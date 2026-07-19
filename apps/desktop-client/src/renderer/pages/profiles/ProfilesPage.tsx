import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Check,
  Cookie,
  Copy,
  Eraser,
  Eye,
  EyeOff,
  FilePlus,
  FileText,
  Filter,
  FlaskConical,
  FolderKanban,
  Layers,
  Layers3,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Share2,
  Shuffle,
  Square,
  Tag,
  Trash2,
  UserPlus,
  Wifi,
  X,
} from 'lucide-react';
import type {
  ProfileRuntimeEvent,
  ProfileView,
  ProxyView,
} from '../../../shared/profile-contracts.js';
import { useProfileLifecycle, useRemoveProfile } from '../../hooks/useProfiles.js';
import { CountryFlag } from '../../components/CountryFlag/CountryFlag.js';
import { Tooltip } from '../../components/ui/Tooltip/index.js';
import { toastService } from '../../services/toast-service.js';
import { osAssets, browserAssets, type PreviewOs } from './profile-assets.js';
import './ProfilesPage.css';

type ProfilesLoadState = 'loading' | 'success' | 'error';
type TabType = 'all' | 'favorite' | 'opened' | 'transferring' | 'trash';
type SortKey = 'serial' | 'name' | 'lastOpen';
type SortDir = 'asc' | 'desc';

interface ProfilesLocationState {
  createdProfileId?: string;
  updatedProfileId?: string;
}

interface ContextMenuState {
  readonly profile: ProfileView;
  readonly x: number;
  readonly y: number;
}

function toVisibleStatus(event: ProfileRuntimeEvent): ProfileView['status'] {
  if (
    event.state === 'starting' ||
    event.state === 'validating' ||
    event.state === 'waiting' ||
    event.state === 'acquiring_lock' ||
    event.state === 'preparing'
  ) {
    return 'starting';
  }
  if (event.state === 'running' || event.state === 'stopping') return 'running';
  if (event.state === 'error' || event.state === 'crashed' || event.state === 'locked') return 'error';
  return 'stopped';
}

function formatLastOpenTime(value: string | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

/** Colored OS logo from bundled SVG asset */
function OsIcon({ os, size = 16 }: { os: PreviewOs; size?: number }): JSX.Element {
  const label = os === 'windows' ? 'Windows' : os === 'mac' ? 'macOS' : 'Linux';
  return (
    <img
      src={osAssets[os].icon}
      alt={label}
      width={size}
      height={size}
      draggable={false}
      style={{ display: 'block', flexShrink: 0 }}
    />
  );
}

/** Fingerprint / kernel icon — coloured Chrome SVG */
function KernelIcon({ size = 16 }: { size?: number }): JSX.Element {
  return (
    <img
      src={browserAssets['chrome'].icon}
      alt="Chrome"
      width={size}
      height={size}
      draggable={false}
      style={{ display: 'block', flexShrink: 0, opacity: 0.6 }}
    />
  );
}

/** Action button with Open / View / Starting states */
function OpenButton({
  isRunning,
  isLoading,
  onClick,
}: {
  isRunning: boolean;
  isLoading: boolean;
  onClick: (e: React.MouseEvent) => void;
}): JSX.Element {
  if (isLoading) {
    return (
      <button type="button" className="prow-open-btn prow-open-btn--loading" disabled>
        <span className="prow-open-btn__spinner" />
        <span>Starting...</span>
      </button>
    );
  }

  if (isRunning) {
    return (
      <button type="button" className="prow-open-btn prow-open-btn--running" onClick={onClick}>
        <img
          src={browserAssets['chrome'].icon}
          alt=""
          width={14}
          height={14}
          draggable={false}
          aria-hidden
        />
        <span>View</span>
      </button>
    );
  }

  return (
    <button type="button" className="prow-open-btn" onClick={onClick}>
      <img
        src={browserAssets['chrome'].icon}
        alt=""
        width={14}
        height={14}
        draggable={false}
        aria-hidden
      />
      <span>Open</span>
    </button>
  );
}

/** Account + popup trigger in serial cell */
function AccountPlusTrigger(): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="prow-account-wrap" ref={ref}>
      <button
        type="button"
        className="prow-account-btn"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        aria-label="Add account"
      >
        <Plus size={12} strokeWidth={2} />
      </button>
      {open && (
        <div className="account-popover" role="menu" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="account-popover-item"
            role="menuitem"
            onClick={(e) => { e.stopPropagation(); setOpen(false); toastService.info('Add Account clicked'); }}
          >
            <Plus size={16} strokeWidth={1.75} />
            <span>Add Account</span>
          </button>
          <button
            type="button"
            className="account-popover-item"
            role="menuitem"
            onClick={(e) => { e.stopPropagation(); setOpen(false); toastService.info('Select Account clicked'); }}
          >
            <UserPlus size={16} strokeWidth={1.75} />
            <span>Select Account</span>
          </button>
        </div>
      )}
    </div>
  );
}

/** Small sort indicator arrow(s) for table header */
function SortIndicator({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }): JSX.Element {
  if (col !== sortKey) {
    return <span className="ptable__th-sort-arrows"><ChevronUp size={10} /><ChevronDown size={10} /></span>;
  }
  return sortDir === 'asc'
    ? <ChevronUp size={11} className="ptable__th-sort-active" />
    : <ChevronDown size={11} className="ptable__th-sort-active" />;
}

export function ProfilesPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as ProfilesLocationState | null;
  const { launch, stop, launchingIds, stoppingIds } = useProfileLifecycle();
  const { remove } = useRemoveProfile(() => { void loadProfiles(); });

  const [profiles, setProfiles] = useState<ProfileView[]>([]);
  const [proxies, setProxies] = useState<ProxyView[]>([]);
  const [loadState, setLoadState] = useState<ProfilesLoadState>('loading');

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [notesProfile, setNotesProfile] = useState<ProfileView | null>(null);
  const [notesText, setNotesText] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineNameText, setInlineNameText] = useState('');
  const [showNotesText, setShowNotesText] = useState(false);

  /* ── Tag & Project Selector States ── */
  const [availableTags, setAvailableTags] = useState<Array<{ name: string; color: string }>>([
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

  const tagPopoverRef = useRef<HTMLDivElement>(null);
  const projectPopoverRef = useRef<HTMLDivElement>(null);

  const [sortKey, setSortKey] = useState<SortKey>('serial');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const menuRef = useRef<HTMLDivElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadProfiles = useCallback(async (): Promise<void> => {
    setLoadState('loading');
    try {
      const result = await window.desktop.profile.list({ limit: 100, offset: 0 });
      setProfiles(result.items);
      setLoadState('success');
    } catch {
      setLoadState('error');
    }
  }, []);

  const loadProxies = useCallback(async (): Promise<void> => {
    try {
      const result = await window.desktop.proxy.list({ limit: 100, offset: 0 });
      setProxies(result.items);
    } catch {
      setProxies([]);
    }
  }, []);

  useEffect(() => {
    void loadProfiles();
    void loadProxies();
  }, [loadProfiles, loadProxies]);

  useEffect(() => {
    return window.desktop.profile.subscribeRuntime((event) => {
      setProfiles((current) =>
        current.map((profile) =>
          profile.id === event.profileId ? { ...profile, status: toVisibleStatus(event) } : profile,
        ),
      );
    });
  }, []);

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
  }, [notesProfile]);

  useEffect(() => {
    if (notesProfile) noteInputRef.current?.focus();
  }, [notesProfile]);

  const proxyMap = useMemo(() => new Map(proxies.map((p) => [p.id, p])), [proxies]);

  const filteredProfiles = useMemo(() => {
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
        (p) => p.name.toLowerCase().includes(term) || (p.notes && p.notes.toLowerCase().includes(term)),
      );
    }
    return result;
  }, [activeTab, profiles, searchTerm]);

  const sortedProfiles = useMemo(() => {
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
  }, [filteredProfiles, sortKey, sortDir]);

  const paginatedProfiles = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedProfiles.slice(start, start + pageSize);
  }, [sortedProfiles, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedProfiles.length / pageSize) || 1;

  const handleSort = (col: SortKey): void => {
    if (col === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col);
      setSortDir('asc');
    }
    setCurrentPage(1);
  };

  const handleLaunchToggle = async (profile: ProfileView): Promise<void> => {
    if (profile.status === 'running') {
      await stop(profile.id);
    } else {
      await launch(profile.id);
    }
    void loadProfiles();
  };

  const handleDuplicate = async (profile: ProfileView): Promise<void> => {
    try {
      const name = `${profile.name} - Copy`;
      await window.desktop.profile.create({
        name,
        os: profile.os,
        engine: profile.engine,
        distribution: profile.distribution,
        channel: profile.channel,
        ...(profile.proxyId ? { proxyId: profile.proxyId } : {}),
        ...(profile.notes ? { notes: profile.notes } : {}),
        ...(profile.projectId ? { projectId: profile.projectId } : {}),
        tags: profile.tags ?? [],
        startupUrls: profile.startupUrls ?? [],
        ...(profile.cookies ? { cookies: profile.cookies } : {}),
      });
      void loadProfiles();
      toastService.success(`Duplicated: ${name}`);
    } catch {
      toastService.error('Could not duplicate profile.');
    }
  };

  const handleSelectAll = (checked: boolean): void => {
    if (checked) {
      setSelectedIds(new Set(paginatedProfiles.map((p) => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleRowClick = (id: string): void => {
    handleSelectOne(id, !selectedIds.has(id));
  };

  const saveNotes = async (): Promise<void> => {
    if (!notesProfile || isSavingNotes) return;
    setIsSavingNotes(true);
    try {
      const updated = await window.desktop.profile.update({
        profileId: notesProfile.id,
        expectedVersion: notesProfile.version,
        notes: notesText.trim(),
      });
      setProfiles((current) =>
        current.map((profile) => (profile.id === updated.id ? updated : profile)),
      );
      setNotesProfile(null);
      toastService.success('Notes saved.', 'Profile updated');
    } catch {
      toastService.error('Notes could not be saved.', 'Update failed');
    } finally {
      setIsSavingNotes(false);
    }
  };

  const openContextMenu = (profile: ProfileView, e: React.MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    const menuW = 236;
    const menuH = 440;
    const x = e.clientX + menuW > window.innerWidth - 8 ? e.clientX - menuW : e.clientX;
    const y = e.clientY + menuH > window.innerHeight - 8 ? e.clientY - menuH : e.clientY;
    setContextMenu({ profile, x, y });
  };

  const runSelectedAction = async (action: 'open' | 'close'): Promise<void> => {
    const sel = profiles.filter((p) => selectedIds.has(p.id));
    await Promise.all(sel.map((p) => (action === 'open' ? launch(p.id) : stop(p.id))));
    toastService.success(`${action === 'open' ? 'Opened' : 'Closed'} ${sel.length} profile(s).`);
    void loadProfiles();
  };

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

  const handleToggleTagItem = async (p: ProfileView, tagToToggle: string): Promise<void> => {
    const currentTags = p.tags ?? [];
    const exists = currentTags.includes(tagToToggle);
    const newTags = exists
      ? currentTags.filter((t) => t !== tagToToggle)
      : [...currentTags, tagToToggle];

    try {
      const updated = await window.desktop.profile.update({
        profileId: p.id,
        expectedVersion: p.version,
        tags: newTags,
      });
      setProfiles((curr) => curr.map((item) => (item.id === updated.id ? updated : item)));
      setTagPopoverProfile(updated);
    } catch {
      toastService.error('Failed to update tags');
    }
  };

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

  const handleSelectProject = async (p: ProfileView, projName: string): Promise<void> => {
    setProjectPopoverProfile(null);
    if (p.projectId === projName) return;

    try {
      const updated = await window.desktop.profile.update({
        profileId: p.id,
        expectedVersion: p.version,
        projectId: projName,
      });
      setProfiles((curr) => curr.map((item) => (item.id === updated.id ? updated : item)));
      toastService.success(`Assigned to Project "${projName}"`);
    } catch {
      toastService.error('Failed to assign project');
    }
  };

  const openNotes = (profile: ProfileView): void => {
    setNotesProfile(profile);
    setNotesText(profile.notes ?? '');
  };

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
      const updated = await window.desktop.profile.update({
        profileId: p.id,
        expectedVersion: p.version,
        name: newName,
      });
      setProfiles((curr) => curr.map((item) => (item.id === updated.id ? updated : item)));
      toastService.success(`Renamed to "${newName}"`);
    } catch {
      toastService.error('Failed to rename profile');
    }
  };

  /** Toggle faved tag on a profile */
  const toggleFavorite = async (p: ProfileView, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();
    const isFaved = p.tags?.includes('faved') ?? false;
    const newTags = isFaved
      ? (p.tags ?? []).filter((t) => t !== 'faved')
      : [...(p.tags ?? []), 'faved'];
    try {
      const updated = await window.desktop.profile.update({
        profileId: p.id,
        expectedVersion: p.version,
        tags: newTags,
      });
      setProfiles((curr) => curr.map((item) => (item.id === updated.id ? updated : item)));
    } catch {
      toastService.error('Failed to update favorite');
    }
  };

  /* ─────────────── Columns header ─────────────── */
  const TH_COLS = (
    <tr>
      <th style={{ width: 44 }} className="text-center">
        <button
          type="button"
          className={`ptable__checkbox ${selectedIds.size === paginatedProfiles.length && paginatedProfiles.length > 0 ? 'ptable__checkbox--checked' : ''}`}
          onClick={() => handleSelectAll(selectedIds.size !== paginatedProfiles.length)}
          aria-label="Select all"
        >
          {selectedIds.size === paginatedProfiles.length && paginatedProfiles.length > 0 && (
            <Check size={11} strokeWidth={2.5} />
          )}
        </button>
      </th>
      <th
        style={{ width: 140, cursor: 'pointer' }}
        onClick={() => handleSort('serial')}
      >
        Serial No. <SortIndicator col="serial" sortKey={sortKey} sortDir={sortDir} />
      </th>
      <th style={{ width: 150, cursor: 'pointer' }} onClick={() => handleSort('name')}>
        Profile Name <SortIndicator col="name" sortKey={sortKey} sortDir={sortDir} />
      </th>
      <th style={{ width: 110 }} className="text-center">Action</th>
      <th style={{ width: showNotesText ? 180 : 110 }} className="text-center">
        Notes{' '}
        <span
          className="ptable__th-hide"
          data-tooltip={showNotesText ? 'Hide note content' : 'Show note content'}
          onClick={() => setShowNotesText((v) => !v)}
        >
          {showNotesText ? <EyeOff size={13} strokeWidth={1.75} /> : <Eye size={13} strokeWidth={1.75} />}
        </span>
      </th>
      <th style={{ width: 90 }} className="text-center">Tag</th>
      <th style={{ width: 120 }} className="text-center">Project</th>
      <th
        style={{ width: 180, cursor: 'pointer' }}
        className="text-center"
        onClick={() => handleSort('lastOpen')}
      >
        Last open time <SortIndicator col="lastOpen" sortKey={sortKey} sortDir={sortDir} />
      </th>
      <th style={{ width: 160 }} className="text-center ptable__th--other">Other</th>
    </tr>
  );

  /* ─────────────── Skeleton ─────────────── */
  const SkeletonRows = (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <tr key={i} className="ptable__row ptable__row--skeleton">
          <td><div className="psk psk--box" style={{ width: 16, height: 16 }} /></td>
          <td><div className="psk" style={{ width: 56 }} /></td>
          <td><div className="psk" style={{ width: 240 }} /></td>
          <td><div className="psk" style={{ width: 72 }} /></td>
          <td><div className="psk psk--box" style={{ width: 22 }} /></td>
          <td><div className="psk" style={{ width: 56 }} /></td>
          <td><div className="psk" style={{ width: 80 }} /></td>
          <td><div className="psk" style={{ width: 140 }} /></td>
          <td><div className="psk" style={{ width: 80 }} /></td>
        </tr>
      ))}
    </>
  );

  return (
    <div className="ppage">
      {/* ─── Tabs bar ─── */}
      <nav className="ptabs" aria-label="Profile tabs">
        <div className="ptabs__list">
          {(
            [
              { id: 'all', label: 'Profiles' },
              { id: 'favorite', label: 'Favorite' },
              { id: 'opened', label: 'Opened' },
              { id: 'transferring', label: 'Transferring', icon: <Share2 size={14} strokeWidth={1.75} /> },
              { id: 'trash', label: 'Trash', icon: <Trash2 size={14} strokeWidth={1.75} /> },
            ] as { id: TabType; label: string; icon?: JSX.Element }[]
          ).map((tab) => {
            // Count badge
            let count = 0;
            if (tab.id === 'favorite') count = profiles.filter((p) => p.tags?.includes('faved')).length;
            else if (tab.id === 'opened') count = profiles.filter((p) => p.status === 'running').length;
            else if (tab.id === 'transferring') count = profiles.filter((p) => p.status === 'starting').length;
            else if (tab.id === 'trash') count = profiles.filter((p) => p.tags?.includes('trash')).length;
            else count = profiles.filter((p) => !p.tags?.includes('trash')).length;

            return (
              <button
                key={tab.id}
                type="button"
                className={`ptabs__tab ${activeTab === tab.id ? 'ptabs__tab--active' : ''}`}
                onClick={() => { setActiveTab(tab.id); setCurrentPage(1); }}
              >
                {tab.icon && <span className="ptabs__tab-icon">{tab.icon}</span>}
                {tab.label}
                {count > 0 && <span className="ptabs__tab-count">{count}</span>}
              </button>
            );
          })}
        </div>
        <div className="ptabs__utils">
          <Tooltip content="Column settings" variant="compact">
            <button type="button" className="ptabs__util-btn" aria-label="Column settings">
              <Settings size={16} strokeWidth={1.75} />
            </button>
          </Tooltip>
          <div className="ptabs__divider-vertical" />
          <Tooltip content="Tag Management" variant="compact">
            <button
              type="button"
              className="ptabs__util-btn ptabs__util-btn--active"
              aria-label="Tag Management"
              onClick={() => setIsTagManagerOpen(true)}
            >
              <Tag size={16} strokeWidth={1.75} />
            </button>
          </Tooltip>
        </div>
      </nav>

      {/* ─── Toolbar ─── */}
      <header className="ptoolbar">
        <div className="ptoolbar__left">
          <label className="ptoolbar__search-wrap">
            <Search size={15} strokeWidth={1.75} className="ptoolbar__search-icon" aria-hidden />
            <input
              type="search"
              placeholder="Search Ctrl + F"
              className="ptoolbar__search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search profiles"
            />
          </label>
          <button type="button" className="ptoolbar__filter-btn">
            <Filter size={15} strokeWidth={1.75} />
            <span>Add filter</span>
          </button>
        </div>
        <div className="ptoolbar__right">
          <button
            type="button"
            className="ptoolbar__action-btn"
            onClick={() => toastService.info('Testing all proxies...')}
          >
            <Wifi size={15} strokeWidth={1.75} />
            <span>Test all</span>
          </button>
          <button
            type="button"
            className="ptoolbar__icon-btn"
            aria-label="Column picker"
            onClick={() => toastService.info('Column picker coming soon')}
          >
            <Layers size={16} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={`ptoolbar__icon-btn ${loadState === 'loading' ? 'ptoolbar__icon-btn--spinning' : ''}`}
            aria-label="Reload profiles"
            onClick={() => { void loadProfiles(); void loadProxies(); }}
            disabled={loadState === 'loading'}
          >
            <RefreshCw size={15} strokeWidth={1.75} />
          </button>
        </div>
      </header>

      {/* ─── Main content ─── */}
      <main className="pcontent">
        {locationState?.createdProfileId && loadState === 'success' && (
          <div className="pnotice pnotice--success" role="status">Profile created successfully.</div>
        )}
        {locationState?.updatedProfileId && loadState === 'success' && (
          <div className="pnotice pnotice--success" role="status">Profile updated successfully.</div>
        )}

        {loadState === 'error' && (
          <div className="pstate-card pstate-card--error" role="alert">
            <AlertTriangle size={36} strokeWidth={1.75} />
            <h2>Failed to load profiles</h2>
            <p>Could not connect to workspace database.</p>
            <button type="button" className="button button--secondary" onClick={() => void loadProfiles()}>
              Retry
            </button>
          </div>
        )}

        {(loadState === 'loading' || loadState === 'success') && (
          <div className="ptable-wrap">
            <table className="ptable">
              <thead>{TH_COLS}</thead>
              <tbody>
                {loadState === 'loading' && SkeletonRows}
                {loadState === 'success' && sortedProfiles.length === 0 && (
                  <tr>
                    <td colSpan={9}>
                      <div className="pstate-card" role="status">
                        <FileText size={36} strokeWidth={1.75} />
                        <h2>No profiles found</h2>
                        <p>Create your first profile to get started.</p>
                        <button
                          type="button"
                          className="button button--primary"
                          onClick={() => navigate('/profiles/create')}
                        >
                          <Plus size={16} strokeWidth={1.75} />
                          <span>Create Profile</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                {loadState === 'success' &&
                  paginatedProfiles.map((p, idx) => {
                    const isChecked = selectedIds.has(p.id);
                    const serialNo = `ATH-${(currentPage - 1) * pageSize + idx + 1}`;
                    const countryCode = proxyMap.get(p.proxyId ?? '')?.countryCode || 'vn';
                    const isLaunching = launchingIds.has(p.id);
                    const isStopping = stoppingIds.has(p.id);
                    const isRunning = p.status === 'running';
                    const osLabel = p.os === 'windows' ? 'Windows 11' : p.os === 'mac' ? 'macOS' : 'Linux';
                    const kernelLabel = `${p.distribution ?? 'Chrome'} ${p.channel ?? ''}`.trim();
                    const visibleTags = p.tags?.filter((t) => Boolean(t) && t.trim() !== '' && t !== 'faved' && t !== 'trash') ?? [];
                    const isFaved = p.tags?.includes('faved') ?? false;

                    return (
                      <tr
                        key={p.id}
                        className={`ptable__row ${isChecked ? 'ptable__row--selected' : ''}`}
                        onClick={() => handleRowClick(p.id)}
                        onContextMenu={(e) => openContextMenu(p, e)}
                        style={{ cursor: 'pointer' }}
                      >
                        {/* Checkbox */}
                        <td className="text-center">
                          <button
                            type="button"
                            className={`ptable__checkbox ${isChecked ? 'ptable__checkbox--checked' : ''}`}
                            onClick={(e) => { e.stopPropagation(); handleSelectOne(p.id, !isChecked); }}
                            aria-label={`Select ${p.name}`}
                          >
                            {isChecked && <Check size={11} strokeWidth={2.5} />}
                          </button>
                        </td>

                        {/* Serial + icons chip row */}
                        <td>
                          <div className="prow-serial">
                            <span className="prow-serial__num">{serialNo}</span>
                            <div className="prow-icons">
                              {/* OS icon */}
                              <Tooltip
                                content={`OS: ${osLabel}\nKernel: ${kernelLabel}`}
                                variant="multiline"
                              >
                                <span className="prow-icon-wrap">
                                  <OsIcon os={p.os} size={16} />
                                </span>
                              </Tooltip>
                              {/* Dotted proxy line + country flag */}
                              <Tooltip
                                content={`${countryCode.toUpperCase()}  Just now\nIP: 14.191.216.101`}
                                variant="multiline"
                              >
                                <span className="prow-proxy-line">
                                  <span className="prow-proxy-line__dash" />
                                  <CountryFlag code={countryCode} size={16} />
                                  <span className="prow-proxy-line__dash" />
                                </span>
                              </Tooltip>
                              {/* Kernel icon */}
                              <Tooltip content={kernelLabel} variant="compact">
                                <span className="prow-icon-wrap">
                                  <KernelIcon size={16} />
                                </span>
                              </Tooltip>
                              {/* Account + popup */}
                              <AccountPlusTrigger />
                            </div>
                          </div>
                        </td>

                        {/* Profile name (seamless inline rename) */}
                        <td>
                          {inlineEditId === p.id ? (
                            <input
                              type="text"
                              className="profile-name-input"
                              value={inlineNameText}
                              onChange={(e) => setInlineNameText(e.target.value)}
                              onBlur={() => void saveInlineName(p)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') void saveInlineName(p);
                                if (e.key === 'Escape') setInlineEditId(null);
                              }}
                              autoFocus
                              onFocus={(e) => e.target.select()}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <div
                              className="profile-name-display"
                              onClick={() => {
                                startInlineEdit(p);
                              }}
                            >
                              <span className="profile-name-text-inner">{p.name}</span>
                            </div>
                          )}
                        </td>

                        {/* Action */}
                        <td className="text-center">
                          <OpenButton
                            isRunning={isRunning}
                            isLoading={isLaunching || isStopping}
                            onClick={(e) => { e.stopPropagation(); void handleLaunchToggle(p); }}
                          />
                        </td>

                        {/* Notes */}
                        <td className="text-center">
                          <div className="prow-cell-center">
                            {p.notes ? (
                              showNotesText ? (
                                <Tooltip content={p.notes} variant="content">
                                  <span
                                    className="prow-note-text"
                                    onClick={(e) => { e.stopPropagation(); openNotes(p); }}
                                  >
                                    {p.notes}
                                  </span>
                                </Tooltip>
                              ) : (
                                <Tooltip content={p.notes} variant="content">
                                  <button
                                    type="button"
                                    className="row-icon-button"
                                    onClick={(e) => { e.stopPropagation(); openNotes(p); }}
                                  >
                                    <FileText size={16} fill="#159cf4" color="#159cf4" strokeWidth={1.5} />
                                  </button>
                                </Tooltip>
                              )
                            ) : (
                              <Tooltip content="Add notes" variant="compact">
                                <button
                                  type="button"
                                  className="row-icon-button"
                                  onClick={(e) => { e.stopPropagation(); openNotes(p); }}
                                  aria-label="Add notes"
                                >
                                  <FilePlus size={16} strokeWidth={1.75} />
                                </button>
                              </Tooltip>
                            )}
                          </div>
                        </td>

                        {/* Tag */}
                        <td className="text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="prow-cell-center prow-cell-center--tags">
                            {visibleTags.length > 0 ? (
                              <div
                                className="prow-tag-group"
                                onClick={(e) => openTagPopover(p, e)}
                              >
                                <Tooltip content={visibleTags[0] ?? ''} variant="compact">
                                  <span className="prow-tag-avatar">
                                    {(visibleTags[0] ?? '').slice(0, 2).toUpperCase()}
                                  </span>
                                </Tooltip>
                                {visibleTags.slice(1).map((t) => (
                                  <span key={t} className="prow-tag-pill">
                                    <span className="prow-tag-pill__dot" />
                                    <span>{t}</span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <Tooltip content="Add Tag" variant="compact">
                                <button
                                  type="button"
                                  className="prow-tag-empty-btn"
                                  onClick={(e) => openTagPopover(p, e)}
                                  aria-label="Add tag"
                                >
                                  <i className="prow-tag-empty-icon">
                                    <Tag size={15} strokeWidth={1.75} />
                                  </i>
                                </button>
                              </Tooltip>
                            )}
                          </div>
                        </td>

                        {/* Project */}
                        <td className="text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="prow-cell-center">
                            <button
                              type="button"
                              className="prow-project-btn"
                              onClick={(e) => openProjectPopover(p, e)}
                            >
                              <Layers3 size={13} strokeWidth={1.75} />
                              <span>{p.projectId || 'Default'}</span>
                            </button>
                          </div>
                        </td>

                        {/* Last open time */}
                        <td className="text-center">
                          <span className="prow-time">{formatLastOpenTime(p.updatedAt)}</span>
                        </td>

                        {/* Other (Sticky right column) */}
                        <td className="text-center ptable__td--other" onClick={(e) => e.stopPropagation()}>
                          <div className="prow-other">
                            <Tooltip content="Favorite" variant="compact">
                              <button
                                type="button"
                                className="row-icon-button"
                                onClick={(e) => { void toggleFavorite(p, e); }}
                              >
                                <Bookmark
                                  size={16}
                                  fill={isFaved ? '#f8a900' : 'none'}
                                  color={isFaved ? '#f8a900' : '#66737D'}
                                  strokeWidth={1.5}
                                />
                              </button>
                            </Tooltip>
                            <Tooltip content="Transfer profile" variant="compact">
                              <button
                                type="button"
                                className="row-icon-button"
                                onClick={(e) => { e.stopPropagation(); toastService.info('Transfer profile'); }}
                              >
                                <Share2 size={16} strokeWidth={1.75} />
                              </button>
                            </Tooltip>
                            <Tooltip content="Assign user" variant="compact">
                              <button
                                type="button"
                                className="row-icon-button"
                                onClick={(e) => { e.stopPropagation(); toastService.info('Assign user'); }}
                              >
                                <UserPlus size={16} strokeWidth={1.75} />
                              </button>
                            </Tooltip>
                            <Tooltip content="More actions" variant="compact">
                              <button
                                type="button"
                                className="row-icon-button"
                                aria-label="More actions"
                                onClick={(e) => { openContextMenu(p, e); }}
                              >
                                <MoreHorizontal size={16} strokeWidth={1.75} />
                              </button>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* ─── Footer pagination ─── */}
      {loadState === 'success' && sortedProfiles.length > 0 && (
        <footer className="pfooter">
          <div className="pfooter__left">
            <span>Total {sortedProfiles.length}</span>
            <span className="pfooter__divider">|</span>
            <button type="button" className="pfooter__action-btn" onClick={() => toastService.info('Testing...')}>
              <FlaskConical size={14} strokeWidth={1.75} />
              <span>test</span>
            </button>
            <button type="button" className="pfooter__action-btn" onClick={() => toastService.info('Add tags...')}>
              <Tag size={14} strokeWidth={1.75} />
              <span>Tag</span>
            </button>
            <button type="button" className="pfooter__action-btn" onClick={() => toastService.info('Add notes...')}>
              <FileText size={14} strokeWidth={1.75} />
              <span>Notes</span>
            </button>
          </div>
          <div className="pfooter__right">
            <select
              className="pfooter__page-size-sel"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              aria-label="Page size"
            >
              <option value={10}>10/page</option>
              <option value={20}>20/page</option>
              <option value={50}>50/page</option>
            </select>
            <div className="pfooter__pagination">
              <span className="pfooter__jump-label">Jump to Page</span>
              <input
                className="pfooter__jump-input"
                type="number"
                min={1}
                max={totalPages}
                value={currentPage}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(totalPages, Number(e.target.value)));
                  if (v) setCurrentPage(v);
                }}
                aria-label="Jump to page"
              />
              <button
                type="button"
                className="pfooter__nav-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} strokeWidth={1.75} />
              </button>
              <span className="pfooter__page-num">{currentPage}</span>
              <button
                type="button"
                className="pfooter__nav-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight size={14} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* ─── Bulk action bar (RoxyBrowser Style) ─── */}
      {selectedIds.size > 0 && (
        <div className="pbulk" role="toolbar" aria-label="Bulk actions">
          <div className="pbulk__count-chip">
            <span>{selectedIds.size} / {sortedProfiles.length} selected</span>
            <button
              type="button"
              className="pbulk__clear-btn"
              onClick={() => setSelectedIds(new Set())}
              aria-label="Deselect all"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
          <button type="button" className="pbulk__btn" onClick={() => void runSelectedAction('open')}>
            <img src={browserAssets['chrome'].icon} alt="" width={14} height={14} aria-hidden />
            <span>Open</span>
          </button>
          <button type="button" className="pbulk__btn" onClick={() => void runSelectedAction('close')}>
            <Square size={14} strokeWidth={1.75} />
            <span>Close</span>
          </button>
          <button type="button" className="pbulk__btn" onClick={() => toastService.info('Transfer profile')}>
            <Share2 size={14} strokeWidth={1.75} />
            <span>Transfer profile</span>
          </button>
          <button type="button" className="pbulk__btn pbulk__btn--icon" aria-label="More bulk actions" onClick={() => toastService.info('More bulk actions')}>
            <MoreHorizontal size={16} strokeWidth={1.75} />
          </button>
        </div>
      )}

      {/* ─── Context menu ─── */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="pctx"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          aria-label="Profile actions"
        >
          <button type="button" className="pctx__item" role="menuitem" onClick={() => { setContextMenu(null); navigate(`/profiles/${contextMenu.profile.id}/edit`); }}>
            <Copy size={16} strokeWidth={1.75} /><span>Edit</span>
          </button>
          <button type="button" className="pctx__item" role="menuitem" onClick={() => { setContextMenu(null); toastService.info('Transfer profile'); }}>
            <Share2 size={16} strokeWidth={1.75} /><span>Transfer profile</span>
          </button>
          <button type="button" className="pctx__item pctx__item--active" role="menuitem" onClick={() => { setContextMenu(null); toastService.info('Move to project'); }}>
            <FolderKanban size={16} strokeWidth={1.75} /><span>Move to project</span>
          </button>
          <div className="pctx__divider" />
          <button type="button" className="pctx__item" role="menuitem" onClick={() => { setContextMenu(null); void handleLaunchToggle(contextMenu.profile); }}>
            {contextMenu.profile.status === 'running'
              ? <><Square size={16} strokeWidth={1.75} /><span>Close</span></>
              : <><img src={browserAssets['chrome'].icon} alt="" width={15} height={15} style={{ display: 'block' }} aria-hidden /><span>Open</span></>}
          </button>
          <button type="button" className="pctx__item" role="menuitem" onClick={() => { setContextMenu(null); toastService.info('Set as Default Browser'); }}>
            <Settings size={16} strokeWidth={1.75} /><span>Set as Default Browser</span>
          </button>
          <button type="button" className="pctx__item" role="menuitem" onClick={() => { setContextMenu(null); void handleDuplicate(contextMenu.profile); }}>
            <Shuffle size={16} strokeWidth={1.75} /><span>Create Desktop Shortcut</span>
          </button>
          <div className="pctx__divider" />
          <button type="button" className="pctx__item pctx__item--has-arrow" role="menuitem" onClick={() => { setContextMenu(null); toastService.info('Profile Actions'); }}>
            <Layers size={16} strokeWidth={1.75} /><span>Profile Actions</span><ChevronLeft size={14} strokeWidth={1.75} className="pctx__arrow" />
          </button>
          <button type="button" className="pctx__item pctx__item--has-arrow" role="menuitem" onClick={() => { setContextMenu(null); toastService.info('Proxy Actions'); }}>
            <Wifi size={16} strokeWidth={1.75} /><span>Proxy Actions</span><ChevronLeft size={14} strokeWidth={1.75} className="pctx__arrow" />
          </button>
          <button type="button" className="pctx__item pctx__item--has-arrow" role="menuitem" onClick={() => { setContextMenu(null); toastService.info('Platform Account Actions'); }}>
            <UserPlus size={16} strokeWidth={1.75} /><span>Platform Account Actions</span><ChevronLeft size={14} strokeWidth={1.75} className="pctx__arrow" />
          </button>
          <div className="pctx__divider" />
          <button type="button" className="pctx__item" role="menuitem" onClick={() => { setContextMenu(null); openNotes(contextMenu.profile); }}>
            <FileText size={16} strokeWidth={1.75} /><span>Add Notes</span>
          </button>
          <button type="button" className="pctx__item" role="menuitem" onClick={() => { setContextMenu(null); setIsAddTagModalOpen(true); }}>
            <Tag size={16} strokeWidth={1.75} /><span>Add Tags</span>
          </button>
          <button type="button" className="pctx__item" role="menuitem" onClick={() => { setContextMenu(null); toastService.info('Edit Cookies'); }}>
            <Cookie size={16} strokeWidth={1.75} /><span>Edit Cookies</span>
          </button>
          <button type="button" className="pctx__item" role="menuitem" onClick={() => { setContextMenu(null); toastService.info('Cookie Robot'); }}>
            <FlaskConical size={16} strokeWidth={1.75} /><span>Cookie Robot</span>
            <span className="pctx__badge pctx__badge--fire">🔥</span>
          </button>
          <button type="button" className="pctx__item" role="menuitem" onClick={() => { setContextMenu(null); toastService.success('Cache cleared.'); }}>
            <Eraser size={16} strokeWidth={1.75} /><span>Clear cache</span>
          </button>
          <div className="pctx__divider" />
          <button type="button" className="pctx__item pctx__item--danger" role="menuitem" onClick={() => { setContextMenu(null); void remove(contextMenu.profile.id); }}>
            <Trash2 size={16} strokeWidth={1.75} /><span>Delete</span>
          </button>
        </div>
      )}

      {/* ─── Notes modal ─── */}
      {notesProfile && (
        <div className="pmodal-overlay" role="presentation" onMouseDown={() => !isSavingNotes && setNotesProfile(null)}>
          <section
            className="pmodal"
            role="dialog"
            aria-modal
            aria-labelledby="notes-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="notes-title">Add Notes</h2>
            <textarea
              ref={noteInputRef}
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              maxLength={2000}
              placeholder="Add a note for this profile…"
            />
            <div className="pmodal__actions">
              <button type="button" className="button button--ghost" disabled={isSavingNotes} onClick={() => setNotesProfile(null)}>Cancel</button>
              <button type="button" className="button button--primary" disabled={isSavingNotes} onClick={() => void saveNotes()}>
                {isSavingNotes ? 'Saving…' : 'Save'}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ─── Tag Popover ─── */}
      {tagPopoverProfile && (
        <div
          ref={tagPopoverRef}
          className="p-popover p-popover--tag"
          style={{ left: tagPopoverPos.x, top: tagPopoverPos.y }}
        >
          <div className="p-popover__list">
            {availableTags.map((tagObj) => {
              const isChecked = (tagPopoverProfile.tags ?? []).includes(tagObj.name);
              return (
                <button
                  key={tagObj.name}
                  type="button"
                  className="p-popover__item"
                  onClick={() => void handleToggleTagItem(tagPopoverProfile, tagObj.name)}
                >
                  <div className={`p-popover__checkbox ${isChecked ? 'p-popover__checkbox--checked' : ''}`}>
                    {isChecked && <Check size={11} strokeWidth={2.5} />}
                  </div>
                  <span
                    className="p-popover__tag-dot"
                    style={{ backgroundColor: tagObj.color }}
                  />
                  <span>{tagObj.name}</span>
                </button>
              );
            })}
          </div>
          <div className="p-popover__divider" />
          <button
            type="button"
            className="p-popover__add-btn"
            onClick={() => {
              setTagPopoverProfile(null);
              setIsAddTagModalOpen(true);
            }}
          >
            <Plus size={14} strokeWidth={2} />
            <span>Add Tag</span>
          </button>
        </div>
      )}

      {/* ─── Project Popover ─── */}
      {projectPopoverProfile && (
        <div
          ref={projectPopoverRef}
          className="p-popover p-popover--project"
          style={{ left: projectPopoverPos.x, top: projectPopoverPos.y }}
        >
          <div className="p-popover__title">Assign to Project</div>
          <div className="p-popover__list">
            {projectsList.map((proj) => {
              const isSelected = (projectPopoverProfile.projectId || 'Default') === proj;
              return (
                <button
                  key={proj}
                  type="button"
                  className={`p-popover__item ${isSelected ? 'p-popover__item--selected' : ''}`}
                  onClick={() => void handleSelectProject(projectPopoverProfile, proj)}
                >
                  <div className={`p-popover__radio ${isSelected ? 'p-popover__radio--checked' : ''}`}>
                    {isSelected && <div className="p-popover__radio-dot" />}
                  </div>
                  <Layers3 size={14} className="p-popover__icon" />
                  <span>{proj}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Add Tag Modal (Matches Screenshot) ─── */}
      {isAddTagModalOpen && (
        <div className="pmodal-overlay" role="presentation" onMouseDown={() => setIsAddTagModalOpen(false)}>
          <section
            className="pmodal pmodal--tag-create"
            role="dialog"
            aria-modal
            aria-labelledby="add-tag-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="add-tag-title">Add Tag</h2>

            {/* Color Palette (8 dots) */}
            <div className="ptag-colors">
              {[
                '#ef5b67', // Red
                '#f59e5b', // Orange
                '#f5b942', // Yellow
                '#31c48d', // Green
                '#2e90fa', // Blue
                '#f472b6', // Pink
                '#a78bfa', // Purple
                '#94a3b8', // Gray
              ].map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`ptag-color-dot ${selectedTagColor === color ? 'ptag-color-dot--active' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedTagColor(color)}
                >
                  {selectedTagColor === color && <Check size={12} strokeWidth={3} color="#ffffff" />}
                </button>
              ))}
            </div>

            <input
              type="text"
              className="ptag-create-input"
              placeholder="Please enter tag name"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreateNewTag();
              }}
              autoFocus
            />

            <div className="pmodal__actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setIsAddTagModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button--primary"
                onClick={() => void handleCreateNewTag()}
                disabled={!newTagName.trim()}
              >
                Save
              </button>
            </div>
          </section>
        </div>
      )}
      {/* ─── Tag Management Modal (Matches Screenshots 1 & 2) ─── */}
      {isTagManagerOpen && (
        <div className="pmodal-overlay" role="presentation" onMouseDown={() => setIsTagManagerOpen(false)}>
          <section
            className="pmodal pmodal--tag-manager-table"
            role="dialog"
            aria-modal
            aria-labelledby="tag-manager-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="pmodal__header">
              <h2 id="tag-manager-title">Tag Management</h2>
              <button
                type="button"
                className="pmodal__close-btn"
                onClick={() => setIsTagManagerOpen(false)}
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            <div className="ptag-manager__sub-bar">
              <span className="ptag-manager__sub-title">
                Add Tag ({availableTags.length})
              </span>
              <button
                type="button"
                className="ptag-manager__add-btn"
                onClick={() => setIsAddTagModalOpen(true)}
              >
                <Plus size={14} strokeWidth={2} />
                <span>Add Tag</span>
              </button>
            </div>

            <div className="ptag-manager__table-wrap">
              <table className="ptag-manager__table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>
                      <button
                        type="button"
                        className={`ptable__checkbox ${
                          availableTags.length > 0 && tagManagerSelected.size === availableTags.length
                            ? 'ptable__checkbox--checked'
                            : ''
                        }`}
                        onClick={() => {
                          if (tagManagerSelected.size === availableTags.length) {
                            setTagManagerSelected(new Set());
                          } else {
                            setTagManagerSelected(new Set(availableTags.map((t) => t.name)));
                          }
                        }}
                      >
                        {availableTags.length > 0 && tagManagerSelected.size === availableTags.length && (
                          <Check size={11} strokeWidth={2.5} />
                        )}
                      </button>
                    </th>
                    <th>Tag</th>
                    <th>Related Profiles</th>
                    <th style={{ textAlign: 'right', paddingRight: 24 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {availableTags.map((tagObj) => {
                    const isChecked = tagManagerSelected.has(tagObj.name);
                    const relatedProfiles = profiles.filter((p) => p.tags?.includes(tagObj.name));
                    return (
                      <tr key={tagObj.name}>
                        <td>
                          <button
                            type="button"
                            className={`ptable__checkbox ${isChecked ? 'ptable__checkbox--checked' : ''}`}
                            onClick={() => {
                              setTagManagerSelected((prev) => {
                                const next = new Set(prev);
                                if (next.has(tagObj.name)) next.delete(tagObj.name);
                                else next.add(tagObj.name);
                                return next;
                              });
                            }}
                          >
                            {isChecked && <Check size={11} strokeWidth={2.5} />}
                          </button>
                        </td>
                        <td>
                          <div className="ptag-manager__tag-cell">
                            <span
                              className="ptag-manager__dot"
                              style={{ backgroundColor: tagObj.color }}
                            />
                            <span className="ptag-manager__tag-name">{tagObj.name}</span>
                          </div>
                        </td>
                        <td>
                          <div className="ptag-manager__related-pills">
                            {relatedProfiles.length > 0 ? (
                              relatedProfiles.map((p, idx) => (
                                <span key={p.id} className="ptag-manager__profile-pill">
                                  {`ATH-${idx + 1}`}
                                </span>
                              ))
                            ) : (
                              <span className="ptag-manager__empty-text">--</span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', paddingRight: 16 }}>
                          <div className="ptag-manager__actions-cell">
                            <button
                              type="button"
                              className="ptag-manager__icon-btn"
                              onClick={() => {
                                setNewTagName(tagObj.name);
                                setSelectedTagColor(tagObj.color);
                                setIsAddTagModalOpen(true);
                              }}
                              title="Edit tag"
                            >
                              <Pencil size={15} strokeWidth={1.75} />
                            </button>
                            <button
                              type="button"
                              className="ptag-manager__icon-btn"
                              onClick={() => setDeletingTag(tagObj.name)}
                              title="Delete tag"
                            >
                              <Trash2 size={15} strokeWidth={1.75} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {availableTags.length === 0 && (
                    <tr>
                      <td colSpan={4} className="ptag-manager__empty-td">
                        No tags created yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ─── Delete Tag Confirmation Modal (Matches Screenshot 1) ─── */}
      {deletingTag && (
        <div className="pmodal-overlay pmodal-overlay--confirm" role="presentation" onMouseDown={() => setDeletingTag(null)}>
          <section
            className="pmodal pmodal--delete-tag"
            role="dialog"
            aria-modal
            aria-labelledby="delete-tag-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="pmodal__header">
              <h2 id="delete-tag-title">Delete Tag</h2>
              <button
                type="button"
                className="pmodal__close-btn"
                onClick={() => setDeletingTag(null)}
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            <p className="pmodal--delete-tag__desc">
              Are you sure you want to delete the selected tags? After deletion, the associated window&apos;s label will be cleared.
            </p>

            <div className="pmodal__actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setDeletingTag(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button--danger-red"
                onClick={() => {
                  const targetName = deletingTag;
                  setAvailableTags((prev) => prev.filter((t) => t.name !== targetName));
                  setProfiles((prev) =>
                    prev.map((p) => ({
                      ...p,
                      tags: p.tags?.filter((t) => t !== targetName),
                    }))
                  );
                  setDeletingTag(null);
                  toastService.success(`Tag "${targetName}" deleted`);
                }}
              >
                Confirm
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
