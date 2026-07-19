import windowsIcon from '../../assets/icons/os/windows.svg';
import macosIcon from '../../assets/icons/os/macos.svg';
import linuxIcon from '../../assets/icons/os/linux.svg';
import androidIcon from '../../assets/icons/os/android.svg';
import iosIcon from '../../assets/icons/os/ios.svg';
import chromiumIcon from '../../assets/icons/browser/chromium.svg';
import firefoxIcon from '../../assets/icons/browser/firefox.svg';
import windowsPreview from '../../assets/images/os-preview/windows-11.svg';
import macosPreview from '../../assets/images/os-preview/macos.svg';
import linuxPreview from '../../assets/images/os-preview/linux-ubuntu.svg';
import androidPreview from '../../assets/images/os-preview/android.svg';
import iosPreview from '../../assets/images/os-preview/ios.svg';

export type PreviewOs = 'windows' | 'mac' | 'linux' | 'android' | 'ios';
export type PreviewKernel = 'chrome' | 'firefox';

export const osAssets: Readonly<Record<PreviewOs, { readonly icon: string; readonly preview: string; readonly label: string }>> = {
  windows: { icon: windowsIcon, preview: windowsPreview, label: 'Windows 11' },
  mac: { icon: macosIcon, preview: macosPreview, label: 'macOS' },
  linux: { icon: linuxIcon, preview: linuxPreview, label: 'Ubuntu Linux' },
  android: { icon: androidIcon, preview: androidPreview, label: 'Android 16' },
  ios: { icon: iosIcon, preview: iosPreview, label: 'iOS 18' },
};

export const browserAssets: Readonly<Record<PreviewKernel, { readonly icon: string; readonly label: string }>> = {
  chrome: { icon: chromiumIcon, label: 'Chrome' },
  firefox: { icon: firefoxIcon, label: 'Firefox' },
};

export interface PreviewFormState {
  readonly system: PreviewOs;
  readonly kernel: PreviewKernel;
  readonly userAgent: string;
  readonly proxyLabel?: string | undefined;
}

export interface ProfilePreviewModel {
  readonly deviceImage: string;
  readonly osIcon: string;
  readonly browserIcon: string;
  readonly system: string;
  readonly kernel: string;
  readonly userAgent: string;
  readonly language: string;
  readonly timeZone: string;
}

/** The preview is deliberately derived from form values; it has no independent state. */
export function buildPreviewModel(form: PreviewFormState): ProfilePreviewModel {
  return {
    deviceImage: osAssets[form.system].preview,
    osIcon: osAssets[form.system].icon,
    browserIcon: browserAssets[form.kernel].icon,
    system: osAssets[form.system].label,
    kernel: browserAssets[form.kernel].label,
    userAgent: form.userAgent,
    language: form.proxyLabel ? 'Based on proxy' : 'Based on IP address',
    timeZone: form.proxyLabel ? 'Based on proxy' : 'Based on IP address',
  };
}
