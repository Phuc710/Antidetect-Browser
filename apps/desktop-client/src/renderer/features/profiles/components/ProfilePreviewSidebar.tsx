import { Copy, Shuffle } from 'lucide-react';
import { toastService } from '../../../services/toast-service.js';

interface PreviewModel {
  readonly osIcon: string;
  readonly browserIcon: string;
  readonly deviceImage: string;
  readonly system: string;
  readonly kernel: string;
  readonly userAgent: string;
  readonly language: string;
  readonly timeZone: string;
}

interface ProfilePreviewSidebarProps {
  readonly preview: PreviewModel;
  readonly locationPrompt: string;
  readonly resolutionMode: string;
  readonly fontMode: string;
  readonly webRTCMode: string;
  readonly webGLMode: string;
  readonly onRandomizeUA: () => void;
}

export function ProfilePreviewSidebar({
  preview,
  locationPrompt,
  resolutionMode,
  fontMode,
  webRTCMode,
  webGLMode,
  onRandomizeUA,
}: ProfilePreviewSidebarProps): JSX.Element {
  const handleCopyUA = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(preview.userAgent);
      toastService.success('User-Agent copied to clipboard.');
    } catch {
      toastService.error('Failed to copy User-Agent.');
    }
  };

  const rows = [
    ['System', preview.system],
    ['Kernel Type', preview.kernel],
    ['User Agent', preview.userAgent],
    ['Language', preview.language],
    ['Time Zone', preview.timeZone],
    ['Location Prompt', locationPrompt],
    ['Location', 'Based on IP address'],
    ['Resolution', resolutionMode],
    ['Font Fingerprint', fontMode],
    ['WebRTC', webRTCMode],
    ['WebGL Image', webGLMode],
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
  ] as const;

  return (
    <aside className="create-profile-preview">
      {/* Header */}
      <div className="create-profile-preview-header">
        <span>Preview</span>
        <button
          type="button"
          className="create-profile-preview-copy-btn"
          onClick={() => void handleCopyUA()}
          title="Copy User-Agent"
        >
          <Copy size={13} />
        </button>
      </div>

      {/* Visual representation */}
      <div className="create-profile-preview-visual">
        <div className="create-profile-preview-visual-chain">
          <span className="create-profile-preview-visual-tile">
            <img src={preview.osIcon} alt="" />
          </span>
          <span className="create-profile-preview-visual-connector" />
          <span className="create-profile-preview-visual-tile">
            <img src={preview.browserIcon} alt="" />
          </span>
          <span className="create-profile-preview-visual-connector" />
          <span className="create-profile-preview-visual-tile">+</span>
        </div>
        <img
          className="create-profile-preview-device"
          src={preview.deviceImage}
          alt={`${preview.system} preview`}
        />
      </div>

      {/* Attributes list */}
      <dl className="create-profile-preview-list">
        {rows.map(([label, value]) => (
          <div className="create-profile-preview-list-row" key={label}>
            <dt>{label}</dt>
            <dd className={label === 'User Agent' ? 'create-profile-preview-list-ua' : undefined}>
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {/* Shuffle button */}
      <button type="button" className="create-profile-preview-rand-btn" onClick={onRandomizeUA}>
        <Shuffle size={14} />
        <span>Generate random fingerprint</span>
      </button>
    </aside>
  );
}
