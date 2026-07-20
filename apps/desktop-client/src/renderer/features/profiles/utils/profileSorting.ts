import type { ProfileView } from '../../../../shared/profile-contracts.js';
import type { SortKey, SortDir } from '../types.js';

export function sortProfiles(
  filteredProfiles: ProfileView[],
  sortKey: SortKey,
  sortDir: SortDir,
): ProfileView[] {
  const arr = [...filteredProfiles];
  arr.sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'name') {
      cmp = a.name.localeCompare(b.name);
    } else if (sortKey === 'lastOpen') {
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      cmp = ta - tb;
    } else {
      // serial: preserve original order (index)
      cmp = filteredProfiles.indexOf(a) - filteredProfiles.indexOf(b);
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });
  return arr;
}
