import { X, Square, Share2, MoreHorizontal } from 'lucide-react';
import { browserAssets } from '../../../pages/profiles/profile-assets.js';
import { toastService } from '../../../services/toast-service.js';

interface ProfilesBulkActionsProps {
  readonly selectedCount: number;
  readonly totalCount: number;
  readonly onClear: () => void;
  readonly onBulkOpen: () => void;
  readonly onBulkClose: () => void;
}

export function ProfilesBulkActions({
  selectedCount,
  totalCount,
  onClear,
  onBulkOpen,
  onBulkClose,
}: ProfilesBulkActionsProps): JSX.Element {
  return (
    <div className="pbulk" role="toolbar" aria-label="Bulk actions">
      <div className="pbulk__count-chip">
        <span>
          {selectedCount} / {totalCount} selected
        </span>
        <button
          type="button"
          className="pbulk__clear-btn"
          onClick={onClear}
          aria-label="Deselect all"
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>
      <button type="button" className="pbulk__btn" onClick={onBulkOpen}>
        <img src={browserAssets['chrome'].icon} alt="" width={14} height={14} aria-hidden />
        <span>Open</span>
      </button>
      <button type="button" className="pbulk__btn" onClick={onBulkClose}>
        <Square size={14} strokeWidth={1.75} />
        <span>Close</span>
      </button>
      <button
        type="button"
        className="pbulk__btn"
        onClick={() => toastService.info('Transfer profile')}
      >
        <Share2 size={14} strokeWidth={1.75} />
        <span>Transfer profile</span>
      </button>
      <button
        type="button"
        className="pbulk__btn pbulk__btn--icon"
        aria-label="More bulk actions"
        onClick={() => toastService.info('More bulk actions')}
      >
        <MoreHorizontal size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}
