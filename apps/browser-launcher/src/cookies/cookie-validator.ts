export interface ValidatedCookie {
  name: string;
  value: string;
  domain: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Lax' | 'Strict' | 'None';
  expires?: number;
}

export interface CookieValidationIssue {
  readonly name?: string;
  readonly path: string;
  readonly message: string;
}

export interface CookieValidationResult {
  readonly success: boolean;
  readonly cookies: ValidatedCookie[];
  readonly issues: CookieValidationIssue[];
}

export class CookieValidator {
  parse(rawJson: string | null | undefined): CookieValidationResult {
    const issues: CookieValidationIssue[] = [];
    const cookies: ValidatedCookie[] = [];

    if (!rawJson) {
      return { success: true, cookies, issues };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch (err: any) {
      issues.push({
        path: 'json',
        message: `Cookie JSON string is malformed: ${err.message || 'SyntaxError'}`,
      });
      return { success: false, cookies, issues };
    }

    if (!Array.isArray(parsed)) {
      issues.push({
        path: 'root',
        message: 'Cookie payload must be an array of cookie objects.',
      });
      return { success: false, cookies, issues };
    }

    parsed.forEach((item, index) => {
      if (!item || typeof item !== 'object') {
        issues.push({
          path: `[${index}]`,
          message: 'Cookie item must be an object.',
        });
        return;
      }

      const rawCookie = item as Record<string, unknown>;
      const {name} = rawCookie;
      const {value} = rawCookie;
      const {domain} = rawCookie;

      if (typeof name !== 'string' || !name) {
        issues.push({
          path: `[${index}].name`,
          message: 'Cookie name is required and must be a non-empty string.',
        });
      }

      if (typeof value !== 'string') {
        issues.push({
          path: `[${index}].value`,
          name: typeof name === 'string' ? name : undefined,
          message: 'Cookie value is required and must be a string.',
        });
      }

      if (typeof domain !== 'string' || !domain) {
        issues.push({
          path: `[${index}].domain`,
          name: typeof name === 'string' ? name : undefined,
          message: 'Cookie domain is required and must be a non-empty string.',
        });
      }

      if (issues.length > 0) {
        return;
      }

      // Safe cast properties
      const cookie: ValidatedCookie = {
        name: name as string,
        value: value as string,
        domain: domain as string,
      };

      const {path} = rawCookie;
      if (path !== undefined) {
        if (typeof path === 'string') cookie.path = path;
        else issues.push({ path: `[${index}].path`, name: cookie.name, message: 'path must be a string.' });
      }

      const {secure} = rawCookie;
      if (secure !== undefined) {
        if (typeof secure === 'boolean') cookie.secure = secure;
        else issues.push({ path: `[${index}].secure`, name: cookie.name, message: 'secure must be a boolean.' });
      }

      const {httpOnly} = rawCookie;
      if (httpOnly !== undefined) {
        if (typeof httpOnly === 'boolean') cookie.httpOnly = httpOnly;
        else issues.push({ path: `[${index}].httpOnly`, name: cookie.name, message: 'httpOnly must be a boolean.' });
      }

      const {sameSite} = rawCookie;
      if (sameSite !== undefined) {
        if (['Lax', 'Strict', 'None'].includes(sameSite as string)) {
          cookie.sameSite = sameSite as any;
        } else {
          issues.push({ path: `[${index}].sameSite`, name: cookie.name, message: 'sameSite must be Lax, Strict, or None.' });
        }
      }

      const {expires} = rawCookie;
      if (expires !== undefined) {
        if (typeof expires === 'number') cookie.expires = expires;
        else issues.push({ path: `[${index}].expires`, name: cookie.name, message: 'expires must be a number.' });
      }

      cookies.push(cookie);
    });

    return {
      success: issues.length === 0,
      cookies: issues.length === 0 ? cookies : [],
      issues,
    };
  }
}
