import type { ProfileView } from '../../../../shared/profile-contracts.js';
import type { CreateProfileDraft } from '../../../pages/profiles/create-profile-model.js';
import type { PreviewOs, PreviewKernel } from '../../../pages/profiles/profile-assets.js';

export type CreateProfileOs = 'windows' | 'mac' | 'linux';

export interface FingerprintSettings {
  readonly locationPrompt: 'Allow' | 'Inquiry' | 'Prohibit';
  readonly resolutionMode: 'Follow System' | 'Custom';
  readonly fontMode: 'Follow System' | 'Custom';
  readonly webRTCMode: 'Prohibit' | 'Open';
  readonly webGLMode: 'Random' | 'Close';
}

export interface ProfileFormState {
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

export const SYSTEM_OPTIONS: readonly PreviewOs[] = ['windows', 'mac', 'linux', 'android', 'ios'];

export const OS_VERSIONS: Readonly<Record<PreviewOs, readonly string[]>> = {
  windows: ['Windows 11', 'Windows 10'],
  mac: ['macOS Sequoia', 'macOS Sonoma', 'macOS Ventura'],
  linux: ['Ubuntu 24.04', 'Ubuntu 22.04', 'Linux x86_64'],
  android: ['Android 16', 'Android 15', 'Android 14'],
  ios: ['iOS 18', 'iOS 17'],
};

export const KERNEL_VERSIONS: Readonly<Record<PreviewKernel, readonly string[]>> = {
  chrome: ['Keep Latest', 'RoxyChrome 150', 'RoxyChrome 149', 'RoxyChrome 148', 'RoxyChrome 147', 'RoxyChrome 146'],
  firefox: ['Keep Latest', 'RoxyFirefox 141', 'RoxyFirefox 140', 'RoxyFirefox 139', 'RoxyFirefox 138'],
};

export const DEFAULT_FINGERPRINT: FingerprintSettings = {
  locationPrompt: 'Allow',
  resolutionMode: 'Follow System',
  fontMode: 'Follow System',
  webRTCMode: 'Prohibit',
  webGLMode: 'Random',
};

export const DEFAULT_FORM_STATE: ProfileFormState = {
  name: '',
  system: 'windows',
  systemVersion: 'Windows 11',
  kernel: 'chrome',
  kernelVersion: 'RoxyChrome 150',
  userAgent: '', // initialized dynamically in container
  cookies: '',
  proxyId: '',
  projectId: '',
  tagsText: '',
  notes: '',
  startupUrlsText: '',
  fingerprint: DEFAULT_FINGERPRINT,
};

export function versionNumber(version: string): string {
  const match = version.match(/(\d+)/);
  return match?.[1] ?? '150';
}

export function buildUserAgent(os: PreviewOs, kernel: PreviewKernel, version: string): string {
  const major = versionNumber(version);
  
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

export function mapStoredOsToPreview(os: CreateProfileOs): PreviewOs {
  return os === 'mac' ? 'mac' : os;
}

export function mapPreviewOsToStored(os: PreviewOs): CreateProfileOs {
  if (os === 'android' || os === 'ios') return 'linux';
  return os;
}

export function formToDraft(form: ProfileFormState): CreateProfileDraft {
  return {
    name: form.name,
    os: mapPreviewOsToStored(form.system),
    notes: form.notes,
    proxyId: form.proxyId,
    projectId: form.projectId,
    tagsText: form.tagsText,
    startupUrlsText: form.startupUrlsText,
    fingerprintPolicy: 'automatic',
  };
}

export function stateFromProfile(profile: ProfileView): ProfileFormState {
  const system = mapStoredOsToPreview(profile.os as CreateProfileOs);
  const kernel: PreviewKernel = profile.engine === 'firefox' ? 'firefox' : 'chrome';
  const kernelVersion = kernel === 'firefox' ? 'RoxyFirefox 141' : 'RoxyChrome 150';
  return {
    ...DEFAULT_FORM_STATE,
    name: profile.name,
    system,
    systemVersion: OS_VERSIONS[system][0] ?? DEFAULT_FORM_STATE.systemVersion,
    kernel,
    kernelVersion,
    userAgent: buildUserAgent(system, kernel, kernelVersion),
    proxyId: profile.proxyId ?? '',
    projectId: profile.projectId ?? '',
    tagsText: (profile.tags ?? []).filter((t) => t !== 'faved' && t !== 'trash').join(','),
    notes: profile.notes ?? '',
    startupUrlsText: '', // Filled from detailed profile if stored
  };
}
