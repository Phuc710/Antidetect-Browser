import { Filter, Wifi, Layers, RefreshCw, Search, Trash2 } from 'lucide-react';
import { toastService } from '../../../services/toast-service.js';
import type { ProfileToolbarAction } from '../types.js';

interface ProfilesToolbarProps {
  readonly searchTerm: string;
  readonly onSearchChange: (term: string) => void;
  readonly isReloading: boolean;
  readonly onReload: () => void;
  readonly actions: ProfileToolbarAction[];
}

export function ProfilesToolbar({
  searchTerm,
  onSearchChange,
  isReloading,
  onReload,
  actions,
}: ProfilesToolbarProps): JSX.Element {
  const showTestAll = actions.includes('test-all');
  const showColumnPicker = actions.includes('column-picker');
  const showReload = actions.includes('reload');
  const showEmptyTrash = actions.includes('empty-trash');

  return (
    <header className="ptoolbar">
      <div className="ptoolbar__left">
        <label className="ptoolbar__search-wrap">
          <Search size={15} strokeWidth={1.75} className="ptoolbar__search-icon" aria-hidden />
          <input
            type="search"
            placeholder="Search Ctrl + F"
            className="ptoolbar__search-input"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search profiles"
          />
        </label>
        <button
          type="button"
          className="ptoolbar__filter-btn"
          onClick={() => toastService.info('Filter functionality coming soon')}
        >
          <Filter size={15} strokeWidth={1.75} />
          <span>Add filter</span>
        </button>
      </div>
      <div className="ptoolbar__right">
        {showEmptyTrash && (
          <button
            type="button"
            className="ptoolbar__action-btn ptoolbar__action-btn--danger"
            onClick={() => toastService.info('Empty Trash coming soon')}
          >
            <Trash2 size={15} strokeWidth={1.75} />
            <span>Empty Trash</span>
          </button>
        )}
        {showTestAll && (
          <button
            type="button"
            className="ptoolbar__action-btn"
            onClick={() => toastService.info('Testing all proxies...')}
          >
            <Wifi size={15} strokeWidth={1.75} />
            <span>Test all</span>
          </button>
        )}
        {showColumnPicker && (
          <button
            type="button"
            className="ptoolbar__icon-btn"
            aria-label="Column picker"
            onClick={() => toastService.info('Column picker coming soon')}
          >
            <Layers size={16} strokeWidth={1.75} />
          </button>
        )}
        {showReload && (
          <button
            type="button"
            className={`ptoolbar__icon-btn ${isReloading ? 'ptoolbar__icon-btn--spinning' : ''}`}
            aria-label="Reload profiles"
            onClick={onReload}
            disabled={isReloading}
          >
            <RefreshCw size={15} strokeWidth={1.75} />
          </button>
        )}
      </div>
    </header>
  );
}
