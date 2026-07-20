import type { ProfileView } from '../../../../shared/profile-contracts.js';

export function isProfileDeleted(profile: ProfileView): boolean {
  return profile.tags?.includes('trash') ?? false;
}

export function isProfileFavorite(profile: ProfileView): boolean {
  return profile.tags?.includes('faved') ?? false;
}

export function isProfileOpened(profile: ProfileView): boolean {
  return profile.status === 'running';
}

export function isProfileTransferring(profile: ProfileView): boolean {
  return profile.status === 'starting';
}
