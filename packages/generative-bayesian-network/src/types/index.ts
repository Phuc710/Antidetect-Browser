export type RecordList = Array<Record<string, string>>;

export type ConditionalProbabilities = Record<string, number> & {
    deeper: Record<string, ConditionalProbabilities>;
    skip: ConditionalProbabilities;
};

export interface NodeDefinition {
    name: string;
    parentNames: string[];
    possibleValues: string[];
    conditionalProbabilities: ConditionalProbabilities;
}
