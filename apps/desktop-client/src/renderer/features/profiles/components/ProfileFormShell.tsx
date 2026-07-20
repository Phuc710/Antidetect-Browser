import { ArrowLeft, Loader2 } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';

interface ProfileFormShellProps {
  readonly isEditing: boolean;
  readonly isSubmitting: boolean;
  readonly isValid: boolean;
  readonly errorMessage: string | null;
  readonly validationMessage?: string | undefined;
  readonly showDiscardConfirmation: boolean;
  readonly onBack: () => void;
  readonly onCancelDiscard: () => void;
  readonly onConfirmDiscard: () => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly children: ReactNode;
  readonly sidebar: ReactNode;
  readonly footerLeft: ReactNode;
}

export function ProfileFormShell({
  isEditing,
  isSubmitting,
  isValid,
  errorMessage,
  validationMessage,
  showDiscardConfirmation,
  onBack,
  onCancelDiscard,
  onConfirmDiscard,
  onSubmit,
  children,
  sidebar,
  footerLeft,
}: ProfileFormShellProps): JSX.Element {
  return (
    <>
      {/* Header bar */}
      <header className="create-profile-header-bar">
        <button type="button" onClick={onBack} className="create-profile-back-btn">
          <ArrowLeft size={18} />
          <span>{isEditing ? 'Edit' : 'Create Profile'}</span>
        </button>

        {!isEditing && (
          <div className="create-profile-header-tabs" aria-label="Profile creation mode">
            <button type="button" className="create-profile-header-tab-btn is-active">
              Create Single
            </button>
            <button type="button" className="create-profile-header-tab-btn" disabled>
              Batch Create
            </button>
            <button type="button" className="create-profile-header-tab-btn" disabled>
              Import Profile
            </button>
          </div>
        )}
      </header>

      {/* Main body scroll grid */}
      <div className="create-profile-body">
        <div className="create-profile-grid">
          <form id="profile-editor-form" className="create-profile-form" onSubmit={onSubmit}>
            {errorMessage && (
              <div className="create-profile-alert create-profile-alert--error" role="alert">
                <span>{errorMessage}</span>
              </div>
            )}
            {children}
          </form>
          {sidebar}
        </div>
      </div>

      {/* Footer bar */}
      <footer className="create-profile-footer">
        {showDiscardConfirmation ? (
          <div className="create-profile-discard" role="status">
            <span>Discard unsaved changes?</span>
            <button type="button" className="button button--ghost" onClick={onCancelDiscard}>
              Cancel
            </button>
            <button type="button" className="button button--danger" onClick={onConfirmDiscard}>
              Discard
            </button>
          </div>
        ) : (
          <>
            <div className="create-profile-footer-left">{footerLeft}</div>
            <div className="create-profile-footer-right">
              {!isEditing && (
                <select className="create-profile-footer-template-select" disabled>
                  <option>Save as template</option>
                </select>
              )}
              {validationMessage && <span className="create-profile-save-error">{validationMessage}</span>}
              <button
                type="submit"
                form="profile-editor-form"
                className="button button--primary create-profile-save-btn"
                disabled={isSubmitting || !isValid}
              >
                {isSubmitting ? (
                  <Loader2 className="create-profile-spinner" size={14} />
                ) : null}
                <span>{isEditing ? 'Save' : 'Create'}</span>
              </button>
            </div>
          </>
        )}
      </footer>
    </>
  );
}
