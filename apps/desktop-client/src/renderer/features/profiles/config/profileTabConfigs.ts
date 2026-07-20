import type { ProfileView } from '../../../../shared/profile-contracts.js';
import type { TabType, EmptyStateConfig, ProfileToolbarAction } from '../types.js';
import { defaultProfileColumns, trashProfileColumns, type ProfileColumn } from '../table/profileColumns.js';
import {
  isProfileDeleted,
  isProfileFavorite,
  isProfileOpened,
  isProfileTransferring,
} from '../utils/profileSelectors.js';

export interface ProfileTabConfig {
  id: TabType;
  label: string;
  filter: (profile: ProfileView) => boolean;
  columns: ProfileColumn[];
  emptyState: EmptyStateConfig;
  toolbarActions: ProfileToolbarAction[];
}

export const profileTabConfigs: Record<TabType, ProfileTabConfig> = {
  all: {
    id: 'all',
    label: 'Profiles',
    filter: (profile) => !isProfileDeleted(profile),
    columns: defaultProfileColumns,
    emptyState: {
      icon: 'FileText',
      title: 'No profiles found',
      description: 'Create your first browser profile.',
    },
    toolbarActions: ['test-all', 'column-picker', 'reload'],
  },

  favorite: {
    id: 'favorite',
    label: 'Favorite',
    filter: (profile) => !isProfileDeleted(profile) && isProfileFavorite(profile),
    columns: defaultProfileColumns,
    emptyState: {
      icon: 'Bookmark',
      title: 'No Favorites',
      description: 'Mark your important profiles as favorite for quick access.',
    },
    toolbarActions: ['test-all', 'column-picker', 'reload'],
  },

  opened: {
    id: 'opened',
    label: 'Opened',
    filter: (profile) => !isProfileDeleted(profile) && isProfileOpened(profile),
    columns: defaultProfileColumns,
    emptyState: {
      icon: 'Monitor',
      title: 'No Opened Profiles',
      description: 'You have no active running browser profiles at the moment.',
    },
    toolbarActions: ['test-all', 'column-picker', 'reload'],
  },

  transferring: {
    id: 'transferring',
    label: 'Transferring',
    filter: (profile) => !isProfileDeleted(profile) && isProfileTransferring(profile),
    columns: defaultProfileColumns,
    emptyState: {
      icon: 'Share2',
      title: 'No Data in Transferring',
      description: 'RoxyBrowser offers powerful profile transfer functionality, enabling users to seamlessly transfer profiles across teams.',
    },
    toolbarActions: ['test-all', 'column-picker', 'reload'],
  },

  trash: {
    id: 'trash',
    label: 'Trash',
    filter: (profile) => isProfileDeleted(profile),
    columns: trashProfileColumns,
    emptyState: {
      icon: 'Trash2',
      title: 'No Data in Trash',
      description: 'Deleted profiles will be displayed here. Permanently clearing them from the trash will make them unrecoverable.',
    },
    toolbarActions: ['empty-trash', 'reload'],
  },
};
