export interface ParsedCookie {
  domain: string;
  name: string;
  value: string;
  path: string;
  expirationDate?: number | undefined;
  secure?: boolean | undefined;
  httpOnly?: boolean | undefined;
  status: 'valid' | 'invalid' | 'missing_domain';
  error?: string | undefined;
}

export function parseCookies(rawText: string, defaultDomain?: string): ParsedCookie[] {
  const text = rawText.trim();
  if (!text) return [];

  // Try parsing as JSON first
  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map((item, idx) => {
          const name = String(item.name || item.key || '');
          const value = String(item.value || '');
          const domain = String(item.domain || item.host || defaultDomain || '').trim();
          const path = String(item.path || '/');

          let expirationDate: number | undefined;
          if (item.expirationDate !== undefined) {
            expirationDate = Number(item.expirationDate);
          } else if (item.expires !== undefined) {
            expirationDate = typeof item.expires === 'number' ? item.expires : Math.floor(new Date(item.expires).getTime() / 1000);
          }

          const hasDomain = Boolean(domain);

          const cookie: ParsedCookie = {
            domain,
            name,
            value,
            path,
            status: name && value ? (hasDomain ? 'valid' : 'missing_domain') : 'invalid',
          };

          if (expirationDate !== undefined) cookie.expirationDate = expirationDate;
          if (item.secure !== undefined) cookie.secure = Boolean(item.secure);
          if (item.httpOnly !== undefined) cookie.httpOnly = Boolean(item.httpOnly);
          if (!(name && value)) cookie.error = `Dữ liệu cookie ở dòng ${idx + 1} thiếu key/value`;

          return cookie;
        });
      }
    } catch {
      // If it looks like JSON but fails to parse, we can report an invalid JSON item or fall through
    }
  }

  // Check if it's Netscape Cookie format
  const lines = text.split(/\r?\n/);
  const isNetscape = lines.some(line => line.startsWith('# Netscape') || line.includes('\t'));

  if (isNetscape) {
    return lines
      .map((line, idx) => {
        const cleanLine = line.trim();
        if (!cleanLine || cleanLine.startsWith('#')) return null;

        const parts = cleanLine.split('\t');
        if (parts.length < 7) {
          // Some Netscape formats might have 6 fields
          if (parts.length >= 6) {
            const domain = parts[0]?.trim() || '';
            const flag = parts[1]?.trim() || '';
            const path = parts[2]?.trim() || '/';
            const secure = parts[3]?.trim() || '';
            const expiration = parts[4]?.trim() || '';
            const name = parts[5]?.trim() || '';
            const value = parts[6]?.trim() || '';
            const isSecure = flag === 'TRUE' || secure === 'TRUE';

            const cookie: ParsedCookie = {
              domain,
              name,
              value,
              path,
              status: domain ? 'valid' : 'missing_domain',
            };

            const expNum = Number(expiration);
            if (!isNaN(expNum)) cookie.expirationDate = expNum;
            cookie.secure = isSecure;
            return cookie;
          }
          return {
            domain: '',
            name: '',
            value: '',
            path: '/',
            status: 'invalid',
            error: `Dòng ${idx + 1} không đúng định dạng Netscape (phải phân tách bằng ký tự Tab)`,
          } as ParsedCookie;
        }

        const domain = parts[0]?.trim() || '';
        const path = parts[2]?.trim() || '/';
        const secure = parts[3]?.trim() || '';
        const expiration = parts[4]?.trim() || '';
        const name = parts[5]?.trim() || '';
        const value = parts[6]?.trim() || '';
        const hasDomain = Boolean(domain);

        const cookie: ParsedCookie = {
          domain,
          name,
          value,
          path,
          status: name && value ? (hasDomain ? 'valid' : 'missing_domain') : 'invalid',
        };

        const expNum = Number(expiration);
        if (!isNaN(expNum)) cookie.expirationDate = expNum;
        cookie.secure = secure === 'TRUE';
        return cookie;
      })
      .filter((item): item is ParsedCookie => item !== null);
  }

  // Fallback to Name=Value pairs (e.g. key1=val1; key2=val2)
  const pairs = text.split(';');
  return pairs
    .map((pair, idx) => {
      const trimmed = pair.trim();
      if (!trimmed) return null;

      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) {
        return {
          domain: defaultDomain || '',
          name: trimmed,
          value: '',
          path: '/',
          status: 'invalid',
          error: `Cặp cookie thứ ${idx + 1} thiếu ký tự '='`,
        } as ParsedCookie;
      }

      const name = trimmed.substring(0, eqIdx).trim();
      const value = trimmed.substring(eqIdx + 1).trim();

      if (!name) {
        return {
          domain: defaultDomain || '',
          name: '',
          value,
          path: '/',
          status: 'invalid',
          error: `Cặp cookie thứ ${idx + 1} có tên rỗng`,
        } as ParsedCookie;
      }

      const hasDomain = Boolean(defaultDomain);

      return {
        domain: defaultDomain || '',
        name,
        value,
        path: '/',
        status: hasDomain ? 'valid' : 'missing_domain',
      } as ParsedCookie;
    })
    .filter((item): item is ParsedCookie => item !== null);
}
