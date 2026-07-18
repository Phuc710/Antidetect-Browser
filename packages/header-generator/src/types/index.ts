import type {
    SUPPORTED_BROWSERS,
    SUPPORTED_DEVICES,
    SUPPORTED_HTTP_VERSIONS,
    SUPPORTED_OPERATING_SYSTEMS,
    MISSING_VALUE_DATASET_TOKEN,
} from '../constants';

export type HttpVersion = (typeof SUPPORTED_HTTP_VERSIONS)[number];
export type Device = (typeof SUPPORTED_DEVICES)[number];
export type OperatingSystem = (typeof SUPPORTED_OPERATING_SYSTEMS)[number];
export type BrowserName = (typeof SUPPORTED_BROWSERS)[number];

export interface BrowserSpecification {
    name: BrowserName;
    minVersion?: number;
    maxVersion?: number;
    httpVersion?: HttpVersion;
}

export type BrowsersType = (BrowserSpecification | BrowserName)[];

export interface HeaderGeneratorOptions {
    browsers: BrowsersType;
    browserListQuery: string;
    operatingSystems: OperatingSystem[];
    devices: Device[];
    locales: string[];
    httpVersion: HttpVersion;
    strict: boolean;
}

export interface HttpBrowserObject {
    name: BrowserName | typeof MISSING_VALUE_DATASET_TOKEN;
    version: number[];
    completeString: string;
    httpVersion: HttpVersion;
}

export type Headers = Record<string, string>;
