import type { CreateProfileInput } from '../../../shared/profile-contracts.js';

export type CreateProfileOs = CreateProfileInput['os'];

export interface CreateProfileDraft {
  name: string;
  os: CreateProfileOs;
  notes: string;
  fingerprintPolicy: 'automatic';
}
export const DEFAULT_CREATE_PROFILE_DRAFT: Readonly<CreateProfileDraft> = {
  name: '',
  os: 'windows',
  notes: '',
  fingerprintPolicy: 'automatic',
};

export interface CreateProfileValidationResult {
  valid: boolean;
  message?: string;
}

export function validateCreateProfileDraft(
  draft: CreateProfileDraft,
): CreateProfileValidationResult {
  if (draft.name.length > 100) {
    return { valid: false, message: 'Tên profile không được vượt quá 100 ký tự.' };
  }

  if (draft.notes.length > 2_000) {
    return { valid: false, message: 'Ghi chú không được vượt quá 2.000 ký tự.' };
  }

  return { valid: true };
}

export function buildCreateProfileInput(draft: CreateProfileDraft): CreateProfileInput {
  const name = draft.name.trim();
  const notes = draft.notes.trim();

  return {
    ...(name ? { name } : {}),
    os: draft.os,
    engine: 'chromium',
    distribution: 'chromium',
    channel: 'stable',
    ...(notes ? { notes } : {}),
  };
}

export function isCreateProfileDraftDirty(draft: CreateProfileDraft): boolean {
  return (
    draft.name !== DEFAULT_CREATE_PROFILE_DRAFT.name ||
    draft.os !== DEFAULT_CREATE_PROFILE_DRAFT.os ||
    draft.notes !== DEFAULT_CREATE_PROFILE_DRAFT.notes
  );
}

export function getProfileDisplayName(name: string): string {
  return name.trim() || 'Unnamed Profile';
}
