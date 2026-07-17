import type { BayesianNetwork } from '../bayesian-network';

export function arrayIntersection<T>(a: T[], b: T[]): T[] {
    return a.filter((x) => b.includes(x));
}

export function arrayUnion<T>(a: T[], b: T[]): T[] {
    return [...a, ...b.filter((x) => !a.includes(x))];
}

export function arrayZip<T>(
    a: T[][],
    b: T[][],
    f: (aEl: T[], bEl: T[]) => T[],
): T[][] {
    return a.map((x, i) => f(x, b[i]));
}

/**
 * Computes the constraint closure: propagates user-specified node constraints
 * to prune compatible values for all parent nodes in the network.
 */
export function getConstraintClosure(
    network: BayesianNetwork,
    possibleValues: Record<string, string[]>,
) {
    // Flattens the "deeper/skip" CPT tree structure into a plain key->value map.
    function undeeper(obj: Record<string, any>) {
        if (typeof obj !== 'object' || obj === null) return obj;

        const result: Record<string, any> = {};
        for (const key of Object.keys(obj)) {
            if (key === 'skip') continue;
            if (key === 'deeper') {
                Object.assign(result, undeeper(obj[key]));
                continue;
            }
            result[key] = undeeper(obj[key]);
        }
        return result;
    }

    function filterByLastLevelKeys(
        tree: Record<string, any>,
        validKeys: string[],
    ) {
        let foundPaths: string[][] = [];
        const dfs = (t: Record<string, any>, acc: string[]) => {
            for (const key of Object.keys(t)) {
                if (typeof t[key] !== 'object' || !t[key]) {
                    if (validKeys.includes(key)) {
                        foundPaths =
                            foundPaths.length === 0
                                ? acc.map((x) => [x])
                                : arrayZip(
                                      foundPaths,
                                      acc.map((x) => [x]),
                                      (a, b) => [...new Set([...a, ...b])],
                                  );
                    }
                    continue;
                } else {
                    dfs(t[key], [...acc, key]);
                }
            }
        };
        dfs(tree, []);
        return foundPaths;
    }

    const sets = [];

    let foundMatchingValues = false;

    // For every pre-specified node, compute the "closure" for values of the other nodes.
    for (const key of Object.keys(possibleValues)) {
        if (!Array.isArray(possibleValues[key])) continue;
        if (possibleValues[key].length === 0) {
            throw new Error(`The current constraints are too restrictive. 
No possible values can be found for the given constraints.`);
        }
        // eslint-disable-next-line
        const node = network['nodesByName'][key]['nodeDefinition'];
        const tree = undeeper(node.conditionalProbabilities);
        const zippedValues = filterByLastLevelKeys(tree, possibleValues[key]);

        if (zippedValues.length > 0) {
            foundMatchingValues = true;
        }
        sets.push({
            ...Object.fromEntries(
                zippedValues.map((x, i) => [node.parentNames[i], x]),
            ),
            [key]: possibleValues[key],
        });
    }

    if (!foundMatchingValues) {
        return {};
    }

    return sets.reduce((acc, x) => {
        for (const key of Object.keys(x)) {
            acc[key] = acc[key] ? arrayIntersection(acc[key], x[key]) : x[key];
            if (acc[key].length === 0) {
                throw new Error(`The current constraints are too restrictive. 
No possible values can be found for the given constraints.`);
            }
        }
        return acc;
    }, {});
}
