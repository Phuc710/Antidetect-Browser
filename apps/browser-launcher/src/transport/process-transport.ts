import type { LauncherCommand,LauncherEvent,LauncherResponse } from 'shared';

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
        const raw = message as any;
        const requestId = raw && typeof raw === 'object' && typeof raw.requestId === 'string'
          ? raw.requestId
          : 'unknown-request';
          
        this.sendError(requestId, {
          code: 'INVALID_COMMAND' as any,
          message: 'Invalid launcher command.',
          details: { issues: validation.issues } as any,
        });
        return;
      }

      try {
        await this.onCommand(validation.command!);
      } catch (err) {
        this.sendError(validation.command!.requestId, serializeLauncherError(err));
      }
    });
  }

  send(msg: LauncherResponse | LauncherEvent) {
    if (process.send) {
      process.send(msg);
    }
  }

  sendSuccess(requestId: string, payload?: any) {
    this.send({
      type: 'command:success',
      requestId,
      ...(payload ? { payload } : {}),
    });
  }

  sendError(requestId: string, error: { code: string; message: string; details?: any }) {
    this.send({
      type: 'command:error',
      requestId,
      error: error as any,
    });
  }

  publishReady() {
    this.send({
      type: 'launcher:ready',
    });
  }
}
