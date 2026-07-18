import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  RefreshCw,
  Play,
  Square,
  Trash2,
  Edit2,
  MoreVertical,
  Chrome,
  AlertTriangle,
  Laptop,
  Check,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  ChevronDown,
  X
} from 'lucide-react';
import type { ProfileView, ProxyView } from 'shared';
import {
  useProfiles,
  useRemoveProfile,
  useProfileLifecycle
} from '../../hooks/useProfiles.js';
import { ProfileFormDialog } from '../../features/profiles/components/ProfileFormDialog.js';
import { CountryFlag } from '../../components/CountryFlag/CountryFlag.js';
import './ProfilesPage.css';

const ITEMS_PER_PAGE = 10;

export function ProfilesPage(): JSX.Element {
  const [searchTerm, setSearchTerm] = useState('');
  const [osFilter, setOsFilter] = useState<'all' | 'windows' | 'mac' | 'linux'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);

  // React Query style IPC Hooks
  const { data: profileResult, loading, error, refetch } = useProfiles(
    searchTerm,
    osFilter === 'all' ? undefined : osFilter,
    statusFilter === 'all' ? undefined : statusFilter
  );

  const { remove } = useRemoveProfile(() => {
    refetch();
    setSelectedIds(new Set());
  });

  const { launch, stop, launchingIds, stoppingIds } = useProfileLifecycle();

  // Dialogue toggles
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProfileView | undefined>(undefined);

  // Map cached proxies to render their name/flag dynamically
  const [proxyMap, setProxyMap] = useState<Map<string, ProxyView>>(new Map());

  useEffect(() => {
    // Tải thông tin proxy để render thông tin gán kèm profile
    window.desktop.proxy.list({ limit: 200, offset: 0 })
      .then((res) => {
        const m = new Map<string, ProxyView>();
        res.items.forEach((p) => m.set(p.id, p));
        setProxyMap(m);
      })
      .catch(() => {});
  }, [profileResult]);

  useEffect(() => {
    refetch();
  }, [refetch, searchTerm, osFilter, statusFilter, currentPage]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Calculations
  const profiles = profileResult?.items ?? [];
  const total = profileResult?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  function handleSelectRow(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  }

  function handleSelectAll() {
    if (selectedIds.size === profiles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(profiles.map((p) => p.id)));
    }
  }

  async function handleStartProfile(id: string) {
    try {
      await launch(id);
      refetch();
    } catch (err: any) {
      alert(err.message || 'Khởi chạy trình duyệt thất bại.');
    }
  }

  async function handleStopProfile(id: string) {
    try {
      await stop(id);
      refetch();
    } catch (err: any) {
      alert(err.message || 'Dừng trình duyệt thất bại.');
    }
  }

  async function handleDeleteProfile(id: string) {
    if (!window.confirm('Xóa profile này? Thao tác không thể hoàn tác và sẽ xóa toàn bộ cookie.')) {
      return;
    }
    await remove(id);
  }

  function handleEditProfile(profile: ProfileView) {
    setEditTarget(profile);
    setDialogOpen(true);
  }

  function handleOpenCreate() {
    setEditTarget(undefined);
    setDialogOpen(true);
  }

  function handleSaved() {
    setDialogOpen(false);
    setEditTarget(undefined);
    refetch();
  }

  // Render OS icon helpers
  function renderOsIcon(os: 'windows' | 'mac' | 'linux') {
    return <Laptop className={`profile-table__os-icon profile-table__os-icon--${os}`} aria-hidden="true" />;
  }

  const pageState = loading ? 'loading' : error ? 'error' : total === 0 ? 'empty' : 'success';

  return (
    <div className="profiles-page">
      {/* Main Top Toolbar */}
      <header className="profiles-toolbar">
        <div className="profiles-toolbar__left">
          <h1 className="profiles-toolbar__title">Profiles</h1>
          {pageState === 'success' && (
            <span className="profiles-toolbar__count" aria-live="polite">
              ({total} tài khoản)
            </span>
          )}
        </div>

        <div className="profiles-toolbar__right">
          <div className="profiles-toolbar__search-wrapper">
            <Search className="profiles-toolbar__search-icon" aria-hidden="true" />
            <input
              type="text"
              placeholder="Tìm kiếm profile..."
              className="profiles-toolbar__search-input"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              aria-label="Tìm kiếm profile"
            />
            {searchTerm && (
              <button
                onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                className="profiles-toolbar__clear-search"
                aria-label="Xóa tìm kiếm"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`button button--secondary ${showFilters ? 'button--active' : ''}`}
            aria-expanded={showFilters}
            aria-label="Bộ lọc nâng cao"
          >
            <SlidersHorizontal size={16} />
            <span>Bộ lọc</span>
          </button>

          <button
            className="button button--secondary"
            aria-label="Làm mới dữ liệu"
            onClick={() => {
              refetch();
              setSelectedIds(new Set());
            }}
          >
            <RefreshCw size={16} />
          </button>

          <button className="button button--primary" onClick={handleOpenCreate} aria-label="Tạo Profile mới">
            <Plus size={16} />
            <span>Thêm Profile</span>
          </button>
        </div>
      </header>

      {/* Expandable filters drawer */}
      {showFilters && (
        <section className="profiles-filters" aria-label="Bộ lọc bổ sung">
          <div className="profiles-filters__group">
            <label htmlFor="os-select" className="profiles-filters__label">Hệ điều hành</label>
            <div className="profiles-filters__select-wrapper">
              <select
                id="os-select"
                className="profiles-filters__select"
                value={osFilter}
                onChange={(e) => { setOsFilter(e.target.value as any); setCurrentPage(1); }}
              >
                <option value="all">Tất cả OS</option>
                <option value="windows">Windows</option>
                <option value="mac">macOS</option>
                <option value="linux">Linux</option>
              </select>
              <ChevronDown size={14} className="profiles-filters__select-chevron" />
            </div>
          </div>

          <div className="profiles-filters__group">
            <label htmlFor="status-select" className="profiles-filters__label">Trạng thái</label>
            <div className="profiles-filters__select-wrapper">
              <select
                id="status-select"
                className="profiles-filters__select"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="stopped">Stopped</option>
                <option value="running">Running</option>
                <option value="error">Error</option>
              </select>
              <ChevronDown size={14} className="profiles-filters__select-chevron" />
            </div>
          </div>
        </section>
      )}

      {/* Main Content Area mapping state triggers */}
      <main className="profiles-content">
        {pageState === 'loading' && (
          <div className="profiles-table-container">
            <table className="profile-table">
              <thead>
                <tr>
                  <th className="profile-table__th--select"><span className="profile-table__skeleton-checkbox" /></th>
                  <th>Cấu hình</th>
                  <th className="profile-table__th--os">Hệ điều hành</th>
                  <th className="profile-table__th--status">Trạng thái</th>
                  <th>Proxy</th>
                  <th className="profile-table__th--sync">Đồng bộ cuối</th>
                  <th className="profile-table__th--actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {[...Array(5)].map((_, idx) => (
                  <tr key={idx} className="profile-table__row--skeleton">
                    <td><span className="profile-table__skeleton-checkbox" /></td>
                    <td><span className="profile-table__skeleton-bar profile-table__skeleton-bar--name" /></td>
                    <td><span className="profile-table__skeleton-bar profile-table__skeleton-bar--os" /></td>
                    <td><span className="profile-table__skeleton-bar profile-table__skeleton-bar--status" /></td>
                    <td><span className="profile-table__skeleton-bar profile-table__skeleton-bar--proxy" /></td>
                    <td><span className="profile-table__skeleton-bar profile-table__skeleton-bar--sync" /></td>
                    <td><span className="profile-table__skeleton-bar profile-table__skeleton-bar--actions" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pageState === 'empty' && (
          <div className="profiles-state-card" role="status">
            <div className="profiles-state-card__illustration">
              <Chrome size={48} className="profiles-state-card__icon" />
            </div>
            <h2 className="profiles-state-card__title">Không tìm thấy Profile nào</h2>
            <p className="profiles-state-card__desc">
              Bắt đầu tạo hồ sơ vân tay trình duyệt an toàn đầu tiên để thực hiện công việc quản lý tài khoản.
            </p>
            <button className="button button--primary" onClick={handleOpenCreate}>
              <Plus size={16} />
              <span>Tạo Profile ngay</span>
            </button>
          </div>
        )}

        {pageState === 'error' && (
          <div className="profiles-state-card profiles-state-card--error" role="alert">
            <div className="profiles-state-card__illustration">
              <AlertTriangle size={48} className="profiles-state-card__icon" />
            </div>
            <h2 className="profiles-state-card__title">Đã xảy ra lỗi tải dữ liệu</h2>
            <p className="profiles-state-card__desc">
              {error || 'Không thể tải danh sách profile. Vui lòng thử lại sau.'}
            </p>
            <button className="button button--secondary" onClick={() => refetch()}>
              <span>Thử lại</span>
            </button>
          </div>
        )}

        {pageState === 'success' && (
          <div className="profiles-table-container">
            <table className="profile-table">
              <thead>
                <tr>
                  <th className="profile-table__th--select">
                    <button
                      className={`profile-table__checkbox ${
                        selectedIds.size === profiles.length ? 'profile-table__checkbox--checked' : ''
                      }`}
                      onClick={handleSelectAll}
                      aria-label="Chọn tất cả profile"
                    >
                      {selectedIds.size === profiles.length && <Check size={12} />}
                    </button>
                  </th>
                  <th>Cấu hình</th>
                  <th className="profile-table__th--os">Hệ điều hành</th>
                  <th className="profile-table__th--status">Trạng thái</th>
                  <th>Proxy</th>
                  <th className="profile-table__th--sync">Đồng bộ cuối</th>
                  <th className="profile-table__th--actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => {
                  const isSelected = selectedIds.has(profile.id);
                  const isLaunching = launchingIds.has(profile.id);
                  const isStopping = stoppingIds.has(profile.id);
                  
                  // Look up assigned proxy details
                  const assignedProxy = profile.proxyId ? proxyMap.get(profile.proxyId) : null;

                  return (
                    <tr
                      key={profile.id}
                      className={`profile-table__row ${isSelected ? 'profile-table__row--selected' : ''}`}
                    >
                      <td>
                        <button
                          className={`profile-table__checkbox ${
                            isSelected ? 'profile-table__checkbox--checked' : ''
                          }`}
                          onClick={() => handleSelectRow(profile.id)}
                          aria-label={`Chọn profile ${profile.name}`}
                        >
                          {isSelected && <Check size={12} />}
                        </button>
                      </td>
                      <td>
                        <div className="profile-table__info-cell">
                          <span className="profile-table__profile-name" title={profile.name}>
                            {profile.name}
                          </span>
                          {profile.notes && (
                            <span className="profile-table__notes font-mono text-muted">
                              {profile.notes}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="profile-table__os-cell">
                          {renderOsIcon(profile.os)}
                          <span className="profile-table__os-label">{profile.engine === 'firefox' ? 'Firefox' : 'Chromium'}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`status-indicator status-indicator--${profile.status}`}>
                          <span className="status-indicator__dot" />
                          <span className="status-indicator__label">
                            {isLaunching ? 'STARTING...' : isStopping ? 'STOPPING...' : profile.status.toUpperCase()}
                          </span>
                        </span>
                      </td>
                      <td>
                        <div className="profile-table__proxy-cell font-mono">
                          {assignedProxy ? (
                            <>
                              {assignedProxy.countryCode && (
                                <CountryFlag
                                  code={assignedProxy.countryCode}
                                  name={assignedProxy.city ?? assignedProxy.countryCode}
                                  size={16}
                                />
                              )}
                              <span>{assignedProxy.name} ({assignedProxy.host}:{assignedProxy.port})</span>
                            </>
                          ) : (
                            <span className="profile-table__proxy-none">Không sử dụng</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="profile-table__time-cell">
                          {new Date(profile.updatedAt).toLocaleDateString('vi-VN')}
                        </span>
                      </td>
                      <td>
                        <div className="profile-table__actions-cell">
                          {profile.status === 'running' ? (
                            <button
                              className="button button--secondary button--icon button--danger"
                              onClick={() => handleStopProfile(profile.id)}
                              disabled={isStopping}
                              title="Dừng profile"
                              aria-label={`Dừng profile ${profile.name}`}
                            >
                              <Square size={14} fill="currentColor" />
                            </button>
                          ) : (
                            <button
                              className="button button--primary button--icon"
                              onClick={() => handleStartProfile(profile.id)}
                              disabled={profile.status === 'starting' || isLaunching || isStopping}
                              title="Chạy profile"
                              aria-label={`Chạy profile ${profile.name}`}
                            >
                              <Play size={14} fill="currentColor" />
                            </button>
                          )}
                          
                          <div className="profile-table__action-menu">
                            <button
                              className="button button--ghost button--icon"
                              onClick={() => setActiveMenuId(activeMenuId === profile.id ? null : profile.id)}
                              aria-label="Thêm thao tác"
                            >
                              <MoreVertical size={14} />
                            </button>

                            {activeMenuId === profile.id && (
                              <>
                                <div className="profile-table__dropdown-backdrop" onClick={() => setActiveMenuId(null)} />
                                <div className="profile-table__dropdown">
                                  <button
                                    className="profile-table__dropdown-item"
                                    onClick={() => {
                                      handleEditProfile(profile);
                                      setActiveMenuId(null);
                                    }}
                                  >
                                    <Edit2 size={13} />
                                    <span>Chỉnh sửa</span>
                                  </button>
                                  <div className="profile-table__dropdown-divider" />
                                  <button
                                    className="profile-table__dropdown-item profile-table__dropdown-item--danger"
                                    onClick={() => {
                                      handleDeleteProfile(profile.id);
                                      setActiveMenuId(null);
                                    }}
                                  >
                                    <Trash2 size={13} />
                                    <span>Xóa</span>
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Selected Bulk Toolbar Overlay */}
      {selectedIds.size > 0 && pageState === 'success' && (
        <section className="profiles-bulk-bar" role="region" aria-label="Thao tác hàng loạt">
          <span className="profiles-bulk-bar__count">
            Đang chọn <strong>{selectedIds.size}</strong> profile
          </span>
          <div className="profiles-bulk-bar__actions">
            <button className="profiles-bulk-bar__close" onClick={() => setSelectedIds(new Set())} aria-label="Bỏ chọn tất cả">
              <X size={16} />
            </button>
          </div>
        </section>
      )}

      {/* Pagination Footer */}
      {pageState === 'success' && (
        <footer className="profiles-footer">
          <div className="profiles-footer__left">
            <span>Hiển thị {profiles.length} của {total} profiles</span>
          </div>
          <div className="profiles-footer__right">
            <button
              className="button button--secondary button--icon"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              aria-label="Trang trước"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="profiles-footer__page-indicator">Trang {currentPage} / {totalPages}</span>
            <button
              className="button button--secondary button--icon"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
              aria-label="Trang sau"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </footer>
      )}

      {/* Form Dialog */}
      <ProfileFormDialog
        open={dialogOpen}
        editTarget={editTarget}
        onClose={() => { setDialogOpen(false); setEditTarget(undefined); }}
        onSaved={handleSaved}
      />
    </div>
  );
}
