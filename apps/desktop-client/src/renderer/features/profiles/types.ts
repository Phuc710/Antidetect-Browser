import type { ProfileView, ProxyView } from '../../../shared/profile-contracts.js';

import * as Icons from 'lucide-react';

export type ProfilesLoadState = 'loading' | 'success' | 'error';
export type TabType = 'all' | 'favorite' | 'opened' | 'transferring' | 'trash';
export type SortKey = 'serial' | 'name' | 'lastOpen';
export type SortDir = 'asc' | 'desc';

export interface ProfilesLocationState {
  createdProfileId?: string;
  updatedProfileId?: string;
}

export interface ContextMenuState {
  readonly profile: ProfileView;
  readonly x: number;
  readonly y: number;
}

export interface TagObject {
  name: string;
  color: string;
}

export interface EmptyStateConfig {
  icon: keyof typeof Icons;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export type ProfileToolbarAction = 'test-all' | 'column-picker' | 'reload' | 'empty-trash';

export interface ProfileRowContext {
  currentPage: number;
  pageSize: number;
  idx: number;
  isChecked: boolean;
  isLaunching: boolean;
  isStopping: boolean;
  launchingIds: Set<string>;
  stoppingIds: Set<string>;
  inlineEditId: string | null;
  inlineNameText: string;
  showNotesText: boolean;
  proxyMap: Map<string, ProxyView>;
  onSelectOne: (id: string, checked: boolean) => void;
  onRowClick: (id: string) => void;
  onLaunchToggle: (profile: ProfileView) => void;
  onOpenNotes: (profile: ProfileView) => void;
  onOpenTagPopover: (profile: ProfileView, e: React.MouseEvent) => void;
  onOpenProjectPopover: (profile: ProfileView, e: React.MouseEvent) => void;
  onToggleFavorite: (profile: ProfileView, e: React.MouseEvent) => Promise<void>;
  onContextMenu: (profile: ProfileView, e: React.MouseEvent) => void;
  onStartInlineEdit: (profile: ProfileView) => void;
  onSaveInlineName: (profile: ProfileView) => void;
  onInlineNameTextChange: (val: string) => void;
  onCancelInlineEdit: () => void;
  onShowNotesToggle: () => void;
  onRestoreProfile?: (profile: ProfileView) => void;
  onDeletePermanently?: (profileId: string) => void;
}
