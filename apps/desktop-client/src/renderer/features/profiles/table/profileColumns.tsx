import React, { useState, useRef, useEffect } from 'react';
import {
  Bookmark,
  FilePlus,
  FileText,
  Layers3,
  MoreHorizontal,
  Plus,
  Share2,
  UserPlus,
  Tag,
  Trash2,
  RotateCcw,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { ProfileView } from '../../../../shared/profile-contracts.js';
import { Tooltip } from '../../../components/ui/Tooltip/index.js';
import { CountryFlag } from '../../../components/CountryFlag/CountryFlag.js';
import { osAssets, browserAssets, type PreviewOs } from '../../../pages/profiles/profile-assets.js';
import { toastService } from '../../../services/toast-service.js';
import type { ProfileRowContext } from '../types.js';

function formatLastOpenTime(value: string | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

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

function OpenButton({
  isRunning,
  isLoading,
  onClick,
}: {
  readonly isRunning: boolean;
  readonly isLoading: boolean;
  readonly onClick: (e: React.MouseEvent) => void;
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
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
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
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              toastService.info('Add Account clicked');
            }}
          >
            <Plus size={16} strokeWidth={1.75} />
            <span>Add Account</span>
          </button>
          <button
            type="button"
            className="account-popover-item"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              toastService.info('Select Account clicked');
            }}
          >
            <UserPlus size={16} strokeWidth={1.75} />
            <span>Select Account</span>
          </button>
        </div>
      )}
    </div>
  );
}

export interface ProfileColumn {
  id: string;
  label: React.ReactNode | ((context: ProfileRowContext) => React.ReactNode);
  width?: string | number | ((context: ProfileRowContext) => string | number);
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  className?: string;
  render: (profile: ProfileView, context: ProfileRowContext) => React.ReactNode;
}

// ─── Individual Column Definitions ───

export const serialColumn: ProfileColumn = {
  id: 'serial',
  label: 'Serial No.',
  width: 140,
  sortable: true,
  render: (profile, context) => {
    const serialNo = `ATH-${(context.currentPage - 1) * context.pageSize + context.idx + 1}`;
    const countryCode = context.proxyMap.get(profile.proxyId ?? '')?.countryCode || 'vn';
    const osLabel = profile.os === 'windows' ? 'Windows 11' : profile.os === 'mac' ? 'macOS' : 'Linux';
    const kernelLabel = `${profile.distribution ?? 'Chrome'} ${profile.channel ?? ''}`.trim();

    return (
      <div className="prow-serial">
        <span className="prow-serial__num">{serialNo}</span>
        <div className="prow-icons">
          <Tooltip content={`OS: ${osLabel}\nKernel: ${kernelLabel}`} variant="multiline">
            <span className="prow-icon-wrap">
              <OsIcon os={profile.os} size={16} />
            </span>
          </Tooltip>
          <Tooltip content={`${countryCode.toUpperCase()}  Just now\nIP: 14.191.216.101`} variant="multiline">
            <span className="prow-proxy-line">
              <span className="prow-proxy-line__dash" />
              <CountryFlag code={countryCode} size={16} />
              <span className="prow-proxy-line__dash" />
            </span>
          </Tooltip>
          <Tooltip content={kernelLabel} variant="compact">
            <span className="prow-icon-wrap">
              <KernelIcon size={16} />
            </span>
          </Tooltip>
          <AccountPlusTrigger />
        </div>
      </div>
    );
  },
};

// Profile Info Column for Trash Tab
export const profileInfoColumn: ProfileColumn = {
  id: 'profileInfo',
  label: 'Profile Info',
  width: 140,
  render: (profile, context) => serialColumn.render(profile, context),
};

export const profileNameColumn: ProfileColumn = {
  id: 'name',
  label: 'Profile Name',
  width: 150,
  sortable: true,
  render: (profile, context) => {
    const isEditing = context.inlineEditId === profile.id;
    return isEditing ? (
      <input
        type="text"
        className="profile-name-input"
        value={context.inlineNameText}
        onChange={(e) => context.onInlineNameTextChange(e.target.value)}
        onBlur={() => context.onSaveInlineName(profile)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') context.onSaveInlineName(profile);
          if (e.key === 'Escape') context.onCancelInlineEdit();
        }}
        autoFocus
        onFocus={(e) => e.target.select()}
        onClick={(e) => e.stopPropagation()}
      />
    ) : (
      <div
        className="profile-name-display"
        onClick={() => context.onStartInlineEdit(profile)}
      >
        <span className="profile-name-text-inner">{profile.name}</span>
      </div>
    );
  },
};

export const launchActionColumn: ProfileColumn = {
  id: 'action',
  label: 'Action',
  width: 110,
  align: 'center',
  render: (profile, context) => {
    const isRunning = profile.status === 'running';
    return (
      <OpenButton
        isRunning={isRunning}
        isLoading={context.isLaunching || context.isStopping}
        onClick={(e) => {
          e.stopPropagation();
          context.onLaunchToggle(profile);
        }}
      />
    );
  },
};

export const notesColumn: ProfileColumn = {
  id: 'notes',
  label: (context) => (
    <>
      Notes{' '}
      <span
        className="ptable__th-hide"
        data-tooltip={context.showNotesText ? 'Hide note content' : 'Show note content'}
        onClick={(e) => {
          e.stopPropagation();
          context.onShowNotesToggle();
        }}
      >
        {context.showNotesText ? (
          <EyeOff size={13} strokeWidth={1.75} />
        ) : (
          <Eye size={13} strokeWidth={1.75} />
        )}
      </span>
    </>
  ),
  width: (context) => (context.showNotesText ? 180 : 110),
  align: 'center',
  render: (profile, context) => {
    return (
      <div className="prow-cell-center">
        {profile.notes ? (
          context.showNotesText ? (
            <Tooltip content={profile.notes} variant="content">
              <span
                className="prow-note-text"
                onClick={(e) => {
                  e.stopPropagation();
                  context.onOpenNotes(profile);
                }}
              >
                {profile.notes}
              </span>
            </Tooltip>
          ) : (
            <Tooltip content={profile.notes} variant="content">
              <button
                type="button"
                className="row-icon-button"
                onClick={(e) => {
                  e.stopPropagation();
                  context.onOpenNotes(profile);
                }}
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
              onClick={(e) => {
                e.stopPropagation();
                context.onOpenNotes(profile);
              }}
              aria-label="Add notes"
            >
              <FilePlus size={16} strokeWidth={1.75} />
            </button>
          </Tooltip>
        )}
      </div>
    );
  },
};

export const tagColumn: ProfileColumn = {
  id: 'tag',
  label: 'Tag',
  width: 90,
  align: 'center',
  render: (profile, context) => {
    const visibleTags =
      profile.tags?.filter(
        (t: string) => Boolean(t) && t.trim() !== '' && t !== 'faved' && t !== 'trash',
      ) ?? [];

    return (
      <div className="prow-cell-center prow-cell-center--tags" onClick={(e) => e.stopPropagation()}>
        {visibleTags.length > 0 ? (
          <div className="prow-tag-group" onClick={(e) => context.onOpenTagPopover(profile, e)}>
            <Tooltip content={visibleTags[0] ?? ''} variant="compact">
              <span className="prow-tag-avatar">
                {(visibleTags[0] ?? '').slice(0, 2).toUpperCase()}
              </span>
            </Tooltip>
            {visibleTags.slice(1).map((t: string) => (
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
              onClick={(e) => context.onOpenTagPopover(profile, e)}
              aria-label="Add tag"
            >
              <i className="prow-tag-empty-icon">
                <Tag size={15} strokeWidth={1.75} />
              </i>
            </button>
          </Tooltip>
        )}
      </div>
    );
  },
};

export const projectColumn: ProfileColumn = {
  id: 'project',
  label: 'Project',
  width: 120,
  align: 'center',
  render: (profile, context) => {
    return (
      <div className="prow-cell-center" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="prow-project-btn"
          onClick={(e) => context.onOpenProjectPopover(profile, e)}
        >
          <Layers3 size={13} strokeWidth={1.75} />
          <span>{profile.projectId || 'Default'}</span>
        </button>
      </div>
    );
  },
};

export const lastOpenColumn: ProfileColumn = {
  id: 'lastOpen',
  label: 'Last open time',
  width: 180,
  sortable: true,
  align: 'center',
  render: (profile) => {
    return <span className="prow-time">{formatLastOpenTime(profile.updatedAt)}</span>;
  },
};

export const otherActionsColumn: ProfileColumn = {
  id: 'other',
  label: 'Other',
  width: 160,
  align: 'center',
  className: 'ptable__td--other',
  render: (profile, context) => {
    const isFaved = profile.tags?.includes('faved') ?? false;

    return (
      <div className="prow-other" onClick={(e) => e.stopPropagation()}>
        <Tooltip content="Favorite" variant="compact">
          <button
            type="button"
            className="row-icon-button"
            onClick={(e) => {
              void context.onToggleFavorite(profile, e);
            }}
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
            onClick={(e) => {
              e.stopPropagation();
              toastService.info('Transfer profile');
            }}
          >
            <Share2 size={16} strokeWidth={1.75} />
          </button>
        </Tooltip>
        <Tooltip content="Assign user" variant="compact">
          <button
            type="button"
            className="row-icon-button"
            onClick={(e) => {
              e.stopPropagation();
              toastService.info('Assign user');
            }}
          >
            <UserPlus size={16} strokeWidth={1.75} />
          </button>
        </Tooltip>
        <Tooltip content="More actions" variant="compact">
          <button
            type="button"
            className="row-icon-button"
            aria-label="More actions"
            onClick={(e) => {
              context.onContextMenu(profile, e);
            }}
          >
            <MoreHorizontal size={16} strokeWidth={1.75} />
          </button>
        </Tooltip>
      </div>
    );
  },
};

// ─── Trash Tab Columns ───

export const deletedAtColumn: ProfileColumn = {
  id: 'deletedAt',
  label: 'Delete Record',
  width: 180,
  align: 'center',
  render: (profile) => {
    return <span className="prow-time">{formatLastOpenTime(profile.updatedAt)}</span>;
  },
};

export const remainingTimeColumn: ProfileColumn = {
  id: 'remainingTime',
  label: 'Remaining time',
  width: 120,
  align: 'center',
  render: () => {
    return <span style={{ color: 'var(--color-error)' }}>30 days</span>;
  },
};

export const trashActionsColumn: ProfileColumn = {
  id: 'trashActions',
  label: 'Action',
  width: 120,
  align: 'center',
  className: 'ptable__td--other',
  render: (profile, context) => {
    return (
      <div className="prow-other" onClick={(e) => e.stopPropagation()}>
        <Tooltip content="Restore" variant="compact">
          <button
            type="button"
            className="row-icon-button"
            onClick={() => context.onRestoreProfile?.(profile)}
          >
            <RotateCcw size={16} strokeWidth={1.75} color="var(--color-success)" />
          </button>
        </Tooltip>
        <Tooltip content="Delete permanently" variant="compact">
          <button
            type="button"
            className="row-icon-button"
            onClick={() => context.onDeletePermanently?.(profile.id)}
          >
            <Trash2 size={16} strokeWidth={1.75} color="var(--color-error)" />
          </button>
        </Tooltip>
      </div>
    );
  },
};

// ─── Column Schemas Registry ───

export const defaultProfileColumns = [
  serialColumn,
  profileNameColumn,
  launchActionColumn,
  notesColumn,
  tagColumn,
  projectColumn,
  lastOpenColumn,
  otherActionsColumn,
];

export const trashProfileColumns = [
  profileInfoColumn,
  profileNameColumn,
  notesColumn,
  tagColumn,
  deletedAtColumn,
  remainingTimeColumn,
  trashActionsColumn,
];
