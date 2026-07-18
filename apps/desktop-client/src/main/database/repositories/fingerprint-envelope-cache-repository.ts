import type Database from 'better-sqlite3';
import type { FingerprintEnvelope } from 'shared';

interface FingerprintEnvelopeCacheRow {
  signed_envelope_json: string;
}

export class FingerprintEnvelopeCacheRepository {
  constructor(private readonly db: Database.Database) {}

  find(profileId: string): unknown | undefined {
    const row = this.db.prepare<[string], FingerprintEnvelopeCacheRow>(`
      SELECT signed_envelope_json
      FROM fingerprint_envelopes_cache
      WHERE profile_id = ?
    `).get(profileId);
    if (!row) return undefined;
    const parsed: unknown = JSON.parse(row.signed_envelope_json);
    return parsed;
  }

  store(profileId: string, envelope: FingerprintEnvelope, cachedAt: string): void {
    this.db.prepare(`
      INSERT INTO fingerprint_envelopes_cache (
        profile_id, fingerprint_id, schema_version, generator_version, dataset_version,
        target_engine, target_os, compatible_runtime_range, generated_at, expires_at,
        signature_key_id, cloud_revision, signed_envelope_json, cached_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(profile_id) DO UPDATE SET
        fingerprint_id = excluded.fingerprint_id,
        schema_version = excluded.schema_version,
        generator_version = excluded.generator_version,
        dataset_version = excluded.dataset_version,
        target_engine = excluded.target_engine,
        target_os = excluded.target_os,
        compatible_runtime_range = excluded.compatible_runtime_range,
        generated_at = excluded.generated_at,
        expires_at = excluded.expires_at,
        signature_key_id = excluded.signature_key_id,
        cloud_revision = excluded.cloud_revision,
        signed_envelope_json = excluded.signed_envelope_json,
        cached_at = excluded.cached_at
    `).run(
      profileId,
      envelope.fingerprintId,
      envelope.schemaVersion,
      envelope.generatorVersion,
      envelope.datasetVersion,
      envelope.targetEngine,
      envelope.targetOs,
      envelope.compatibleRuntimeRange,
      envelope.generatedAt,
      envelope.expiresAt,
      envelope.signature.keyId,
      envelope.cloudRevision ?? null,
      JSON.stringify(envelope),
      cachedAt,
    );
  }

  removeExpired(olderThan: string): number {
    return this.db.prepare('DELETE FROM fingerprint_envelopes_cache WHERE expires_at < ?')
      .run(olderThan).changes;
  }
}
