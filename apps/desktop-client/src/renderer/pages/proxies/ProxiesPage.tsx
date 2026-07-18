import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, RefreshCw, Globe, AlertTriangle, WifiOff, X } from 'lucide-react';
import type { ProxyView, ProxyTestResult } from 'shared';
import { proxyIpc } from '../../features/proxies/api/proxy-ipc.js';
import { ProxyTable } from '../../features/proxies/components/ProxyTable.js';
import { ProxyFormDialog } from '../../features/proxies/components/ProxyFormDialog.js';
import './ProxiesPage.css';

type PageState = 'loading' | 'success' | 'empty' | 'error' | 'offline';

const ITEMS_PER_PAGE = 30;

export function ProxiesPage(): JSX.Element {
  const [proxies, setProxies] = useState<ProxyView[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [pageState, setPageState] = useState<PageState>('loading');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProxyView | undefined>(undefined);

  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  const load = useCallback(async (searchTerm: string, currentPage: number) => {
    setPageState('loading');
    try {
      const result = await proxyIpc.list({
        search: searchTerm || undefined,
        limit: ITEMS_PER_PAGE,
        offset: (currentPage - 1) * ITEMS_PER_PAGE,
      });
      setProxies(result.items);
      setTotal(result.total);
      setPageState(result.total === 0 ? 'empty' : 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      if (message.toLowerCase().includes('network') || message.includes('fetch')) {
        setPageState('offline');
      } else {
        setPageState('error');
      }
    }
  }, []);

  useEffect(() => {
    void load(search, page);
  }, [load, search, page]);

  function handleSaved(_proxy: ProxyView) {
    setDialogOpen(false);
    setEditTarget(undefined);
    // Refresh danh sách
    void load(search, page);
  }

  function handleDeleted(proxyId: string) {
    setProxies((prev) => prev.filter((p) => p.id !== proxyId));
    setTotal((prev) => Math.max(0, prev - 1));
  }

  function handleTestComplete(proxyId: string, result: ProxyTestResult) {
    // Cập nhật status và location trong local list không cần refetch
    setProxies((prev) => prev.map((p) =>
      p.id === proxyId
        ? {
            ...p,
            status: result.status === 'online' ? 'online' : result.status as ProxyView['status'],
            countryCode: result.countryCode ?? p.countryCode,
            city: result.city ?? p.city,
            timezone: result.timezone ?? p.timezone,
            latencyMs: result.latencyMs ?? p.latencyMs,
            lastCheckedAt: result.checkedAt,
          }
        : p
    ));
  }

  function openCreate() {
    setEditTarget(undefined);
    setDialogOpen(true);
  }

  function openEdit(proxy: ProxyView) {
    setEditTarget(proxy);
    setDialogOpen(true);
  }

  return (
    <div className="proxies-page">
      {/* Toolbar */}
      <header className="proxies-toolbar">
        <div className="proxies-toolbar__left">
          <h1 className="proxies-toolbar__title">Proxy Manager</h1>
          {pageState === 'success' && (
            <span className="proxies-toolbar__count" aria-live="polite">({total})</span>
          )}
        </div>

        <div className="proxies-toolbar__right">
          <div className="proxies-toolbar__search-wrap">
            <Search className="proxies-toolbar__search-icon" size={14} aria-hidden="true" />
            <input
              type="search"
              placeholder="Tìm tên, IP..."
              className="proxies-toolbar__search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              aria-label="Tìm kiếm proxy"
            />
            {search && (
              <button className="proxies-toolbar__clear" onClick={() => { setSearch(''); setPage(1); }} aria-label="Xóa tìm kiếm">
                <X size={13} />
              </button>
            )}
          </div>

          <button
            className="button button--secondary"
            onClick={() => void load(search, page)}
            aria-label="Làm mới"
          >
            <RefreshCw size={15} />
          </button>

          <button className="button button--primary" onClick={openCreate}>
            <Plus size={15} />
            <span>Thêm Proxy</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="proxies-content">
        {pageState === 'loading' && (
          <ProxyTable
            proxies={[]}
            total={0}
            loading={true}
            page={1}
            totalPages={1}
            onPageChange={() => {}}
            onEdit={openEdit}
            onDeleted={handleDeleted}
            onTestComplete={handleTestComplete}
          />
        )}

        {pageState === 'success' && (
          <ProxyTable
            proxies={proxies}
            total={total}
            loading={false}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            onEdit={openEdit}
            onDeleted={handleDeleted}
            onTestComplete={handleTestComplete}
          />
        )}

        {pageState === 'empty' && (
          <div className="proxies-state-card" role="status">
            <div className="proxies-state-card__icon-wrap">
              <Globe size={48} className="proxies-state-card__icon" />
            </div>
            <h2 className="proxies-state-card__title">Chưa có Proxy nào</h2>
            <p className="proxies-state-card__desc">
              Thêm proxy HTTP, HTTPS hoặc SOCKS5 để gán cho browser profile và ẩn IP thật.
            </p>
            <button className="button button--primary" onClick={openCreate}>
              <Plus size={15} />
              <span>Thêm Proxy đầu tiên</span>
            </button>
          </div>
        )}

        {pageState === 'error' && (
          <div className="proxies-state-card proxies-state-card--error" role="alert">
            <div className="proxies-state-card__icon-wrap">
              <AlertTriangle size={48} className="proxies-state-card__icon" />
            </div>
            <h2 className="proxies-state-card__title">Không thể tải danh sách</h2>
            <p className="proxies-state-card__desc">
              Đã xảy ra lỗi khi đọc dữ liệu từ local database.
            </p>
            <button className="button button--secondary" onClick={() => void load(search, page)}>
              Thử lại
            </button>
          </div>
        )}

        {pageState === 'offline' && (
          <div className="proxies-state-card" role="status">
            <div className="proxies-state-card__icon-wrap">
              <WifiOff size={48} className="proxies-state-card__icon" />
            </div>
            <h2 className="proxies-state-card__title">Mất kết nối mạng</h2>
            <p className="proxies-state-card__desc">
              Không thể đồng bộ dữ liệu. Một số tính năng sẽ không hoạt động khi offline.
            </p>
            <button className="button button--secondary" onClick={() => void load(search, page)}>
              Thử lại
            </button>
          </div>
        )}
      </main>

      {/* Create / Edit Dialog */}
      <ProxyFormDialog
        open={dialogOpen}
        editTarget={editTarget}
        onClose={() => { setDialogOpen(false); setEditTarget(undefined); }}
        onSaved={handleSaved}
      />
    </div>
  );
}
