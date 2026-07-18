import { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  RefreshCw,
  Play,
  Square,
  Trash2,
  Copy,
  Edit2,
  MoreVertical,
  Globe,
  Chrome,
  AlertTriangle,
  WifiOff,
  Laptop,
  Check,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  ChevronDown,
  X
} from 'lucide-react';
import './ProfilesPage.css';

// Types alignment with spec
interface Profile {
  id: string;
  name: string;
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'syncing' | 'locked' | 'error';
  os: 'windows' | 'macos' | 'linux';
  browser: string;
  proxy: string;
  lastSynced: string;
  tags: string[];
}

// Initial Mock Profiles data
const MOCK_PROFILES: Profile[] = [
  {
    id: 'p1',
    name: 'Profile Facebook Ads 01',
    status: 'running',
    os: 'windows',
    browser: 'Chrome 122',
    proxy: '192.168.1.100:8080 (VN)',
    lastSynced: '10 phút trước',
    tags: ['ads', 'facebook']
  },
  {
    id: 'p2',
    name: 'Profile Google Search Buyer',
    status: 'stopped',
    os: 'macos',
    browser: 'Chrome 120',
    proxy: '45.124.84.10:1080 (US)',
    lastSynced: '2 giờ trước',
    tags: ['buyer', 'google']
  },
  {
    id: 'p3',
    name: 'Tiktok Shop Feed Creator',
    status: 'syncing',
    os: 'linux',
    browser: 'Chrome 121',
    proxy: 'Direct (No Proxy)',
    lastSynced: 'Hôm qua',
    tags: ['tiktok', 'creator']
  },
  {
    id: 'p4',
    name: 'Profile eBay Stealth US',
    status: 'locked',
    os: 'windows',
    browser: 'Chrome 122',
    proxy: '172.98.54.21:3128 (US)',
    lastSynced: '3 ngày trước',
    tags: ['ebay', 'stealth']
  },
  {
    id: 'p5',
    name: 'Amazon Dropship Store 02',
    status: 'error',
    os: 'windows',
    browser: 'Chrome 122',
    proxy: 'Proxy Lỗi / Unreachable',
    lastSynced: '4 ngày trước',
    tags: ['amazon', 'dropship']
  },
  {
    id: 'p6',
    name: 'Coinlist Whitelist Airdrop',
    status: 'starting',
    os: 'macos',
    browser: 'Chrome 120',
    proxy: '88.198.24.11:8000 (DE)',
    lastSynced: '5 ngày trước',
    tags: ['crypto', 'airdrop']
  }
];

export function ProfilesPage(): JSX.Element {
  // Simulator State Toggles to showcase all requested states in UI
  const [viewState, setViewState] = useState<'success' | 'loading' | 'empty' | 'error' | 'offline'>('success');
  
  // Real UI states
  const [profiles, setProfiles] = useState<Profile[]>(MOCK_PROFILES);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [osFilter, setOsFilter] = useState<'all' | 'windows' | 'macos' | 'linux'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Toggle selection
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
    if (selectedIds.size === filteredProfiles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProfiles.map((p) => p.id)));
    }
  }

  // Action handlers
  function handleStartProfile(id: string) {
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'running' } : p))
    );
  }

  function handleStopProfile(id: string) {
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'stopped' } : p))
    );
  }

  function handleDeleteProfile(id: string) {
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    const next = new Set(selectedIds);
    next.delete(id);
    setSelectedIds(next);
  }

  function handleCloneProfile(profile: Profile) {
    const clone: Profile = {
      ...profile,
      id: `p-clone-${Date.now()}`,
      name: `${profile.name} (Copy)`,
      status: 'stopped',
    };
    setProfiles((prev) => [clone, ...prev]);
  }

  function handleBulkStart() {
    setProfiles((prev) =>
      prev.map((p) => (selectedIds.has(p.id) ? { ...p, status: 'running' } : p))
    );
    setSelectedIds(new Set());
  }

  function handleBulkStop() {
    setProfiles((prev) =>
      prev.map((p) => (selectedIds.has(p.id) ? { ...p, status: 'stopped' } : p))
    );
    setSelectedIds(new Set());
  }

  function handleBulkDelete() {
    setProfiles((prev) => prev.filter((p) => !selectedIds.has(p.id)));
    setSelectedIds(new Set());
  }

  // Filter profiles based on search and dropdown selectors
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.proxy.toLowerCase().includes(searchTerm.toLowerCase());
      const matchOs = osFilter === 'all' || p.os === osFilter;
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchSearch && matchOs && matchStatus;
    });
  }, [profiles, searchTerm, osFilter, statusFilter]);

  // Paginated list
  const paginatedProfiles = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProfiles.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProfiles, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredProfiles.length / itemsPerPage));

  // Render OS tag
  function renderOsIcon(os: 'windows' | 'macos' | 'linux') {
    return <Laptop className={`profile-table__os-icon profile-table__os-icon--${os}`} aria-hidden="true" />;
  }

  return (
    <div className="profiles-page">
      {/* State Simulator Panel for Design Review */}
      <div className="profiles-simulator" role="region" aria-label="Bộ mô phỏng trạng thái">
        <span className="profiles-simulator__label">Trạng thái Demo:</span>
        <div className="profiles-simulator__actions">
          {(['success', 'loading', 'empty', 'error', 'offline'] as const).map((state) => (
            <button
              key={state}
              onClick={() => {
                setViewState(state);
                setSelectedIds(new Set());
              }}
              className={`button button--xs ${viewState === state ? 'button--primary' : 'button--secondary'}`}
            >
              {state.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Main Top Toolbar */}
      <header className="profiles-toolbar">
        <div className="profiles-toolbar__left">
          <h1 className="profiles-toolbar__title">Profiles</h1>
          <span className="profiles-toolbar__count" aria-live="polite">
            ({filteredProfiles.length} tài khoản)
          </span>
        </div>

        <div className="profiles-toolbar__right">
          <div className="profiles-toolbar__search-wrapper">
            <Search className="profiles-toolbar__search-icon" aria-hidden="true" />
            <input
              type="text"
              placeholder="Tìm kiếm profile, proxy..."
              className="profiles-toolbar__search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Tìm kiếm profile"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
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
              setProfiles(MOCK_PROFILES);
              setSelectedIds(new Set());
            }}
          >
            <RefreshCw size={16} />
          </button>

          <button className="button button--primary" aria-label="Tạo Profile mới">
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
                onChange={(e) => setOsFilter(e.target.value as any)}
              >
                <option value="all">Tất cả OS</option>
                <option value="windows">Windows</option>
                <option value="macos">macOS</option>
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
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="stopped">Stopped</option>
                <option value="running">Running</option>
                <option value="syncing">Syncing</option>
                <option value="locked">Locked</option>
                <option value="error">Error</option>
              </select>
              <ChevronDown size={14} className="profiles-filters__select-chevron" />
            </div>
          </div>
        </section>
      )}

      {/* Main Content Area mapping state triggers */}
      <main className="profiles-content">
        {viewState === 'loading' && (
          <div className="profiles-table-container">
            <table className="profile-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}><span className="profile-table__skeleton-checkbox" /></th>
                  <th>Cấu hình</th>
                  <th style={{ width: '120px' }}>Hệ điều hành</th>
                  <th style={{ width: '140px' }}>Trạng thái</th>
                  <th>Proxy</th>
                  <th style={{ width: '140px' }}>Đồng bộ cuối</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {[...Array(5)].map((_, idx) => (
                  <tr key={idx} className="profile-table__row--skeleton">
                    <td><span className="profile-table__skeleton-checkbox" /></td>
                    <td><span className="profile-table__skeleton-bar" style={{ width: '160px' }} /></td>
                    <td><span className="profile-table__skeleton-bar" style={{ width: '80px' }} /></td>
                    <td><span className="profile-table__skeleton-bar" style={{ width: '90px' }} /></td>
                    <td><span className="profile-table__skeleton-bar" style={{ width: '200px' }} /></td>
                    <td><span className="profile-table__skeleton-bar" style={{ width: '100px' }} /></td>
                    <td><span className="profile-table__skeleton-bar" style={{ width: '60px', float: 'right' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {viewState === 'empty' && (
          <div className="profiles-state-card" role="status">
            <div className="profiles-state-card__illustration">
              <Chrome size={48} className="profiles-state-card__icon" />
            </div>
            <h2 className="profiles-state-card__title">Không tìm thấy Profile nào</h2>
            <p className="profiles-state-card__desc">
              Bắt đầu tạo hồ sơ vân tay trình duyệt an toàn đầu tiên để thực hiện công việc quản lý tài khoản.
            </p>
            <button className="button button--primary" onClick={() => setViewState('success')}>
              <Plus size={16} />
              <span>Tạo Profile ngay</span>
            </button>
          </div>
        )}

        {viewState === 'error' && (
          <div className="profiles-state-card profiles-state-card--error" role="alert">
            <div className="profiles-state-card__illustration">
              <AlertTriangle size={48} className="profiles-state-card__icon" />
            </div>
            <h2 className="profiles-state-card__title">Đã xảy ra lỗi tải dữ liệu</h2>
            <p className="profiles-state-card__desc">
              Không thể kết nối đến cơ sở dữ liệu SQLite cục bộ của ứng dụng. Vui lòng thử lại.
            </p>
            <button className="button button--secondary" onClick={() => setViewState('success')}>
              <span>Thử lại</span>
            </button>
          </div>
        )}

        {viewState === 'offline' && (
          <div className="profiles-state-card" role="status">
            <div className="profiles-state-card__illustration">
              <WifiOff size={48} className="profiles-state-card__icon" />
            </div>
            <h2 className="profiles-state-card__title">Bạn đang ngoại tuyến</h2>
            <p className="profiles-state-card__desc">
              Không có kết nối mạng internet. Trạng thái đồng bộ đám mây tạm thời không khả dụng. Bạn vẫn có thể mở các profile offline.
            </p>
            <button className="button button--secondary" onClick={() => setViewState('success')}>
              <span>Bật chế độ Offline</span>
            </button>
          </div>
        )}

        {viewState === 'success' && filteredProfiles.length === 0 && (
          <div className="profiles-state-card">
            <div className="profiles-state-card__illustration">
              <Search size={48} className="profiles-state-card__icon" />
            </div>
            <h2 className="profiles-state-card__title">Không có kết quả trùng khớp</h2>
            <p className="profiles-state-card__desc">
              Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc để xem lại danh sách.
            </p>
            <button className="button button--secondary" onClick={() => { setSearchTerm(''); setOsFilter('all'); setStatusFilter('all'); }}>
              <span>Xóa bộ lọc</span>
            </button>
          </div>
        )}

        {viewState === 'success' && filteredProfiles.length > 0 && (
          <div className="profiles-table-container">
            <table className="profile-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <button
                      className={`profile-table__checkbox ${
                        selectedIds.size === filteredProfiles.length ? 'profile-table__checkbox--checked' : ''
                      }`}
                      onClick={handleSelectAll}
                      aria-label="Chọn tất cả profile"
                    >
                      {selectedIds.size === filteredProfiles.length && <Check size={12} />}
                    </button>
                  </th>
                  <th>Cấu hình</th>
                  <th style={{ width: '120px' }}>Hệ điều hành</th>
                  <th style={{ width: '140px' }}>Trạng thái</th>
                  <th>Proxy</th>
                  <th style={{ width: '140px' }}>Đồng bộ cuối</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProfiles.map((profile) => {
                  const isSelected = selectedIds.has(profile.id);
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
                          <div className="profile-table__tags">
                            {profile.tags.map((tag) => (
                              <span key={tag} className="profile-table__tag">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="profile-table__os-cell">
                          {renderOsIcon(profile.os)}
                          <span className="profile-table__os-label">{profile.browser}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`status-indicator status-indicator--${profile.status}`}>
                          <span className="status-indicator__dot" />
                          <span className="status-indicator__label">
                            {profile.status.toUpperCase()}
                          </span>
                        </span>
                      </td>
                      <td>
                        <div className="profile-table__proxy-cell font-mono">
                          <Globe size={13} className="profile-table__proxy-icon" />
                          <span className="profile-table__proxy-text" title={profile.proxy}>
                            {profile.proxy}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="profile-table__sync-text">{profile.lastSynced}</span>
                      </td>
                      <td>
                        <div className="profile-table__actions-cell">
                          {profile.status === 'running' ? (
                            <button
                              className="button button--danger button--icon"
                              onClick={() => handleStopProfile(profile.id)}
                              title="Dừng profile"
                              aria-label={`Dừng profile ${profile.name}`}
                            >
                              <Square size={14} fill="currentColor" />
                            </button>
                          ) : (
                            <button
                              className="button button--primary button--icon"
                              onClick={() => handleStartProfile(profile.id)}
                              disabled={profile.status === 'starting' || profile.status === 'stopping' || profile.status === 'locked'}
                              title="Chạy profile"
                              aria-label={`Chạy profile ${profile.name}`}
                            >
                              <Play size={14} fill="currentColor" />
                            </button>
                          )}
                          
                          <div style={{ position: 'relative' }}>
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
                                      handleCloneProfile(profile);
                                      setActiveMenuId(null);
                                    }}
                                  >
                                    <Copy size={13} />
                                    <span>Nhân bản</span>
                                  </button>
                                  <button
                                    className="profile-table__dropdown-item"
                                    onClick={() => setActiveMenuId(null)}
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
      {selectedIds.size > 0 && viewState === 'success' && (
        <section className="profiles-bulk-bar" role="region" aria-label="Thao tác hàng loạt">
          <span className="profiles-bulk-bar__count">
            Đang chọn <strong>{selectedIds.size}</strong> profile
          </span>
          <div className="profiles-bulk-bar__actions">
            <button className="button button--secondary" onClick={handleBulkStart}>
              <Play size={14} fill="currentColor" />
              <span>Chạy</span>
            </button>
            <button className="button button--secondary" onClick={handleBulkStop}>
              <Square size={14} fill="currentColor" />
              <span>Dừng</span>
            </button>
            <button className="button button--danger" onClick={handleBulkDelete}>
              <Trash2 size={14} />
              <span>Xóa</span>
            </button>
            <button className="profiles-bulk-bar__close" onClick={() => setSelectedIds(new Set())} aria-label="Bỏ chọn tất cả">
              <X size={16} />
            </button>
          </div>
        </section>
      )}

      {/* Pagination Footer */}
      {viewState === 'success' && filteredProfiles.length > 0 && (
        <footer className="profiles-footer">
          <div className="profiles-footer__left">
            <span>Hiển thị {Math.min(filteredProfiles.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(filteredProfiles.length, currentPage * itemsPerPage)} của {filteredProfiles.length} profiles</span>
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
    </div>
  );
}
