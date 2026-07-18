import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CreateProfilePage } from '../CreateProfilePage.js';

vi.mock('react-router-dom', () => ({
  useNavigate: () => () => undefined,
}));

describe('CreateProfilePage', () => {
  it('renders a full page form without dialog semantics or fake fingerprint values', () => {
    const html = renderToStaticMarkup(<CreateProfilePage />);

    expect(html).toContain('Create Single');
    expect(html).toContain('Automatic fingerprint policy');
    expect(html).toContain('Generate Fingerprint');
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('User-Agent');
    expect(html).not.toContain('WebGL Vendor');
  });

  it('marks unsupported modes and persistence fields as disabled', () => {
    const html = renderToStaticMarkup(<CreateProfilePage />);

    expect(html).toContain('Batch Create');
    expect(html).toContain('Import Profile');
    expect(html).toContain('Save as template');
    expect(html.match(/disabled=""/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
  });
});
