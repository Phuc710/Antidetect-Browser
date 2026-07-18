import type { HeaderGeneratorOptions, Headers } from 'header-generator';

export interface ScreenFingerprint {
    availHeight: number;
    availWidth: number;
    availTop: number;
    availLeft: number;
    colorDepth: number;
    height: number;
    pixelDepth: number;
    width: number;
    devicePixelRatio: number;
    pageXOffset: number;
    pageYOffset: number;
    innerHeight: number;
    outerHeight: number;
    outerWidth: number;
    innerWidth: number;
    screenX: number;
    clientWidth: number;
    clientHeight: number;
    hasHDR: boolean;
}

export interface Brand {
    brand: string;
    version: string;
}

export interface UserAgentData {
    brands: Brand[];
    mobile: boolean;
    platform: string;
    architecture: string;
    bitness: string;
    fullVersionList: Brand[];
    model: string;
    platformVersion: string;
    uaFullVersion: string;
}

export interface ExtraProperties {
    vendorFlavors: string[];
    isBluetoothSupported?: boolean;
    globalPrivacyControl: boolean | null;
    pdfViewerEnabled: boolean;
    installedApps: unknown[];
}

export interface NavigatorFingerprint {
    userAgent: string;
    userAgentData: UserAgentData | null;
    doNotTrack: string | null;
    appCodeName: string;
    appName: string;
    appVersion: string;
    oscpu: string | null;
    webdriver: boolean | string;
    language: string;
    languages: string[];
    platform: string;
    deviceMemory?: number;
    hardwareConcurrency: number;
    product: string;
    productSub: string;
    vendor: string;
    vendorSub: string | null;
    maxTouchPoints?: number;
    extraProperties: ExtraProperties;
}

export interface VideoCard {
    renderer: string;
    vendor: string;
}

export interface Fingerprint {
    screen: ScreenFingerprint;
    navigator: NavigatorFingerprint;
    videoCodecs: Record<string, string>;
    audioCodecs: Record<string, string>;
    pluginsData: Record<string, unknown>;
    battery?: Record<string, string | number | boolean | null>;
    videoCard: VideoCard | null;
    multimediaDevices: Record<string, unknown>;
    fonts: string[];
    mockWebRTC: boolean;
    slim?: boolean;
}

export interface BrowserFingerprintWithHeaders {
    headers: Headers;
    fingerprint: Fingerprint;
}

export interface FingerprintGeneratorOptions extends HeaderGeneratorOptions {
    screen: {
        minWidth?: number;
        maxWidth?: number;
        minHeight?: number;
        maxHeight?: number;
    };
    mockWebRTC?: boolean;
    slim?: boolean;
}
