import fs from 'fs';
import path from 'path';

import { BayesianNetwork } from 'generative-bayesian-network';
import { prepareRecords } from '../utils';
import {
    BROWSER_HTTP_NODE_NAME,
    BROWSER_NODE_NAME,
    OPERATING_SYSTEM_NODE_NAME,
    DEVICE_NODE_NAME,
    MISSING_VALUE_DATASET_TOKEN,
    NON_GENERATED_NODES,
    STRINGIFIED_PREFIX,
    PLUGIN_CHARACTERISTICS_ATTRIBUTES,
    HTTP_VERSION_NODE_NAME,
} from '../constants';

export class GeneratorNetworksCreator {
    private getDeviceOS(userAgent: string): {
        device: string;
        operatingSystem: string;
    } {
        let operatingSystem = MISSING_VALUE_DATASET_TOKEN as string;
        if (/windows/i.test(userAgent)) {
            operatingSystem = 'windows';
        }
        let device = 'desktop';
        if (/phone|android|mobile/i.test(userAgent)) {
            device = 'mobile';
            if (/iphone|mac/i.test(userAgent)) {
                operatingSystem = 'ios';
            } else if (/android/i.test(userAgent)) {
                operatingSystem = 'android';
            }
        } else if (/linux/i.test(userAgent)) {
            operatingSystem = 'linux';
        } else if (/mac/i.test(userAgent)) {
            operatingSystem = 'macos';
        }

        return { device, operatingSystem };
    }

    private getBrowserNameVersion(
        userAgent: string,
    ): `${string}/${string}` | typeof MISSING_VALUE_DATASET_TOKEN {
        const canonicalNames = {
            chrome: 'chrome',
            crios: 'chrome',
            firefox: 'firefox',
            fxios: 'firefox',
            safari: 'safari',
            edge: 'edge',
            edg: 'edge',
            edga: 'edge',
            edgios: 'edge',
        } as Record<string, string>;

        const unsupportedBrowsers =
            /opr|yabrowser|SamsungBrowser|UCBrowser|vivaldi/i;
        const edge = /(edg(a|ios|e)?)\/([0-9.]*)/i;
        const safari = /Version\/([\d.]+)( Mobile\/[a-z0-9]+)? Safari/i;
        const supportedBrowsers =
            /(firefox|fxios|chrome|crios|safari)\/([0-9.]*)/i;

        if (unsupportedBrowsers.test(userAgent)) {
            return MISSING_VALUE_DATASET_TOKEN;
        }

        if (edge.test(userAgent)) {
            const match = userAgent.match(edge)![0].split('/');
            return `edge/${match[1]}`;
        }

        if (safari.test(userAgent)) {
            const match = userAgent.match(safari);
            return `safari/${match![1]}`;
        }

        if (supportedBrowsers.test(userAgent)) {
            const match = userAgent.match(supportedBrowsers)![0].split('/');
            return `${canonicalNames[match[0].toLowerCase()]}/${match[1]}`;
        }

        return MISSING_VALUE_DATASET_TOKEN;
    }

    async prepareHeaderGeneratorFiles(
        datasetPath: string,
        resultsPath: string,
    ) {
        const datasetText = fs.readFileSync(datasetPath, { encoding: 'utf8' });
        const records = await prepareRecords(
            JSON.parse(datasetText),
            'headers',
        );

        const inputGeneratorNetwork = new BayesianNetwork({
            path: path.join(
                __dirname,
                '..',
                'network_structures',
                'input-network-structure.zip',
            ),
        });
        const headerGeneratorNetwork = new BayesianNetwork({
            path: path.join(
                __dirname,
                '..',
                'network_structures',
                'header-network-structure.zip',
            ),
        });
        // eslint-disable-next-line dot-notation
        const desiredHeaderAttributes = Object.keys(
            headerGeneratorNetwork['nodesByName'],
        ).filter(
            (attribute) =>
                !(NON_GENERATED_NODES as unknown as string[]).includes(
                    attribute,
                ),
        );

        let selectedRecords = records.map((record) => {
            return Object.entries(record).reduce(
                (acc: typeof record, [key, value]) => {
                    if (desiredHeaderAttributes.includes(key))
                        acc[key] = value ?? MISSING_VALUE_DATASET_TOKEN;
                    return acc;
                },
                {},
            );
        });

        selectedRecords = selectedRecords.map((record) => {
            const userAgent = (
                record['user-agent'] !== MISSING_VALUE_DATASET_TOKEN
                    ? record['user-agent']
                    : record['User-Agent']
            ).toLowerCase();

            const browser = this.getBrowserNameVersion(userAgent);
            const { device, operatingSystem } = this.getDeviceOS(userAgent);

            return {
                ...record,
                [BROWSER_NODE_NAME]: browser,
                [OPERATING_SYSTEM_NODE_NAME]: operatingSystem,
                [DEVICE_NODE_NAME]: device,
                [BROWSER_HTTP_NODE_NAME]: `${browser}|${
                    (record[HTTP_VERSION_NODE_NAME] as string).startsWith('_1')
                        ? '1'
                        : '2'
                }`,
            };
        });

        headerGeneratorNetwork.setProbabilitiesAccordingToData(selectedRecords);
        inputGeneratorNetwork.setProbabilitiesAccordingToData(selectedRecords);

        const inputNetworkDefinitionPath = path.join(
            resultsPath,
            'input-network-definition.zip',
        );
        const headerNetworkDefinitionPath = path.join(
            resultsPath,
            'header-network-definition.zip',
        );
        const browserHelperFilePath = path.join(
            resultsPath,
            'browser-helper-file.json',
        );

        headerGeneratorNetwork.saveNetworkDefinition({
            path: headerNetworkDefinitionPath,
        });
        inputGeneratorNetwork.saveNetworkDefinition({
            path: inputNetworkDefinitionPath,
        });

        const uniqueBrowsersAndHttps = Array.from(
            new Set(
                selectedRecords.map((record) => record[BROWSER_HTTP_NODE_NAME]),
            ),
        );
        fs.writeFileSync(
            browserHelperFilePath,
            JSON.stringify(uniqueBrowsersAndHttps),
        );
    }

    async prepareFingerprintGeneratorFiles(
        datasetPath: string,
        resultsPath: string,
    ) {
        const datasetText = fs
            .readFileSync(datasetPath, { encoding: 'utf8' })
            .replace(/^\ufeff/, '');
        const records = await prepareRecords(
            JSON.parse(datasetText),
            'fingerprints',
        );
        for (let x = 0; x < records.length; x++) {
            // eslint-disable-next-line no-console
            if (x % 1000 === 0)
                console.log(`Processing record ${x} of ${records.length}`);
            const record = records[x];
            const pluginCharacteristics = {} as { [key: string]: string };
            for (const pluginCharacteristicsAttribute of PLUGIN_CHARACTERISTICS_ATTRIBUTES) {
                if (pluginCharacteristicsAttribute in record) {
                    if (record[pluginCharacteristicsAttribute] !== '') {
                        pluginCharacteristics[pluginCharacteristicsAttribute] =
                            record[pluginCharacteristicsAttribute];
                    }
                    delete record[pluginCharacteristicsAttribute];
                }
            }

            record.pluginsData =
                Object.keys(pluginCharacteristics).length !== 0
                    ? pluginCharacteristics
                    : MISSING_VALUE_DATASET_TOKEN;

            for (const attribute of Object.keys(record)) {
                if ([null, '', undefined].includes(record[attribute])) {
                    record[attribute] = MISSING_VALUE_DATASET_TOKEN;
                } else {
                    record[attribute] =
                        typeof record[attribute] === 'string' ||
                        record[attribute] instanceof String
                            ? record[attribute]
                            : STRINGIFIED_PREFIX +
                              JSON.stringify(record[attribute]);
                }
            }

            records[x] = record;
        }

        const fingerprintGeneratorNetwork = new BayesianNetwork({
            path: path.join(
                __dirname,
                '..',
                'network_structures',
                'fingerprint-network-structure.zip',
            ),
        });
        // eslint-disable-next-line dot-notation
        const desiredFingerprintAttributes = Object.keys(
            fingerprintGeneratorNetwork['nodesByName'],
        );

        const selectedRecords = records.map((record) => {
            return Object.entries(record).reduce(
                (acc: typeof record, [key, value]) => {
                    if (desiredFingerprintAttributes.includes(key))
                        acc[key] = value ?? MISSING_VALUE_DATASET_TOKEN;
                    return acc;
                },
                {},
            );
        });

        const fingerprintNetworkDefinitionPath = path.join(
            resultsPath,
            'fingerprint-network-definition.zip',
        );

        // eslint-disable-next-line no-console
        console.log('Building the fingerprint network...');
        fingerprintGeneratorNetwork.setProbabilitiesAccordingToData(
            selectedRecords,
        );
        fingerprintGeneratorNetwork.saveNetworkDefinition({
            path: fingerprintNetworkDefinitionPath,
        });
    }
}
