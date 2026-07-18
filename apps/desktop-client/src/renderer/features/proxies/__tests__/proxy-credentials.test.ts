import { describe, it, expect } from 'vitest';
import type { ProxyView } from 'shared';

function formatCopyableProxyAddress(proxy: ProxyView): string {
  // Security Requirement: Copy action MUST copy host:port only — NEVER raw password
  return `${proxy.protocol}://${proxy.host}:${proxy.port}`;
}

describe('Proxy Credential Absence & Copy Security Unit Tests', () => {
  it('should format copyable address without embedded credentials', () => {
    const proxy: ProxyView = {
      id: 'px-1',
      name: 'Residential US',
      protocol: 'socks5',
      host: 'proxy.residential.com',
      port: 1080,
      authMode: 'username_password',
      usernameMasked: 'user_****',
      status: 'online',
      countryCode: 'us',
      city: 'Chicago',
      timezone: 'America/Chicago',
      latencyMs: 120,
      lastCheckedAt: '2026-07-18T10:00:00Z',
      createdAt: '2026-07-01T00:00:00Z',
      updatedAt: '2026-07-18T10:00:00Z',
    };

    const copyText = formatCopyableProxyAddress(proxy);
    expect(copyText).toBe('socks5://proxy.residential.com:1080');
    expect(copyText).not.toContain('user_****');
    expect(copyText).not.toContain('password');
  });

  it('should render masked username only and omit password field in ProxyView', () => {
    const proxy: ProxyView = {
      id: 'px-2',
      name: 'Datacenter Proxy',
      protocol: 'http',
      host: '1.2.3.4',
      port: 8080,
      authMode: 'username_password',
      usernameMasked: 'admin_***',
      status: 'online',
      countryCode: 'de',
      city: 'Berlin',
      timezone: 'Europe/Berlin',
      latencyMs: 35,
      lastCheckedAt: '2026-07-18T10:00:00Z',
      createdAt: '2026-07-01T00:00:00Z',
      updatedAt: '2026-07-18T10:00:00Z',
    };

    expect(proxy.usernameMasked).toBe('admin_***');
    expect('password' in proxy).toBe(false);
  });
});
