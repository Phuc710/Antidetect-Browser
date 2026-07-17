import { getRecordSchema } from '../validators';
import {
    MISSING_VALUE_DATASET_TOKEN,
    HTTP_VERSION_NODE_NAME,
} from '../constants';

export async function prepareRecords(
    records: Record<string, any>[],
    preprocessingType: string,
): Promise<Record<string, any>[]> {
    const recordSchema = await getRecordSchema();

    const cleanedRecords = records
        .map((x) => recordSchema.safeParse(x))
        .filter((record) => record.success)
        .map((record) => record.data);

    console.log(
        `Found ${cleanedRecords.length}/${records.length} valid records.`,
    );

    const deconstructedRecords = cleanedRecords
        .map((record) => {
            if (preprocessingType === 'headers') {
                const { httpVersion, headers } = record.requestFingerprint;
                headers[HTTP_VERSION_NODE_NAME] = `_${httpVersion}_`;

                return headers;
            } else {
                return record.browserFingerprint;
            }
        })
        .filter((x) => x);

    const attributes = new Set<keyof (typeof deconstructedRecords)[number]>(
        deconstructedRecords.flatMap((record) =>
            Object.keys(record || {}),
        ) as (keyof (typeof deconstructedRecords)[number])[],
    );

    const reorganizedRecords = deconstructedRecords.map((record) => {
        const reorganizedRecord = {} as Record<string, any>;
        for (const attribute of attributes) {
            reorganizedRecord[attribute] =
                record[attribute] === undefined
                    ? MISSING_VALUE_DATASET_TOKEN
                    : record[attribute];
        }
        return reorganizedRecord;
    });

    return reorganizedRecords;
}
