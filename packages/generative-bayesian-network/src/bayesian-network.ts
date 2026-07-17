import AdmZip = require('adm-zip');

import { BayesianNode } from './bayesian-node';
import {
    setNetworkProbabilities,
    saveNetworkDefinition,
} from './services/bayesian-trainer.service';

import { RecordList } from './types';

export class BayesianNetwork {
    private nodesInSamplingOrder: BayesianNode[] = [];
    private nodesByName: Record<string, BayesianNode> = {};

    constructor({ path }: { path: string }) {
        const zip = new AdmZip(path);
        const zipEntries = zip.getEntries();

        const networkDefinition = JSON.parse(
            zipEntries[0].getData().toString('utf8'),
        );
        this.nodesInSamplingOrder = networkDefinition.nodes.map(
            (nodeDefinition: any) => new BayesianNode(nodeDefinition),
        );

        this.nodesByName = this.nodesInSamplingOrder.reduce(
            (p, node) => ({
                ...p,
                [node.name]: node,
            }),
            {},
        );
    }

    generateSample(inputValues: Record<string, string> = {}) {
        const sample = inputValues;
        for (const node of this.nodesInSamplingOrder) {
            if (!(node.name in sample)) {
                sample[node.name] = node.sample(sample);
            }
        }
        return sample;
    }

    generateConsistentSampleWhenPossible(
        valuePossibilities: Record<string, string[]>,
    ) {
        return this.recursivelyGenerateConsistentSampleWhenPossible(
            {},
            valuePossibilities,
            0,
        );
    }

    private recursivelyGenerateConsistentSampleWhenPossible(
        sampleSoFar: Record<string, string>,
        valuePossibilities: Record<string, string[]>,
        depth: number,
    ): Record<string, string> {
        const bannedValues: string[] = [];
        const node = this.nodesInSamplingOrder[depth];
        let sampleValue;

        do {
            sampleValue = node.sampleAccordingToRestrictions(
                sampleSoFar,
                valuePossibilities[node.name],
                bannedValues,
            );
            if (!sampleValue) break;

            sampleSoFar[node.name] = sampleValue;

            if (depth + 1 < this.nodesInSamplingOrder.length) {
                const sample =
                    this.recursivelyGenerateConsistentSampleWhenPossible(
                        sampleSoFar,
                        valuePossibilities,
                        depth + 1,
                    );
                if (Object.keys(sample).length !== 0) {
                    return sample;
                }
            } else {
                return sampleSoFar;
            }

            bannedValues.push(sampleValue);
        } while (sampleValue);

        return {};
    }

    setProbabilitiesAccordingToData(data: RecordList) {
        setNetworkProbabilities(
            this.nodesInSamplingOrder,
            this.nodesByName,
            data,
        );
    }

    saveNetworkDefinition({ path }: { path: string }) {
        saveNetworkDefinition(this.nodesInSamplingOrder, path);
    }
}
