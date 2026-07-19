import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  FileText,
  Layers3,
  Loader2,
  Minus,
  Paperclip,
  Plus,
  Shuffle,
  Tag,
} from 'lucide-react';
import type { ProfileView, ProxyView } from '../../../shared/profile-contracts.js';
import { parseCookies } from '../../features/profiles/utils/cookie-parser.js';
import { toastService } from '../../services/toast-service.js';
import { AccountSidebar } from '../../components/AccountSidebar.js';
import {
  buildCreateProfileInput,
  buildUpdateProfileInput,
  DEFAULT_CREATE_PROFILE_DRAFT,
  parseStartupUrls,
  profileToDraft,
  validateCreateProfileDraft,
  type CreateProfileDraft,
  type CreateProfileOs,
} from './create-profile-model.js';
import {
  browserAssets,
  buildPreviewModel,
  osAssets,
  type PreviewKernel,
  type PreviewOs,
} from './profile-assets.js';
import './CreateProfilePage.css';
interface SegmentOption<T> {
  value: T;
  label: string;
}

function SegmentControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}): JSX.Element {
  return (
    <div className="create-profile-mini-segment">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={value === opt.value ? 'is-selected' : ''}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
type AccordionKey = 'urls' | 'basic' | 'advanced' | 'preferences';

interface FingerprintSettings {
  readonly locationPrompt: 'Allow' | 'Inquiry' | 'Prohibit';
  readonly resolutionMode: 'Follow System' | 'Custom';
  readonly fontMode: 'Follow System' | 'Custom';
  readonly webRTCMode: 'Prohibit' | 'Open';
  readonly webGLMode: 'Random' | 'Close';
}

interface ProfileFormState {
  readonly name: string;
  readonly system: PreviewOs;
  readonly systemVersion: string;
  readonly kernel: PreviewKernel;
  readonly kernelVersion: string;
  readonly userAgent: string;
  readonly cookies: string;
  readonly proxyId: string;
  readonly projectId: string;
  readonly tagsText: string;
  readonly notes: string;
  readonly startupUrlsText: string;
  readonly fingerprint: FingerprintSettings;
}

interface ProfileFormProps {
  mode: 'create' | 'edit';
  profileId?: string | undefined;
}

const SYSTEM_OPTIONS: readonly PreviewOs[] = ['windows', 'mac', 'linux', 'android', 'ios'];

const OS_VERSIONS: Readonly<Record<PreviewOs, readonly string[]>> = {
  windows: ['Windows 11', 'Windows 10'],
  mac: ['macOS Sequoia', 'macOS Sonoma', 'macOS Ventura'],
  linux: ['Ubuntu 24.04', 'Ubuntu 22.04', 'Linux x86_64'],
  android: ['Android 16', 'Android 15', 'Android 14'],
  ios: ['iOS 18', 'iOS 17'],
};

const KERNEL_VERSIONS: Readonly<Record<PreviewKernel, readonly string[]>> = {
  chrome: ['Keep Latest', 'RoxyChrome 150', 'RoxyChrome 149', 'RoxyChrome 148', 'RoxyChrome 147', 'RoxyChrome 146'],
  firefox: ['Keep Latest', 'RoxyFirefox 141', 'RoxyFirefox 140', 'RoxyFirefox 139', 'RoxyFirefox 138'],
};

const DEFAULT_FINGERPRINT: FingerprintSettings = {
  locationPrompt: 'Allow',
  resolutionMode: 'Follow System',
  fontMode: 'Follow System',
  webRTCMode: 'Prohibit',
  webGLMode: 'Random',
};

const DEFAULT_FORM_STATE: ProfileFormState = {
  name: '',
  system: 'windows',
  systemVersion: 'Windows 11',
  kernel: 'chrome',
  kernelVersion: 'RoxyChrome 150',
  userAgent: buildUserAgent('windows', 'chrome', 'RoxyChrome 150'),
  cookies: '',
  proxyId: '',
  projectId: '',
  tagsText: '',
  notes: '',
  startupUrlsText: '',
  fingerprint: DEFAULT_FINGERPRINT,
};

function versionNumber(version: string): string {
  const match = version.match(/(\d+)/);
  return match?.[1] ?? '150';
}

function buildUserAgent(os: PreviewOs, kernel: PreviewKernel, version: string): string {
  const major = versionNumber(version);
  
  // Smart random minor/patch segments
  const patchNum1 = Math.floor(Math.random() * 10);
  const patchNum2 = Math.floor(Math.random() * 1500) + 6000;
  const patchNum3 = Math.floor(Math.random() * 120) + 30;
  const chromeMinor = `${patchNum1}.${patchNum2}.${patchNum3}`;

  if (os === 'ios') {
    const iosVersions = ['18_0', '18_1', '18_2', '17_5', '17_6'];
    const chosenIos = iosVersions[Math.floor(Math.random() * iosVersions.length)] || '18_0';
    return `Mozilla/5.0 (iPhone; CPU iPhone OS ${chosenIos} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${chosenIos.replace('_', '.')} Mobile/15E148 Safari/604.1`;
  }

  const winPlatforms = [
    'Windows NT 10.0; Win64; x64',
    'Windows NT 10.0',
  ];
  const winPlatform = winPlatforms[Math.floor(Math.random() * winPlatforms.length)] || 'Windows NT 10.0; Win64; x64';

  const platforms: Record<Exclude<PreviewOs, 'ios'>, string> = {
    windows: winPlatform,
    mac: 'Macintosh; Intel Mac OS X 10_15_7',
    linux: 'X11; Linux x86_64',
    android: `Linux; Android ${Math.floor(Math.random() * 4) + 13}; SM-G998B`,
  };

  const platform = platforms[os] || '';

  if (kernel === 'firefox') {
    const isWin = os === 'windows';
    const ffPlatform = isWin ? 'Windows NT 10.0; Win64; x64' : platform;
    return `Mozilla/5.0 (${ffPlatform}; rv:${major}.0) Gecko/20100101 Firefox/${major}.0`;
  }

  const mobile = os === 'android' ? ' Mobile' : '';
  return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.${chromeMinor}${mobile} Safari/537.36`;
}

function mapStoredOsToPreview(os: CreateProfileOs): PreviewOs {
  return os === 'mac' ? 'mac' : os;
}

function mapPreviewOsToStored(os: PreviewOs): CreateProfileOs {
  if (os === 'android' || os === 'ios') return 'linux';
  return os;
}

function formToDraft(form: ProfileFormState): CreateProfileDraft {
  return {
    ...DEFAULT_CREATE_PROFILE_DRAFT,
    name: form.name,
    os: mapPreviewOsToStored(form.system),
    notes: form.notes,
    proxyId: form.proxyId,
    projectId: form.projectId,
    tagsText: form.tagsText,
    startupUrlsText: form.startupUrlsText,
  };
}

function stateFromProfile(profile: ProfileView): ProfileFormState {
  const draft = profileToDraft(profile);
  const system = mapStoredOsToPreview(draft.os);
  const kernel: PreviewKernel = profile.engine === 'firefox' ? 'firefox' : 'chrome';
  const kernelVersion = kernel === 'firefox' ? 'RoxyFirefox 141' : 'RoxyChrome 150';
  return {
    ...DEFAULT_FORM_STATE,
    name: draft.name,
    system,
    systemVersion: OS_VERSIONS[system][0] ?? DEFAULT_FORM_STATE.systemVersion,
    kernel,
    kernelVersion,
    userAgent: buildUserAgent(system, kernel, kernelVersion),
    proxyId: draft.proxyId,
    projectId: draft.projectId,
    tagsText: draft.tagsText,
    notes: draft.notes,
    startupUrlsText: draft.startupUrlsText,
  };
}

function compactProxy(proxy: ProxyView | undefined): string {
  if (!proxy) return 'VN/Can Duoc (14.191.220.68)';
  return `${proxy.name} (${proxy.host}:${proxy.port})`;
}

export function ProfileForm({ mode, profileId }: ProfileFormProps): JSX.Element {
  const navigate = useNavigate();
  const isEditing = mode === 'edit';
  const submitGuardRef = useRef(false);
  const cookieFileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [proxies, setProxies] = useState<ProxyView[]>([]);
  const [formState, setFormState] = useState<ProfileFormState>(DEFAULT_FORM_STATE);
  const [initialFormState, setInitialFormState] = useState<ProfileFormState>(DEFAULT_FORM_STATE);
  const [expanded, setExpanded] = useState<Record<AccordionKey, boolean>>({
    urls: false,
    basic: false,
    advanced: false,
    preferences: false,
  });

  const [basicSettings, setBasicSettings] = useState({
    language: 'ip',
    displayLanguage: 'ip',
    timeZone: 'ip',
    locationPrompt: 'Allow' as 'Allow' | 'Inquiry' | 'Prohibit',
    location: 'ip',
    sound: 'Open',
    image: 'Open',
    video: 'Open',
    size: 'Custom',
    width: '1000',
    height: '1000',
    searchEngine: 'Google',
    gridPosition: 0,
  });

  const [advancedSettings, setAdvancedSettings] = useState({
    resolution: 'Follow System',
    font: 'Follow System',
    webrtc: 'Prohibit',
    webglImage: 'Random',
    webglInfo: 'Random',
    webglVendor: 'Google Inc. (Intel)',
    webglRenderer: 'ANGLE (Intel, Intel(R) HD Graphics P530 Direct3D11 vs_5_0 ps_5_0, D3D11-20.19.15.4463)',
    webgpu: 'Based on WebGL',
    canvas: 'Random',
    audioContext: 'Random',
    speechVoices: 'Random',
    doNotTrack: 'Open',
    clientRects: 'Random',
    mediaDevice: 'Random',
    deviceName: 'DESKTOP-46VN80XH',
    macAddress: '78-01-65-33-1D-C7',
    hardwareConcurrency: 'Random',
    deviceMemory: 'Random',
    ssl: 'Close',
    portScan: 'Open',
    whitelistPorts: '',
    hardwareAcceleration: 'Open',
    disableSandbox: 'Close',
    startupParameters: '',
  });

  const [prefs, setPrefs] = useState({
    syncBookmarks: true,
    syncHistory: false,
    syncTabs: false,
    syncCookie: true,
    syncExtensions: false,
    syncPasswords: true,
    syncIndexedDB: false,
    syncLocalStorage: false,
    syncSessionStorage: false,
    clearCache: true,
    clearCookies: false,
    clearLocalStorage: false,
    randomStartup: true,
    savePassword: true,
    stopNoNetwork: false,
    stopIpChange: false,
    stopCountryChange: false,
    openDashboard: true,
    ipReminder: true,
    googleSignIn: true,
    blacklist: '',
    whitelist: '',
  });
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDiscardConfirmation, setShowDiscardConfirmation] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void window.desktop.proxy.list({ limit: 200, offset: 0 })
      .then((result) => {
        if (!cancelled) setProxies(result.items.filter((item) => item.status !== 'pending_delete'));
      })
      .catch(() => {
        if (!cancelled) setProxies([]);
      });

    if (!profileId) return () => { cancelled = true; };

    void window.desktop.profile.get({ profileId })
      .then((loaded) => {
        if (cancelled) return;
        const nextState = stateFromProfile(loaded);
        setProfile(loaded);
        setFormState(nextState);
        setInitialFormState(nextState);
        setIsLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage('The profile could not be loaded.');
          setIsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [profileId]);

  const startupUrls = useMemo(() => parseStartupUrls(formState.startupUrlsText), [formState.startupUrlsText]);
  const defaultCookieDomain = useMemo(() => {
    const firstUrl = startupUrls[0];
    if (!firstUrl) return undefined;
    try { return new URL(firstUrl).hostname; } catch { return undefined; }
  }, [startupUrls]);
  const parsedCookies = useMemo(
    () => parseCookies(formState.cookies, defaultCookieDomain),
    [defaultCookieDomain, formState.cookies],
  );
  const invalidCookieCount = parsedCookies.filter((item) => item.status === 'invalid').length;
  const selectedProxy = proxies.find((item) => item.id === formState.proxyId);
  const preview = useMemo(
    () => buildPreviewModel({
      system: formState.system,
      kernel: formState.kernel,
      userAgent: formState.userAgent,
      proxyLabel: selectedProxy?.name,
    }),
    [formState.kernel, formState.system, formState.userAgent, selectedProxy?.name],
  );
  const isDirty = useMemo(
    () => JSON.stringify(formState) !== JSON.stringify(initialFormState),
    [formState, initialFormState],
  );
  const validation = useMemo(() => validateCreateProfileDraft(formToDraft(formState)), [formState]);
  const canSubmit = !isSubmitting
    && !isLoading
    && (!isEditing || isDirty)
    && validation.valid
    && invalidCookieCount === 0
    && formState.userAgent.trim().length > 0
    && formState.userAgent.length <= 1024;

  useEffect(() => {
    function preventAccidentalClose(event: BeforeUnloadEvent): void {
      if (!isDirty || submitGuardRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', preventAccidentalClose);
    return () => window.removeEventListener('beforeunload', preventAccidentalClose);
  }, [isDirty]);

  function updateForm(patch: Partial<ProfileFormState>): void {
    setFormState((current) => ({ ...current, ...patch }));
    setErrorMessage(null);
    setShowDiscardConfirmation(false);
  }

  function handleSystemChange(system: PreviewOs): void {
    const systemVersion = OS_VERSIONS[system][0] ?? '';
    const kernel = system === 'ios' ? 'chrome' : formState.kernel;
    const kernelVersion = KERNEL_VERSIONS[kernel][1] ?? KERNEL_VERSIONS[kernel][0] ?? '';
    updateForm({
      system,
      systemVersion,
      kernel,
      kernelVersion,
      userAgent: buildUserAgent(system, kernel, kernelVersion),
    });
  }

  function handleKernelChange(kernel: PreviewKernel): void {
    if (formState.system === 'ios' && kernel === 'firefox') return;
    const kernelVersion = KERNEL_VERSIONS[kernel][1] ?? KERNEL_VERSIONS[kernel][0] ?? '';
    updateForm({
      kernel,
      kernelVersion,
      userAgent: buildUserAgent(formState.system, kernel, kernelVersion),
    });
  }

  function handleKernelVersionChange(kernelVersion: string): void {
    updateForm({
      kernelVersion,
      userAgent: buildUserAgent(formState.system, formState.kernel, kernelVersion),
    });
  }

  function handleRandomizeUA(): void {
    updateForm({
      userAgent: buildUserAgent(formState.system, formState.kernel, formState.kernelVersion),
    });
  }

  function toggleAccordion(key: AccordionKey): void {
    setExpanded((current) => ({ ...current, [key]: !current[key] }));
  }

  function handleBack(): void {
    if (isDirty) setShowDiscardConfirmation(true);
    else navigate('/profiles');
  }

  function handleCopyProfileId(): void {
    if (!profile) return;
    void navigator.clipboard.writeText(profile.id);
    setCopiedId(true);
    window.setTimeout(() => setCopiedId(false), 1500);
  }

  function handleCookieFile(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/\.(json|txt)$/i.test(file.name)) {
      setErrorMessage('Cookie file must be a .json or .txt file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateForm({ cookies: String(reader.result ?? '') });
    };
    reader.onerror = () => setErrorMessage('Cookie file could not be read.');
    reader.readAsText(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canSubmit || submitGuardRef.current) return;

    submitGuardRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const draft = formToDraft(formState);
      const saved = isEditing && profile
        ? await window.desktop.profile.update(buildUpdateProfileInput(profile, draft, formState.cookies))
        : await window.desktop.profile.create(buildCreateProfileInput(draft, formState.cookies));

      if (isEditing) {
        const nextState = { ...formState, cookies: '' };
        setProfile(saved);
        setFormState(nextState);
        setInitialFormState(nextState);
        toastService.success('Profile saved.');
        submitGuardRef.current = false;
        setIsSubmitting(false);
        return;
      }

      navigate('/profiles', { replace: true, state: { createdProfileId: saved.id } });
    } catch {
      submitGuardRef.current = false;
      setIsSubmitting(false);
      setErrorMessage(`The profile could not be ${isEditing ? 'updated' : 'created'}. Your draft is still available.`);
    }
  }

  if (isLoading) {
    return (
      <div className="create-profile-loading">
        <Loader2 className="create-profile-spinner" size={24} />
        <span>Loading profile</span>
      </div>
    );
  }

  return (
    <>
      <header className="create-profile-header-bar">
        <button type="button" onClick={handleBack} className="create-profile-back-btn">
          <ArrowLeft size={18} />
          <span>{isEditing ? 'Edit' : 'Create Profile'}</span>
        </button>

        {!isEditing && (
          <div className="create-profile-header-tabs" aria-label="Profile creation mode">
            <button type="button" className="create-profile-header-tab-btn is-active">Create Single</button>
            <button type="button" className="create-profile-header-tab-btn" disabled>Batch Create</button>
            <button type="button" className="create-profile-header-tab-btn" disabled>Import Profile</button>
          </div>
        )}
      </header>

      <div className="create-profile-body">
        <div className="create-profile-grid">
          <form id="profile-editor-form" className="create-profile-form" onSubmit={(event) => void handleSubmit(event)}>
            {errorMessage && (
              <div className="create-profile-alert create-profile-alert--error" role="alert">
                <AlertCircle size={14} />
                <span>{errorMessage}</span>
              </div>
            )}

            <section className="create-profile-section create-profile-section--first" aria-labelledby="profile-info-title">
              <div className="create-profile-section-heading">
                <h2 className="create-profile-section__title" id="profile-info-title">Profile Info</h2>
                {isEditing && profile && (
                  <span className="create-profile-id-link">
                    ID: {profile.id}
                    <button type="button" onClick={handleCopyProfileId}>{copiedId ? 'Copied' : 'Copy'}</button>
                  </span>
                )}
              </div>

              <div className="create-profile-fields">
                <div className="create-profile-row">
                  <label className="create-profile-row-label" htmlFor="profile-name">Profile Name</label>
                  <div className="create-profile-row-control">
                    <input
                      id="profile-name"
                      value={formState.name}
                      maxLength={100}
                      placeholder="Unnamed Profile (Optional)"
                      onChange={(event) => updateForm({ name: event.target.value })}
                      autoComplete="off"
                    />
                  </div>
                </div>

                <div className="create-profile-row">
                  <span className="create-profile-row-label">System</span>
                  <div className="create-profile-row-control create-profile-row-control--split">
                    <div className="create-profile-segmented create-profile-segmented--os">
                      {SYSTEM_OPTIONS.map((system) => (
                        <button
                          key={system}
                          type="button"
                          className={`create-profile-os-seg ${formState.system === system ? 'is-selected' : ''}`}
                          onClick={() => handleSystemChange(system)}
                          title={osAssets[system].label}
                        >
                          <img src={osAssets[system].icon} alt="" />
                        </button>
                      ))}
                    </div>
                    <select
                      className="create-profile-os-select"
                      value={formState.systemVersion}
                      onChange={(event) => updateForm({ systemVersion: event.target.value })}
                      aria-label="System version"
                    >
                      {OS_VERSIONS[formState.system].map((version) => <option key={version}>{version}</option>)}
                    </select>
                  </div>
                </div>

                <div className="create-profile-row">
                  <span className="create-profile-row-label">Kernel</span>
                  <div className="create-profile-row-control create-profile-row-control--split">
                    <div className="create-profile-segmented create-profile-segmented--kernel">
                      {(['chrome', 'firefox'] as const).map((kernel) => {
                        const disabled = formState.system === 'ios' && kernel === 'firefox';
                        return (
                          <button
                            key={kernel}
                            type="button"
                            className={`create-profile-kernel-seg ${formState.kernel === kernel ? 'is-selected' : ''}`}
                            disabled={disabled}
                            onClick={() => handleKernelChange(kernel)}
                          >
                            <img src={browserAssets[kernel].icon} alt="" />
                            <span>{browserAssets[kernel].label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <select
                      className="create-profile-kernel-select"
                      value={formState.kernelVersion}
                      onChange={(event) => handleKernelVersionChange(event.target.value)}
                      aria-label="Kernel version"
                    >
                      {KERNEL_VERSIONS[formState.kernel].map((version) => <option key={version}>{version}</option>)}
                    </select>
                  </div>
                </div>

                <div className="create-profile-row">
                  <span className="create-profile-row-label">User-Agent</span>
                  <div className="create-profile-row-control create-profile-row-control--ua">
                    <input
                      value={formState.userAgent}
                      maxLength={1024}
                      onChange={(event) => updateForm({ userAgent: event.target.value })}
                    />
                    <button type="button" className="create-profile-ua-random-btn" onClick={handleRandomizeUA}>
                      <Shuffle size={14} />
                      <span>Random</span>
                    </button>
                  </div>
                </div>

                <div className="create-profile-row create-profile-row--textarea">
                  <span className="create-profile-row-label">Cookies</span>
                  <div className="create-profile-row-control">
                    <div className="create-profile-cookies-field">
                      <textarea
                        id="profile-cookies"
                        value={formState.cookies}
                        placeholder="JSON list format, Netscape text or Cookie Name=Value pairs"
                        onChange={(event) => updateForm({ cookies: event.target.value })}
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <button
                        type="button"
                        className="create-profile-attachment-btn"
                        onClick={() => cookieFileInputRef.current?.click()}
                        title="Attach cookie file"
                      >
                        <Paperclip size={15} />
                      </button>
                      <input
                        ref={cookieFileInputRef}
                        type="file"
                        accept=".json,.txt"
                        hidden
                        onChange={handleCookieFile}
                      />
                    </div>
                    {invalidCookieCount > 0 && (
                      <small className="create-profile-field-error">Fix {invalidCookieCount} invalid cookie entries before saving.</small>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="create-profile-section" aria-labelledby="proxy-title">
              <div className="create-profile-section-heading">
                <h2 className="create-profile-section__title" id="proxy-title">Proxies</h2>
                <div className="create-profile-section__actions">
                  <button type="button" className="create-profile-action-link" onClick={() => navigate('/proxies')}>Purchase / Add</button>
                  <button type="button" className="create-profile-action-link">Select</button>
                </div>
              </div>
              <p className="create-profile-section-note">Local Network: {compactProxy(selectedProxy)}</p>
              <div className="create-profile-fields create-profile-fields--compact">
                <div className="create-profile-row">
                  <span className="create-profile-row-label">Proxy ID</span>
                  <div className="create-profile-row-control">
                    <select value={formState.proxyId} onChange={(event) => updateForm({ proxyId: event.target.value })}>
                      <option value="">No proxy (local network)</option>
                      {proxies.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} · {item.protocol}://{item.host}:{item.port}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </section>

            <section className="create-profile-section" aria-labelledby="accounts-title">
              <div className="create-profile-section-heading">
                <h2 className="create-profile-section__title" id="accounts-title">Accounts</h2>
                <div className="create-profile-section__actions">
                  <button type="button" className="create-profile-action-link">Select</button>
                  <button type="button" className="create-profile-action-link">Add</button>
                </div>
              </div>
              <div style={{ marginTop: 'var(--space-3)' }}>
                <AccountSidebar />
              </div>
            </section>

            {/* Accordion: URLs */}
            <section className="create-profile-accordion">
              <button
                type="button"
                className="create-profile-accordion__trigger"
                onClick={() => toggleAccordion('urls')}
                aria-expanded={expanded.urls}
              >
                <span className="create-profile-accordion__trigger-left">
                  <span className="create-profile-accordion__icon">{expanded.urls ? <Minus size={13} /> : <Plus size={13} />}</span>
                  <span>URLs</span>
                </span>
              </button>
              {expanded.urls && (
                <div className="create-profile-accordion__content">
                  <div className="create-profile-row create-profile-row--textarea">
                    <span className="create-profile-row-label">Startup URLs</span>
                    <div className="create-profile-row-control">
                      <textarea
                        value={formState.startupUrlsText}
                        placeholder={'Must start with http:// or https://\nOne URL per line, press Enter for new line'}
                        onChange={(event) => updateForm({ startupUrlsText: event.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Accordion: Basic Settings */}
            <section className="create-profile-accordion">
              <button
                type="button"
                className="create-profile-accordion__trigger"
                onClick={() => toggleAccordion('basic')}
                aria-expanded={expanded.basic}
              >
                <span className="create-profile-accordion__trigger-left">
                  <span className="create-profile-accordion__icon">{expanded.basic ? <Minus size={13} /> : <Plus size={13} />}</span>
                  <span>Basic Settings</span>
                </span>
              </button>
              {expanded.basic && (
                <div className="create-profile-accordion__content">
                  <div className="create-profile-basic-grid">
                    <div className="create-profile-basic-row">
                      <span>Language</span>
                      <SegmentControl
                        options={[{ value: 'ip', label: 'Based on IP address' }, { value: 'custom', label: 'Custom' }]}
                        value={basicSettings.language}
                        onChange={(val) => setBasicSettings(b => ({ ...b, language: val }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>Display Language</span>
                      <SegmentControl
                        options={[{ value: 'ip', label: 'Based on IP address' }, { value: 'custom', label: 'Custom' }]}
                        value={basicSettings.displayLanguage}
                        onChange={(val) => setBasicSettings(b => ({ ...b, displayLanguage: val }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>Time Zone</span>
                      <SegmentControl
                        options={[{ value: 'ip', label: 'Based on IP address' }, { value: 'custom', label: 'Custom' }]}
                        value={basicSettings.timeZone}
                        onChange={(val) => setBasicSettings(b => ({ ...b, timeZone: val }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>Location Prompt</span>
                      <SegmentControl
                        options={[{ value: 'Inquiry', label: 'Inquiry' }, { value: 'Allow', label: 'Allow' }, { value: 'Prohibit', label: 'Prohibit' }]}
                        value={basicSettings.locationPrompt}
                        onChange={(val) => setBasicSettings(b => ({ ...b, locationPrompt: val }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>Location</span>
                      <SegmentControl
                        options={[{ value: 'ip', label: 'Based on IP address' }, { value: 'custom', label: 'Custom' }]}
                        value={basicSettings.location}
                        onChange={(val) => setBasicSettings(b => ({ ...b, location: val }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>Sound</span>
                      <SegmentControl
                        options={[{ value: 'Open', label: 'Open' }, { value: 'Close', label: 'Close' }]}
                        value={basicSettings.sound}
                        onChange={(val) => setBasicSettings(b => ({ ...b, sound: val }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>Image</span>
                      <SegmentControl
                        options={[{ value: 'Open', label: 'Open' }, { value: 'Close', label: 'Close' }]}
                        value={basicSettings.image}
                        onChange={(val) => setBasicSettings(b => ({ ...b, image: val }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>Video</span>
                      <SegmentControl
                        options={[{ value: 'Open', label: 'Open' }, { value: 'Close', label: 'Close' }]}
                        value={basicSettings.video}
                        onChange={(val) => setBasicSettings(b => ({ ...b, video: val }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>Size</span>
                      <div className="create-profile-size-row">
                        <SegmentControl
                          options={[{ value: 'Custom', label: 'Custom' }, { value: 'Fullscreen', label: 'Fullscreen' }]}
                          value={basicSettings.size}
                          onChange={(val) => setBasicSettings(b => ({ ...b, size: val }))}
                        />
                        {basicSettings.size === 'Custom' && (
                          <div className="create-profile-size-inputs">
                            <label htmlFor="res-w">W</label>
                            <input
                              id="res-w"
                              value={basicSettings.width}
                              onChange={(e) => setBasicSettings(b => ({ ...b, width: e.target.value }))}
                            />
                            <label htmlFor="res-h">H</label>
                            <input
                              id="res-h"
                              value={basicSettings.height}
                              onChange={(e) => setBasicSettings(b => ({ ...b, height: e.target.value }))}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="create-profile-basic-row">
                      <span>Profile Position</span>
                      <div className="create-profile-position-grid">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((idx) => (
                          <button
                            key={idx}
                            type="button"
                            className={`create-profile-position-cell ${basicSettings.gridPosition === idx ? 'is-selected' : ''}`}
                            onClick={() => setBasicSettings(b => ({ ...b, gridPosition: idx }))}
                            aria-label={`Position ${idx + 1}`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="create-profile-basic-row">
                      <span>Search Engine</span>
                      <select value={basicSettings.searchEngine} onChange={(e) => setBasicSettings(b => ({ ...b, searchEngine: e.target.value }))}>
                        <option value="Google">Google</option>
                        <option value="Bing">Bing</option>
                        <option value="DuckDuckGo">DuckDuckGo</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Accordion: Advanced Fingerprint Settings */}
            <section className="create-profile-accordion">
              <button
                type="button"
                className="create-profile-accordion__trigger"
                onClick={() => toggleAccordion('advanced')}
                aria-expanded={expanded.advanced}
              >
                <span className="create-profile-accordion__trigger-left">
                  <span className="create-profile-accordion__icon">{expanded.advanced ? <Minus size={13} /> : <Plus size={13} />}</span>
                  <span>Advanced Fingerprint Settings</span>
                </span>
              </button>
              {expanded.advanced && (
                <div className="create-profile-accordion__content">
                  <div className="create-profile-basic-grid">
                    <div className="create-profile-basic-row">
                      <span>Resolution</span>
                      <SegmentControl
                        options={[{ value: 'Follow System', label: 'Follow System' }, { value: 'Custom', label: 'Custom' }]}
                        value={advancedSettings.resolution}
                        onChange={(val) => setAdvancedSettings(a => ({ ...a, resolution: val }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>Font Fingerprint</span>
                      <SegmentControl
                        options={[{ value: 'Follow System', label: 'Follow System' }, { value: 'Random', label: 'Random' }]}
                        value={advancedSettings.font}
                        onChange={(val) => setAdvancedSettings(a => ({ ...a, font: val }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>WebRTC</span>
                      <SegmentControl
                        options={[{ value: 'Replace', label: 'Replace' }, { value: 'Real', label: 'Real' }, { value: 'Prohibit', label: 'Prohibit' }]}
                        value={advancedSettings.webrtc}
                        onChange={(val) => setAdvancedSettings(a => ({ ...a, webrtc: val }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>WebGL Image</span>
                      <SegmentControl
                        options={[{ value: 'Random', label: 'Random' }, { value: 'Real', label: 'Real' }]}
                        value={advancedSettings.webglImage}
                        onChange={(val) => setAdvancedSettings(a => ({ ...a, webglImage: val }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>WebGL Info</span>
                      <SegmentControl
                        options={[{ value: 'Real', label: 'Real' }, { value: 'Random', label: 'Random' }, { value: 'Custom', label: 'Custom' }]}
                        value={advancedSettings.webglInfo}
                        onChange={(val) => setAdvancedSettings(a => ({ ...a, webglInfo: val }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>WebGL Vendor</span>
                      <input
                        value={advancedSettings.webglVendor}
                        onChange={(e) => setAdvancedSettings(a => ({ ...a, webglVendor: e.target.value }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>WebGL Renderer</span>
                      <input
                        value={advancedSettings.webglRenderer}
                        onChange={(e) => setAdvancedSettings(a => ({ ...a, webglRenderer: e.target.value }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>WebGpu</span>
                      <SegmentControl
                        options={[{ value: 'Based on WebGL', label: 'Based on WebGL' }, { value: 'Real', label: 'Real' }, { value: 'Prohibit', label: 'Prohibit' }]}
                        value={advancedSettings.webgpu}
                        onChange={(val) => setAdvancedSettings(a => ({ ...a, webgpu: val }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>Canvas</span>
                      <SegmentControl
                        options={[{ value: 'Random', label: 'Random' }, { value: 'Real', label: 'Real' }]}
                        value={advancedSettings.canvas}
                        onChange={(val) => setAdvancedSettings(a => ({ ...a, canvas: val }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>AudioContext</span>
                      <SegmentControl
                        options={[{ value: 'Random', label: 'Random' }, { value: 'Real', label: 'Real' }]}
                        value={advancedSettings.audioContext}
                        onChange={(val) => setAdvancedSettings(a => ({ ...a, audioContext: val }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>Speech Voices</span>
                      <SegmentControl
                        options={[{ value: 'Random', label: 'Random' }, { value: 'Real', label: 'Real' }]}
                        value={advancedSettings.speechVoices}
                        onChange={(val) => setAdvancedSettings(a => ({ ...a, speechVoices: val }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>Do Not Track</span>
                      <SegmentControl
                        options={[{ value: 'Open', label: 'Open' }, { value: 'Close', label: 'Close' }]}
                        value={advancedSettings.doNotTrack}
                        onChange={(val) => setAdvancedSettings(a => ({ ...a, doNotTrack: val }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>Client Rects</span>
                      <SegmentControl
                        options={[{ value: 'Random', label: 'Random' }, { value: 'Real', label: 'Real' }]}
                        value={advancedSettings.clientRects}
                        onChange={(val) => setAdvancedSettings(a => ({ ...a, clientRects: val }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>Media Device</span>
                      <SegmentControl
                        options={[{ value: 'Random', label: 'Random' }, { value: 'Real', label: 'Real' }]}
                        value={advancedSettings.mediaDevice}
                        onChange={(val) => setAdvancedSettings(a => ({ ...a, mediaDevice: val }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>Device Name</span>
                      <input
                        value={advancedSettings.deviceName}
                        onChange={(e) => setAdvancedSettings(a => ({ ...a, deviceName: e.target.value }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>MAC Address</span>
                      <input
                        value={advancedSettings.macAddress}
                        onChange={(e) => setAdvancedSettings(a => ({ ...a, macAddress: e.target.value }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>Hardware Concurrency</span>
                      <SegmentControl
                        options={[{ value: 'Random', label: 'Random' }, { value: 'Custom', label: 'Custom' }]}
                        value={advancedSettings.hardwareConcurrency}
                        onChange={(val) => setAdvancedSettings(a => ({ ...a, hardwareConcurrency: val }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>Device Memory</span>
                      <SegmentControl
                        options={[{ value: 'Random', label: 'Random' }, { value: 'Custom', label: 'Custom' }]}
                        value={advancedSettings.deviceMemory}
                        onChange={(val) => setAdvancedSettings(a => ({ ...a, deviceMemory: val }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>SSL fingerprint settings</span>
                      <SegmentControl
                        options={[{ value: 'Close', label: 'Close' }, { value: 'Open', label: 'Open' }]}
                        value={advancedSettings.ssl}
                        onChange={(val) => setAdvancedSettings(a => ({ ...a, ssl: val }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>Port Scan Protection</span>
                      <SegmentControl
                        options={[{ value: 'Open', label: 'Open' }, { value: 'Close', label: 'Close' }]}
                        value={advancedSettings.portScan}
                        onChange={(val) => setAdvancedSettings(a => ({ ...a, portScan: val }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>Scan Whitelist</span>
                      <input
                        value={advancedSettings.whitelistPorts}
                        placeholder="Ports allowed to be scanned by websites, multiple ports separated by commas"
                        onChange={(e) => setAdvancedSettings(a => ({ ...a, whitelistPorts: e.target.value }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>Hardware Acceleration Mode</span>
                      <SegmentControl
                        options={[{ value: 'Open', label: 'Open' }, { value: 'Close', label: 'Close' }]}
                        value={advancedSettings.hardwareAcceleration}
                        onChange={(val) => setAdvancedSettings(a => ({ ...a, hardwareAcceleration: val }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>Disable Sandbox</span>
                      <SegmentControl
                        options={[{ value: 'Close', label: 'Close' }, { value: 'Open', label: 'Open' }]}
                        value={advancedSettings.disableSandbox}
                        onChange={(val) => setAdvancedSettings(a => ({ ...a, disableSandbox: val }))}
                      />
                    </div>
                    <div className="create-profile-basic-row">
                      <span>Startup Parameters</span>
                      <input
                        value={advancedSettings.startupParameters}
                        placeholder="Browser startup parameters, such as --mute, multiple parameters are separated by semicolons"
                        onChange={(e) => setAdvancedSettings(a => ({ ...a, startupParameters: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Accordion: Preferences */}
            <section className="create-profile-accordion">
              <button
                type="button"
                className="create-profile-accordion__trigger"
                onClick={() => toggleAccordion('preferences')}
                aria-expanded={expanded.preferences}
              >
                <span className="create-profile-accordion__trigger-left">
                  <span className="create-profile-accordion__icon">{expanded.preferences ? <Minus size={13} /> : <Plus size={13} />}</span>
                  <span>Preferences</span>
                </span>
              </button>
              {expanded.preferences && (
                <div className="create-profile-accordion__content">
                  <div className="create-profile-preferences-grid">
                    {[
                      ['syncBookmarks', 'Sync Bookmarks'],
                      ['syncHistory', 'Sync History'],
                      ['syncTabs', 'Sync Tabs'],
                      ['syncCookie', 'Sync Cookie'],
                      ['syncExtensions', 'Sync Extensions'],
                      ['syncPasswords', 'Sync Saved Username and Password'],
                      ['syncIndexedDB', 'Sync IndexedDB'],
                      ['syncLocalStorage', 'Sync Local Storage'],
                      ['syncSessionStorage', 'Sync Session Storage'],
                      ['clearCache', 'Delete Cache Files before Browser Startup'],
                      ['clearCookies', 'Delete Cookies before Browser Startup'],
                      ['clearLocalStorage', 'Delete Local Storage before Browser Startup'],
                      ['randomStartup', 'Random Fingerprint when Browser Startup'],
                      ['savePassword', 'Prompt to Save Password'],
                      ['stopNoNetwork', 'Stop Opening if Network is Unavailable'],
                      ['stopIpChange', 'Stop Opening if IP changes'],
                      ['stopCountryChange', 'Stop Opening if IP country/region changes'],
                      ['openDashboard', 'Open Dashboard'],
                      ['ipReminder', 'IP Change Reminder'],
                      ['googleSignIn', 'Enable Google Sign-in'],
                    ].map(([field, label]) => (
                      <label className="create-profile-preference-item" key={field}>
                        <input
                          type="checkbox"
                          checked={prefs[field as keyof typeof prefs] as boolean}
                          onChange={(e) => setPrefs(p => ({ ...p, [field as keyof typeof prefs]: e.target.checked }))}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>

                  <div className="create-profile-fields" style={{ marginTop: 'var(--space-4)' }}>
                    <div className="create-profile-row create-profile-row--textarea">
                      <span className="create-profile-row-label">URL Access Blacklist</span>
                      <div className="create-profile-row-control">
                        <textarea
                          value={prefs.blacklist}
                          placeholder="One URL per line, add new lines for multiple"
                          onChange={(e) => setPrefs(p => ({ ...p, blacklist: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="create-profile-row create-profile-row--textarea">
                      <span className="create-profile-row-label">URL Access Whitelist</span>
                      <div className="create-profile-row-control">
                        <textarea
                          value={prefs.whitelist}
                          placeholder="One URL per line, add new lines for multiple"
                          onChange={(e) => setPrefs(p => ({ ...p, whitelist: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </form>

          <aside className="create-profile-preview">
            <div className="create-profile-preview-header">
              <span>Preview</span>
              <button type="button" className="create-profile-preview-copy-btn" onClick={() => void navigator.clipboard.writeText(formState.userAgent)}>
                <Copy size={13} />
              </button>
            </div>

            <div className="create-profile-preview-visual">
              <div className="create-profile-preview-visual-chain">
                <span className="create-profile-preview-visual-tile"><img src={preview.osIcon} alt="" /></span>
                <span className="create-profile-preview-visual-connector" />
                <span className="create-profile-preview-visual-tile"><img src={preview.browserIcon} alt="" /></span>
                <span className="create-profile-preview-visual-connector" />
                <span className="create-profile-preview-visual-tile">+</span>
              </div>
              <img className="create-profile-preview-device" src={preview.deviceImage} alt={`${preview.system} preview`} />
            </div>

            <dl className="create-profile-preview-list">
              {[
                ['System', preview.system],
                ['Kernel Type', preview.kernel],
                ['User Agent', preview.userAgent],
                ['Language', preview.language],
                ['Time Zone', preview.timeZone],
                ['Location Prompt', formState.fingerprint.locationPrompt],
                ['Location', 'Based on IP address'],
                ['Resolution', formState.fingerprint.resolutionMode],
                ['Font Fingerprint', formState.fingerprint.fontMode],
                ['WebRTC', formState.fingerprint.webRTCMode],
                ['WebGL Image', formState.fingerprint.webGLMode],
                ['WebGL Info', 'Random'],
                ['Canvas', 'Random'],
                ['AudioContext', 'Random'],
                ['Speech Voices', 'Random'],
                ['Do Not Track', 'Open'],
                ['Client Rects', 'Random'],
                ['Media Device', 'Random'],
                ['Device Name', 'Random'],
                ['MAC Address', 'Custom'],
                ['Hardware Concurrency', '12-core'],
                ['Device Memory', '8G'],
                ['SSL fingerprint settings', 'Close'],
                ['Port Scan Protection', 'Open'],
                ['Hardware Acceleration Mode', 'Open'],
              ].map(([label, value]) => (
                <div className="create-profile-preview-list-row" key={label}>
                  <dt>{label}</dt>
                  <dd className={label === 'User Agent' ? 'create-profile-preview-list-ua' : undefined}>{value}</dd>
                </div>
              ))}
            </dl>

            <button type="button" className="create-profile-preview-rand-btn" onClick={handleRandomizeUA}>
              <Shuffle size={14} />
              <span>Generate random fingerprint</span>
            </button>
          </aside>
        </div>
      </div>

      <footer className="create-profile-footer">
        {showDiscardConfirmation ? (
          <div className="create-profile-discard" role="status">
            <span>Discard unsaved changes?</span>
            <button type="button" className="button button--ghost" onClick={() => setShowDiscardConfirmation(false)}>Cancel</button>
            <button type="button" className="button button--danger" onClick={() => navigate('/profiles')}>Discard</button>
          </div>
        ) : (
          <>
            <div className="create-profile-footer-left">
              <button type="button" className="create-profile-footer-btn"><Layers3 size={14} /><span>Default</span></button>
              <button type="button" className="create-profile-footer-btn"><Tag size={14} /><span>Tag</span></button>
              <button type="button" className="create-profile-footer-btn"><FileText size={14} /><span>Notes</span></button>
            </div>
            <div className="create-profile-footer-right">
              {!isEditing && (
                <select className="create-profile-footer-template-select" disabled>
                  <option>Save as template</option>
                </select>
              )}
              {!validation.valid && <span className="create-profile-save-error">{validation.message}</span>}
              <button type="submit" form="profile-editor-form" className="button button--primary create-profile-save-btn" disabled={!canSubmit}>
                {isSubmitting ? <Loader2 className="create-profile-spinner" size={14} /> : <Check size={14} />}
                <span>{isEditing ? 'Save' : 'Create'}</span>
              </button>
            </div>
          </>
        )}
      </footer>
    </>
  );
}
