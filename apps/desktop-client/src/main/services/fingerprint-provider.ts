import {
  generateKeyPairSync,
  randomUUID,
  type KeyLike,
  type KeyObject,
} from 'crypto';
import { FingerprintGenerator } from 'fingerprint-generator';
import type {
  FingerprintEnvelope,
  FingerprintPayloadDto,
  FingerprintTargetEngine,
  FingerprintTargetOs,
  UnsignedFingerprintEnvelope,
} from 'shared';
import {
  FingerprintPipelineError,
  signFingerprintEnvelope,
  type ApplicationMode,
  type FingerprintEnvelopeValidator,
} from './fingerprint-envelope-validator.js';
import { Logger } from './logger.js';

const logger = new Logger('FingerprintProvider');
const DEVELOPMENT_KEY_ID = 'test:local-development';
const DEVELOPMENT_ENVELOPE_LIFETIME_MS = 24 * 60 * 60 * 1_000;

export interface FingerprintProviderRequest {
  readonly profileId: string;
  readonly targetEngine: FingerprintTargetEngine;
  readonly targetOs: FingerprintTargetOs;
}

export interface IFingerprintProvider {
  getVerifiedEnvelope(options: FingerprintProviderRequest): Promise<FingerprintEnvelope>;
}

export interface AuthenticatedTransportClient {
  post(path: string, body: Readonly<Record<string, string>>): Promise<unknown>;
}

export interface DevelopmentFingerprintGenerator {
  generate(options: {
    readonly targetEngine: FingerprintTargetEngine;
    readonly targetOs: FingerprintTargetOs;
  }): FingerprintPayloadDto;
}

export interface DevelopmentSigningMaterial {
  readonly keyId: string;
  readonly privateKey: KeyLike;
  readonly publicKey: string;
}

export class FingerprintTransportError extends Error {
  constructor(
    public readonly status: number | undefined,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'FingerprintTransportError';
  }
}

class LocalWorkspaceFingerprintGenerator implements DevelopmentFingerprintGenerator {
  private generator: FingerprintGenerator | undefined;

  generate(options: {
    readonly targetEngine: FingerprintTargetEngine;
    readonly targetOs: FingerprintTargetOs;
  }): FingerprintPayloadDto {
    if (options.targetEngine !== 'chromium') {
      throw new FingerprintPipelineError(
        'FINGERPRINT_ENGINE_MISMATCH',
        'Development fingerprint generation supports Chromium only in Phase 1.',
      );
    }
    this.generator ??= new FingerprintGenerator();
    const generated = this.generator.getFingerprint({
      browsers: ['chrome'],
      operatingSystems: [options.targetOs === 'mac' ? 'macos' : options.targetOs],
      devices: ['desktop'],
      locales: ['en-US'],
      mockWebRTC: true,
    });
    return {
      fingerprint: { ...generated.fingerprint },
      headers: { ...generated.headers },
    };
  }
}

export class CloudFingerprintProvider implements IFingerprintProvider {
  constructor(
    private readonly transport: AuthenticatedTransportClient,
    private readonly validator: FingerprintEnvelopeValidator,
  ) {}

  async getVerifiedEnvelope(options: FingerprintProviderRequest): Promise<FingerprintEnvelope> {
    try {
      const response = await this.transport.post('/v1/fingerprints/generate', {
        profileId: options.profileId,
        targetEngine: options.targetEngine,
        targetOs: options.targetOs,
      });
      return this.validator.parseAndVerifySignature(response);
    } catch (error: unknown) {
      if (error instanceof FingerprintPipelineError) throw error;
      if (error instanceof FingerprintTransportError && error.status !== undefined) {
        if (error.status >= 400 && error.status < 500) {
          throw new FingerprintPipelineError(
            error.status === 404 ? 'FINGERPRINT_MISSING' : 'FINGERPRINT_SCHEMA_UNSUPPORTED',
            'Cloud fingerprint request was rejected.',
            { cause: error },
          );
        }
      }
      throw new FingerprintPipelineError(
        'FINGERPRINT_SERVICE_UNAVAILABLE',
        'Cloud fingerprint service is unavailable.',
        { cause: error },
      );
    }
  }
}

export interface DevelopmentFingerprintProviderOptions {
  readonly mode: ApplicationMode;
  readonly signingMaterial: DevelopmentSigningMaterial;
  readonly validator: FingerprintEnvelopeValidator;
  readonly generator?: DevelopmentFingerprintGenerator;
  readonly now?: () => Date;
  readonly idGenerator?: () => string;
}

export class DevelopmentFingerprintProvider implements IFingerprintProvider {
  private readonly generator: DevelopmentFingerprintGenerator;
  private readonly now: () => Date;
  private readonly idGenerator: () => string;

  constructor(private readonly options: DevelopmentFingerprintProviderOptions) {
    this.generator = options.generator ?? new LocalWorkspaceFingerprintGenerator();
    this.now = options.now ?? (() => new Date());
    this.idGenerator = options.idGenerator ?? randomUUID;
  }

  async getVerifiedEnvelope(request: FingerprintProviderRequest): Promise<FingerprintEnvelope> {
    if (this.options.mode === 'production') {
      throw new FingerprintPipelineError(
        'LOCAL_PROVIDER_FORBIDDEN_IN_PRODUCTION',
        'Local fingerprint generation is forbidden in production.',
      );
    }
    logger.warn('[DEV ONLY - not for production] Generating a local fingerprint envelope.');
    const generatedAt = this.now();
    const unsigned: UnsignedFingerprintEnvelope = {
      schemaVersion: 2,
      fingerprintId: this.idGenerator(),
      generatorVersion: '2.1.83-development',
      datasetVersion: 'bundled-2.1.83',
      targetEngine: request.targetEngine,
      targetOs: request.targetOs,
      compatibleRuntimeRange: '>=0.0.0',
      generatedAt: generatedAt.toISOString(),
      expiresAt: new Date(generatedAt.getTime() + DEVELOPMENT_ENVELOPE_LIFETIME_MS).toISOString(),
      payload: this.generator.generate(request),
    };
    const envelope = signFingerprintEnvelope(
      unsigned,
      this.options.signingMaterial.keyId,
      this.options.signingMaterial.privateKey,
    );
    return this.options.validator.parseAndVerifySignature(envelope);
  }
}

export interface CreateFingerprintProviderOptions {
  readonly mode: ApplicationMode;
  readonly validator: FingerprintEnvelopeValidator;
  readonly cloudTransport?: AuthenticatedTransportClient;
  readonly developmentSigningMaterial?: DevelopmentSigningMaterial;
  readonly developmentGenerator?: DevelopmentFingerprintGenerator;
}

export function createFingerprintProvider(
  options: CreateFingerprintProviderOptions,
): IFingerprintProvider {
  if (options.mode === 'production') {
    if (!options.cloudTransport) {
      throw new FingerprintPipelineError(
        'FINGERPRINT_SERVICE_UNAVAILABLE',
        'Cloud fingerprint transport is not configured.',
      );
    }
    return new CloudFingerprintProvider(options.cloudTransport, options.validator);
  }
  if (!options.developmentSigningMaterial) {
    throw new FingerprintPipelineError(
      'FINGERPRINT_INTEGRITY_INVALID',
      'Development signing material is not configured.',
    );
  }
  return new DevelopmentFingerprintProvider({
    mode: options.mode,
    signingMaterial: options.developmentSigningMaterial,
    validator: options.validator,
    ...(options.developmentGenerator ? { generator: options.developmentGenerator } : {}),
  });
}

function rawPublicKey(publicKey: KeyObject): string {
  const spki = publicKey.export({ format: 'der', type: 'spki' });
  return spki.subarray(spki.length - 32).toString('base64url');
}

export function createEphemeralDevelopmentSigningMaterial(): DevelopmentSigningMaterial {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    keyId: DEVELOPMENT_KEY_ID,
    privateKey,
    publicKey: rawPublicKey(publicKey),
  };
}
