import { describe, expect, it } from 'vitest';
import {
  buildCreateProfileInput,
  DEFAULT_CREATE_PROFILE_DRAFT,
  getProfileDisplayName,
  isCreateProfileDraftDirty,
  validateCreateProfileDraft,
} from '../create-profile-model.js';

describe('create profile model', () => {
  it('omits an empty name so Main can apply the domain default', () => {
    expect(buildCreateProfileInput({ ...DEFAULT_CREATE_PROFILE_DRAFT, name: '   ' })).toEqual({
      os: 'windows',
      engine: 'chromium',
      distribution: 'chromium',
      channel: 'stable',
    });
  });

  it('trims supported values and does not submit unsupported settings', () => {
    expect(buildCreateProfileInput({
      ...DEFAULT_CREATE_PROFILE_DRAFT,
      name: '  Work profile  ',
      os: 'linux',
      notes: '  Internal note  ',
    })).toEqual({
      name: 'Work profile',
      os: 'linux',
      engine: 'chromium',
      distribution: 'chromium',
      channel: 'stable',
      notes: 'Internal note',
    });
  });

  it('validates the UI limits', () => {
    expect(validateCreateProfileDraft({
      ...DEFAULT_CREATE_PROFILE_DRAFT,
      name: 'x'.repeat(101),
    })).toEqual({ valid: false, message: 'Profile name cannot exceed 100 characters.' });

    expect(validateCreateProfileDraft({
      ...DEFAULT_CREATE_PROFILE_DRAFT,
      notes: 'x'.repeat(2_001),
    }).valid).toBe(false);
  });

  it('tracks dirty state without persisting a global draft', () => {
    expect(isCreateProfileDraftDirty({ ...DEFAULT_CREATE_PROFILE_DRAFT })).toBe(false);
    expect(isCreateProfileDraftDirty({ ...DEFAULT_CREATE_PROFILE_DRAFT, os: 'mac' })).toBe(true);
  });

  it('uses the safe unnamed preview label', () => {
    expect(getProfileDisplayName('  ')).toBe('Unnamed Profile');
    expect(getProfileDisplayName('  Named  ')).toBe('Named');
  });
});
