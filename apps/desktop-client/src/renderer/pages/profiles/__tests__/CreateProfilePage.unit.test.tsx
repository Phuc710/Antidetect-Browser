import { vi } from 'vitest';

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<any>('@tanstack/react-query');
  return {
    ...actual,
    useQuery: (_options: any) => {
      return {
        data: [],
        isLoading: false,
        isError: false,
        status: 'success',
      };
    },
    useMutation: () => ({
      mutateAsync: async () => {},
      isPending: false,
    }),
  };
});

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateProfilePage } from '../CreateProfilePage.js';

vi.mock('react-router-dom', () => ({
  useNavigate: () => () => undefined,
  useParams: () => ({}),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

describe('CreateProfilePage', () => {
  it('renders the Roxy-style full page profile editor and disables unsupported modes', () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <CreateProfilePage />
      </QueryClientProvider>
    );

    // 1. Verify general rendering
    expect(html).toContain('Create Profile');
    expect(html).toContain('Profile Info');
    expect(html).toContain('System');
    expect(html).toContain('Kernel');
    expect(html).toContain('User-Agent');
    expect(html).toContain('Preview');
    expect(html).toContain('Generate random fingerprint');
    expect(html).not.toContain('role="dialog"');

    // 2. Verify unsupported features are disabled
    expect(html).toContain('Batch Create');
    expect(html).toContain('Import Profile');
    expect(html).toContain('Save as template');
    expect(html.match(/disabled=""/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});
