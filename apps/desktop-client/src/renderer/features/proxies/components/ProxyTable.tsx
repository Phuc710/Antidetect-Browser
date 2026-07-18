import { useState } from 'react';
import {
  Play, Trash2, Edit2, Check, ChevronLeft, ChevronRight, Loader2, Copy
} from 'lucide-react';
import type { ProxyView, ProxyTestResult } from 'shared';
import { CountryFlag } from '../../../components/CountryFlag/CountryFlag.js';
import { useTestProxy, useRemoveProxy } from '../hooks/proxy-hooks.js';
import './ProxyTable.css';

interface ProxyTableProps {
  proxies: ProxyView[];
  total: number;
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange(page: number): void;
  onEdit(proxy: ProxyView): void;
  onDeleted(proxyId: string): void;
  onTestComplete(proxyId: string, result: ProxyTestResult): void;
}

export function ProxyTable({
  proxies, total, loading, page, totalPages,
  onPageChange, onEdit, onDeleted, onTestComplete
}: ProxyTableProps): JSX.Element {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { testStored, testingIds } = useTestProxy();
  const { remove } = useRemoveProxy(onDeleted);

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  }

  function toggleAll() {
    if (selectedIds.size === proxies.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(proxies.map((p) => p.id)));
    }
  }

  async function handleTest(proxy: ProxyView) {
    const result = await testStored(proxy.id);
    onTestComplete(proxy.id, result);
  }

  function handleCopy(proxy: ProxyView) {
    // Chỉ copy host:port — KHÔNG copy credential theo RFC-0025
    const text = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
    navigator.clipboard.writeText(text).catch(() => {});
  }

  async function handleDelete(proxyId: string) {
    if (!window.confirm('Xóa proxy này? Thao tác không thể hoàn tác.')) return;
    await remove(proxyId);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(proxyId);
      return next;
    });
  }

  const allSelected = proxies.length > 0 && selectedIds.size === proxies.length;

  return (
    <div className="proxy-table-wrap">
      <div className="proxy-table-container">
        <table className="proxy-table">
          <thead>
            <tr>
              <th className="proxy-table__th--checkbox">
                <button
                  className={`proxy-table__checkbox ${allSelected ? 'proxy-table__checkbox--checked' : ''}`}
                  onClick={toggleAll}
                  aria-label="Chọn tất cả"
                >
                  {allSelected && <Check size={11} />}
                </button>
              </th>
              <th>Tên</th>
              <th className="proxy-table__th--protocol">Giao thức</th>
              <th>Host:Port</th>
              <th className="proxy-table__th--auth">Xác thực</th>
              <th className="proxy-table__th--location">Vị trí</th>
              <th className="proxy-table__th--status">Trạng thái</th>
              <th className="proxy-table__th--actions">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : proxies.map((proxy) => (
                <ProxyRow
                  key={proxy.id}
                  proxy={proxy}
                  selected={selectedIds.has(proxy.id)}
                  testing={testingIds.has(proxy.id)}
                  onToggle={toggleSelect}
                  onEdit={onEdit}
                  onTest={handleTest}
                  onCopy={handleCopy}
                  onDelete={handleDelete}
                />
              ))
            }
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && total > 0 && (
        <footer className="proxy-table__footer">
          <span className="proxy-table__count">
            {total} proxy
          </span>
          <div className="proxy-table__pagination">
            <button
              className="button button--secondary button--icon"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              aria-label="Trang trước"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="proxy-table__page">Trang {page} / {totalPages}</span>
            <button
              className="button button--secondary button--icon"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              aria-label="Trang sau"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

function ProxyRow({
  proxy, selected, testing, onToggle, onEdit, onTest, onCopy, onDelete
}: {
  proxy: ProxyView;
  selected: boolean;
  testing: boolean;
  onToggle(id: string): void;
  onEdit(p: ProxyView): void;
  onTest(p: ProxyView): Promise<void>;
  onCopy(p: ProxyView): void;
  onDelete(id: string): Promise<void>;
}): JSX.Element {
  return (
    <tr className={`proxy-table__row ${selected ? 'proxy-table__row--selected' : ''}`}>
      <td>
        <button
          className={`proxy-table__checkbox ${selected ? 'proxy-table__checkbox--checked' : ''}`}
          onClick={() => onToggle(proxy.id)}
          aria-label={`Chọn ${proxy.name}`}
        >
          {selected && <Check size={11} />}
        </button>
      </td>
      <td>
        <span className="proxy-table__name truncate" title={proxy.name}>{proxy.name}</span>
      </td>
      <td>
        <span className={`proxy-table__protocol-badge proxy-table__protocol-badge--${proxy.protocol}`}>
          {proxy.protocol.toUpperCase()}
        </span>
      </td>
      <td>
        <span className="proxy-table__address font-mono">{proxy.host}:{proxy.port}</span>
      </td>
      <td>
        {proxy.authMode === 'username_password'
          ? <span className="proxy-table__auth-info">{proxy.usernameMasked ?? '—'}</span>
          : <span className="proxy-table__auth-none">—</span>
        }
      </td>
      <td>
        <div className="proxy-table__location">
          {proxy.countryCode && (
            <CountryFlag
              code={proxy.countryCode}
              name={proxy.city ?? proxy.countryCode}
              size={16}
            />
          )}
          <span className="proxy-table__city truncate">
            {proxy.city ? `${proxy.city}, ${proxy.countryCode?.toUpperCase()}` : (proxy.countryCode?.toUpperCase() ?? '—')}
          </span>
        </div>
      </td>
      <td>
        {testing
          ? <span className="status-indicator status-indicator--starting">
              <span className="status-indicator__dot" />
              <span className="status-indicator__label">TESTING...</span>
            </span>
          : <ProxyStatusBadge status={proxy.status} latencyMs={proxy.latencyMs} />
        }
      </td>
      <td>
        <div className="proxy-table__actions">
          <button
            className="button button--ghost button--icon"
            onClick={() => void onTest(proxy)}
            disabled={testing}
            title="Kiểm tra kết nối"
            aria-label={`Kiểm tra proxy ${proxy.name}`}
          >
            {testing ? <Loader2 size={13} className="proxy-table__spin" /> : <Play size={13} />}
          </button>
          <button
            className="button button--ghost button--icon"
            onClick={() => onCopy(proxy)}
            title="Sao chép Host:Port"
            aria-label={`Sao chép proxy ${proxy.name}`}
          >
            <Copy size={13} />
          </button>
          <button
            className="button button--ghost button--icon"
            onClick={() => onEdit(proxy)}
            title="Chỉnh sửa"
            aria-label={`Sửa proxy ${proxy.name}`}
          >
            <Edit2 size={13} />
          </button>
          <button
            className="button button--ghost button--icon button--danger"
            onClick={() => void onDelete(proxy.id)}
            title="Xóa"
            aria-label={`Xóa proxy ${proxy.name}`}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function ProxyStatusBadge({ status, latencyMs }: { status: ProxyView['status']; latencyMs: number | undefined }): JSX.Element {
  const map: Record<ProxyView['status'], { cls: string; label: string }> = {
    unchecked:            { cls: 'stopped',  label: 'Chưa kiểm tra' },
    checking:             { cls: 'starting', label: 'Đang test' },
    online:               { cls: 'running',  label: `${latencyMs != null ? `${latencyMs} ms` : 'Online'}` },
    offline:              { cls: 'error',    label: 'Offline' },
    authentication_error: { cls: 'error',    label: 'Sai mật khẩu' },
    timeout:              { cls: 'error',    label: 'Timeout' },
    configuration_error:  { cls: 'error',    label: 'Cấu hình lỗi' },
  };

  const { cls, label } = map[status] ?? { cls: 'stopped', label: status };
  return (
    <span className={`status-indicator status-indicator--${cls}`}>
      <span className="status-indicator__dot" />
      <span className="status-indicator__label">{label}</span>
    </span>
  );
}

function SkeletonRow(): JSX.Element {
  return (
    <tr className="proxy-table__row--skeleton">
      <td><span className="proxy-table__skeleton-box proxy-table__skeleton-box--checkbox" /></td>
      <td><span className="proxy-table__skeleton-bar proxy-table__skeleton-bar--name" /></td>
      <td><span className="proxy-table__skeleton-bar proxy-table__skeleton-bar--protocol" /></td>
      <td><span className="proxy-table__skeleton-bar proxy-table__skeleton-bar--host" /></td>
      <td><span className="proxy-table__skeleton-bar proxy-table__skeleton-bar--auth" /></td>
      <td><span className="proxy-table__skeleton-bar proxy-table__skeleton-bar--location" /></td>
      <td><span className="proxy-table__skeleton-bar proxy-table__skeleton-bar--status" /></td>
      <td><span className="proxy-table__skeleton-bar proxy-table__skeleton-bar--actions" /></td>
    </tr>
  );
}
