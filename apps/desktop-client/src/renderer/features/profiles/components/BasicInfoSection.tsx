import React from 'react';
import { Shuffle, Paperclip, Plus, Minus } from 'lucide-react';
import type { ProfileView, ProxyView } from '../../../../shared/profile-contracts.js';
import type { ProfileFormState } from '../config/profileFormConfigs.js';
import {
  SYSTEM_OPTIONS,
  OS_VERSIONS,
  KERNEL_VERSIONS,
} from '../config/profileFormConfigs.js';
import { osAssets, browserAssets, type PreviewOs, type PreviewKernel } from '../../../pages/profiles/profile-assets.js';
import { AccountSidebar } from '../../../components/AccountSidebar.js';

interface SegmentOption<T> {
  value: T;
  label: string;
}

function SegmentControl<T extends string>({
  options,
  value,
  onChange,
}: {
  readonly options: readonly SegmentOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
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

interface BasicInfoSectionProps {
  readonly formState: ProfileFormState;
  readonly proxies: ProxyView[];
  readonly compactProxyLabel: string;
  readonly cookieFileInputRef: React.RefObject<HTMLInputElement>;
  readonly invalidCookieCount: number;
  readonly isEditing: boolean;
  readonly profile: ProfileView | null;
  readonly copiedId: boolean;
  readonly expandedUrls: boolean;
  readonly expandedBasic: boolean;
  readonly basicSettings: {
    readonly language: string;
    readonly displayLanguage: string;
    readonly timeZone: string;
    readonly locationPrompt: 'Allow' | 'Inquiry' | 'Prohibit';
    readonly location: string;
    readonly sound: string;
    readonly image: string;
    readonly video: string;
    readonly size: string;
    readonly width: string;
    readonly height: string;
    readonly searchEngine: string;
    readonly gridPosition: number;
  };
  readonly onUpdateForm: (patch: Partial<ProfileFormState>) => void;
  readonly onSystemChange: (system: PreviewOs) => void;
  readonly onKernelChange: (kernel: PreviewKernel) => void;
  readonly onKernelVersionChange: (version: string) => void;
  readonly onRandomizeUA: () => void;
  readonly onCookieFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  readonly onCopyProfileId: () => void;
  readonly onToggleAccordion: (key: 'urls' | 'basic') => void;
  readonly onUpdateBasicSettings: (patch: Partial<BasicInfoSectionProps['basicSettings']>) => void;
  readonly onNavigateToProxies: () => void;
}

export function BasicInfoSection({
  formState,
  proxies,
  compactProxyLabel,
  cookieFileInputRef,
  invalidCookieCount,
  isEditing,
  profile,
  copiedId,
  expandedUrls,
  expandedBasic,
  basicSettings,
  onUpdateForm,
  onSystemChange,
  onKernelChange,
  onKernelVersionChange,
  onRandomizeUA,
  onCookieFileChange,
  onCopyProfileId,
  onToggleAccordion,
  onUpdateBasicSettings,
  onNavigateToProxies,
}: BasicInfoSectionProps): JSX.Element {
  return (
    <>
      {/* Profile Info Section */}
      <section className="create-profile-section create-profile-section--first" aria-labelledby="profile-info-title">
        <div className="create-profile-section-heading">
          <h2 className="create-profile-section__title" id="profile-info-title">
            Profile Info
          </h2>
          {isEditing && profile && (
            <span className="create-profile-id-link">
              ID: {profile.id}
              <button type="button" onClick={onCopyProfileId}>
                {copiedId ? 'Copied' : 'Copy'}
              </button>
            </span>
          )}
        </div>

        <div className="create-profile-fields">
          {/* Profile Name */}
          <div className="create-profile-row">
            <label className="create-profile-row-label" htmlFor="profile-name">
              Profile Name
            </label>
            <div className="create-profile-row-control">
              <input
                id="profile-name"
                value={formState.name}
                maxLength={100}
                placeholder="Unnamed Profile (Optional)"
                onChange={(event) => onUpdateForm({ name: event.target.value })}
                autoComplete="off"
              />
            </div>
          </div>

          {/* System Selection */}
          <div className="create-profile-row">
            <span className="create-profile-row-label">System</span>
            <div className="create-profile-row-control create-profile-row-control--split">
              <div className="create-profile-segmented create-profile-segmented--os">
                {SYSTEM_OPTIONS.map((system) => (
                  <button
                    key={system}
                    type="button"
                    className={`create-profile-os-seg ${formState.system === system ? 'is-selected' : ''}`}
                    onClick={() => onSystemChange(system)}
                    title={osAssets[system].label}
                  >
                    <img src={osAssets[system].icon} alt="" />
                  </button>
                ))}
              </div>
              <select
                className="create-profile-os-select"
                value={formState.systemVersion}
                onChange={(event) => onUpdateForm({ systemVersion: event.target.value })}
                aria-label="System version"
              >
                {OS_VERSIONS[formState.system].map((version) => (
                  <option key={version}>{version}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Kernel Selection */}
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
                      onClick={() => onKernelChange(kernel)}
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
                onChange={(event) => onKernelVersionChange(event.target.value)}
                aria-label="Kernel version"
              >
                {KERNEL_VERSIONS[formState.kernel].map((version) => (
                  <option key={version}>{version}</option>
                ))}
              </select>
            </div>
          </div>

          {/* User-Agent */}
          <div className="create-profile-row">
            <span className="create-profile-row-label">User-Agent</span>
            <div className="create-profile-row-control create-profile-row-control--ua">
              <input
                value={formState.userAgent}
                maxLength={1024}
                onChange={(event) => onUpdateForm({ userAgent: event.target.value })}
              />
              <button type="button" className="create-profile-ua-random-btn" onClick={onRandomizeUA}>
                <Shuffle size={14} />
                <span>Random</span>
              </button>
            </div>
          </div>

          {/* Cookies */}
          <div className="create-profile-row create-profile-row--textarea">
            <span className="create-profile-row-label">Cookies</span>
            <div className="create-profile-row-control">
              <div className="create-profile-cookies-field">
                <textarea
                  id="profile-cookies"
                  value={formState.cookies}
                  placeholder="JSON list format, Netscape text or Cookie Name=Value pairs"
                  onChange={(event) => onUpdateForm({ cookies: event.target.value })}
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
                  onChange={onCookieFileChange}
                />
              </div>
              {invalidCookieCount > 0 && (
                <small className="create-profile-field-error">
                  Fix {invalidCookieCount} invalid cookie entries before saving.
                </small>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Proxy Section */}
      <section className="create-profile-section" aria-labelledby="proxy-title">
        <div className="create-profile-section-heading">
          <h2 className="create-profile-section__title" id="proxy-title">
            Proxies
          </h2>
          <div className="create-profile-section__actions">
            <button type="button" className="create-profile-action-link" onClick={onNavigateToProxies}>
              Purchase / Add
            </button>
            <button type="button" className="create-profile-action-link">
              Select
            </button>
          </div>
        </div>
        <p className="create-profile-section-note">Local Network: {compactProxyLabel}</p>
        <div className="create-profile-fields create-profile-fields--compact">
          <div className="create-profile-row">
            <span className="create-profile-row-label">Proxy ID</span>
            <div className="create-profile-row-control">
              <select value={formState.proxyId} onChange={(event) => onUpdateForm({ proxyId: event.target.value })}>
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

      {/* Accounts Section */}
      <section className="create-profile-section" aria-labelledby="accounts-title">
        <div className="create-profile-section-heading">
          <h2 className="create-profile-section__title" id="accounts-title">
            Accounts
          </h2>
          <div className="create-profile-section__actions">
            <button type="button" className="create-profile-action-link">
              Select
            </button>
            <button type="button" className="create-profile-action-link">
              Add
            </button>
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
          onClick={() => onToggleAccordion('urls')}
          aria-expanded={expandedUrls}
        >
          <span className="create-profile-accordion__trigger-left">
            <span className="create-profile-accordion__icon">{expandedUrls ? <Minus size={13} /> : <Plus size={13} />}</span>
            <span>URLs</span>
          </span>
        </button>
        {expandedUrls && (
          <div className="create-profile-accordion__content">
            <div className="create-profile-row create-profile-row--textarea">
              <span className="create-profile-row-label">Startup URLs</span>
              <div className="create-profile-row-control">
                <textarea
                  value={formState.startupUrlsText}
                  placeholder={'Must start with http:// or https://\nOne URL per line, press Enter for new line'}
                  onChange={(event) => onUpdateForm({ startupUrlsText: event.target.value })}
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
          onClick={() => onToggleAccordion('basic')}
          aria-expanded={expandedBasic}
        >
          <span className="create-profile-accordion__trigger-left">
            <span className="create-profile-accordion__icon">{expandedBasic ? <Minus size={13} /> : <Plus size={13} />}</span>
            <span>Basic Settings</span>
          </span>
        </button>
        {expandedBasic && (
          <div className="create-profile-accordion__content">
            <div className="create-profile-basic-grid">
              <div className="create-profile-basic-row">
                <span>Language</span>
                <SegmentControl
                  options={[{ value: 'ip', label: 'Based on IP address' }, { value: 'custom', label: 'Custom' }]}
                  value={basicSettings.language}
                  onChange={(val) => onUpdateBasicSettings({ language: val })}
                />
              </div>
              <div className="create-profile-basic-row">
                <span>Display Language</span>
                <SegmentControl
                  options={[{ value: 'ip', label: 'Based on IP address' }, { value: 'custom', label: 'Custom' }]}
                  value={basicSettings.displayLanguage}
                  onChange={(val) => onUpdateBasicSettings({ displayLanguage: val })}
                />
              </div>
              <div className="create-profile-basic-row">
                <span>Time Zone</span>
                <SegmentControl
                  options={[{ value: 'ip', label: 'Based on IP address' }, { value: 'custom', label: 'Custom' }]}
                  value={basicSettings.timeZone}
                  onChange={(val) => onUpdateBasicSettings({ timeZone: val })}
                />
              </div>
              <div className="create-profile-basic-row">
                <span>Location Prompt</span>
                <SegmentControl
                  options={[{ value: 'Allow', label: 'Allow' }, { value: 'Inquiry', label: 'Inquiry' }, { value: 'Prohibit', label: 'Prohibit' }]}
                  value={basicSettings.locationPrompt}
                  onChange={(val) => onUpdateBasicSettings({ locationPrompt: val })}
                />
              </div>
              <div className="create-profile-basic-row">
                <span>Location</span>
                <SegmentControl
                  options={[{ value: 'ip', label: 'Based on IP address' }, { value: 'custom', label: 'Custom' }]}
                  value={basicSettings.location}
                  onChange={(val) => onUpdateBasicSettings({ location: val })}
                />
              </div>
              <div className="create-profile-basic-row">
                <span>Sound</span>
                <SegmentControl
                  options={[{ value: 'Open', label: 'Open' }, { value: 'Close', label: 'Close' }]}
                  value={basicSettings.sound}
                  onChange={(val) => onUpdateBasicSettings({ sound: val })}
                />
              </div>
              <div className="create-profile-basic-row">
                <span>Image</span>
                <SegmentControl
                  options={[{ value: 'Open', label: 'Open' }, { value: 'Close', label: 'Close' }]}
                  value={basicSettings.image}
                  onChange={(val) => onUpdateBasicSettings({ image: val })}
                />
              </div>
              <div className="create-profile-basic-row">
                <span>Video (Webcam)</span>
                <SegmentControl
                  options={[{ value: 'Open', label: 'Open' }, { value: 'Close', label: 'Close' }]}
                  value={basicSettings.video}
                  onChange={(val) => onUpdateBasicSettings({ video: val })}
                />
              </div>
              <div className="create-profile-basic-row">
                <span>Browser Window Size</span>
                <SegmentControl
                  options={[{ value: 'Custom', label: 'Custom' }, { value: 'Follow System', label: 'Follow System' }]}
                  value={basicSettings.size}
                  onChange={(val) => onUpdateBasicSettings({ size: val })}
                />
              </div>
              {basicSettings.size === 'Custom' && (
                <div className="create-profile-basic-row create-profile-basic-row--split">
                  <span>Dimensions</span>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <input
                      type="number"
                      value={basicSettings.width}
                      style={{ width: 80 }}
                      onChange={(e) => onUpdateBasicSettings({ width: e.target.value })}
                      aria-label="Width"
                    />
                    <span>x</span>
                    <input
                      type="number"
                      value={basicSettings.height}
                      style={{ width: 80 }}
                      onChange={(e) => onUpdateBasicSettings({ height: e.target.value })}
                      aria-label="Height"
                    />
                  </div>
                </div>
              )}
              <div className="create-profile-basic-row">
                <span>Search Engine</span>
                <select
                  value={basicSettings.searchEngine}
                  onChange={(e) => onUpdateBasicSettings({ searchEngine: e.target.value })}
                  aria-label="Search engine"
                >
                  <option>Google</option>
                  <option>Bing</option>
                  <option>Yahoo</option>
                  <option>DuckDuckGo</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
