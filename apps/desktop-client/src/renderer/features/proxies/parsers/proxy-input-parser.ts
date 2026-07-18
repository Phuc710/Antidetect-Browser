import type { ProxyProtocol, ProxyAuthMode } from 'shared';
import type { ParsedProxyItem } from '../proxy-batch-model.js';

export function parseProxyLine(
  line: string,
  defaultProto: ProxyProtocol = 'http'
): ParsedProxyItem | null {
  let text = line.trim();
  if (!text) return null;

  // Extract Notes: {notes} at the end
  let notes: string | undefined;
  const notesMatch = text.match(/\{([^}]+)\}$/);
  if (notesMatch) {
    notes = notesMatch[1];
    text = text.substring(0, text.length - notesMatch[0].length).trim();
  }

  // Extract Refresh URL: [refreshUrl] at the end
  let refreshUrl: string | undefined;
  const refreshMatch = text.match(/\[([^\]]+)\]$/);
  if (refreshMatch) {
    refreshUrl = refreshMatch[1];
    text = text.substring(0, text.length - refreshMatch[0].length).trim();
  }

  // Check and extract protocol scheme
  let protocol = defaultProto;
  const schemeMatch = text.match(/^([a-zA-Z0-9]+):\/\//);
  if (schemeMatch) {
    const scheme = schemeMatch[1]?.toLowerCase();
    if (scheme === 'http' || scheme === 'https' || scheme === 'socks5') {
      protocol = scheme as ProxyProtocol;
    }
    text = text.substring(schemeMatch[0].length);
  }

  let host = '';
  let port = 0;
  let username: string | undefined;
  let password: string | undefined;
  let authMode: ProxyAuthMode = 'none';

  // Format 1: user:pass@host:port or user:pass@[ipv6]:port
  const atIndex = text.lastIndexOf('@');
  if (atIndex !== -1) {
    const authPart = text.substring(0, atIndex);
    const connPart = text.substring(atIndex + 1);

    const colonIndex = authPart.indexOf(':');
    if (colonIndex !== -1) {
      username = safeDecodeURIComponent(authPart.substring(0, colonIndex));
      password = safeDecodeURIComponent(authPart.substring(colonIndex + 1));
      authMode = 'username_password';
    } else {
      username = safeDecodeURIComponent(authPart);
      authMode = 'username_password';
    }

    const parsedConn = parseHostPort(connPart);
    if (!parsedConn) return null;
    host = parsedConn.host;
    port = parsedConn.port;
  } else {
    // Format 2: host:port:user:pass or [ipv6]:port:user:pass
    if (text.startsWith('[')) {
      const closingBracket = text.indexOf(']');
      if (closingBracket !== -1) {
        host = text.substring(0, closingBracket + 1);
        const remaining = text.substring(closingBracket + 1);
        const parts = remaining.split(':');
        // parts[0] is empty because colon follows ']' immediately
        if (parts.length >= 4) {
          port = parseInt(parts[1] ?? '0', 10);
          username = safeDecodeURIComponent(parts[2] ?? '');
          password = safeDecodeURIComponent(parts.slice(3).join(':'));
          authMode = 'username_password';
        } else if (parts.length >= 2) {
          port = parseInt(parts[1] ?? '0', 10);
          authMode = 'none';
        } else {
          return null;
        }
      } else {
        return null;
      }
    } else {
      // Format 3: host:port or host:port:user:pass
      const parts = text.split(':');
      if (parts.length >= 4) {
        host = parts[0] ?? '';
        port = parseInt(parts[1] ?? '0', 10);
        username = safeDecodeURIComponent(parts[2] ?? '');
        password = safeDecodeURIComponent(parts.slice(3).join(':'));
        authMode = 'username_password';
      } else if (parts.length >= 2) {
        host = parts[0] ?? '';
        port = parseInt(parts[1] ?? '0', 10);
        authMode = 'none';
      } else {
        return null;
      }
    }
  }

  if (!host || isNaN(port) || port <= 0 || port > 65535) {
    return null;
  }

  return {
    id: Math.random().toString(36).substring(7),
    protocol,
    host,
    port,
    authMode,
    username: username || undefined,
    password: password || undefined,
    refreshUrl: refreshUrl || undefined,
    notes: notes || undefined,
    status: 'unchecked',
  };
}

function parseHostPort(text: string): { host: string; port: number } | null {
  if (text.startsWith('[')) {
    const closing = text.indexOf(']');
    if (closing === -1) return null;
    const host = text.substring(0, closing + 1);
    const portStr = text.substring(closing + 2); // skip ']' and ':'
    const port = parseInt(portStr, 10);
    return { host, port };
  } else {
    const colon = text.lastIndexOf(':');
    if (colon === -1) return null;
    const host = text.substring(0, colon);
    const port = parseInt(text.substring(colon + 1), 10);
    return { host, port };
  }
}

function safeDecodeURIComponent(val: string): string {
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
}
