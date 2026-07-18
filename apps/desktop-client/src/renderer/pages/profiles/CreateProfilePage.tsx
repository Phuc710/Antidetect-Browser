import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Chrome,
  Cookie,
  FileText,
  Fingerprint,
  FolderKanban,
  Info,
  Link2,
  Loader2,
  Monitor,
  Network,
  ShieldCheck,
  Tags,
  UserRound,
} from 'lucide-react';
import type { ProfileView, ProxyView } from '../../../shared/profile-contracts.js';
import { parseCookies } from '../../features/profiles/utils/cookie-parser.js';
import {
  buildCreateProfileInput,
  buildUpdateProfileInput,
  DEFAULT_CREATE_PROFILE_DRAFT,
  getProfileDisplayName,
  isCreateProfileDraftDirty,
  parseStartupUrls,
  profileToDraft,
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

export function CreateProfilePage(): JSX.Element {
  const navigate = useNavigate();
  const { profileId } = useParams<{ profileId: string }>();
  const isEditing = Boolean(profileId);
  const submitGuardRef = useRef(false);
  const [draft, setDraft] = useState<CreateProfileDraft>({ ...DEFAULT_CREATE_PROFILE_DRAFT });
  const [initialDraft, setInitialDraft] = useState<CreateProfileDraft>({ ...DEFAULT_CREATE_PROFILE_DRAFT });
  const [cookieText, setCookieText] = useState('');
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [proxies, setProxies] = useState<ProxyView[]>([]);
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDiscardConfirmation, setShowDiscardConfirmation] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void window.desktop.proxy.list({ limit: 200, offset: 0 })
      .then((result) => {
        if (!cancelled) setProxies(result.items.filter((item) => item.status !== 'pending_delete'));
      })
      .catch(() => {
        if (!cancelled) setProxies([]);
      });

    if (profileId) {
      void window.desktop.profile.get({ profileId })
        .then((loaded) => {
          if (cancelled) return;
          const nextDraft = profileToDraft(loaded);
          setProfile(loaded);
          setDraft(nextDraft);
          setInitialDraft(nextDraft);
          setIsLoading(false);
        })
        .catch(() => {
          if (!cancelled) {
            setErrorMessage('The profile could not be loaded.');
            setIsLoading(false);
          }
        });
    }
    return () => { cancelled = true; };
  }, [profileId]);

  const startupUrls = useMemo(() => parseStartupUrls(draft.startupUrlsText), [draft.startupUrlsText]);
  const defaultCookieDomain = useMemo(() => {
    const firstUrl = startupUrls[0];
    if (!firstUrl) return undefined;
    try { return new URL(firstUrl).hostname; } catch { return undefined; }
  }, [startupUrls]);
  const parsedCookies = useMemo(
    () => parseCookies(cookieText, defaultCookieDomain),
    [cookieText, defaultCookieDomain],
  );
  const invalidCookieCount = parsedCookies.filter((item) => item.status === 'invalid').length;
  const selectedProxy = proxies.find((item) => item.id === draft.proxyId);
  const isDirty = useMemo(
    () => isCreateProfileDraftDirty(draft, initialDraft) || cookieText.length > 0,
    [cookieText, draft, initialDraft],
  );
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
    if (isDirty) setShowDiscardConfirmation(true);
    else navigate('/profiles');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitGuardRef.current || isLoading) return;
    const validation = validateCreateProfileDraft(draft);
    if (!validation.valid) {
      setErrorMessage(validation.message ?? 'The profile configuration is invalid.');
      return;
    }
    if (cookieText.length > 1_048_576) {
      setErrorMessage('Cookie input cannot exceed 1 MiB.');
      return;
    }
    if (invalidCookieCount > 0) {
      setErrorMessage(`Fix ${invalidCookieCount} invalid cookie entries before saving.`);
      return;
    }

    submitGuardRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const saved = isEditing && profile
        ? await window.desktop.profile.update(buildUpdateProfileInput(profile, draft, cookieText))
        : await window.desktop.profile.create(buildCreateProfileInput(draft, cookieText));
      setCookieText('');
      setDraft({ ...DEFAULT_CREATE_PROFILE_DRAFT });
      navigate('/profiles', {
        replace: true,
        state: isEditing ? { updatedProfileId: saved.id } : { createdProfileId: saved.id },
      });
    } catch {
      submitGuardRef.current = false;
      setIsSubmitting(false);
      setErrorMessage(`The profile could not be ${isEditing ? 'updated' : 'created'}. Your draft is still available.`);
    }
  }

  if (isLoading) {
    return <div className="create-profile-loading"><Loader2 className="create-profile-spinner" size={24} /> Loading profile…</div>;
  }

  return (
    <div className="create-profile-page">
      <header className="create-profile-header">
        <div className="create-profile-header__title-row">
          <button type="button" className="button button--ghost button--icon create-profile-header__back" onClick={handleBack} aria-label="Back to Profiles">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>{isEditing ? 'Edit Profile' : 'Create Profile'}</h1>
            <p>Profile metadata and browser runtime configuration.</p>
          </div>
        </div>
        {!isEditing && (
          <nav className="create-profile-tabs" aria-label="Profile creation mode">
            <button type="button" className="create-profile-tabs__item create-profile-tabs__item--active" aria-current="page">Create Single</button>
            <button type="button" className="create-profile-tabs__item" disabled>Batch Create <span>Not supported</span></button>
            <button type="button" className="create-profile-tabs__item" disabled>Import Profile <span>Not supported</span></button>
          </nav>
        )}
      </header>

      <div className="create-profile-body">
        <div className="create-profile-grid">
          <form id="profile-editor-form" className="create-profile-form" onSubmit={(event) => void handleSubmit(event)}>
            {errorMessage && <div className="create-profile-alert create-profile-alert--error" role="alert"><AlertCircle size={17} /><span>{errorMessage}</span></div>}

            <section className="create-profile-section" aria-labelledby="profile-info-title">
              <SectionHeading eyebrow="Profile configuration" title="Profile Info" status="Saved by Desktop Main" />
              <div className="create-profile-fields">
                <label className="create-profile-field" htmlFor="profile-name">
                  <span className="create-profile-field__label-row"><span>Profile Name</span><span>{draft.name.length} / 100</span></span>
                  <input id="profile-name" value={draft.name} maxLength={100} placeholder="Unnamed Profile (Optional)" onChange={(event) => updateDraft({ name: event.target.value })} autoComplete="off" />
                  <small>An empty name is normalized to Unnamed Profile by Main.</small>
                </label>

                <fieldset className="create-profile-fieldset" disabled={isEditing}>
                  <legend>System</legend>
                  <div className="create-profile-segmented">
                    {OS_OPTIONS.map((option) => (
                      <button key={option.value} type="button" className={draft.os === option.value ? 'is-selected' : ''} onClick={() => updateDraft({ os: option.value })} aria-pressed={draft.os === option.value}>
                        <Monitor size={16} /> {option.label}
                      </button>
                    ))}
                  </div>
                  {isEditing && <small>Runtime identity is immutable after profile creation.</small>}
                </fieldset>

                <div className="create-profile-field create-profile-field--read-only">
                  <span>Browser</span>
                  <div className="create-profile-runtime-card"><Chrome size={20} /><div><strong>Bundled Chromium</strong><small>Stable channel · version resolved at launch</small></div><ShieldCheck size={18} /></div>
                </div>

                <label className="create-profile-field" htmlFor="profile-notes">
                  <span className="create-profile-field__label-row"><span>Notes</span><span>{draft.notes.length} / 2000</span></span>
                  <textarea id="profile-notes" value={draft.notes} maxLength={2_000} rows={3} placeholder="Internal notes (Optional)" onChange={(event) => updateDraft({ notes: event.target.value })} />
                </label>
              </div>
            </section>

            <section className="create-profile-section" aria-labelledby="network-title">
              <SectionHeading eyebrow="Network assignment" title="Proxy" status="Persisted" icon={<Network size={18} />} />
              <div className="create-profile-fields">
                <label className="create-profile-field" htmlFor="profile-proxy">
                  <span>Saved Proxy</span>
                  <select id="profile-proxy" value={draft.proxyId} onChange={(event) => updateDraft({ proxyId: event.target.value })}>
                    <option value="">No proxy (local network)</option>
                    {proxies.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.protocol}://{item.host}:{item.port}</option>)}
                  </select>
                  <small>Credentials are never exposed to Renderer.</small>
                </label>
              </div>
            </section>

            <section className="create-profile-section" aria-labelledby="startup-title">
              <SectionHeading eyebrow="Startup data" title="URLs and Cookies" status="Persisted" icon={<Link2 size={18} />} />
              <div className="create-profile-fields">
                <label className="create-profile-field" htmlFor="profile-urls">
                  <span>Startup URLs</span>
                  <textarea id="profile-urls" value={draft.startupUrlsText} rows={4} placeholder={'https://example.com\nhttps://accounts.example.com'} onChange={(event) => updateDraft({ startupUrlsText: event.target.value })} />
                  <small>One http:// or https:// URL per line.</small>
                </label>
                <label className="create-profile-field" htmlFor="profile-cookies">
                  <span className="create-profile-field__label-row"><span>Cookies</span><span>{parsedCookies.length} parsed</span></span>
                  <textarea id="profile-cookies" value={cookieText} rows={6} placeholder="JSON, Netscape, or Name=Value" onChange={(event) => { setCookieText(event.target.value); setErrorMessage(null); }} autoComplete="off" spellCheck={false} />
                  <small>Kept only in this page memory. Existing cookies remain unchanged during Edit unless new cookie data is entered.</small>
                </label>
              </div>
            </section>

            <section className="create-profile-section" aria-labelledby="metadata-title">
              <SectionHeading eyebrow="Organization" title="Project and Tags" status="Persisted" icon={<FolderKanban size={18} />} />
              <div className="create-profile-fields create-profile-fields--two-columns">
                <label className="create-profile-field" htmlFor="profile-project"><span>Project ID</span><input id="profile-project" value={draft.projectId} maxLength={128} placeholder="Optional" onChange={(event) => updateDraft({ projectId: event.target.value })} /></label>
                <label className="create-profile-field" htmlFor="profile-tags"><span>Tags</span><input id="profile-tags" value={draft.tagsText} placeholder="ads, work, client-a" onChange={(event) => updateDraft({ tagsText: event.target.value })} /><small>Comma-separated, up to 50 tags.</small></label>
              </div>
            </section>

            <section className="create-profile-section" aria-labelledby="fingerprint-title">
              <SectionHeading eyebrow="Production policy" title="Fingerprint" status="Automatic" icon={<Fingerprint size={18} />} />
              <div className="create-profile-fingerprint-policy">
                <div className="create-profile-fingerprint-policy__icon"><Fingerprint size={24} /></div>
                <div><strong>Automatic fingerprint policy</strong><p>A validated fingerprint is attached by Desktop Main before the first page is ready.</p><small>Renderer does not generate or preview synthetic UA, Canvas, WebGL, GPU, or audio values.</small></div>
              </div>
              <UnsupportedGrid items={['WebRTC and location policy', 'Canvas and WebGL controls', 'Fonts and resolution', 'Audio and media devices']} />
            </section>

            <DisabledSection title="Accounts" description="Platform credentials need a dedicated encrypted repository and are not accepted by the current profile contract." items={['Platform account', 'Username and password', '2FA key']} icon={<UserRound size={18} />} />
            <DisabledSection title="Preferences and Data Sync" description="Template, sync, cleanup, hardware and startup flags remain disabled until they have persistence and launch enforcement." items={['Save as template', 'Data sync', 'Storage cleanup', 'Hardware settings']} icon={<FileText size={18} />} />
          </form>

          <aside className="create-profile-preview" aria-labelledby="profile-preview-title">
            <div className="create-profile-preview__heading"><div><span>Safe preview</span><h2 id="profile-preview-title">{displayName}</h2></div><Info size={18} /></div>
            <div className="create-profile-preview__device"><Monitor size={42} /><span>{OS_OPTIONS.find((item) => item.value === draft.os)?.label}</span></div>
            <dl className="create-profile-preview__list">
              <PreviewRow label="System" value={OS_OPTIONS.find((item) => item.value === draft.os)?.label ?? draft.os} />
              <PreviewRow label="Engine" value="Chromium" />
              <PreviewRow label="Runtime" value="Resolved at launch" />
              <PreviewRow label="Proxy" value={selectedProxy ? `${selectedProxy.name} (${selectedProxy.host}:${selectedProxy.port})` : 'No proxy (local network)'} />
              <PreviewRow label="URLs" value={`${startupUrls.length} configured`} />
              <PreviewRow label="Cookies" value={cookieText ? `${parsedCookies.length} ready` : isEditing && profile?.cookieCount ? `${profile.cookieCount} existing` : 'None'} />
              <PreviewRow label="Project" value={draft.projectId.trim() || 'None'} />
              <PreviewRow label="Fingerprint" value="Automatic at launch" />
            </dl>
            <div className="create-profile-preview__notice"><ShieldCheck size={16} /><span>No secrets or invented fingerprint values are shown here.</span></div>
          </aside>
        </div>
      </div>

      <footer className="create-profile-footer">
        {showDiscardConfirmation ? (
          <div className="create-profile-discard" role="status"><span>You have unsaved changes. Discard this draft?</span><button type="button" className="button button--ghost" onClick={() => setShowDiscardConfirmation(false)}>Keep editing</button><button type="button" className="button button--danger" onClick={() => navigate('/profiles')}>Discard</button></div>
        ) : (
          <><div className="create-profile-footer__metadata"><span><Tags size={15} /> {draft.tagsText.trim() ? 'Tags configured' : 'No tags'}</span><span><Cookie size={15} /> {parsedCookies.length} cookies</span></div><div className="create-profile-footer__actions"><button type="submit" form="profile-editor-form" className="button button--primary" disabled={isSubmitting || Boolean(errorMessage && !isDirty)}>{isSubmitting ? <Loader2 className="create-profile-spinner" size={16} /> : <CheckCircle2 size={16} />}{isSubmitting ? 'Saving…' : isEditing ? 'Save Profile' : 'Create Profile'}</button></div></>
        )}
      </footer>
    </div>
  );
}

function SectionHeading({ eyebrow, title, status, icon }: { eyebrow: string; title: string; status: string; icon?: ReactNode }): JSX.Element {
  return <div className="create-profile-section__heading"><div className="create-profile-section__title-with-icon">{icon}<div><span className="create-profile-section__eyebrow">{eyebrow}</span><h2>{title}</h2></div></div><span className="create-profile-section__status create-profile-section__status--ready"><CheckCircle2 size={14} /> {status}</span></div>;
}

function PreviewRow({ label, value }: { label: string; value: string }): JSX.Element {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function UnsupportedGrid({ items }: { items: readonly string[] }): JSX.Element {
  return <div className="create-profile-disabled-grid">{items.map((item) => <div key={item}><span>{item}</span><strong>Not supported</strong></div>)}</div>;
}

function DisabledSection({ title, description, items, icon }: { title: string; description: string; items: readonly string[]; icon: ReactNode }): JSX.Element {
  return <section className="create-profile-section create-profile-section--disabled" aria-disabled="true"><div className="create-profile-section__heading"><div className="create-profile-section__title-with-icon">{icon}<div><span className="create-profile-section__eyebrow">Contract required</span><h2>{title}</h2></div></div><span className="create-profile-section__status">Not supported</span></div><p className="create-profile-section__description">{description}</p><UnsupportedGrid items={items} /></section>;
}
