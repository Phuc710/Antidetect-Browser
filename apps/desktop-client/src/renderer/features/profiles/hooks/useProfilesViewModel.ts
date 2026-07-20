import { useMemo } from 'react';
import type { ProfileView } from '../../../../shared/profile-contracts.js';
import type { TabType, SortKey, SortDir, EmptyStateConfig } from '../types.js';
import { profileTabConfigs, type ProfileTabConfig } from '../config/profileTabConfigs.js';
import { sortProfiles } from '../utils/profileSorting.js';
import { resolveProfileEmptyState } from '../utils/resolveProfileEmptyState.js';
import {
  isProfileDeleted,
  isProfileFavorite,
  isProfileOpened,
  isProfileTransferring,
} from '../utils/profileSelectors.js';

interface UseProfilesViewModelInput {
  profiles: ProfileView[];
  activeTab: TabType;
  searchTerm: string;
  currentPage: number;
  pageSize: number;
  sortKey: SortKey;
  sortDir: SortDir;
}

export interface ProfilesViewModel {
  tabConfig: ProfileTabConfig;
  tabCounts: Record<TabType, number>;
  filteredProfiles: ProfileView[];
  sortedProfiles: ProfileView[];
  paginatedProfiles: ProfileView[];
  totalItems: number;
  totalPages: number;
  emptyState: EmptyStateConfig;
}

export function getProfileTabCounts(profiles: ProfileView[]): Record<TabType, number> {
  const counts: Record<TabType, number> = {
    all: 0,
    favorite: 0,
    opened: 0,
    transferring: 0,
    trash: 0,
  };

  for (const profile of profiles) {
    if (isProfileDeleted(profile)) {
      counts.trash += 1;
      continue;
    }

    counts.all += 1;

    if (isProfileFavorite(profile)) {
      counts.favorite += 1;
    }

    if (isProfileOpened(profile)) {
      counts.opened += 1;
    }

    if (isProfileTransferring(profile)) {
      counts.transferring += 1;
    }
  }

  return counts;
}

export function useProfilesViewModel({
  profiles,
  activeTab,
  searchTerm,
  currentPage,
  pageSize,
  sortKey,
  sortDir,
}: UseProfilesViewModelInput): ProfilesViewModel {
  const tabConfig = useMemo(() => profileTabConfigs[activeTab], [activeTab]);

  const tabCounts = useMemo(() => getProfileTabCounts(profiles), [profiles]);

  const tabProfiles = useMemo(
    () => profiles.filter(tabConfig.filter),
    [profiles, tabConfig],
  );

  const filteredProfiles = useMemo(
    () => {
      const term = searchTerm.trim().toLowerCase();
      if (!term) return tabProfiles;
      return tabProfiles.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          (p.notes && p.notes.toLowerCase().includes(term)),
      );
    },
    [tabProfiles, searchTerm],
  );

  const sortedProfiles = useMemo(
    () => sortProfiles(filteredProfiles, sortKey, sortDir),
    [filteredProfiles, sortKey, sortDir],
  );

  const paginatedProfiles = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedProfiles.slice(start, start + pageSize);
  }, [sortedProfiles, currentPage, pageSize]);

  const totalItems = sortedProfiles.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  const emptyState = useMemo(
    () => resolveProfileEmptyState(tabConfig, searchTerm),
    [tabConfig, searchTerm],
  );

  return {
    tabConfig,
    tabCounts,
    filteredProfiles,
    sortedProfiles,
    paginatedProfiles,
    totalItems,
    totalPages,
    emptyState,
  };
}
