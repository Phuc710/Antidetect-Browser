import { app } from 'electron';
import { join, resolve, relative, isAbsolute } from 'path';
import fs from 'fs';
import { Logger } from './logger.js';

const logger = new Logger('ProfileStorageResolver');

export class ProfileStorageResolver {
    private readonly rootDir: string;

    constructor(rootDirectory?: string) {
        const userDataPath =
            rootDirectory ?? join(app.getPath('userData'), 'profiles');
        this.rootDir = resolve(userDataPath);

        if (!fs.existsSync(this.rootDir)) {
            fs.mkdirSync(this.rootDir, { recursive: true });
        }
    }

    getRootDirectory(): string {
        return this.rootDir;
    }

    /**
     * Resolve storage key thành đường dẫn vật lý tuyệt đối an toàn.
     * Ngăn chặn hoàn toàn lỗi Path Traversal bảo mật.
     */
    resolvePath(storageKey: string): string {
        if (!storageKey || typeof storageKey !== 'string') {
            throw new Error('INVALID_STORAGE_KEY');
        }

        // 1. Kiểm tra storageKey không chứa path separators hay absolute path
        if (
            storageKey.includes('/') ||
            storageKey.includes('\\') ||
            isAbsolute(storageKey)
        ) {
            logger.error(
                `Path traversal blocked: invalid characters in storageKey=${storageKey}`,
            );
            throw new Error('STORAGE_KEY_INVALID_CHARACTERS');
        }

        const targetPath = resolve(this.rootDir, storageKey);

        // 2. Kiểm tra targetPath phải nằm trong rootDir
        const rel = relative(this.rootDir, targetPath);
        if (rel.startsWith('..') || isAbsolute(rel)) {
            logger.error(
                `Path traversal attempt blocked: key=${storageKey} -> resolved=${targetPath}`,
            );
            throw new Error('STORAGE_KEY_OUT_OF_BOUNDS');
        }

        // 3. Ngăn chặn symlink hướng ra ngoài thư mục quản lý của app
        if (fs.existsSync(targetPath)) {
            try {
                const stat = fs.lstatSync(targetPath);
                if (stat.isSymbolicLink()) {
                    const realTarget = fs.realpathSync(targetPath);
                    const relReal = relative(this.rootDir, realTarget);
                    if (relReal.startsWith('..') || isAbsolute(relReal)) {
                        logger.error(
                            `Symlink traversal blocked: key=${storageKey} -> realPath=${realTarget}`,
                        );
                        throw new Error('SYMLINK_OUT_OF_BOUNDS');
                    }
                }
            } catch (err: unknown) {
                if (
                    err instanceof Error &&
                    err.message.includes('OUT_OF_BOUNDS')
                ) {
                    throw err;
                }
                logger.warn('Failed to check symlink status', err);
            }
        }

        return targetPath;
    }
}
