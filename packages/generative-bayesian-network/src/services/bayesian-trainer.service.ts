import AdmZip = require('adm-zip');

import { BayesianNode } from '../bayesian-node';
import { RecordList } from '../types';

export function setNetworkProbabilities(
    nodesInSamplingOrder: BayesianNode[],
    nodesByName: Record<string, BayesianNode>,
    data: RecordList,
) {
    nodesInSamplingOrder.forEach((node, i) => {
        // eslint-disable-next-line no-console
        console.log(
            `${i}/${nodesInSamplingOrder.length} Setting probabilities for node ${node.name}`,
        );
        const possibleParentValues: Record<string, string[]> = {};
        for (const parentName of node.parentNames) {
            possibleParentValues[parentName] =
                nodesByName[parentName].possibleValues;
        }
        node.setProbabilitiesAccordingToData(data, possibleParentValues);
    });
}

export function saveNetworkDefinition(
    nodesInSamplingOrder: BayesianNode[],
    path: string,
) {
    const network = {
        nodes: nodesInSamplingOrder,
    };

    const zip = new AdmZip();

    zip.addFile('network.json', Buffer.from(JSON.stringify(network), 'utf8'));
    zip.writeZip(path);
}
