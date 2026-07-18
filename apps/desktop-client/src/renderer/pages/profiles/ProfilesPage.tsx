import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Chrome,
  Globe,
  Laptop,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import type {
  ProfileRuntimeEvent,
  ProfileView,
} from '../../../shared/profile-contracts.js';
import './ProfilesPage.css';

type ProfilesLoadState = 'loading' | 'success' | 'error';

interface ProfilesLocationState {
  createdProfileId?: string;
}

function toVisibleStatus(event: ProfileRuntimeEvent): ProfileView['status'] {
  if (event.state === 'starting' || event.state === 'validating' || event.state === 'waiting' || event.state === 'acquiring_lock' || event.state === 'preparing') {
    return 'starting';
  }
  if (event.state === 'running' || event.state === 'stopping') return 'running';
  if (event.state === 'error' || event.state === 'crashed' || event.state === 'locked') return 'error';
  return 'stopped';
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function getOsLabel(os: ProfileView['os']): string {
  if (os === 'mac') return 'macOS';
  return os === 'windows' ? 'Windows' : 'Linux';
}

export function ProfilesPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as ProfilesLocationState | null;
  const [profiles, setProfiles] = useState<ProfileView[]>([]);
  const [loadState, setLoadState] = useState<ProfilesLoadState>('loading');
  const [searchTerm, setSearchTerm] = useState('');
  const [osFilter, setOsFilter] = useState<'all' | ProfileView['os']>('all');

  const loadProfiles = useCallback(async (): Promise<void> => {
    setLoadState('loading');
    try {
      const result = await window.desktop.profile.list({ limit: 100, offset: 0 });
      setProfiles(result.items);
      setLoadState('success');
    } catch {
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  useEffect(() => {
    return window.desktop.profile.subscribeRuntime((event) => {
      setProfiles((current) => current.map((profile) => (
        profile.id === event.profileId
          ? { ...profile, status: toVisibleStatus(event) }
          : profile
      )));
    });
  }, []);

  const filteredProfiles = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase();
    return profiles.filter((profile) => {
      const matchesSearch = !normalizedSearch
        || profile.name.toLocaleLowerCase().includes(normalizedSearch)
        || profile.notes?.toLocaleLowerCase().includes(normalizedSearch);
      const matchesOs = osFilter === 'all' || profile.os === osFilter;
      return matchesSearch && matchesOs;
    });
  }, [osFilter, profiles, searchTerm]);

  return (
    <div className="profiles-page">
      <header className="profiles-toolbar">
        <div className="profiles-toolbar__left">
          <h1 className="profiles-toolbar__title">Profiles</h1>
          <span className="profiles-toolbar__count" aria-live="polite">
            ({profiles.length} profiles)
          </span>
        </div>

        <div className="profiles-toolbar__right">
          <div className="profiles-toolbar__search-wrapper">
            <Search className="profiles-toolbar__search-icon" aria-hidden="true" />
            <input
              type="search"
              placeholder="Tìm profile…"
              className="profiles-toolbar__search-input"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              aria-label="Tìm kiếm profile"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="profiles-toolbar__clear-search"
                aria-label="Xóa tìm kiếm"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <label className="profiles-filter-inline">
            <span className="sr-only">Lọc hệ điều hành</span>
            <select
              value={osFilter}
              onChange={(event) => setOsFilter(event.target.value as typeof osFilter)}
              aria-label="Lọc hệ điều hành"
            >
              <option value="all">All systems</option>
              <option value="windows">Windows</option>
              <option value="mac">macOS</option>
              <option value="linux">Linux</option>
            </select>
          </label>

          <button
            type="button"
            className="button button--secondary"
            aria-label="Làm mới profiles"
            onClick={() => void loadProfiles()}
            disabled={loadState === 'loading'}
          >
            <RefreshCw size={16} className={loadState === 'loading' ? 'profiles-refresh--spinning' : ''} />
          </button>

          <button
            type="button"
            className="button button--primary"
            aria-label="Tạo Profile mới"
            onClick={() => navigate('/profiles/create')}
          >
            <Plus size={16} />
            <span>Create Profile</span>
          </button>
        </div>
      </header>

      <main className="profiles-content">
        {locationState?.createdProfileId && loadState === 'success' && (
          <div className="profiles-created-notice" role="status">
            <CheckCircle2 size={16} aria-hidden="true" />
            Profile đã được tạo và lưu thành công.
          </div>
        )}

        {loadState === 'loading' && (
          <div className="profiles-table-container" aria-busy="true" aria-label="Đang tải profiles">
            <table className="profile-table">
              <thead>
                <tr>
                  <th>Profile</th>
                  <th>System</th>
                  <th>Runtime</th>
                  <th>Status</th>
                  <th>Network</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2, 3].map((row) => (
                  <tr key={row} className="profile-table__row--skeleton">
                    {[0, 1, 2, 3, 4, 5].map((cell) => (
                      <td key={cell}><span className="profile-table__skeleton-bar" /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {loadState === 'error' && (
          <div className="profiles-state-card profiles-state-card--error" role="alert">
            <div className="profiles-state-card__illustration">
              <AlertTriangle size={48} className="profiles-state-card__icon" />
            </div>
            <h2 className="profiles-state-card__title">Không thể tải profiles</h2>
            <p className="profiles-state-card__desc">Desktop Main chưa trả về danh sách profile. Không có mock fallback.</p>
            <button type="button" className="button button--secondary" onClick={() => void loadProfiles()}>
              Thử lại
            </button>
          </div>
        )}

        {loadState === 'success' && profiles.length === 0 && (
          <div className="profiles-state-card" role="status">
            <div className="profiles-state-card__illustration">
              <Chrome size={48} className="profiles-state-card__icon" />
            </div>
            <h2 className="profiles-state-card__title">Chưa có profile</h2>
            <p className="profiles-state-card__desc">Tạo profile đầu tiên bằng cấu hình runtime được Desktop hỗ trợ.</p>
            <button type="button" className="button button--primary" onClick={() => navigate('/profiles/create')}>
              <Plus size={16} />
              Create Profile
            </button>
          </div>
        )}

        {loadState === 'success' && profiles.length > 0 && filteredProfiles.length === 0 && (
          <div className="profiles-state-card" role="status">
            <div className="profiles-state-card__illustration">
              <Search size={48} className="profiles-state-card__icon" />
            </div>
            <h2 className="profiles-state-card__title">Không có kết quả phù hợp</h2>
            <p className="profiles-state-card__desc">Thử từ khóa khác hoặc xóa bộ lọc hệ điều hành.</p>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => {
                setSearchTerm('');
                setOsFilter('all');
              }}
            >
              Xóa bộ lọc
            </button>
          </div>
        )}

        {loadState === 'success' && filteredProfiles.length > 0 && (
          <div className="profiles-table-container">
            <table className="profile-table">
              <thead>
                <tr>
                  <th>Profile</th>
                  <th>System</th>
                  <th>Runtime</th>
                  <th>Status</th>
                  <th>Network</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.map((profile) => (
                  <tr key={profile.id} className="profile-table__row">
                    <td>
                      <div className="profile-table__info-cell">
                        <span className="profile-table__profile-name">{profile.name}</span>
                        {profile.notes && <span className="profile-table__note">{profile.notes}</span>}
                      </div>
                    </td>
                    <td>
                      <div className="profile-table__os-cell">
                        <Laptop className={`profile-table__os-icon profile-table__os-icon--${profile.os}`} aria-hidden="true" />
                        <span>{getOsLabel(profile.os)}</span>
                      </div>
                    </td>
                    <td>
                      <div className="profile-table__runtime-cell">
                        <Chrome size={14} aria-hidden="true" />
                        <span>{profile.distribution} · {profile.channel}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`status-indicator status-indicator--${profile.status}`}>
                        <span className="status-indicator__dot" />
                        {profile.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div className="profile-table__proxy-cell">
                        <Globe size={13} className="profile-table__proxy-icon" />
                        <span>{profile.proxyId ? 'Configured proxy' : 'No proxy (local network)'}</span>
                      </div>
                    </td>
                    <td><span className="profile-table__sync-text">{formatUpdatedAt(profile.updatedAt)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
