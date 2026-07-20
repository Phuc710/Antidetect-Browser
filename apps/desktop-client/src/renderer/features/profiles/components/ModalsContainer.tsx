import { Check, Layers3, Plus, X, Pencil, Trash2 } from 'lucide-react';
import type { ProfileView } from '../../../../shared/profile-contracts.js';
import type { TagObject } from '../types.js';

interface ModalsContainerProps {
  readonly notesProfile: ProfileView | null;
  readonly notesText: string;
  readonly isSavingNotes: boolean;
  readonly noteInputRef: React.RefObject<HTMLTextAreaElement>;
  readonly onNotesTextChange: (val: string) => void;
  readonly onSaveNotes: () => void;
  readonly onCancelNotes: () => void;

  readonly tagPopoverProfile: ProfileView | null;
  readonly tagPopoverRef: React.RefObject<HTMLDivElement>;
  readonly tagPopoverPos: { x: number; y: number };
  readonly availableTags: TagObject[];
  readonly onToggleTagItem: (p: ProfileView, tag: string) => void;
  readonly onAddTagClick: () => void;

  readonly projectPopoverProfile: ProfileView | null;
  readonly projectPopoverRef: React.RefObject<HTMLDivElement>;
  readonly projectPopoverPos: { x: number; y: number };
  readonly projectsList: string[];
  readonly onSelectProject: (p: ProfileView, projName: string) => void;

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
  readonly onToggleTagManagerSelected: (tag: string) => void;
  readonly onToggleSelectAllTags: () => void;
  readonly onEditTagClick: (name: string, color: string) => void;
  readonly onDeleteTagClick: (name: string) => void;

  readonly deletingTag: string | null;
  readonly onCloseDeleteTagConfirm: () => void;
  readonly onConfirmDeleteTag: (name: string) => void;
  readonly profiles: ProfileView[];
}

export function ModalsContainer({
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
  onAddTagClick,
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
}: ModalsContainerProps): JSX.Element {
  return (
    <>
      {/* ─── Notes modal ─── */}
      {notesProfile && (
        <div
          className="pmodal-overlay"
          role="presentation"
          onMouseDown={() => !isSavingNotes && onCancelNotes()}
        >
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
              onChange={(e) => onNotesTextChange(e.target.value)}
              maxLength={2000}
              placeholder="Add a note for this profile…"
            />
            <div className="pmodal__actions">
              <button
                type="button"
                className="button button--ghost"
                disabled={isSavingNotes}
                onClick={onCancelNotes}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button--primary"
                disabled={isSavingNotes}
                onClick={onSaveNotes}
              >
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
                  onClick={() => onToggleTagItem(tagPopoverProfile, tagObj.name)}
                >
                  <div
                    className={`p-popover__checkbox ${
                      isChecked ? 'p-popover__checkbox--checked' : ''
                    }`}
                  >
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
            onClick={onAddTagClick}
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
                  onClick={() => onSelectProject(projectPopoverProfile, proj)}
                >
                  <div
                    className={`p-popover__radio ${
                      isSelected ? 'p-popover__radio--checked' : ''
                    }`}
                  >
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
        <div
          className="pmodal-overlay"
          role="presentation"
          onMouseDown={onCloseAddTagModal}
        >
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
                  onClick={() => onSelectedTagColorChange(color)}
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
              onChange={(e) => onNewTagNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCreateNewTag();
              }}
              autoFocus
            />

            <div className="pmodal__actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={onCloseAddTagModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button--primary"
                onClick={onCreateNewTag}
                disabled={!newTagName.trim()}
              >
                Save
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ─── Tag Management Modal ─── */}
      {isTagManagerOpen && (
        <div
          className="pmodal-overlay"
          role="presentation"
          onMouseDown={onCloseTagManager}
        >
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
                onClick={onCloseTagManager}
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
                onClick={onAddTagClick}
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
                        onClick={onToggleSelectAllTags}
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
                            onClick={() => onToggleTagManagerSelected(tagObj.name)}
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
                              onClick={() => onEditTagClick(tagObj.name, tagObj.color)}
                              title="Edit tag"
                            >
                              <Pencil size={15} strokeWidth={1.75} />
                            </button>
                            <button
                              type="button"
                              className="ptag-manager__icon-btn"
                              onClick={() => onDeleteTagClick(tagObj.name)}
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

      {/* ─── Delete Tag Confirmation Modal ─── */}
      {deletingTag && (
        <div
          className="pmodal-overlay pmodal-overlay--confirm"
          role="presentation"
          onMouseDown={onCloseDeleteTagConfirm}
        >
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
                onClick={onCloseDeleteTagConfirm}
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            <p className="pmodal--delete-tag__desc">
              Are you sure you want to delete the selected tags? After deletion, the associated
              window&apos;s label will be cleared.
            </p>

            <div className="pmodal__actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={onCloseDeleteTagConfirm}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button--danger-red"
                onClick={() => onConfirmDeleteTag(deletingTag)}
              >
                Confirm
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
