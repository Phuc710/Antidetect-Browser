import type {
    LauncherCommand,
    LauncherEvent,
    LauncherResponse,
    SerializedLauncherError,
} from 'shared';

import { serializeLauncherError } from '../errors/serialize-launcher-error.js';
import { CommandValidator } from './command-validator.js';

export class ProcessTransport {
    private readonly validator = new CommandValidator();
    private readonly onCommand: (command: LauncherCommand) => Promise<void>;

    constructor(onCommand: (command: LauncherCommand) => Promise<void>) {
        this.onCommand = onCommand;
    }

    start() {
        process.on('message', async (message: unknown) => {
            // Validate command format
            const validation = this.validator.validate(message);

            if (!validation.success) {
                const raw =
                    message && typeof message === 'object'
                        ? (message as Record<string, unknown>)
                        : null;
                const requestId =
                    raw && typeof raw.requestId === 'string'
                        ? raw.requestId
                        : 'unknown-request';

                this.sendError(requestId, {
                    code: 'INVALID_COMMAND',
                    message: 'Invalid launcher command.',
                    details: { issues: validation.issues },
                });
                return;
            }

            try {
                await this.onCommand(validation.command!);
            } catch (err) {
                this.sendError(
                    validation.command!.requestId,
                    serializeLauncherError(err),
                );
            }
        });
    }

    send(msg: LauncherResponse | LauncherEvent) {
        if (process.send) {
            process.send(msg);
        }
    }

    sendSuccess(requestId: string, payload?: unknown) {
        this.send({
            type: 'command:success',
            requestId,
            ...(payload ? { payload } : {}),
        });
    }

    sendError(requestId: string, error: SerializedLauncherError) {
        this.send({
            type: 'command:error',
            requestId,
            error,
        });
    }

    publishReady() {
        this.send({
            type: 'launcher:ready',
        });
    }
}
