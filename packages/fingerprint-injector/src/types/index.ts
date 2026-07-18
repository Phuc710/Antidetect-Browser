import type { Fingerprint } from 'fingerprint-generator';

export interface EnhancedFingerprint extends Fingerprint {
    userAgent: string;
    historyLength: number;
}
