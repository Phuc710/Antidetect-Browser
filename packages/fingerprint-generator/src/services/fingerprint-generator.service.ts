import { BayesianNetwork, utils } from 'generative-bayesian-network';
import {
    HeaderGenerator,
    HeaderGeneratorOptions,
    Headers,
} from 'header-generator';

import { MISSING_VALUE_DATASET_TOKEN, STRINGIFIED_PREFIX } from '../constants';

import {
    Fingerprint,
    BrowserFingerprintWithHeaders,
    FingerprintGeneratorOptions,
} from '../types';

/** Module-level cache to avoid re-reading the fingerprint network zip on each instantiation. */
let cachedFingerprintGeneratorNetwork: BayesianNetwork | undefined;

export class FingerprintGenerator extends HeaderGenerator {
    fingerprintGeneratorNetwork: any;

    fingerprintGlobalOptions: Partial<
        Omit<FingerprintGeneratorOptions, keyof HeaderGeneratorOptions>
    >;

    constructor(options: Partial<FingerprintGeneratorOptions> = {}) {
        super(options);
        this.fingerprintGlobalOptions = {
            screen: options.screen,
            mockWebRTC: options.mockWebRTC,
            slim: options.slim,
        };
        if (!cachedFingerprintGeneratorNetwork) {
            cachedFingerprintGeneratorNetwork = new BayesianNetwork({
                path: `${__dirname}/../data_files/fingerprint-network-definition.zip`,
            });
        }
        this.fingerprintGeneratorNetwork = cachedFingerprintGeneratorNetwork;
    }

    /**
     * Generates a browser fingerprint with matching HTTP headers.
     * When `options.screen` is set, triggers constraint propagation (significantly slower ~0.03s/fingerprint vs ~0.0007s).
     */
    getFingerprint(
        options: Partial<FingerprintGeneratorOptions> = {},
        requestDependentHeaders: Headers = {},
    ): BrowserFingerprintWithHeaders {
        const filteredValues: Record<string, string[]> = {};

        for (const [key, value] of Object.entries(options)) {
            if (!value) {
                delete options[key as keyof typeof options];
            }
        }

        options = {
            ...this.fingerprintGlobalOptions,
            ...options,
        };

        const partialCSP = (() => {
            const extensiveScreen =
                options.screen && Object.keys(options.screen).length !== 0;
            const shouldUseExtensiveConstraints = extensiveScreen;

            if (!shouldUseExtensiveConstraints) return undefined;

            filteredValues.screen = extensiveScreen
                ? this.fingerprintGeneratorNetwork.nodesByName.screen.possibleValues.filter(
                      (screenString: string) => {
                          const screen = JSON.parse(
                              screenString.split(STRINGIFIED_PREFIX)[1],
                          );
                          return (
                              screen.width >= (options.screen?.minWidth ?? 0) &&
                              screen.width <=
                                  (options.screen?.maxWidth ?? 1e5) &&
                              screen.height >=
                                  (options.screen?.minHeight ?? 0) &&
                              screen.height <=
                                  (options.screen?.maxHeight ?? 1e5)
                          );
                      },
                  )
                : undefined;

            try {
                return utils.getConstraintClosure(
                    this.fingerprintGeneratorNetwork,
                    filteredValues,
                );
            } catch (e) {
                if (options?.strict) throw e;
                delete filteredValues.screen;
                return undefined;
            }
        })();

        for (let generateRetries = 0; generateRetries < 10; generateRetries++) {
            // Generate headers consistent with the inputs to get input-compatible user-agent and accept-language headers needed later
            const headers = super.getHeaders(
                options,
                requestDependentHeaders,
                partialCSP?.userAgent,
            );
            const userAgent =
                'User-Agent' in headers
                    ? headers['User-Agent']
                    : headers['user-agent'];

            const fingerprint: Record<string, any> =
                this.fingerprintGeneratorNetwork.generateConsistentSampleWhenPossible(
                    {
                        ...filteredValues,
                        userAgent: [userAgent],
                    },
                );

            /* Delete any missing attributes and unpack any object/array-like attributes
             * that have been packed together to make the underlying network simpler
             */
            for (const attribute of Object.keys(fingerprint)) {
                if (fingerprint[attribute] === MISSING_VALUE_DATASET_TOKEN) {
                    fingerprint[attribute] = null;
                } else if (
                    fingerprint[attribute].startsWith(STRINGIFIED_PREFIX)
                ) {
                    fingerprint[attribute] = JSON.parse(
                        fingerprint[attribute].slice(STRINGIFIED_PREFIX.length),
                    );
                }
            }

            if (!fingerprint.screen) continue; // fix? sometimes, fingerprints are generated 90% empty/null. This is just a workaround.

            const acceptLanguageHeaderValue =
                'Accept-Language' in headers
                    ? headers['Accept-Language']
                    : headers['accept-language'];
            const acceptedLanguages = [];
            for (const locale of acceptLanguageHeaderValue.split(',')) {
                acceptedLanguages.push(locale.split(';')[0]);
            }
            fingerprint.languages = acceptedLanguages;

            return {
                fingerprint: {
                    ...this.transformFingerprint(fingerprint),
                    mockWebRTC:
                        options.mockWebRTC ??
                        this.fingerprintGlobalOptions.mockWebRTC ??
                        false,
                    slim:
                        options.slim ??
                        this.fingerprintGlobalOptions.slim ??
                        false,
                },
                headers,
            };
        }

        throw new Error(
            'Failed to generate a consistent fingerprint after 10 attempts',
        );
    }

    private transformFingerprint(
        fingerprint: Record<string, any>,
    ): Fingerprint {
        const {
            userAgent,
            userAgentData,
            doNotTrack,
            appCodeName,
            appName,
            appVersion,
            oscpu,
            webdriver,
            languages,
            platform,
            deviceMemory,
            hardwareConcurrency,
            product,
            productSub,
            vendor,
            vendorSub,
            maxTouchPoints,
            extraProperties,
            screen,
            pluginsData,
            audioCodecs,
            videoCodecs,
            battery,
            videoCard,
            multimediaDevices,
            fonts,
        } = fingerprint;
        const parsedMemory = parseInt(deviceMemory, 10);
        const parsedTouchPoints = parseInt(maxTouchPoints, 10);

        const navigator = {
            userAgent,
            userAgentData,
            language: languages[0],
            languages,
            platform,
            deviceMemory: Number.isNaN(parsedMemory) ? null : parsedMemory, // Firefox does not have deviceMemory available
            hardwareConcurrency: parseInt(hardwareConcurrency, 10),
            maxTouchPoints: Number.isNaN(parsedTouchPoints)
                ? 0
                : parsedTouchPoints,
            product,
            productSub,
            vendor,
            vendorSub,
            doNotTrack,
            appCodeName,
            appName,
            appVersion,
            oscpu,
            extraProperties,
            webdriver,
        };

        return {
            screen,
            navigator,
            audioCodecs,
            videoCodecs,
            pluginsData,
            battery,
            videoCard,
            multimediaDevices,
            fonts,
        } as Fingerprint;
    }
}
