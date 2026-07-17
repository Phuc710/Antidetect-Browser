import { readFileSync } from 'fs';

import { BayesianNetwork, utils } from 'generative-bayesian-network';
import ow from 'ow';

import {
    SUPPORTED_BROWSERS,
    BROWSER_HTTP_NODE_NAME,
    MISSING_VALUE_DATASET_TOKEN,
    OPERATING_SYSTEM_NODE_NAME,
    DEVICE_NODE_NAME,
    SUPPORTED_OPERATING_SYSTEMS,
    HTTP1_SEC_FETCH_ATTRIBUTES,
    HTTP2_SEC_FETCH_ATTRIBUTES,
} from '../constants';
import {
    getBrowser,
    getUserAgent,
    getBrowsersFromQuery,
    shuffleArray,
} from '../utils';

import { headerGeneratorOptionsShape } from '../validators';

import {
    HttpVersion,
    OperatingSystem,
    BrowserSpecification,
    BrowsersType,
    HeaderGeneratorOptions,
    HttpBrowserObject,
    Headers,
} from '../types';

let cachedHeadersOrder: string[] | undefined;
let cachedUniqueBrowsers: HttpBrowserObject[] | undefined;
let cachedInputGeneratorNetwork: BayesianNetwork | undefined;
let cachedHeaderGeneratorNetwork: BayesianNetwork | undefined;

export class HeaderGenerator {
    globalOptions: HeaderGeneratorOptions;

    browserListQuery: string | undefined;

    private inputGeneratorNetwork: any;

    private headerGeneratorNetwork: any;

    private uniqueBrowsers: HttpBrowserObject[];

    private headersOrder: string[];

    private relaxationOrder: (keyof typeof headerGeneratorOptionsShape)[] = [
        'locales',
        'devices',
        'operatingSystems',
        'browsers',
        'browserListQuery',
    ];

    constructor(options: Partial<HeaderGeneratorOptions> = {}) {
        ow(
            options,
            'HeaderGeneratorOptions',
            ow.object.partialShape(headerGeneratorOptionsShape),
        );

        const {
            browsers = SUPPORTED_BROWSERS,
            operatingSystems = SUPPORTED_OPERATING_SYSTEMS as unknown as OperatingSystem[],
            devices = ['desktop'],
            locales = ['en-US'],
            httpVersion = '2',
            browserListQuery = '',
            strict = false,
        } = options;
        this.globalOptions = {
            browsers: this._prepareBrowsersConfig(
                browsers as BrowsersType,
                browserListQuery,
                httpVersion,
            ),
            operatingSystems,
            devices,
            locales,
            httpVersion,
            browserListQuery,
            strict,
        };

        if (!cachedHeadersOrder) {
            cachedHeadersOrder = JSON.parse(
                readFileSync(
                    `${__dirname}/../data_files/headers-order.json`,
                ).toString(),
            );
        }
        this.headersOrder = cachedHeadersOrder!;

        if (!cachedUniqueBrowsers) {
            const uniqueBrowserStrings = JSON.parse(
                readFileSync(
                    `${__dirname}/../data_files/browser-helper-file.json`,
                    'utf8',
                ).toString(),
            );
            cachedUniqueBrowsers = [];
            for (const browserString of uniqueBrowserStrings) {
                if (browserString !== MISSING_VALUE_DATASET_TOKEN) {
                    cachedUniqueBrowsers.push(
                        this.prepareHttpBrowserObject(browserString),
                    );
                }
            }
        }
        this.uniqueBrowsers = cachedUniqueBrowsers;

        if (!cachedInputGeneratorNetwork) {
            cachedInputGeneratorNetwork = new BayesianNetwork({
                path: `${__dirname}/../data_files/input-network-definition.zip`,
            });
        }
        this.inputGeneratorNetwork = cachedInputGeneratorNetwork;

        if (!cachedHeaderGeneratorNetwork) {
            cachedHeaderGeneratorNetwork = new BayesianNetwork({
                path: `${__dirname}/../data_files/header-network-definition.zip`,
            });
        }
        this.headerGeneratorNetwork = cachedHeaderGeneratorNetwork;
    }

    getHeaders(
        options: Partial<HeaderGeneratorOptions> = {},
        requestDependentHeaders: Headers = {},
        userAgentValues?: string[],
    ): Headers {
        ow(
            options,
            'HeaderGeneratorOptions',
            ow.object.partialShape(headerGeneratorOptionsShape),
        );

        for (const [key, value] of Object.entries(options)) {
            if (!value) {
                delete options[key as keyof typeof options];
            }
        }

        const headerOptions = { ...this.globalOptions, ...options };
        const possibleAttributeValues =
            this._getPossibleAttributeValues(headerOptions);

        const [http1Constraints, http2Constraints] = userAgentValues
            ? [
                  utils.getConstraintClosure(this.headerGeneratorNetwork, {
                      'User-Agent': userAgentValues,
                  }),
                  utils.getConstraintClosure(this.headerGeneratorNetwork, {
                      'user-agent': userAgentValues,
                  }),
              ]
            : [null, null];

        const inputConstraints = Object.entries(possibleAttributeValues).reduce(
            (acc, [key, value]) => {
                if (key === '*BROWSER_HTTP') {
                    acc[key] = value.filter((x: string) => {
                        const [browserName, httpVersion] = x.split('|');
                        let httpValues = http2Constraints;

                        if (
                            httpVersion === '1' ||
                            !http2Constraints ||
                            Object.keys(http2Constraints).length === 0
                        ) {
                            httpValues = http1Constraints;
                        }

                        return (
                            httpValues?.['*BROWSER'].includes(browserName) ??
                            true
                        );
                    });
                    return acc;
                }
                acc[key] = value.filter(
                    (x: string) =>
                        (http1Constraints?.[key]?.includes(x) ||
                            http2Constraints?.[key]?.includes(x)) ??
                        true,
                );
                return acc;
            },
            {} as typeof possibleAttributeValues,
        );

        const inputSample =
            this.inputGeneratorNetwork.generateConsistentSampleWhenPossible(
                inputConstraints,
            );

        if (Object.keys(inputSample).length === 0) {
            // Try to convert HTTP/2 headers to HTTP/1 headers
            if (headerOptions.httpVersion === '1') {
                const headers2 = this.getHeaders(
                    {
                        ...options,
                        httpVersion: '2',
                    },
                    requestDependentHeaders,
                    userAgentValues,
                );

                const pascalize = (name: string) => {
                    return name
                        .split('-')
                        .map((part) => {
                            return (
                                part[0]!.toUpperCase() +
                                part.slice(1).toLowerCase()
                            );
                        })
                        .join('-');
                };

                const converted2to1 = Object.fromEntries(
                    Object.entries(headers2).map(([name, value]) => {
                        if (name.startsWith('sec-ch-ua')) {
                            return [name, value];
                        }
                        if (['dnt', 'rtt', 'ect'].includes(name)) {
                            return [name.toUpperCase(), value];
                        }
                        return [pascalize(name), value];
                    }),
                );

                return this.orderHeaders(converted2to1);
            }

            const relaxationIndex = this.relaxationOrder.findIndex(
                (key) => options[key] !== undefined,
            );
            if (options.strict || relaxationIndex === -1) {
                throw new Error(
                    'No headers based on this input can be generated. Please relax or change some of the requirements you specified.',
                );
            }

            // Relax the requirements and try again
            const relaxedOptions = { ...options };
            const relaxationKey = this.relaxationOrder[relaxationIndex];
            delete relaxedOptions[relaxationKey];
            return this.getHeaders(
                relaxedOptions,
                requestDependentHeaders,
                userAgentValues,
            );
        }

        const generatedSample =
            this.headerGeneratorNetwork.generateSample(inputSample);

        // Manually fill the accept-language header with random ordering of the locales from input
        const generatedHttpAndBrowser = this.prepareHttpBrowserObject(
            generatedSample[BROWSER_HTTP_NODE_NAME],
        );
        let secFetchAttributeNames:
            | typeof HTTP2_SEC_FETCH_ATTRIBUTES
            | typeof HTTP1_SEC_FETCH_ATTRIBUTES = HTTP2_SEC_FETCH_ATTRIBUTES;
        let acceptLanguageFieldName = 'accept-language';
        if (generatedHttpAndBrowser.httpVersion !== '2') {
            acceptLanguageFieldName = 'Accept-Language';
            secFetchAttributeNames = HTTP1_SEC_FETCH_ATTRIBUTES;
        }

        generatedSample[acceptLanguageFieldName] = this._getAcceptLanguageField(
            headerOptions.locales,
        );

        const isChrome = generatedHttpAndBrowser.name === 'chrome';
        const isFirefox = generatedHttpAndBrowser.name === 'firefox';
        const isEdge = generatedHttpAndBrowser.name === 'edge';

        const hasSecFetch =
            (isChrome && generatedHttpAndBrowser.version[0] >= 76) ||
            (isFirefox && generatedHttpAndBrowser.version[0] >= 90) ||
            (isEdge && generatedHttpAndBrowser.version[0] >= 79);

        if (hasSecFetch) {
            generatedSample[secFetchAttributeNames.site] = 'same-site';
            generatedSample[secFetchAttributeNames.mode] = 'navigate';
            generatedSample[secFetchAttributeNames.user] = '?1';
            generatedSample[secFetchAttributeNames.dest] = 'document';
        }

        for (const attribute of Object.keys(generatedSample)) {
            if (
                attribute.toLowerCase() === 'connection' &&
                generatedSample[attribute] === 'close'
            )
                delete generatedSample[attribute];
            if (
                attribute.startsWith('*') ||
                generatedSample[attribute] === MISSING_VALUE_DATASET_TOKEN
            )
                delete generatedSample[attribute];
        }

        return this.orderHeaders(
            {
                ...generatedSample,
                ...requestDependentHeaders,
            },
            (this.headersOrder as Record<string, any>)[
                generatedHttpAndBrowser.name
            ],
        );
    }

    orderHeaders(
        headers: Headers,
        order = this.getOrderFromUserAgent(headers),
    ): Headers {
        const orderedSample: Headers = {};

        for (const attribute of order) {
            if (attribute in headers) {
                orderedSample[attribute] = headers[attribute];
            }
        }

        for (const attribute of Object.keys(headers)) {
            if (!order.includes(attribute)) {
                orderedSample[attribute] = headers[attribute];
            }
        }

        return orderedSample;
    }

    private _prepareBrowsersConfig(
        browsers?: BrowsersType,
        browserListQuery?: string,
        httpVersion?: HttpVersion,
    ): BrowserSpecification[] {
        let finalBrowsers = browsers;

        if (browserListQuery) {
            finalBrowsers = getBrowsersFromQuery(browserListQuery);
        }

        return finalBrowsers!.map((browser) => {
            if (typeof browser === 'string') {
                return { name: browser, httpVersion };
            }

            browser.httpVersion = httpVersion;
            return browser;
        });
    }

    private _getBrowserHttpOptions(browsers: BrowserSpecification[]): string[] {
        const browserHttpOptions = [];
        for (const browser of browsers) {
            for (const browserOption of this.uniqueBrowsers) {
                if (browser.name === browserOption.name) {
                    const browserMajorVersion = browserOption.version[0];

                    if (
                        (!browser.minVersion ||
                            browser.minVersion <= browserMajorVersion) &&
                        (!browser.maxVersion ||
                            browser.maxVersion >= browserMajorVersion) &&
                        browser.httpVersion === browserOption.httpVersion
                    ) {
                        browserHttpOptions.push(browserOption.completeString);
                    }
                }
            }
        }

        return browserHttpOptions;
    }

    private _getPossibleAttributeValues(
        headerOptions: Partial<HeaderGeneratorOptions>,
    ): Record<string, any> {
        const {
            browsers: optionsBrowser,
            browserListQuery,
            httpVersion,
            operatingSystems,
        } = headerOptions;
        const browsers = this._prepareBrowsersConfig(
            optionsBrowser,
            browserListQuery,
            httpVersion,
        );

        const browserHttpOptions = this._getBrowserHttpOptions(browsers);
        const possibleAttributeValues: Record<string, any> = {};

        possibleAttributeValues[BROWSER_HTTP_NODE_NAME] = browserHttpOptions;

        possibleAttributeValues[OPERATING_SYSTEM_NODE_NAME] = operatingSystems;

        if (headerOptions.devices) {
            possibleAttributeValues[DEVICE_NODE_NAME] = headerOptions.devices;
        }

        return possibleAttributeValues;
    }

    private _getAcceptLanguageField(
        localesFromOptions: HeaderGeneratorOptions['locales'],
    ): string {
        let locales = localesFromOptions;
        let highLevelLocales = [];
        for (const locale of locales) {
            if (!locale.includes('-')) {
                highLevelLocales.push(locale);
            }
        }

        for (const locale of locales) {
            if (!highLevelLocales.includes(locale)) {
                let highLevelEquivalentPresent = false;
                for (const highLevelLocale of highLevelLocales) {
                    if (locale.includes(highLevelLocale)) {
                        highLevelEquivalentPresent = true;
                        break;
                    }
                }
                if (!highLevelEquivalentPresent) highLevelLocales.push(locale);
            }
        }

        highLevelLocales = shuffleArray(highLevelLocales);
        locales = shuffleArray(locales);

        const localesInAddingOrder = [];

        for (const highLevelLocale of highLevelLocales) {
            for (const locale of locales) {
                if (
                    locale.includes(highLevelLocale) &&
                    !highLevelLocales.includes(locale)
                ) {
                    localesInAddingOrder.push(locale);
                }
            }
            localesInAddingOrder.push(highLevelLocale);
        }

        let acceptLanguageFieldValue = localesInAddingOrder[0];

        for (let x = 1; x < localesInAddingOrder.length; x++) {
            acceptLanguageFieldValue += `,${localesInAddingOrder[x]};q=${1 - x * 0.1}`;
        }
        return acceptLanguageFieldValue;
    }

    private prepareHttpBrowserObject(
        httpBrowserString: string,
    ): HttpBrowserObject {
        const [browserString, httpVersion] = httpBrowserString.split('|');
        let browserObject;

        if (browserString === MISSING_VALUE_DATASET_TOKEN) {
            browserObject = { name: MISSING_VALUE_DATASET_TOKEN };
        } else {
            browserObject = this.prepareBrowserObject(browserString);
        }

        return {
            ...browserObject,
            httpVersion: httpVersion as HeaderGeneratorOptions['httpVersion'],
            completeString: httpBrowserString,
        } as HttpBrowserObject;
    }

    private prepareBrowserObject(browserString: string): HttpBrowserObject {
        const nameVersionSplit = browserString.split('/');
        const versionSplit = nameVersionSplit[1].split('.');
        const preparedVersion = [];
        for (const versionPart of versionSplit) {
            preparedVersion.push(parseInt(versionPart, 10));
        }

        return {
            name: nameVersionSplit[0],
            version: preparedVersion,
            completeString: browserString,
        } as HttpBrowserObject;
    }

    private getOrderFromUserAgent(headers: Record<string, string>): string[] {
        const userAgent = getUserAgent(headers);
        const browser = getBrowser(userAgent);

        if (!browser) {
            return [];
        }

        return (this.headersOrder as Record<string, any>)[browser] ?? [];
    }
}
