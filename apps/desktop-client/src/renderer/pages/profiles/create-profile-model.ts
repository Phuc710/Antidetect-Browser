import type {
  CreateProfileInput,
  ProfileView,
  UpdateProfileInput,
} from '../../../shared/profile-contracts.js';

export type CreateProfileOs = CreateProfileInput['os'];

export interface CreateProfileDraft {
  name: string;
  os: CreateProfileOs;
  notes: string;
  proxyId: string;
  projectId: string;
  tagsText: string;
  startupUrlsText: string;
  fingerprintPolicy: 'automatic';
}

export const DEFAULT_CREATE_PROFILE_DRAFT: Readonly<CreateProfileDraft> = {
  name: '',
  os: 'windows',
  notes: '',
  proxyId: '',
  projectId: '',
  tagsText: '',
  startupUrlsText: '',
  fingerprintPolicy: 'automatic',
};

export interface CreateProfileValidationResult {
  valid: boolean;
  message?: string;
}

export function profileToDraft(profile: ProfileView): CreateProfileDraft {
  return {
    name: profile.name,
    os: profile.os,
    notes: profile.notes ?? '',
    proxyId: profile.proxyId ?? '',
    projectId: profile.projectId ?? '',
    tagsText: (profile.tags ?? []).join(', '),
    startupUrlsText: (profile.startupUrls ?? []).join('\n'),
    fingerprintPolicy: 'automatic',
  };
}

export function validateCreateProfileDraft(
  draft: CreateProfileDraft,
): CreateProfileValidationResult {
  if (draft.name.length > 100) {
    return { valid: false, message: 'Profile name cannot exceed 100 characters.' };
  }
  if (draft.notes.length > 2_000) {
    return { valid: false, message: 'Notes cannot exceed 2,000 characters.' };
  }
  if (draft.projectId.length > 128) {
    return { valid: false, message: 'Project ID cannot exceed 128 characters.' };
  }

  const tags = parseTags(draft.tagsText);
  if (tags.length > 50 || tags.some((tag) => tag.length > 64)) {
    return { valid: false, message: 'Use at most 50 tags, each up to 64 characters.' };
  }

  const urls = parseStartupUrls(draft.startupUrlsText);
  if (urls.length > 50) {
    return { valid: false, message: 'Use at most 50 startup URLs.' };
  }
  for (const url of urls) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error();
    } catch {
      return { valid: false, message: `Startup URL must begin with http:// or https://: ${url}` };
    }
  }
  return { valid: true };
}

export function buildCreateProfileInput(
  draft: CreateProfileDraft,
  cookies?: string,
): CreateProfileInput {
  const name = draft.name.trim();
  const notes = draft.notes.trim();
  const projectId = draft.projectId.trim();
  const tags = parseTags(draft.tagsText);
  const startupUrls = parseStartupUrls(draft.startupUrlsText);
  const rawCookies = cookies?.trim();

  return {
    ...(name ? { name } : {}),
    os: draft.os,
    engine: 'chromium',
    distribution: 'chromium',
    channel: 'stable',
    ...(draft.proxyId ? { proxyId: draft.proxyId } : {}),
    ...(notes ? { notes } : {}),
    ...(projectId ? { projectId } : {}),
    ...(tags.length ? { tags } : {}),
    ...(startupUrls.length ? { startupUrls } : {}),
    ...(rawCookies ? { cookies: rawCookies } : {}),
  };
}

export function buildUpdateProfileInput(
  profile: ProfileView,
  draft: CreateProfileDraft,
  cookies?: string,
): UpdateProfileInput {
  const rawCookies = cookies?.trim();
  return {
    profileId: profile.id,
    expectedVersion: profile.version,
    name: draft.name.trim(),
    proxyId: draft.proxyId || null,
    notes: draft.notes.trim(),
    projectId: draft.projectId.trim() || null,
    tags: parseTags(draft.tagsText),
    startupUrls: parseStartupUrls(draft.startupUrlsText),
    ...(rawCookies ? { cookies: rawCookies } : {}),
  };
}

export function isCreateProfileDraftDirty(
  draft: CreateProfileDraft,
  initial: CreateProfileDraft = DEFAULT_CREATE_PROFILE_DRAFT,
): boolean {
  return Object.keys(initial).some((key) => {
    const field = key as keyof CreateProfileDraft;
    return draft[field] !== initial[field];
  });
}

export function getProfileDisplayName(name: string): string {
  return name.trim() || 'Unnamed Profile';
}

export function parseStartupUrls(value: string): string[] {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

export function parseTags(value: string): string[] {
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
}
