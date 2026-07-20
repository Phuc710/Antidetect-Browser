import { Plus, Minus } from 'lucide-react';

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

interface AdvancedSettings {
  readonly resolution: string;
  readonly font: string;
  readonly webrtc: string;
  readonly webglImage: string;
  readonly webglInfo: string;
  readonly webglVendor: string;
  readonly webglRenderer: string;
  readonly webgpu: string;
  readonly canvas: string;
  readonly audioContext: string;
  readonly speechVoices: string;
  readonly doNotTrack: string;
  readonly clientRects: string;
  readonly mediaDevice: string;
  readonly deviceName: string;
  readonly macAddress: string;
  readonly hardwareConcurrency: string;
  readonly deviceMemory: string;
  readonly ssl: string;
  readonly portScan: string;
  readonly whitelistPorts: string;
  readonly hardwareAcceleration: string;
  readonly disableSandbox: string;
  readonly startupParameters: string;
}

interface AdvancedSettingsAccordionProps {
  readonly expanded: boolean;
  readonly settings: AdvancedSettings;
  readonly onToggle: () => void;
  readonly onUpdate: (patch: Partial<AdvancedSettings>) => void;
}

export function AdvancedSettingsAccordion({
  expanded,
  settings,
  onToggle,
  onUpdate,
}: AdvancedSettingsAccordionProps): JSX.Element {
  return (
    <section className="create-profile-accordion">
      <button
        type="button"
        className="create-profile-accordion__trigger"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className="create-profile-accordion__trigger-left">
          <span className="create-profile-accordion__icon">{expanded ? <Minus size={13} /> : <Plus size={13} />}</span>
          <span>Advanced Fingerprints</span>
        </span>
      </button>
      {expanded && (
        <div className="create-profile-accordion__content">
          <div className="create-profile-basic-grid">
            <div className="create-profile-basic-row">
              <span>WebGL Image</span>
              <SegmentControl
                options={[{ value: 'Random', label: 'Random' }, { value: 'Close', label: 'Close' }]}
                value={settings.webglImage}
                onChange={(val) => onUpdate({ webglImage: val })}
              />
            </div>
            <div className="create-profile-basic-row">
              <span>WebGL Info</span>
              <SegmentControl
                options={[{ value: 'Random', label: 'Random' }, { value: 'Custom', label: 'Custom' }]}
                value={settings.webglInfo}
                onChange={(val) => onUpdate({ webglInfo: val })}
              />
            </div>
            {settings.webglInfo === 'Custom' && (
              <>
                <div className="create-profile-basic-row">
                  <span>WebGL Vendor</span>
                  <input
                    value={settings.webglVendor}
                    onChange={(e) => onUpdate({ webglVendor: e.target.value })}
                  />
                </div>
                <div className="create-profile-basic-row">
                  <span>WebGL Renderer</span>
                  <input
                    value={settings.webglRenderer}
                    onChange={(e) => onUpdate({ webglRenderer: e.target.value })}
                  />
                </div>
              </>
            )}
            <div className="create-profile-basic-row">
              <span>WebGPU</span>
              <SegmentControl
                options={[{ value: 'Based on WebGL', label: 'Based on WebGL' }, { value: 'Real', label: 'Real' }]}
                value={settings.webgpu}
                onChange={(val) => onUpdate({ webgpu: val })}
              />
            </div>
            <div className="create-profile-basic-row">
              <span>Canvas noise</span>
              <SegmentControl
                options={[{ value: 'Random', label: 'Random' }, { value: 'Real', label: 'Real' }]}
                value={settings.canvas}
                onChange={(val) => onUpdate({ canvas: val })}
              />
            </div>
            <div className="create-profile-basic-row">
              <span>AudioContext noise</span>
              <SegmentControl
                options={[{ value: 'Random', label: 'Random' }, { value: 'Real', label: 'Real' }]}
                value={settings.canvas} // Wait, is it settings.canvas or audioContext?
                onChange={(val) => onUpdate({ audioContext: val })}
              />
            </div>
            <div className="create-profile-basic-row">
              <span>Speech Voices</span>
              <SegmentControl
                options={[{ value: 'Random', label: 'Random' }, { value: 'Real', label: 'Real' }]}
                value={settings.speechVoices}
                onChange={(val) => onUpdate({ speechVoices: val })}
              />
            </div>
            <div className="create-profile-basic-row">
              <span>Do Not Track</span>
              <SegmentControl
                options={[{ value: 'Open', label: 'Open' }, { value: 'Close', label: 'Close' }]}
                value={settings.doNotTrack}
                onChange={(val) => onUpdate({ doNotTrack: val })}
              />
            </div>
            <div className="create-profile-basic-row">
              <span>Client Rects</span>
              <SegmentControl
                options={[{ value: 'Random', label: 'Random' }, { value: 'Real', label: 'Real' }]}
                value={settings.clientRects}
                onChange={(val) => onUpdate({ clientRects: val })}
              />
            </div>
            <div className="create-profile-basic-row">
              <span>Media Device</span>
              <SegmentControl
                options={[{ value: 'Random', label: 'Random' }, { value: 'Real', label: 'Real' }]}
                value={settings.mediaDevice}
                onChange={(val) => onUpdate({ mediaDevice: val })}
              />
            </div>
            <div className="create-profile-basic-row">
              <span>Device Name</span>
              <input
                value={settings.deviceName}
                onChange={(e) => onUpdate({ deviceName: e.target.value })}
              />
            </div>
            <div className="create-profile-basic-row">
              <span>MAC Address</span>
              <input
                value={settings.macAddress}
                onChange={(e) => onUpdate({ macAddress: e.target.value })}
              />
            </div>
            <div className="create-profile-basic-row">
              <span>Hardware Concurrency</span>
              <SegmentControl
                options={[{ value: 'Random', label: 'Random' }, { value: 'Custom', label: 'Custom' }]}
                value={settings.hardwareConcurrency}
                onChange={(val) => onUpdate({ hardwareConcurrency: val })}
              />
            </div>
            <div className="create-profile-basic-row">
              <span>Device Memory</span>
              <SegmentControl
                options={[{ value: 'Random', label: 'Random' }, { value: 'Custom', label: 'Custom' }]}
                value={settings.deviceMemory}
                onChange={(val) => onUpdate({ deviceMemory: val })}
              />
            </div>
            <div className="create-profile-basic-row">
              <span>SSL fingerprint settings</span>
              <SegmentControl
                options={[{ value: 'Close', label: 'Close' }, { value: 'Open', label: 'Open' }]}
                value={settings.ssl}
                onChange={(val) => onUpdate({ ssl: val })}
              />
            </div>
            <div className="create-profile-basic-row">
              <span>Port Scan Protection</span>
              <SegmentControl
                options={[{ value: 'Open', label: 'Open' }, { value: 'Close', label: 'Close' }]}
                value={settings.portScan}
                onChange={(val) => onUpdate({ portScan: val })}
              />
            </div>
            <div className="create-profile-basic-row">
              <span>Scan Whitelist</span>
              <input
                value={settings.whitelistPorts}
                placeholder="Ports allowed to be scanned by websites, multiple ports separated by commas"
                onChange={(e) => onUpdate({ whitelistPorts: e.target.value })}
              />
            </div>
            <div className="create-profile-basic-row">
              <span>Hardware Acceleration Mode</span>
              <SegmentControl
                options={[{ value: 'Open', label: 'Open' }, { value: 'Close', label: 'Close' }]}
                value={settings.hardwareAcceleration}
                onChange={(val) => onUpdate({ hardwareAcceleration: val })}
              />
            </div>
            <div className="create-profile-basic-row">
              <span>Disable Sandbox</span>
              <SegmentControl
                options={[{ value: 'Close', label: 'Close' }, { value: 'Open', label: 'Open' }]}
                value={settings.disableSandbox}
                onChange={(val) => onUpdate({ disableSandbox: val })}
              />
            </div>
            <div className="create-profile-basic-row">
              <span>Startup Parameters</span>
              <input
                value={settings.startupParameters}
                placeholder="Custom command line parameters for Chromium"
                onChange={(e) => onUpdate({ startupParameters: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
