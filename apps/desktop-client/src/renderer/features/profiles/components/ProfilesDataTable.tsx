import { ChevronUp, ChevronDown, Check } from 'lucide-react';
import type { ProfileView } from '../../../../shared/profile-contracts.js';
import type { EmptyStateConfig, ProfileRowContext } from '../types.js';
import type { ProfileColumn } from '../table/profileColumns.js';
import * as Icons from 'lucide-react';

interface ProfilesDataTableProps {
  readonly rows: ProfileView[];
  readonly columns: ProfileColumn[];
  readonly rowContext: ProfileRowContext;
  readonly loading: boolean;
  readonly isError: boolean;
  readonly emptyState: EmptyStateConfig;
  readonly selectedIds: Set<string>;
  readonly sortKey: string;
  readonly sortDir: string;
  readonly onSelectAll: (checked: boolean) => void;
  readonly onSort: (colId: any) => void;
  readonly onCreateProfileClick: () => void;
  readonly onRetryLoad: () => void;
}

function SortIndicator({
  colId,
  sortKey,
  sortDir,
}: {
  readonly colId: string;
  readonly sortKey: string;
  readonly sortDir: string;
}): JSX.Element {
  if (colId !== sortKey) {
    return (
      <span className="ptable__th-sort-arrows">
        <ChevronUp size={10} />
        <ChevronDown size={10} />
      </span>
    );
  }
  return sortDir === 'asc' ? (
    <ChevronUp size={11} className="ptable__th-sort-active" />
  ) : (
    <ChevronDown size={11} className="ptable__th-sort-active" />
  );
}

function ProfileTableRow({
  profile,
  columns,
  rowContext,
}: {
  readonly profile: ProfileView;
  readonly columns: ProfileColumn[];
  readonly rowContext: ProfileRowContext;
}): JSX.Element {
  const isChecked = rowContext.isChecked;

  return (
    <tr
      className={`ptable__row ${isChecked ? 'ptable__row--selected' : ''}`}
      onClick={() => rowContext.onRowClick(profile.id)}
      onContextMenu={(e) => rowContext.onContextMenu(profile, e)}
      style={{ cursor: 'pointer' }}
    >
      <td className="text-center">
        <button
          type="button"
          className={`ptable__checkbox ${isChecked ? 'ptable__checkbox--checked' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            rowContext.onSelectOne(profile.id, !isChecked);
          }}
          aria-label={`Select ${profile.name}`}
        >
          {isChecked && <Check size={11} strokeWidth={2.5} />}
        </button>
      </td>

      {columns.map((col) => {
        const alignClass =
          col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : '';
        return (
          <td key={col.id} className={`${alignClass} ${col.className ?? ''}`}>
            {col.render(profile, rowContext)}
          </td>
        );
      })}
    </tr>
  );
}

/** Shared centered empty state — works for any tab, just pass icon/title/description */
function TableEmptyState({
  emptyState,
  onCreateProfileClick,
}: {
  readonly emptyState: EmptyStateConfig;
  readonly onCreateProfileClick?: () => void;
}): JSX.Element {
  const IconComponent = Icons[emptyState.icon] as React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;

  const showCreateBtn = emptyState.action !== undefined
    ? emptyState.action
    : emptyState.title === 'No profiles found' && (
        <button
          type="button"
          className="ptable-empty__btn"
          onClick={onCreateProfileClick}
        >
          Create Profile
        </button>
      );

  return (
    <div className="ptable-empty" role="status">
      <div className="ptable-empty__icon-wrap">
        {IconComponent && (
          <IconComponent size={36} strokeWidth={1.5} className="ptable-empty__icon" />
        )}
      </div>
      <h2 className="ptable-empty__title">{emptyState.title}</h2>
      <p className="ptable-empty__desc">{emptyState.description}</p>
      {showCreateBtn && <div className="ptable-empty__action">{showCreateBtn}</div>}
    </div>
  );
}

export function ProfilesDataTable({
  rows,
  columns,
  rowContext,
  loading,
  isError,
  emptyState,
  selectedIds,
  sortKey,
  sortDir,
  onSelectAll,
  onSort,
  onCreateProfileClick,
  onRetryLoad,
}: ProfilesDataTableProps): JSX.Element {
  const isAllPageSelected = selectedIds.size === rows.length && rows.length > 0;

  const TH_COLS = (
    <tr>
      <th style={{ width: 44 }} className="text-center">
        <button
          type="button"
          className={`ptable__checkbox ${isAllPageSelected ? 'ptable__checkbox--checked' : ''}`}
          onClick={() => onSelectAll(!isAllPageSelected)}
          aria-label="Select all"
        >
          {isAllPageSelected && <Check size={11} strokeWidth={2.5} />}
        </button>
      </th>
      {columns.map((col) => {
        const alignClass =
          col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : '';
        const labelNode = typeof col.label === 'function' ? col.label(rowContext) : col.label;
        const colWidth = typeof col.width === 'function' ? col.width(rowContext) : col.width;

        return col.sortable ? (
          <th
            key={col.id}
            style={{ width: colWidth, cursor: 'pointer' }}
            className={alignClass}
            onClick={() => onSort(col.id)}
          >
            {labelNode} <SortIndicator colId={col.id} sortKey={sortKey} sortDir={sortDir} />
          </th>
        ) : (
          <th
            key={col.id}
            style={{ width: colWidth }}
            className={`${alignClass} ${col.className ?? ''}`}
          >
            {labelNode}
          </th>
        );
      })}
    </tr>
  );

  const SkeletonRows = (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <tr key={i} className="ptable__row ptable__row--skeleton">
          <td>
            <div className="psk psk--box" style={{ width: 16, height: 16 }} />
          </td>
          {columns.map((col) => {
            const colWidth = typeof col.width === 'function' ? col.width(rowContext) : col.width;
            return (
              <td key={col.id} style={{ width: colWidth }}>
                <div
                  className={col.id === 'notes' ? 'psk psk--box' : 'psk'}
                  style={{ width: col.id === 'notes' ? 22 : col.id === 'name' ? 240 : 80 }}
                />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );

  if (isError) {
    return (
      <div className="ptable-wrap ptable-wrap--center" role="alert">
        <TableEmptyState
          emptyState={{
            icon: 'AlertCircle',
            title: 'Failed to load profiles',
            description: 'Could not connect to workspace database.',
          }}
        />
        <button type="button" className="ptable-empty__btn" onClick={onRetryLoad}>
          Retry
        </button>
      </div>
    );
  }

  const showEmpty = !loading && rows.length === 0;

  return (
    <div className="ptable-wrap">
      <table className="ptable">
        <thead>{TH_COLS}</thead>
        <tbody>{loading && SkeletonRows}</tbody>
      </table>

      {/* Centered empty state — rendered OUTSIDE the table, fills remaining height */}
      {showEmpty && (
        <TableEmptyState
          emptyState={emptyState}
          onCreateProfileClick={onCreateProfileClick}
        />
      )}

      {/* Rows rendered normally when data exists */}
      {!loading && rows.length > 0 && (
        <table className="ptable">
          <tbody>
            {rows.map((profile, idx) => {
              const itemContext = {
                ...rowContext,
                idx,
                isChecked: selectedIds.has(profile.id),
                isLaunching: rowContext.launchingIds.has(profile.id),
                isStopping: rowContext.stoppingIds.has(profile.id),
              };
              return (
                <ProfileTableRow
                  key={profile.id}
                  profile={profile}
                  columns={columns}
                  rowContext={itemContext}
                />
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
