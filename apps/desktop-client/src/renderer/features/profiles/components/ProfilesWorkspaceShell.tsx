import React from 'react';
import type { ProfileView } from '../../../../shared/profile-contracts.js';
import type {
  TabType,
  TagObject,
  ContextMenuState,
  ProfileRowContext,
} from '../types.js';
import type { ProfileTabConfig } from '../config/profileTabConfigs.js';

import { ProfilesTabs } from './ProfilesTabs.js';
import { ProfilesToolbar } from './ProfilesToolbar.js';
import { ProfilesDataTable } from './ProfilesDataTable.js';
import { ProfilesPagination } from './ProfilesPagination.js';
import { ProfilesBulkActions } from './ProfilesBulkActions.js';
import { ProfileContextMenu } from './ProfileContextMenu.js';
import { ModalsContainer } from './ModalsContainer.js';

interface ProfilesWorkspaceShellProps {
  readonly searchTerm: string;
  readonly onSearchChange: (term: string) => void;
  readonly activeTab: TabType;
  readonly tabCounts: Record<TabType, number>;
  readonly onTabChange: (tab: TabType) => void;
  readonly onOpenTagManager: () => void;

  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly refetch: () => Promise<any>;
  readonly tabConfig: ProfileTabConfig;

  readonly locationState: { createdProfileId?: string; updatedProfileId?: string } | null;
  readonly paginatedProfiles: ProfileView[];
  readonly rowContext: ProfileRowContext;
  readonly selectedIds: Set<string>;
  readonly sortKey: string;
  readonly sortDir: 'asc' | 'desc';
  readonly onSelectAll: (checked: boolean) => void;
  readonly onSort: (key: any) => void;
  readonly onNavigateToCreate: () => void;

  readonly totalItems: number;
  readonly pageSize: number;
  readonly currentPage: number;
  readonly totalPages: number;
  readonly onPageSizeChange: (size: number) => void;
  readonly onPageChange: (page: number) => void;

  readonly clearSelection: () => void;
  readonly handleBulkOpen: () => void;
  readonly handleBulkClose: () => void;

  readonly contextMenu: ContextMenuState | null;
  readonly menuRef: React.RefObject<HTMLDivElement>;
  readonly onCloseContextMenu: () => void;
  readonly handleLaunchToggle: (profile: ProfileView) => void;
  readonly duplicateProfile: (profile: ProfileView) => void;
  readonly deleteProfile: (profileId: string) => void;
  readonly openNotes: (profile: ProfileView) => void;
  readonly onEditClick: (id: string) => void;
  readonly setIsAddTagModalOpen: (open: boolean) => void;

  readonly notesProfile: ProfileView | null;
  readonly notesText: string;
  readonly isSavingNotes: boolean;
  readonly noteInputRef: React.RefObject<HTMLTextAreaElement>;
  readonly onNotesTextChange: (text: string) => void;
  readonly onSaveNotes: () => void;
  readonly onCancelNotes: () => void;

  readonly tagPopoverProfile: ProfileView | null;
  readonly tagPopoverRef: React.RefObject<HTMLDivElement>;
  readonly tagPopoverPos: { x: number; y: number };
  readonly availableTags: TagObject[];
  readonly onToggleTagItem: (p: ProfileView, tag: string) => void;

  readonly projectPopoverProfile: ProfileView | null;
  readonly projectPopoverRef: React.RefObject<HTMLDivElement>;
  readonly projectPopoverPos: { x: number; y: number };
  readonly projectsList: string[];
  readonly onSelectProject: (p: ProfileView, project: string) => void;

  readonly isAddTagModalOpen: boolean;
  readonly selectedTagColor: string;
  readonly newTagName: string;
  readonly onSelectedTagColorChange: (color: string) => void;
  readonly onNewTagNameChange: (name: string) => void;
  readonly onCreateNewTag: () => void;
  readonly onCloseAddTagModal: () => void;

  readonly isTagManagerOpen: boolean;
  readonly onCloseTagManager: () => void;
  readonly tagManagerSelected: Set<string>;
  readonly onToggleTagManagerSelected: (name: string) => void;
  readonly onToggleSelectAllTags: () => void;
  readonly onEditTagClick: (name: string, color: string) => void;
  readonly onDeleteTagClick: (name: string | null) => void;
  readonly deletingTag: string | null;
  readonly onCloseDeleteTagConfirm: () => void;
  readonly onConfirmDeleteTag: (name: string) => void;

  readonly profiles: ProfileView[];
}

export function ProfilesWorkspaceShell({
  searchTerm,
  onSearchChange,
  activeTab,
  tabCounts,
  onTabChange,
  onOpenTagManager,
  isLoading,
  isError,
  refetch,
  tabConfig,
  locationState,
  paginatedProfiles,
  rowContext,
  selectedIds,
  sortKey,
  sortDir,
  onSelectAll,
  onSort,
  onNavigateToCreate,
  totalItems,
  pageSize,
  currentPage,
  totalPages,
  onPageSizeChange,
  onPageChange,
  clearSelection,
  handleBulkOpen,
  handleBulkClose,
  contextMenu,
  menuRef,
  onCloseContextMenu,
  handleLaunchToggle,
  duplicateProfile,
  deleteProfile,
  openNotes,
  onEditClick,
  setIsAddTagModalOpen,
  notesProfile,
  notesText,
  isSavingNotes,
  noteInputRef,
  onNotesTextChange,
  onSaveNotes,
  onCancelNotes,
  tagPopoverProfile,
  tagPopoverRef,
  tagPopoverPos,
  availableTags,
  onToggleTagItem,
  projectPopoverProfile,
  projectPopoverRef,
  projectPopoverPos,
  projectsList,
  onSelectProject,
  isAddTagModalOpen,
  selectedTagColor,
  newTagName,
  onSelectedTagColorChange,
  onNewTagNameChange,
  onCreateNewTag,
  onCloseAddTagModal,
  isTagManagerOpen,
  onCloseTagManager,
  tagManagerSelected,
  onToggleTagManagerSelected,
  onToggleSelectAllTags,
  onEditTagClick,
  onDeleteTagClick,
  deletingTag,
  onCloseDeleteTagConfirm,
  onConfirmDeleteTag,
  profiles,
}: ProfilesWorkspaceShellProps): JSX.Element {
  return (
    <div className="ppage">
      {/* ─── Tabs bar ─── */}
      <ProfilesTabs
        activeTab={activeTab}
        tabCounts={tabCounts}
        onTabChange={onTabChange}
        onOpenTagManager={onOpenTagManager}
      />

      {/* ─── Toolbar ─── */}
      <ProfilesToolbar
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        isReloading={isLoading}
        onReload={() => {
          void refetch();
        }}
        actions={tabConfig.toolbarActions}
      />

      {/* ─── Main content table ─── */}
      <main className="pcontent">
        {locationState?.createdProfileId && !isLoading && (
          <div className="pnotice pnotice--success" role="status">
            Profile created successfully.
          </div>
        )}
        {locationState?.updatedProfileId && !isLoading && (
          <div className="pnotice pnotice--success" role="status">
            Profile updated successfully.
          </div>
        )}
        <ProfilesDataTable
          rows={paginatedProfiles}
          columns={tabConfig.columns}
          rowContext={rowContext}
          loading={isLoading}
          isError={isError}
          emptyState={tabConfig.emptyState}
          selectedIds={selectedIds}
          sortKey={sortKey}
          sortDir={sortDir}
          onSelectAll={onSelectAll}
          onSort={onSort}
          onCreateProfileClick={onNavigateToCreate}
          onRetryLoad={() => {
            void refetch();
          }}
        />
      </main>

      {/* ─── Footer pagination (Always rendered when not loading) ─── */}
      {!isLoading && (
        <ProfilesPagination
          totalCount={totalItems}
          pageSize={pageSize}
          currentPage={currentPage}
          totalPages={totalPages || 1}
          onPageSizeChange={onPageSizeChange}
          onPageChange={onPageChange}
        />
      )}

      {/* ─── Bulk actions ─── */}
      {selectedIds.size > 0 && (
        <ProfilesBulkActions
          selectedCount={selectedIds.size}
          totalCount={totalItems}
          onClear={clearSelection}
          onBulkOpen={handleBulkOpen}
          onBulkClose={handleBulkClose}
        />
      )}

      {/* ─── Context menu & Modals ─── */}
      {contextMenu && (
        <ProfileContextMenu
          contextMenu={contextMenu}
          menuRef={menuRef}
          onClose={onCloseContextMenu}
          onLaunchToggle={handleLaunchToggle}
          onDuplicate={(p) => void duplicateProfile(p)}
          onDelete={(id) => void deleteProfile(id)}
          onOpenNotes={openNotes}
          onEditClick={onEditClick}
          onAddTagClick={() => setIsAddTagModalOpen(true)}
        />
      )}

      <ModalsContainer
        notesProfile={notesProfile}
        notesText={notesText}
        isSavingNotes={isSavingNotes}
        noteInputRef={noteInputRef}
        onNotesTextChange={onNotesTextChange}
        onSaveNotes={onSaveNotes}
        onCancelNotes={onCancelNotes}
        tagPopoverProfile={tagPopoverProfile}
        tagPopoverRef={tagPopoverRef}
        tagPopoverPos={tagPopoverPos}
        availableTags={availableTags}
        onToggleTagItem={onToggleTagItem}
        onAddTagClick={() => {
          setIsAddTagModalOpen(true);
        }}
        projectPopoverProfile={projectPopoverProfile}
        projectPopoverRef={projectPopoverRef}
        projectPopoverPos={projectPopoverPos}
        projectsList={projectsList}
        onSelectProject={onSelectProject}
        isAddTagModalOpen={isAddTagModalOpen}
        selectedTagColor={selectedTagColor}
        newTagName={newTagName}
        onSelectedTagColorChange={onSelectedTagColorChange}
        onNewTagNameChange={onNewTagNameChange}
        onCreateNewTag={onCreateNewTag}
        onCloseAddTagModal={onCloseAddTagModal}
        isTagManagerOpen={isTagManagerOpen}
        onCloseTagManager={onCloseTagManager}
        tagManagerSelected={tagManagerSelected}
        onToggleTagManagerSelected={onToggleTagManagerSelected}
        onToggleSelectAllTags={onToggleSelectAllTags}
        onEditTagClick={onEditTagClick}
        onDeleteTagClick={onDeleteTagClick}
        deletingTag={deletingTag}
        onCloseDeleteTagConfirm={onCloseDeleteTagConfirm}
        onConfirmDeleteTag={onConfirmDeleteTag}
        profiles={profiles}
      />
    </div>
  );
}
