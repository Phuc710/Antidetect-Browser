import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers3, Tag, FileText } from 'lucide-react';
import type { ProxyView } from '../../../shared/profile-contracts.js';
import { parseCookies } from '../../features/profiles/utils/cookie-parser.js';

// Features & Configs
import {
  DEFAULT_FORM_STATE,
  OS_VERSIONS,
  KERNEL_VERSIONS,
  buildUserAgent,
  formToDraft,
  stateFromProfile,
  type ProfileFormState,
} from '../../features/profiles/config/profileFormConfigs.js';
import { buildPreviewModel, type PreviewOs, type PreviewKernel } from './profile-assets.js';
import {
  buildCreateProfileInput,
  buildUpdateProfileInput,
  validateCreateProfileDraft,
  parseStartupUrls,
} from './create-profile-model.js';

// Custom Hooks
import { useProfileFormQuery } from '../../features/profiles/hooks/useProfileFormQuery.js';
import { useProfileFormMutations } from '../../features/profiles/hooks/useProfileFormMutations.js';

// Sub-components
import { ProfileFormShell } from '../../features/profiles/components/ProfileFormShell.js';
import { BasicInfoSection } from '../../features/profiles/components/BasicInfoSection.js';
import { AdvancedSettingsAccordion } from '../../features/profiles/components/AdvancedSettingsAccordion.js';
import { PreferencesAccordion } from '../../features/profiles/components/PreferencesAccordion.js';
import { ProfilePreviewSidebar } from '../../features/profiles/components/ProfilePreviewSidebar.js';

import './CreateProfilePage.css';

interface ProfileFormProps {
  readonly mode: 'create' | 'edit';
  readonly profileId?: string | undefined;
}

type AccordionKey = 'urls' | 'basic' | 'advanced' | 'preferences';

function compactProxy(proxy: ProxyView | undefined): string {
  if (!proxy) return 'VN/Can Duoc (14.191.220.68)';
  return `${proxy.name} (${proxy.host}:${proxy.port})`;
}

export function ProfileForm({ mode, profileId }: ProfileFormProps): JSX.Element {
  const navigate = useNavigate();
  const isEditing = mode === 'edit';
  const submitGuardRef = useRef(false);
  const cookieFileInputRef = useRef<HTMLInputElement>(null);

  // Custom data hooks
  const { proxies, profile: loadedProfile, isLoading, isError } = useProfileFormQuery(profileId);
  const { createProfile, isCreating, updateProfile, isUpdating } = useProfileFormMutations();

  // Local Form state
  const [formState, setFormState] = useState<ProfileFormState>(DEFAULT_FORM_STATE);
  const [initialFormState, setInitialFormState] = useState<ProfileFormState>(DEFAULT_FORM_STATE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDiscardConfirmation, setShowDiscardConfirmation] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Accordion expanded states
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

  // Hydrate form state when editing profile loads
  useEffect(() => {
    if (isEditing && loadedProfile) {
      const nextState = stateFromProfile(loadedProfile);
      setFormState(nextState);
      setInitialFormState(nextState);
    } else if (!isEditing) {
      const defaultUA = buildUserAgent(
        DEFAULT_FORM_STATE.system,
        DEFAULT_FORM_STATE.kernel,
        DEFAULT_FORM_STATE.kernelVersion,
      );
      setFormState((prev) => ({ ...prev, userAgent: defaultUA }));
      setInitialFormState((prev) => ({ ...prev, userAgent: defaultUA }));
    }
  }, [isEditing, loadedProfile]);

  const startupUrls = useMemo(() => parseStartupUrls(formState.startupUrlsText), [formState.startupUrlsText]);
  const defaultCookieDomain = useMemo(() => {
    const firstUrl = startupUrls[0];
    if (!firstUrl) return undefined;
    try {
      return new URL(firstUrl).hostname;
    } catch {
      return undefined;
    }
  }, [startupUrls]);

  const parsedCookies = useMemo(
    () => parseCookies(formState.cookies, defaultCookieDomain),
    [defaultCookieDomain, formState.cookies],
  );
  const invalidCookieCount = parsedCookies.filter((item) => item.status === 'invalid').length;
  const selectedProxy = proxies.find((item) => item.id === formState.proxyId);
  const preview = useMemo(
    () =>
      buildPreviewModel({
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
  const isSubmitting = isCreating || isUpdating;

  const canSubmit =
    !isSubmitting &&
    !isLoading &&
    (!isEditing || isDirty) &&
    validation.valid &&
    invalidCookieCount === 0 &&
    formState.userAgent.trim().length > 0 &&
    formState.userAgent.length <= 1024;

  // Prevent accidental close on unsaved changes
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
    if (!loadedProfile) return;
    void navigator.clipboard.writeText(loadedProfile.id);
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
    setErrorMessage(null);
    try {
      const draft = formToDraft(formState);
      if (isEditing && loadedProfile) {
        await updateProfile(buildUpdateProfileInput(loadedProfile, draft, formState.cookies));
      } else {
        await createProfile(buildCreateProfileInput(draft, formState.cookies));
      }
      submitGuardRef.current = false;
    } catch (err) {
      submitGuardRef.current = false;
      setErrorMessage(
        err instanceof Error
          ? err.message
          : `The profile could not be ${isEditing ? 'updated' : 'created'}. Your draft is still available.`,
      );
    }
  }

  if (isLoading) {
    return (
      <div className="create-profile-loading">
        <span>Loading profile</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="pstate-card pstate-card--error" role="alert">
        <h2>Failed to load profile data</h2>
        <button type="button" className="button button--secondary" onClick={() => navigate('/profiles')}>
          Go Back
        </button>
      </div>
    );
  }

  const footerLeft = (
    <>
      <button type="button" className="create-profile-footer-btn">
        <Layers3 size={14} />
        <span>Default</span>
      </button>
      <button type="button" className="create-profile-footer-btn">
        <Tag size={14} />
        <span>Tag</span>
      </button>
      <button type="button" className="create-profile-footer-btn">
        <FileText size={14} />
        <span>Notes</span>
      </button>
    </>
  );

  return (
    <ProfileFormShell
      isEditing={isEditing}
      isSubmitting={isSubmitting}
      isValid={canSubmit}
      errorMessage={errorMessage}
      validationMessage={!validation.valid ? validation.message : undefined}
      showDiscardConfirmation={showDiscardConfirmation}
      onBack={handleBack}
      onCancelDiscard={() => setShowDiscardConfirmation(false)}
      onConfirmDiscard={() => navigate('/profiles')}
      onSubmit={(e) => void handleSubmit(e)}
      footerLeft={footerLeft}
      sidebar={
        <ProfilePreviewSidebar
          preview={preview}
          locationPrompt={formState.fingerprint.locationPrompt}
          resolutionMode={formState.fingerprint.resolutionMode}
          fontMode={formState.fingerprint.fontMode}
          webRTCMode={formState.fingerprint.webRTCMode}
          webGLMode={formState.fingerprint.webGLMode}
          onRandomizeUA={handleRandomizeUA}
        />
      }
    >
      <BasicInfoSection
        formState={formState}
        proxies={proxies}
        compactProxyLabel={compactProxy(selectedProxy)}
        cookieFileInputRef={cookieFileInputRef}
        invalidCookieCount={invalidCookieCount}
        isEditing={isEditing}
        profile={loadedProfile}
        copiedId={copiedId}
        expandedUrls={expanded.urls}
        expandedBasic={expanded.basic}
        basicSettings={basicSettings}
        onUpdateForm={updateForm}
        onSystemChange={handleSystemChange}
        onKernelChange={handleKernelChange}
        onKernelVersionChange={handleKernelVersionChange}
        onRandomizeUA={handleRandomizeUA}
        onCookieFileChange={handleCookieFile}
        onCopyProfileId={handleCopyProfileId}
        onToggleAccordion={(key) => toggleAccordion(key)}
        onUpdateBasicSettings={(patch) => setBasicSettings((prev) => ({ ...prev, ...patch }))}
        onNavigateToProxies={() => navigate('/proxies')}
      />

      <AdvancedSettingsAccordion
        expanded={expanded.advanced}
        settings={advancedSettings}
        onToggle={() => toggleAccordion('advanced')}
        onUpdate={(patch) => setAdvancedSettings((prev) => ({ ...prev, ...patch }))}
      />

      <PreferencesAccordion
        expanded={expanded.preferences}
        prefs={prefs}
        onToggle={() => toggleAccordion('preferences')}
        onUpdate={(patch) => setPrefs((prev) => ({ ...prev, ...patch }))}
      />
    </ProfileFormShell>
  );
}
