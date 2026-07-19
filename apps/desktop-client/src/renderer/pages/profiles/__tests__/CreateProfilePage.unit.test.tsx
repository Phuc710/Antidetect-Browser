import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CreateProfilePage } from '../CreateProfilePage.js';

vi.mock('react-router-dom', () => ({
  useNavigate: () => () => undefined,
  useParams: () => ({}),
}));

describe('CreateProfilePage', () => {
  it('renders the Roxy-style full page profile editor', () => {
    const html = renderToStaticMarkup(<CreateProfilePage />);

    expect(html).toContain('Create Profile');
    expect(html).toContain('Profile Info');
    expect(html).toContain('System');
    expect(html).toContain('Kernel');
    expect(html).toContain('User-Agent');
    expect(html).toContain('Preview');
    expect(html).toContain('Generate random fingerprint');
    expect(html).not.toContain('role="dialog"');
  });

  it('marks unsupported modes and persistence fields as disabled', () => {
    const html = renderToStaticMarkup(<CreateProfilePage />);

    expect(html).toContain('Batch Create');
    expect(html).toContain('Import Profile');
    expect(html).toContain('Save as template');
    expect(html.match(/disabled=""/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});
