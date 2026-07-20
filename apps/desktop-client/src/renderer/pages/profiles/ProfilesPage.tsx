import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../hooks/queryKeys.js';
import type { ProfileView } from '../../../shared/profile-contracts.js';
import { toastService } from '../../services/toast-service.js';

// Custom Hooks & Types
import type {
  ProfilesLocationState,
  ContextMenuState,
  TagObject,
  ProfileRowContext,
} from '../../features/profiles/types.js';
import { useProfilesTableState } from '../../features/profiles/hooks/useProfilesTableState.js';
import { useProfilesQuery } from '../../features/profiles/hooks/useProfilesQuery.js';
import { useProfileSelection } from '../../features/profiles/hooks/useProfileSelection.js';
import { useProfileRuntime } from '../../features/profiles/hooks/useProfileRuntime.js';
import { useProfileMutations } from '../../features/profiles/hooks/useProfileMutations.js';
import { useProfilesViewModel } from '../../features/profiles/hooks/useProfilesViewModel.js';

// Layout Shell
import { ProfilesWorkspaceShell } from '../../features/profiles/components/ProfilesWorkspaceShell.js';

import './ProfilesPage.css';

export function ProfilesPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as ProfilesLocationState | null;

  const queryClient = useQueryClient();

  // Custom hooks for server and UI states
  const {
    searchTerm,
    activeTab,
    sortKey,
    sortDir,
    currentPage,
    pageSize,
    setSearchTerm,
    setActiveTab,
    setCurrentPage,
    setPageSize,
    handleSort,
  } = useProfilesTableState();

  const { profiles, proxies, isLoading, isError, refetch } = useProfilesQuery();
  const {
    deleteProfile,
    duplicateProfile,
    updateProfile,
    toggleLaunch,
    launchingIds,
    stoppingIds,
    bulkLaunch,
    bulkStop,
  } = useProfileMutations();

  // Handle real-time runtime status events via query client cache update
  useProfileRuntime();

  // Transform view data via view model pipeline
  const {
    tabConfig,
    tabCounts,
    sortedProfiles,
    paginatedProfiles,
    totalItems,
    totalPages,
  } = useProfilesViewModel({
    profiles,
    activeTab,
    searchTerm,
    currentPage,
    pageSize,
    sortKey,
    sortDir,
  });

  // Selection state
  const availableIds = useMemo(() => sortedProfiles.map((p) => p.id), [sortedProfiles]);
  const pageIds = useMemo(() => paginatedProfiles.map((p) => p.id), [paginatedProfiles]);
  const { selectedIds, toggleOne, toggleAll, clearSelection } = useProfileSelection(availableIds);

  const handleSelectAll = (checked: boolean): void => {
    toggleAll(checked, pageIds);
  };

  const handleSelectOne = (id: string, checked: boolean): void => {
    toggleOne(id, checked);
  };

  const handleRowClick = (id: string): void => {
    toggleOne(id, !selectedIds.has(id));
  };

  // Ephemeral UI states
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [notesProfile, setNotesProfile] = useState<ProfileView | null>(null);
  const [notesText, setNotesText] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineNameText, setInlineNameText] = useState('');
  const [showNotesText, setShowNotesText] = useState(false);

  const [availableTags, setAvailableTags] = useState<TagObject[]>([
    { name: 'athanhphuc7102005', color: '#31c48d' },
    { name: 'cc', color: '#f5b942' },
  ]);
  const [tagPopoverProfile, setTagPopoverProfile] = useState<ProfileView | null>(null);
  const [tagPopoverPos, setTagPopoverPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [isAddTagModalOpen, setIsAddTagModalOpen] = useState(false);
  const [deletingTag, setDeletingTag] = useState<string | null>(null);
  const [tagManagerSelected, setTagManagerSelected] = useState<Set<string>>(new Set());
  const [newTagName, setNewTagName] = useState('');
  const [selectedTagColor, setSelectedTagColor] = useState('#f5b942');

  const [projectsList] = useState<string[]>(['Default', 'test']);
  const [projectPopoverProfile, setProjectPopoverProfile] = useState<ProfileView | null>(null);
  const [projectPopoverPos, setProjectPopoverPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const menuRef = useRef<HTMLDivElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);
  const tagPopoverRef = useRef<HTMLDivElement>(null);
  const projectPopoverRef = useRef<HTMLDivElement>(null);

  // Notes management
  const saveNotes = useCallback(async (): Promise<void> => {
    if (!notesProfile || isSavingNotes) return;
    setIsSavingNotes(true);
    try {
      await updateProfile({
        profileId: notesProfile.id,
        expectedVersion: notesProfile.version,
        notes: notesText.trim(),
      });
      setNotesProfile(null);
      toastService.success('Notes saved.', 'Profile updated');
    } catch {
      toastService.error('Notes could not be saved.', 'Update failed');
    } finally {
      setIsSavingNotes(false);
    }
  }, [notesProfile, isSavingNotes, notesText, updateProfile]);

  const openNotes = (profile: ProfileView): void => {
    setNotesProfile(profile);
    setNotesText(profile.notes ?? '');
  };

  const cancelNotes = (): void => {
    setNotesProfile(null);
    setNotesText('');
  };

  // Keyboard and outside click event listeners
  useEffect(() => {
    const dismiss = (event: MouseEvent): void => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setContextMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setContextMenu(null);
        setNotesProfile(null);
        setInlineEditId(null);
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && notesProfile) {
        event.preventDefault();
        void saveNotes();
      }
    };
    document.addEventListener('mousedown', dismiss);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', dismiss);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [notesProfile, saveNotes]);

  useEffect(() => {
    if (notesProfile) noteInputRef.current?.focus();
  }, [notesProfile]);

  // Click outside listener for popovers
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tagPopoverRef.current && !tagPopoverRef.current.contains(e.target as Node)) {
        setTagPopoverProfile(null);
      }
      if (projectPopoverRef.current && !projectPopoverRef.current.contains(e.target as Node)) {
        setProjectPopoverProfile(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Popover openers
  const openTagPopover = (p: ProfileView, e: React.MouseEvent): void => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTagPopoverPos({ x: rect.left, y: rect.bottom + 4 });
    setTagPopoverProfile(p);
    setProjectPopoverProfile(null);
  };

  const openProjectPopover = (p: ProfileView, e: React.MouseEvent): void => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setProjectPopoverPos({ x: rect.left, y: rect.bottom + 4 });
    setProjectPopoverProfile(p);
    setTagPopoverProfile(null);
  };

  // Toggle single values in profile
  const handleToggleTagItem = async (p: ProfileView, tagToToggle: string): Promise<void> => {
    const currentTags = p.tags ?? [];
    const exists = currentTags.includes(tagToToggle);
    const newTags = exists
      ? currentTags.filter((t) => t !== tagToToggle)
      : [...currentTags, tagToToggle];

    try {
      await updateProfile({
        profileId: p.id,
        expectedVersion: p.version,
        tags: newTags,
      });
      // Hydrate local popover state to match updated tags
      setTagPopoverProfile({ ...p, tags: newTags });
    } catch {
      toastService.error('Failed to update tags');
    }
  };

  const handleSelectProject = async (p: ProfileView, projName: string): Promise<void> => {
    setProjectPopoverProfile(null);
    if (p.projectId === projName) return;

    try {
      await updateProfile({
        profileId: p.id,
        expectedVersion: p.version,
        projectId: projName,
      });
      toastService.success(`Assigned to Project "${projName}"`);
    } catch {
      toastService.error('Failed to assign project');
    }
  };

  const handleToggleFavorite = async (p: ProfileView, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();
    const isFaved = p.tags?.includes('faved') ?? false;
    const newTags = isFaved
      ? (p.tags ?? []).filter((t) => t !== 'faved')
      : [...(p.tags ?? []), 'faved'];
    try {
      await updateProfile({
        profileId: p.id,
        expectedVersion: p.version,
        tags: newTags,
      });
    } catch {
      toastService.error('Failed to update favorite');
    }
  };

  const handleLaunchToggle = (profile: ProfileView): void => {
    const isRunning = profile.status === 'running';
    void toggleLaunch({ profile, isRunning });
  };

  // Tag creation & manager actions
  const handleCreateNewTag = async (): Promise<void> => {
    const name = newTagName.trim();
    if (!name) return;

    if (!availableTags.some((t) => t.name === name)) {
      setAvailableTags((prev) => [...prev, { name, color: selectedTagColor }]);
    }
    setIsAddTagModalOpen(false);
    setNewTagName('');
    toastService.success(`Tag "${name}" created`);
  };

  const handleConfirmDeleteTag = (targetName: string) => {
    setAvailableTags((prev) => prev.filter((t) => t.name !== targetName));

    // Clean up deleted tags from profiles query cache directly
    queryClient.setQueriesData<{ items: ProfileView[]; total: number }>(
      { queryKey: queryKeys.profiles.lists() },
      (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          items: oldData.items.map((p) => ({
            ...p,
            tags: p.tags?.filter((t) => t !== targetName),
          })),
        };
      },
    );

    setDeletingTag(null);
    toastService.success(`Tag "${targetName}" deleted`);
  };

  // Inline rename
  const startInlineEdit = (p: ProfileView): void => {
    setInlineEditId(p.id);
    setInlineNameText(p.name);
  };

  const saveInlineName = async (p: ProfileView): Promise<void> => {
    if (!inlineEditId) return;
    const newName = inlineNameText.trim();
    setInlineEditId(null);
    if (!newName || newName === p.name) return;

    try {
      await updateProfile({
        profileId: p.id,
        expectedVersion: p.version,
        name: newName,
      });
      toastService.success(`Renamed to "${newName}"`);
    } catch {
      toastService.error('Failed to rename profile');
    }
  };

  // Bulk actions
  const handleBulkOpen = (): void => {
    const selectedProfiles = profiles.filter((p) => selectedIds.has(p.id));
    void bulkLaunch(selectedProfiles);
  };

  const handleBulkClose = (): void => {
    const selectedProfiles = profiles.filter((p) => selectedIds.has(p.id));
    void bulkStop(selectedProfiles);
  };

  const proxyMap = useMemo(() => new Map(proxies.map((p) => [p.id, p])), [proxies]);

  // Construct Row Context dynamically
  const rowContext: ProfileRowContext = useMemo(
    () => ({
      currentPage,
      pageSize,
      idx: 0,
      isChecked: false,
      isLaunching: false,
      isStopping: false,
      launchingIds,
      stoppingIds,
      inlineEditId,
      inlineNameText,
      showNotesText,
      proxyMap,
      onSelectOne: handleSelectOne,
      onRowClick: handleRowClick,
      onLaunchToggle: handleLaunchToggle,
      onOpenNotes: openNotes,
      onOpenTagPopover: openTagPopover,
      onOpenProjectPopover: openProjectPopover,
      onToggleFavorite: handleToggleFavorite,
      onContextMenu: (profile, e) => {
        e.preventDefault();
        e.stopPropagation();
        const menuW = 236;
        const menuH = 440;
        const x = e.clientX + menuW > window.innerWidth - 8 ? e.clientX - menuW : e.clientX;
        const y = e.clientY + menuH > window.innerHeight - 8 ? e.clientY - menuH : e.clientY;
        setContextMenu({ profile, x, y });
      },
      onStartInlineEdit: startInlineEdit,
      onSaveInlineName: saveInlineName,
      onInlineNameTextChange: setInlineNameText,
      onCancelInlineEdit: () => setInlineEditId(null),
      onShowNotesToggle: () => setShowNotesText((v) => !v),
      onRestoreProfile: (profile) => {
        const newTags = (profile.tags ?? []).filter((t) => t !== 'trash');
        void updateProfile({
          profileId: profile.id,
          expectedVersion: profile.version,
          tags: newTags,
        }).then(() => toastService.success(`Restored profile "${profile.name}"`));
      },
      onDeletePermanently: (profileId) => {
        void deleteProfile(profileId);
      },
    }),
    [
      currentPage,
      pageSize,
      inlineEditId,
      inlineNameText,
      showNotesText,
      proxyMap,
      launchingIds,
      stoppingIds,
      deleteProfile,
      updateProfile,
      toggleLaunch,
    ],
  );

  return (
    <ProfilesWorkspaceShell
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      activeTab={activeTab}
      tabCounts={tabCounts}
      onTabChange={setActiveTab}
      onOpenTagManager={() => setIsTagManagerOpen(true)}
      isLoading={isLoading}
      isError={isError}
      refetch={refetch}
      tabConfig={tabConfig}
      locationState={locationState}
      paginatedProfiles={paginatedProfiles}
      rowContext={rowContext}
      selectedIds={selectedIds}
      sortKey={sortKey}
      sortDir={sortDir}
      onSelectAll={handleSelectAll}
      onSort={handleSort}
      onNavigateToCreate={() => navigate('/profiles/create')}
      totalItems={totalItems}
      pageSize={pageSize}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageSizeChange={setPageSize}
      onPageChange={setCurrentPage}
      clearSelection={clearSelection}
      handleBulkOpen={handleBulkOpen}
      handleBulkClose={handleBulkClose}
      contextMenu={contextMenu}
      menuRef={menuRef}
      onCloseContextMenu={() => setContextMenu(null)}
      handleLaunchToggle={handleLaunchToggle}
      duplicateProfile={duplicateProfile}
      deleteProfile={deleteProfile}
      openNotes={openNotes}
      onEditClick={(id) => navigate(`/profiles/${id}/edit`)}
      setIsAddTagModalOpen={setIsAddTagModalOpen}
      notesProfile={notesProfile}
      notesText={notesText}
      isSavingNotes={isSavingNotes}
      noteInputRef={noteInputRef}
      onNotesTextChange={setNotesText}
      onSaveNotes={() => void saveNotes()}
      onCancelNotes={cancelNotes}
      tagPopoverProfile={tagPopoverProfile}
      tagPopoverRef={tagPopoverRef}
      tagPopoverPos={tagPopoverPos}
      availableTags={availableTags}
      onToggleTagItem={handleToggleTagItem}
      projectPopoverProfile={projectPopoverProfile}
      projectPopoverRef={projectPopoverRef}
      projectPopoverPos={projectPopoverPos}
      projectsList={projectsList}
      onSelectProject={handleSelectProject}
      isAddTagModalOpen={isAddTagModalOpen}
      selectedTagColor={selectedTagColor}
      newTagName={newTagName}
      onSelectedTagColorChange={setSelectedTagColor}
      onNewTagNameChange={setNewTagName}
      onCreateNewTag={handleCreateNewTag}
      onCloseAddTagModal={() => setIsAddTagModalOpen(false)}
      isTagManagerOpen={isTagManagerOpen}
      onCloseTagManager={() => setIsTagManagerOpen(false)}
      tagManagerSelected={tagManagerSelected}
      onToggleTagManagerSelected={(name) => {
        setTagManagerSelected((prev) => {
          const next = new Set(prev);
          if (next.has(name)) next.delete(name);
          else next.add(name);
          return next;
        });
      }}
      onToggleSelectAllTags={() => {
        if (tagManagerSelected.size === availableTags.length) {
          setTagManagerSelected(new Set());
        } else {
          setTagManagerSelected(new Set(availableTags.map((t) => t.name)));
        }
      }}
      onEditTagClick={(name, color) => {
        setNewTagName(name);
        setSelectedTagColor(color);
        setIsAddTagModalOpen(true);
      }}
      onDeleteTagClick={setDeletingTag}
      deletingTag={deletingTag}
      onCloseDeleteTagConfirm={() => setDeletingTag(null)}
      onConfirmDeleteTag={handleConfirmDeleteTag}
      profiles={profiles}
    />
  );
}
