import { tmpdir } from 'os';
import { join } from 'path';

export const app = {
  getPath: (_name: string): string => join(tmpdir(), 'fingerprint-suite-electron-test'),
  getAppPath: (): string => process.cwd(),
  isPackaged: false,
};
