import { describe, it, expect } from 'vitest';
import { parseCookies } from '../cookie-parser.js';

describe('parseCookies Utility', () => {
  it('should parse valid JSON cookie array', () => {
    const jsonText = JSON.stringify([
      { name: 'session_id', value: '123xyz', domain: '.facebook.com', path: '/' },
      { name: 'auth_token', value: 'abcdef', domain: 'google.com', path: '/mail', expirationDate: 1800000000 },
    ]);

    const result = parseCookies(jsonText);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      domain: '.facebook.com',
      name: 'session_id',
      value: '123xyz',
      path: '/',
      status: 'valid',
    });
    expect(result[1]).toEqual({
      domain: 'google.com',
      name: 'auth_token',
      value: 'abcdef',
      path: '/mail',
      expirationDate: 1800000000,
      status: 'valid',
    });
  });

  it('should parse Netscape cookie file format', () => {
    const netscapeText = `
# Netscape HTTP Cookie File
# http://curl.haxx.se/rfc/cookie_spec.html
# This is a generated file! Do not edit.

.facebook.com\tTRUE\t/\tFALSE\t1780000000\tc_user\t1000098765
google.com\tFALSE\t/search\tTRUE\t1790000000\tSID\tabc123
`;

    const result = parseCookies(netscapeText);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      domain: '.facebook.com',
      name: 'c_user',
      value: '1000098765',
      path: '/',
      expirationDate: 1780000000,
      secure: false,
      status: 'valid',
    });
    expect(result[1]).toEqual({
      domain: 'google.com',
      name: 'SID',
      value: 'abc123',
      path: '/search',
      expirationDate: 1790000000,
      secure: true,
      status: 'valid',
    });
  });

  it('should parse Name=Value pairs and bind custom domain if provided', () => {
    const keyValueText = 'session=xyz; other=abc';
    const result = parseCookies(keyValueText, '.my-domain.com');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      domain: '.my-domain.com',
      name: 'session',
      value: 'xyz',
      path: '/',
      status: 'valid',
    });
    expect(result[1]).toEqual({
      domain: '.my-domain.com',
      name: 'other',
      value: 'abc',
      path: '/',
      status: 'valid',
    });
  });

  it('should mark Name=Value cookies missing domain if defaultDomain is omitted', () => {
    const keyValueText = 'session=xyz';
    const result = parseCookies(keyValueText);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      domain: '',
      name: 'session',
      value: 'xyz',
      path: '/',
      status: 'missing_domain',
    });
  });

  it('should flag invalid formats and return empty for empty inputs', () => {
    expect(parseCookies('')).toHaveLength(0);
    expect(parseCookies('   \n  ')).toHaveLength(0);

    const result = parseCookies('invalid_cookie_string_without_equals');
    expect(result).toHaveLength(1);
    expect(result[0]!.status).toBe('invalid');
    expect(result[0]!.error).toBeDefined();
  });
});
