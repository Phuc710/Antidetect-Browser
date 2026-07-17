import ow from 'ow';

import {
    SUPPORTED_BROWSERS,
    SUPPORTED_OPERATING_SYSTEMS,
    SUPPORTED_DEVICES,
    SUPPORTED_HTTP_VERSIONS,
} from '../constants';

export const browserSpecificationShape = {
    name: ow.string,
    minVersion: ow.optional.number,
    maxVersion: ow.optional.number,
    httpVersion: ow.optional.string,
};

export const headerGeneratorOptionsShape = {
    browsers: ow.optional.array.ofType(
        ow.any(
            ow.object.exactShape(browserSpecificationShape),
            ow.string.oneOf(SUPPORTED_BROWSERS),
        ),
    ),
    operatingSystems: ow.optional.array.ofType(
        ow.string.oneOf(SUPPORTED_OPERATING_SYSTEMS),
    ),
    devices: ow.optional.array.ofType(ow.string.oneOf(SUPPORTED_DEVICES)),
    locales: ow.optional.array.ofType(ow.string),
    httpVersion: ow.optional.string.oneOf(SUPPORTED_HTTP_VERSIONS),
    browserListQuery: ow.optional.string,
    strict: ow.optional.boolean,
};
