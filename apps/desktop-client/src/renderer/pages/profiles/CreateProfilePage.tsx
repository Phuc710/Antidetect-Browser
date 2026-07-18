import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Chrome,
  FileText,
  Fingerprint,
  FolderKanban,
  Info,
  Loader2,
  Monitor,
  Network,
  ShieldCheck,
  Tags,
} from 'lucide-react';
import type { ProfileView } from '../../../shared/profile-contracts.js';
import {
  buildCreateProfileInput,
  DEFAULT_CREATE_PROFILE_DRAFT,
  getProfileDisplayName,
  isCreateProfileDraftDirty,
  validateCreateProfileDraft,
  type CreateProfileDraft,
  type CreateProfileOs,
} from './create-profile-model.js';
import './CreateProfilePage.css';

const OS_OPTIONS: ReadonlyArray<{ value: CreateProfileOs; label: string }> = [
  { value: 'windows', label: 'Windows' },
  { value: 'mac', label: 'macOS' },
  { value: 'linux', label: 'Linux' },
];

const UNSUPPORTED_SETTINGS = [
  'Language and display language',
  'Timezone and geolocation',
  'Screen resolution and fonts',
  'WebRTC, Canvas, WebGL and AudioContext',
  'CPU, memory and media devices',
] as const;

export function CreateProfilePage(): JSX.Element {
  const navigate = useNavigate();
  const submitGuardRef = useRef(false);
  const [draft, setDraft] = useState<CreateProfileDraft>({ ...DEFAULT_CREATE_PROFILE_DRAFT });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDiscardConfirmation, setShowDiscardConfirmation] = useState(false);

  const isDirty = useMemo(() => isCreateProfileDraftDirty(draft), [draft]);
  const displayName = getProfileDisplayName(draft.name);

  useEffect(() => {
    function preventAccidentalClose(event: BeforeUnloadEvent): void {
      if (!isDirty || submitGuardRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', preventAccidentalClose);
    return () => window.removeEventListener('beforeunload', preventAccidentalClose);
  }, [isDirty]);

  function updateDraft(patch: Partial<CreateProfileDraft>): void {
    setDraft((current) => ({ ...current, ...patch }));
    setErrorMessage(null);
    setShowDiscardConfirmation(false);
  }

  function handleBack(): void {
    if (isDirty) {
      setShowDiscardConfirmation(true);
      return;
    }
    navigate('/profiles');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitGuardRef.current) return;

    const validation = validateCreateProfileDraft(draft);
    if (!validation.valid) {
      setErrorMessage(validation.message ?? 'Dữ liệu profile không hợp lệ.');
      return;
    }

    submitGuardRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const created: ProfileView = await window.desktop.profile.create(buildCreateProfileInput(draft));
      setDraft({ ...DEFAULT_CREATE_PROFILE_DRAFT });
      navigate('/profiles', {
        replace: true,
        state: { createdProfileId: created.id },
      });
    } catch {
      submitGuardRef.current = false;
      setIsSubmitting(false);
      setErrorMessage('Không thể tạo profile. Dữ liệu của bạn vẫn được giữ nguyên để thử lại.');
    }
  }

  return (
    <div className="create-profile-page">
      <header className="create-profile-header">
        <div className="create-profile-header__title-row">
          <button
            type="button"
            className="button button--ghost button--icon create-profile-header__back"
            onClick={handleBack}
            aria-label="Quay lại Profiles"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>Create Profile</h1>
            <p>Tạo metadata và cấu hình runtime được Desktop hỗ trợ.</p>
          </div>
        </div>

        <nav className="create-profile-tabs" aria-label="Chế độ tạo profile">
          <button type="button" className="create-profile-tabs__item create-profile-tabs__item--active" aria-current="page">
            Create Single
          </button>
          <button type="button" className="create-profile-tabs__item" disabled title="Chưa hỗ trợ">
            Batch Create
            <span>Chưa hỗ trợ</span>
          </button>
          <button type="button" className="create-profile-tabs__item" disabled title="Chưa hỗ trợ">
            Import Profile
            <span>Chưa hỗ trợ</span>
          </button>
        </nav>
      </header>

      <div className="create-profile-body">
        <div className="create-profile-grid">
          <form id="create-profile-form" className="create-profile-form" onSubmit={(event) => void handleSubmit(event)}>
            {errorMessage && (
              <div className="create-profile-alert create-profile-alert--error" role="alert">
                <AlertCircle size={17} aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
            )}

            <section className="create-profile-section" aria-labelledby="profile-info-title">
              <div className="create-profile-section__heading">
                <div>
                  <span className="create-profile-section__eyebrow">Required configuration</span>
                  <h2 id="profile-info-title">Profile Info</h2>
                </div>
                <span className="create-profile-section__status create-profile-section__status--ready">
                  <CheckCircle2 size={14} /> Supported
                </span>
              </div>

              <div className="create-profile-fields">
                <label className="create-profile-field" htmlFor="profile-name">
                  <span className="create-profile-field__label-row">
                    <span>Profile Name</span>
                    <span>{draft.name.length} / 100</span>
                  </span>
                  <input
                    id="profile-name"
                    value={draft.name}
                    maxLength={100}
                    placeholder="Unnamed Profile (Optional)"
                    onChange={(event) => updateDraft({ name: event.target.value })}
                    autoComplete="off"
                  />
                  <small>Tên trống sẽ được Main chuẩn hóa thành Unnamed Profile.</small>
                </label>

                <fieldset className="create-profile-fieldset">
                  <legend>System</legend>
                  <div className="create-profile-segmented">
                    {OS_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={draft.os === option.value ? 'is-selected' : ''}
                        onClick={() => updateDraft({ os: option.value })}
                        aria-pressed={draft.os === option.value}
                      >
                        <Monitor size={16} aria-hidden="true" />
                        {option.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="create-profile-field create-profile-field--read-only">
                  <span>Browser</span>
                  <div className="create-profile-runtime-card">
                    <Chrome size={20} aria-hidden="true" />
                    <div>
                      <strong>Bundled Chromium</strong>
                      <small>Stable channel · Version resolved at launch</small>
                    </div>
                    <ShieldCheck size={18} aria-label="Runtime được hỗ trợ" />
                  </div>
                </div>

                <label className="create-profile-field" htmlFor="profile-notes">
                  <span className="create-profile-field__label-row">
                    <span>Notes</span>
                    <span>{draft.notes.length} / 2000</span>
                  </span>
                  <textarea
                    id="profile-notes"
                    value={draft.notes}
                    maxLength={2_000}
                    rows={3}
                    placeholder="Ghi chú nội bộ (Optional)"
                    onChange={(event) => updateDraft({ notes: event.target.value })}
                  />
                </label>
              </div>
            </section>

            <UnsupportedSection
              title="Proxy, Accounts and URLs"
              description="Các field này chưa có contract hoàn chỉnh trên Core sạch nên không được submit."
              items={['Proxy selection', 'Platform accounts', 'Startup URLs', 'Cookie import']}
              icon={<Network size={18} />}
            />

            <UnsupportedSection
              title="Basic Settings"
              description="Language, timezone, location và media policy sẽ được bật sau khi có persistence và launch enforcement."
              items={UNSUPPORTED_SETTINGS.slice(0, 3)}
              icon={<ChevronDown size={18} />}
            />

            <section className="create-profile-section" aria-labelledby="fingerprint-title">
              <div className="create-profile-section__heading">
                <div>
                  <span className="create-profile-section__eyebrow">Production policy</span>
                  <h2 id="fingerprint-title">Fingerprint</h2>
                </div>
                <span className="create-profile-section__status">Automatic</span>
              </div>

              <div className="create-profile-fingerprint-policy">
                <div className="create-profile-fingerprint-policy__icon">
                  <Fingerprint size={24} aria-hidden="true" />
                </div>
                <div>
                  <strong>Automatic fingerprint policy</strong>
                  <p>Fingerprint sẽ được tạo an toàn khi dịch vụ production khả dụng.</p>
                  <small>Renderer không generate fingerprint và không hiển thị UA/WebGL/Canvas giả.</small>
                </div>
                <button type="button" className="button button--secondary" disabled title="Chưa có production provider contract">
                  Generate Fingerprint
                </button>
              </div>

              <div className="create-profile-disabled-grid" aria-label="Advanced fingerprint settings chưa hỗ trợ">
                {UNSUPPORTED_SETTINGS.slice(3).map((item) => (
                  <div key={item}>
                    <span>{item}</span>
                    <strong>Chưa hỗ trợ</strong>
                  </div>
                ))}
              </div>
            </section>

            <UnsupportedSection
              title="Preferences and Data Sync"
              description="Không lưu cấu hình sync, cleanup hay startup behavior cho tới khi có repository/API thật."
              items={['Data sync', 'Browser settings', 'Random fingerprint on startup', 'Cache and storage cleanup']}
              icon={<FileText size={18} />}
            />
          </form>

          <aside className="create-profile-preview" aria-labelledby="profile-preview-title">
            <div className="create-profile-preview__heading">
              <div>
                <span>Safe preview</span>
                <h2 id="profile-preview-title">{displayName}</h2>
              </div>
              <Info size={18} aria-label="Chỉ hiển thị dữ liệu đã xác nhận" />
            </div>

            <div className="create-profile-preview__device">
              <Monitor size={42} aria-hidden="true" />
              <span>{OS_OPTIONS.find((option) => option.value === draft.os)?.label}</span>
            </div>

            <dl className="create-profile-preview__list">
              <PreviewRow label="System" value={OS_OPTIONS.find((option) => option.value === draft.os)?.label ?? draft.os} />
              <PreviewRow label="Engine" value="Chromium" />
              <PreviewRow label="Distribution" value="Bundled Chromium" />
              <PreviewRow label="Channel" value="Stable" />
              <PreviewRow label="Runtime" value="Resolved at launch" />
              <PreviewRow label="Proxy" value="No proxy (local network)" />
              <PreviewRow label="Notes" value={draft.notes.trim() ? 'Included' : 'None'} />
              <PreviewRow label="Fingerprint" value="Automatic at launch" />
            </dl>

            <div className="create-profile-preview__notice">
              <ShieldCheck size={16} aria-hidden="true" />
              <span>Không có fingerprint giả hoặc secret trong preview.</span>
            </div>
          </aside>
        </div>
      </div>

      <footer className="create-profile-footer">
        {showDiscardConfirmation ? (
          <div className="create-profile-discard" role="status">
            <span>Bạn có thay đổi chưa lưu. Rời trang và bỏ toàn bộ draft?</span>
            <button type="button" className="button button--ghost" onClick={() => setShowDiscardConfirmation(false)}>
              Tiếp tục chỉnh sửa
            </button>
            <button type="button" className="button button--danger" onClick={() => navigate('/profiles')}>
              Bỏ thay đổi
            </button>
          </div>
        ) : (
          <>
            <div className="create-profile-footer__metadata">
              <button type="button" className="button button--secondary" disabled title="Chưa có project contract">
                <FolderKanban size={15} /> Project
              </button>
              <button type="button" className="button button--secondary" disabled title="Chưa có tags contract">
                <Tags size={15} /> Tags
              </button>
            </div>
            <div className="create-profile-footer__actions">
              <button type="button" className="button button--secondary" disabled title="Chưa có template repository">
                Save as template
              </button>
              <button
                type="submit"
                form="create-profile-form"
                className="button button--primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="create-profile-spinner" size={16} /> : <CheckCircle2 size={16} />}
                {isSubmitting ? 'Creating…' : 'Create Profile'}
              </button>
            </div>
          </>
        )}
      </footer>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function UnsupportedSection({
  title,
  description,
  items,
  icon,
}: {
  title: string;
  description: string;
  items: readonly string[];
  icon: ReactNode;
}): JSX.Element {
  return (
    <section className="create-profile-section create-profile-section--disabled" aria-disabled="true">
      <div className="create-profile-section__heading">
        <div className="create-profile-section__title-with-icon">
          {icon}
          <div>
            <span className="create-profile-section__eyebrow">Contract required</span>
            <h2>{title}</h2>
          </div>
        </div>
        <span className="create-profile-section__status">Chưa hỗ trợ</span>
      </div>
      <p className="create-profile-section__description">{description}</p>
      <div className="create-profile-disabled-grid">
        {items.map((item) => (
          <div key={item}>
            <span>{item}</span>
            <strong>Disabled</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
