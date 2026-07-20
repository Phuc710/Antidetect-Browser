import type { ProfileView } from '../../../../shared/profile-contracts.js';
import type { TabType } from '../types.js';

export function filterProfiles(
  profiles: ProfileView[],
  activeTab: TabType,
  searchTerm: string,
): ProfileView[] {
  let result = profiles;
  if (activeTab === 'favorite') {
    result = result.filter((p) => p.tags?.includes('faved'));
  } else if (activeTab === 'opened') {
    result = result.filter((p) => p.status === 'running');
  } else if (activeTab === 'transferring') {
    result = result.filter((p) => p.status === 'starting');
  } else if (activeTab === 'trash') {
    result = result.filter((p) => p.tags?.includes('trash'));
  } else {
    // 'all' tab: exclude trashed profiles
    result = result.filter((p) => !p.tags?.includes('trash'));
  }
  const term = searchTerm.trim().toLowerCase();
  if (term) {
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.notes && p.notes.toLowerCase().includes(term)),
    );
  }
  return result;
}
