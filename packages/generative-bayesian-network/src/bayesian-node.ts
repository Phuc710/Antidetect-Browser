import { RecordList, NodeDefinition } from './types';

function getRelativeFrequencies(
    data: RecordList,
    attributeName: keyof RecordList[number],
) {
    const frequencies: Record<string, number> = {};
    const totalCount = data.length;

    data.forEach((record) => {
        const value = record[attributeName];
        frequencies[value] = (frequencies[value] ?? 0) + 1;
    });

    return Object.fromEntries(
        Object.entries(frequencies).map(([key, value]) => [
            key,
            value / totalCount,
        ]),
    );
}

export class BayesianNode {
    private nodeDefinition: NodeDefinition;

    constructor(nodeDefinition: NodeDefinition) {
        this.nodeDefinition = nodeDefinition;
    }

    toJSON() {
        return this.nodeDefinition;
    }

    /**
     * Traverses the CPT tree using known parent values to reach leaf-level probabilities.
     * Falls back to `probabilities.skip` when a parent value is not present in the tree.
     */
    private getProbabilitiesGivenKnownValues(
        parentValues: Record<string, string> = {},
    ) {
        let probabilities = this.nodeDefinition.conditionalProbabilities;

        for (const parentName of this.parentNames) {
            const parentValue = parentValues[parentName];
            if (parentValue in probabilities.deeper) {
                probabilities = probabilities.deeper[parentValue];
            } else {
                probabilities = probabilities.skip;
            }
        }
        return probabilities;
    }

    private sampleRandomValueFromPossibilities(
        possibleValues: string[],
        totalProbabilityOfPossibleValues: number,
        probabilities: Record<string, number>,
    ) {
        let chosenValue = possibleValues[0];
        const anchor = Math.random() * totalProbabilityOfPossibleValues;
        let cumulativeProbability = 0;
        for (const possibleValue of possibleValues) {
            cumulativeProbability += probabilities[possibleValue];
            if (cumulativeProbability > anchor) {
                chosenValue = possibleValue;
                break;
            }
        }

        return chosenValue;
    }

    sample(parentValues = {}) {
        const probabilities =
            this.getProbabilitiesGivenKnownValues(parentValues);
        const possibleValues = Object.keys(probabilities);

        return this.sampleRandomValueFromPossibilities(
            possibleValues,
            1.0,
            probabilities,
        );
    }

    sampleAccordingToRestrictions(
        parentValues: Record<string, string>,
        valuePossibilities: string[],
        bannedValues: string[],
    ): string | false {
        const probabilities =
            this.getProbabilitiesGivenKnownValues(parentValues);
        let totalProbability = 0.0;
        const validValues = [];
        const valuesInDistribution = Object.keys(probabilities);
        const possibleValues = valuePossibilities || valuesInDistribution;
        for (const value of possibleValues) {
            if (
                !bannedValues.includes(value) &&
                valuesInDistribution.includes(value)
            ) {
                validValues.push(value);
                totalProbability += probabilities[value];
            }
        }

        if (validValues.length === 0) return false;
        return this.sampleRandomValueFromPossibilities(
            validValues,
            totalProbability,
            probabilities,
        );
    }

    setProbabilitiesAccordingToData(
        data: RecordList,
        possibleParentValues: Record<string, string[]> = {},
    ) {
        this.nodeDefinition.possibleValues = Array.from(
            new Set(data.map((record) => record[this.name])),
        );
        this.nodeDefinition.conditionalProbabilities =
            this.recursivelyCalculateConditionalProbabilitiesAccordingToData(
                data,
                possibleParentValues,
                0,
            );
    }

    private recursivelyCalculateConditionalProbabilitiesAccordingToData(
        data: RecordList,
        possibleParentValues: Record<string, string[]>,
        depth: number,
    ) {
        let probabilities = {
            deeper: {},
        } as any;

        if (depth < this.parentNames.length) {
            const currentParentName = this.parentNames[depth];
            for (const possibleValue of possibleParentValues[
                currentParentName
            ]) {
                const skip = !data
                    .map((record) => record[currentParentName])
                    .includes(possibleValue);
                let filteredData = data;
                if (!skip) {
                    filteredData = data.filter(
                        (record) => record[currentParentName] === possibleValue,
                    );
                }
                const nextLevel =
                    this.recursivelyCalculateConditionalProbabilitiesAccordingToData(
                        filteredData,
                        possibleParentValues,
                        depth + 1,
                    );

                if (!skip) {
                    probabilities.deeper[possibleValue] = nextLevel;
                } else {
                    probabilities.skip = nextLevel;
                }
            }
        } else {
            probabilities = getRelativeFrequencies(data, this.name);
        }

        return probabilities;
    }

    get name(): string {
        return this.nodeDefinition.name;
    }

    get parentNames(): string[] {
        return this.nodeDefinition.parentNames;
    }

    get possibleValues(): string[] {
        return this.nodeDefinition.possibleValues;
    }
}
