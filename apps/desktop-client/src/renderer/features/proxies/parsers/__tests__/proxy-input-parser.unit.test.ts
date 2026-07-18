import { describe, it, expect } from 'vitest';
import { parseProxyLine } from '../proxy-input-parser.js';

describe('proxy-input-parser', () => {
  // Parser coverage is local-only and never opens a network connection.
  it('should parse standard IPv4 host and port', () => {
    const res = parseProxyLine('1.2.3.4:8080');
    expect(res).not.toBeNull();
    expect(res?.host).toBe('1.2.3.4');
    expect(res?.port).toBe(8080);
    expect(res?.authMode).toBe('none');
  });

  it('should parse bracketed IPv6 host and port', () => {
    const res = parseProxyLine('[2001:db8::1]:1080');
    expect(res).not.toBeNull();
    expect(res?.host).toBe('[2001:db8::1]');
    expect(res?.port).toBe(1080);
    expect(res?.authMode).toBe('none');
  });

  it('should parse username and password containing special characters (percent-encoded)', () => {
    const res = parseProxyLine('user%40domain.com:p%40ss%3Aword@1.2.3.4:8080');
    expect(res).not.toBeNull();
    expect(res?.host).toBe('1.2.3.4');
    expect(res?.port).toBe(8080);
    expect(res?.authMode).toBe('username_password');
    expect(res?.username).toBe('user@domain.com');
    expect(res?.password).toBe('p@ss:word');
  });

  it('should parse password with special character colons in format host:port:user:pass', () => {
    const res = parseProxyLine('1.2.3.4:8080:user:pass:with:colons');
    expect(res).not.toBeNull();
    expect(res?.host).toBe('1.2.3.4');
    expect(res?.port).toBe(8080);
    expect(res?.username).toBe('user');
    expect(res?.password).toBe('pass:with:colons');
  });

  it('should parse bracketed IPv6 with credentials', () => {
    const res = parseProxyLine('[2001:db8::1]:1080:user:pass');
    expect(res).not.toBeNull();
    expect(res?.host).toBe('[2001:db8::1]');
    expect(res?.port).toBe(1080);
    expect(res?.username).toBe('user');
    expect(res?.password).toBe('pass');
  });

  it('should extract optional notes and refresh url', () => {
    const res = parseProxyLine('socks5://1.2.3.4:1080[http://refresh.url/rotate]{Vietnam Residential 01}');
    expect(res).not.toBeNull();
    expect(res?.protocol).toBe('socks5');
    expect(res?.host).toBe('1.2.3.4');
    expect(res?.port).toBe(1080);
    expect(res?.refreshUrl).toBe('http://refresh.url/rotate');
    expect(res?.notes).toBe('Vietnam Residential 01');
  });

  it('should reject invalid ports', () => {
    expect(parseProxyLine('1.2.3.4:0')).toBeNull();
    expect(parseProxyLine('1.2.3.4:65536')).toBeNull();
    expect(parseProxyLine('1.2.3.4:invalid')).toBeNull();
  });
});
