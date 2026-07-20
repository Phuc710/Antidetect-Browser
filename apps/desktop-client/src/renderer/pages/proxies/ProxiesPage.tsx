import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Plus, RefreshCw, Search, X } from 'lucide-react';
import type { ProxyTestResult, ProxyView } from 'shared';
import { proxyIpc } from '../../features/proxies/api/proxy-ipc.js';
import { ProxyFormDialog } from '../../features/proxies/components/ProxyFormDialog.js';
import { ProxyTable } from '../../features/proxies/components/ProxyTable.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import './ProxiesPage.css';

type PageState = 'loading' | 'success' | 'empty' | 'error';
const ITEMS_PER_PAGE = 30;

export function ProxiesPage(): JSX.Element {
  const [proxies, setProxies] = useState<ProxyView[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [pageState, setPageState] = useState<PageState>('loading');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProxyView | undefined>();
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  const load = useCallback(async (searchTerm: string, currentPage: number): Promise<void> => {
    setPageState('loading');
    try {
      const result = await proxyIpc.list({
        ...(searchTerm ? { search: searchTerm } : {}),
        limit: ITEMS_PER_PAGE,
        offset: (currentPage - 1) * ITEMS_PER_PAGE,
      });
      setProxies(result.items);
      setTotal(result.total);
      setPageState(result.total === 0 ? 'empty' : 'success');
    } catch {
      setPageState('error');
    }
  }, []);

  useEffect(() => { void load(search, page); }, [load, search, page]);

  function handleTestComplete(proxyId: string, result: ProxyTestResult): void {
    setProxies((current) => current.map((proxy) => proxy.id === proxyId ? {
      ...proxy,
      status: result.status,
      ...(result.countryCode ? { countryCode: result.countryCode } : {}),
      ...(result.city ? { city: result.city } : {}),
      ...(result.timezone ? { timezone: result.timezone } : {}),
      ...(result.latencyMs !== undefined ? { latencyMs: result.latencyMs } : {}),
      lastCheckedAt: result.checkedAt,
    } : proxy));
  }

  return (
    <div className="proxies-page">
      <header className="proxies-toolbar">
        <div className="proxies-toolbar__left">
          <h1 className="proxies-toolbar__title">Proxy Manager</h1>
          {pageState === 'success' && <span className="proxies-toolbar__count" aria-live="polite">({total})</span>}
        </div>
        <div className="proxies-toolbar__right">
          <div className="proxies-toolbar__search-wrap">
            <Search className="proxies-toolbar__search-icon" size={14} />
            <input type="search" placeholder="Search name or host…" className="proxies-toolbar__search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} aria-label="Search proxies" />
            {search && <button type="button" className="proxies-toolbar__clear" onClick={() => { setSearch(''); setPage(1); }} aria-label="Clear search"><X size={13} /></button>}
          </div>
          <button type="button" className="button button--secondary" onClick={() => void load(search, page)} aria-label="Refresh proxies"><RefreshCw size={15} /></button>
          <button type="button" className="button button--primary" onClick={() => { setEditTarget(undefined); setDialogOpen(true); }}><Plus size={15} /> Add Proxy</button>
        </div>
      </header>

      <main className="proxies-content">
        {(pageState === 'loading' || pageState === 'success') && (
          <ProxyTable
            proxies={pageState === 'loading' ? [] : proxies}
            total={pageState === 'loading' ? 0 : total}
            loading={pageState === 'loading'}
            page={pageState === 'loading' ? 1 : page}
            totalPages={pageState === 'loading' ? 1 : totalPages}
            onPageChange={setPage}
            onEdit={(proxy) => { setEditTarget(proxy); setDialogOpen(true); }}
            onDeleted={(proxyId) => { setProxies((current) => current.filter((item) => item.id !== proxyId)); setTotal((current) => Math.max(0, current - 1)); }}
            onTestComplete={handleTestComplete}
          />
        )}
        {pageState === 'empty' && (
          <EmptyState
            icon="Globe"
            title="No saved proxies"
            description="Add an HTTP, HTTPS, or SOCKS5 proxy. Passwords are stored in the operating-system credential vault."
            action={
              <button type="button" className="button button--primary" onClick={() => setDialogOpen(true)}>
                <Plus size={15} /> Add first proxy
              </button>
            }
          />
        )}
        {pageState === 'error' && (
          <div className="proxies-state-card proxies-state-card--error" role="alert">
            <div className="proxies-state-card__icon-wrap"><AlertTriangle size={48} className="proxies-state-card__icon" /></div>
            <h2 className="proxies-state-card__title">Could not load proxies</h2>
            <p className="proxies-state-card__desc">Desktop Main did not return proxy data. No mock fallback is used.</p>
            <button type="button" className="button button--secondary" onClick={() => void load(search, page)}>Try again</button>
          </div>
        )}
      </main>

      <ProxyFormDialog open={dialogOpen} editTarget={editTarget} onClose={() => { setDialogOpen(false); setEditTarget(undefined); }} onSaved={() => { setDialogOpen(false); setEditTarget(undefined); void load(search, page); }} />
    </div>
  );
}
