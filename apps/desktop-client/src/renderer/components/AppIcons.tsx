/**
 * AppIcons — Centralized, 100% offline icon components & helpers
 * No CDN requests, no runtime API fetching.
 *
 * Components provided:
 *  - <FlagIcon code="us" size={16} />
 *  - <OSIcon name="windows" size={16} />
 *  - <BrowserIcon name="chrome" size={16} />
 *  - <BrandIcon name="facebook" size={16} />
 *  - <ProxyIcon type="socks5" size={14} />
 *  - <DeviceIcon type="desktop" size={16} />
 */
import { Icon } from '@iconify/react';
import { CountryFlag } from './CountryFlag/CountryFlag.js';
import { osAssets, browserAssets, type PreviewOs, type PreviewKernel } from '../pages/profiles/profile-assets.js';

// --- Local Eager Load for Devices ---
const deviceAssets = import.meta.glob<string>('../assets/devices/*.svg', {
  eager: true,
  import: 'default',
});

// --- Brand Icon mapping via Iconify registered local set ---
const BRAND_ICON_MAP: Record<string, { icon: string; color?: string }> = {
  facebook: { icon: 'logos:facebook' },
  amazon: { icon: 'simple-icons:amazon', color: '#FF9900' },
  linkedin: { icon: 'logos:linkedin-icon' },
  x: { icon: 'simple-icons:x', color: '#000000' },
  twitter: { icon: 'simple-icons:x', color: '#000000' },
  paypal: { icon: 'logos:paypal' },
  gmail: { icon: 'logos:google-gmail' },
  google: { icon: 'logos:google-gmail' },
  outlook: { icon: 'logos:microsoft-icon' },
  microsoft: { icon: 'logos:microsoft-icon' },
  vinted: { icon: 'simple-icons:vinted', color: '#09B1BA' },
};

export interface BrandIconProps {
  name: string;
  size?: number;
  className?: string;
}

export function BrandIcon({ name, size = 16, className }: BrandIconProps): JSX.Element | null {
  const brandKey = name.trim().toLowerCase();
  const brand = BRAND_ICON_MAP[brandKey];
  if (!brand) return null;

  return (
    <span className={`app-brand-icon ${className ?? ''}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
      <Icon
        icon={brand.icon}
        width={size}
        height={size}
        {...(brand.color ? { color: brand.color } : {})}
      />
    </span>
  );
}

// --- Flag Icon Component (Re-exports CountryFlag with unified API) ---
export interface FlagIconProps {
  code: string;
  size?: 16 | 20 | 24 | 32 | 40 | 48;
  name?: string;
  className?: string;
}

export function FlagIcon({ code, size = 16, name, className }: FlagIconProps): JSX.Element | null {
  return <CountryFlag code={code} size={size} name={name ?? code} className={className} />;
}

// --- OS Icon Component ---
export interface OSIconProps {
  name: PreviewOs | 'win' | string;
  size?: number;
  className?: string;
}

export function OSIcon({ name, size = 16, className }: OSIconProps): JSX.Element | null {
  const raw = name.trim().toLowerCase();
  const osKey: PreviewOs = raw === 'win' || raw === 'windows' ? 'windows' : raw === 'mac' || raw === 'macos' ? 'mac' : raw === 'linux' ? 'linux' : raw === 'android' ? 'android' : raw === 'ios' ? 'ios' : 'windows';
  const asset = osAssets[osKey];
  if (!asset) return null;

  return (
    <img
      src={asset.icon}
      alt={asset.label}
      width={size}
      height={size}
      draggable={false}
      className={`app-os-icon ${className ?? ''}`}
      style={{ display: 'block', flexShrink: 0 }}
    />
  );
}

// --- Browser Icon Component ---
export interface BrowserIconProps {
  name: PreviewKernel | string;
  size?: number;
  className?: string;
}

export function BrowserIcon({ name, size = 16, className }: BrowserIconProps): JSX.Element | null {
  const raw = name.trim().toLowerCase();
  const kernelKey: PreviewKernel = raw.includes('firefox') ? 'firefox' : 'chrome';
  const asset = browserAssets[kernelKey];
  if (!asset) return null;

  return (
    <img
      src={asset.icon}
      alt={asset.label}
      width={size}
      height={size}
      draggable={false}
      className={`app-browser-icon ${className ?? ''}`}
      style={{ display: 'block', flexShrink: 0 }}
    />
  );
}

// --- Proxy Icon Component ---
export interface ProxyIconProps {
  type: 'http' | 'https' | 'socks4' | 'socks5' | string;
  size?: number;
  className?: string;
}

export function ProxyIcon({ type, size = 14, className }: ProxyIconProps): JSX.Element {
  const label = type.toUpperCase();
  const isSocks = label.startsWith('SOCKS');

  return (
    <span
      className={`app-proxy-badge ${className ?? ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1px 5px',
        fontSize: Math.max(9, size - 4),
        fontWeight: 600,
        borderRadius: 3,
        backgroundColor: isSocks ? 'rgba(54, 127, 245, 0.12)' : 'rgba(49, 196, 141, 0.12)',
        color: isSocks ? '#367ff5' : '#31c48d',
        border: `1px solid ${isSocks ? 'rgba(54, 127, 245, 0.25)' : 'rgba(49, 196, 141, 0.25)'}`,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
    >
      {label}
    </span>
  );
}

// --- Device Icon Component ---
export interface DeviceIconProps {
  type: 'desktop' | 'laptop' | 'mobile' | 'tablet' | string;
  size?: number;
  className?: string;
}

export function DeviceIcon({ type, size = 16, className }: DeviceIconProps): JSX.Element | null {
  const key = type.trim().toLowerCase();
  const path = `../assets/devices/${key}.svg`;
  const src = deviceAssets[path];
  if (!src) return null;

  return (
    <img
      src={src}
      alt={key}
      width={size}
      height={size}
      draggable={false}
      className={`app-device-icon ${className ?? ''}`}
      style={{ display: 'block', flexShrink: 0 }}
    />
  );
}

// --- Helper Functions ---
export function getFlag(code: string): JSX.Element | null {
  return <FlagIcon code={code} />;
}

export function getBrandIcon(name: string): JSX.Element | null {
  return <BrandIcon name={name} />;
}

export function getOSIcon(name: string): JSX.Element | null {
  return <OSIcon name={name} />;
}

export function getBrowserIcon(name: string): JSX.Element | null {
  return <BrowserIcon name={name} />;
}

export function getProxyIcon(type: string): JSX.Element | null {
  return <ProxyIcon type={type} />;
}

export function getDeviceIcon(type: string): JSX.Element | null {
  return <DeviceIcon type={type} />;
}
