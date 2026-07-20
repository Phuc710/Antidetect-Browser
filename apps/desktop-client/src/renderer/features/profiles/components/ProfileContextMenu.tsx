import {
  Copy,
  Share2,
  FolderKanban,
  Square,
  Settings,
  Shuffle,
  Layers,
  Wifi,
  UserPlus,
  FileText,
  Tag,
  Cookie,
  FlaskConical,
  Eraser,
  Trash2,
  ChevronLeft,
} from 'lucide-react';
import type { ProfileView } from '../../../../shared/profile-contracts.js';
import type { ContextMenuState } from '../types.js';
import { browserAssets } from '../../../pages/profiles/profile-assets.js';
import { toastService } from '../../../services/toast-service.js';

interface ProfileContextMenuProps {
  readonly contextMenu: ContextMenuState;
  readonly menuRef: React.RefObject<HTMLDivElement>;
  readonly onClose: () => void;
  readonly onLaunchToggle: (profile: ProfileView) => void;
  readonly onDuplicate: (profile: ProfileView) => void;
  readonly onDelete: (profileId: string) => void;
  readonly onOpenNotes: (profile: ProfileView) => void;
  readonly onEditClick: (profileId: string) => void;
  readonly onAddTagClick: () => void;
}

export function ProfileContextMenu({
  contextMenu,
  menuRef,
  onClose,
  onLaunchToggle,
  onDuplicate,
  onDelete,
  onOpenNotes,
  onEditClick,
  onAddTagClick,
}: ProfileContextMenuProps): JSX.Element {
  const { profile, x, y } = contextMenu;

  return (
    <div
      ref={menuRef}
      className="pctx"
      style={{ left: x, top: y }}
      role="menu"
      aria-label="Profile actions"
    >
      <button
        type="button"
        className="pctx__item"
        role="menuitem"
        onClick={() => {
          onClose();
          onEditClick(profile.id);
        }}
      >
        <Copy size={16} strokeWidth={1.75} />
        <span>Edit</span>
      </button>
      <button
        type="button"
        className="pctx__item"
        role="menuitem"
        onClick={() => {
          onClose();
          toastService.info('Transfer profile');
        }}
      >
        <Share2 size={16} strokeWidth={1.75} />
        <span>Transfer profile</span>
      </button>
      <button
        type="button"
        className="pctx__item pctx__item--active"
        role="menuitem"
        onClick={() => {
          onClose();
          toastService.info('Move to project');
        }}
      >
        <FolderKanban size={16} strokeWidth={1.75} />
        <span>Move to project</span>
      </button>
      <div className="pctx__divider" />
      <button
        type="button"
        className="pctx__item"
        role="menuitem"
        onClick={() => {
          onClose();
          onLaunchToggle(profile);
        }}
      >
        {profile.status === 'running' ? (
          <>
            <Square size={16} strokeWidth={1.75} />
            <span>Close</span>
          </>
        ) : (
          <>
            <img
              src={browserAssets['chrome'].icon}
              alt=""
              width={15}
              height={15}
              style={{ display: 'block' }}
              aria-hidden
            />
            <span>Open</span>
          </>
        )}
      </button>
      <button
        type="button"
        className="pctx__item"
        role="menuitem"
        onClick={() => {
          onClose();
          toastService.info('Set as Default Browser');
        }}
      >
        <Settings size={16} strokeWidth={1.75} />
        <span>Set as Default Browser</span>
      </button>
      <button
        type="button"
        className="pctx__item"
        role="menuitem"
        onClick={() => {
          onClose();
          void onDuplicate(profile);
        }}
      >
        <Shuffle size={16} strokeWidth={1.75} />
        <span>Create Desktop Shortcut</span>
      </button>
      <div className="pctx__divider" />
      <button
        type="button"
        className="pctx__item pctx__item--has-arrow"
        role="menuitem"
        onClick={() => {
          onClose();
          toastService.info('Profile Actions');
        }}
      >
        <Layers size={16} strokeWidth={1.75} />
        <span>Profile Actions</span>
        <ChevronLeft size={14} strokeWidth={1.75} className="pctx__arrow" />
      </button>
      <button
        type="button"
        className="pctx__item pctx__item--has-arrow"
        role="menuitem"
        onClick={() => {
          onClose();
          toastService.info('Proxy Actions');
        }}
      >
        <Wifi size={16} strokeWidth={1.75} />
        <span>Proxy Actions</span>
        <ChevronLeft size={14} strokeWidth={1.75} className="pctx__arrow" />
      </button>
      <button
        type="button"
        className="pctx__item pctx__item--has-arrow"
        role="menuitem"
        onClick={() => {
          onClose();
          toastService.info('Platform Account Actions');
        }}
      >
        <UserPlus size={16} strokeWidth={1.75} />
        <span>Platform Account Actions</span>
        <ChevronLeft size={14} strokeWidth={1.75} className="pctx__arrow" />
      </button>
      <div className="pctx__divider" />
      <button
        type="button"
        className="pctx__item"
        role="menuitem"
        onClick={() => {
          onClose();
          onOpenNotes(profile);
        }}
      >
        <FileText size={16} strokeWidth={1.75} />
        <span>Add Notes</span>
      </button>
      <button
        type="button"
        className="pctx__item"
        role="menuitem"
        onClick={() => {
          onClose();
          onAddTagClick();
        }}
      >
        <Tag size={16} strokeWidth={1.75} />
        <span>Add Tags</span>
      </button>
      <button
        type="button"
        className="pctx__item"
        role="menuitem"
        onClick={() => {
          onClose();
          toastService.info('Edit Cookies');
        }}
      >
        <Cookie size={16} strokeWidth={1.75} />
        <span>Edit Cookies</span>
      </button>
      <button
        type="button"
        className="pctx__item"
        role="menuitem"
        onClick={() => {
          onClose();
          toastService.info('Cookie Robot');
        }}
      >
        <FlaskConical size={16} strokeWidth={1.75} />
        <span>Cookie Robot</span>
        <span className="pctx__badge pctx__badge--fire">🔥</span>
      </button>
      <button
        type="button"
        className="pctx__item"
        role="menuitem"
        onClick={() => {
          onClose();
          toastService.success('Cache cleared.');
        }}
      >
        <Eraser size={16} strokeWidth={1.75} />
        <span>Clear cache</span>
      </button>
      <div className="pctx__divider" />
      <button
        type="button"
        className="pctx__item pctx__item--danger"
        role="menuitem"
        onClick={() => {
          onClose();
          void onDelete(profile.id);
        }}
      >
        <Trash2 size={16} strokeWidth={1.75} />
        <span>Delete</span>
      </button>
    </div>
  );
}
