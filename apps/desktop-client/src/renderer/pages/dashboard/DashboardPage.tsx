import { useAuthStore } from '../../store/auth-store.js';
import './DashboardPage.css';

export function DashboardPage(): JSX.Element {
  const { user } = useAuthStore();

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard__header">
        <h1 className="dashboard__title">
          Xin chào{user?.name ? `, ${user.name}` : ''}!
        </h1>
        <p className="dashboard__subtitle">
          Tổng quan hệ thống Antidetect Browser của bạn.
        </p>
      </div>

      {/* Stats cards */}
      <div className="dashboard__grid">
        <StatCard label="Tổng profiles" value="0" />
        <StatCard label="Đang chạy" value="0" modifier="success" />
        <StatCard label="Proxy lỗi" value="0" modifier="error" />
        <StatCard label="Đồng bộ cloud" value="OK" modifier="success" />
      </div>

      {/* Placeholder for feature areas */}
      <div className="profile-manager-placeholder">
        <div className="profile-manager-placeholder__content">
          <p className="profile-manager-placeholder__title">Profile Manager</p>
          <p className="profile-manager-placeholder__desc">
            Đang phát triển — RFC-0004 Profile Management
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  modifier,
}: {
  label: string;
  value: string;
  modifier?: 'success' | 'error';
}): JSX.Element {
  const valueModifier =
    modifier === 'success' ? 'dashboard__card-value--success'
    : modifier === 'error' ? 'dashboard__card-value--error'
    : '';

  return (
    <div className="dashboard__card">
      <p className="dashboard__card-label">{label}</p>
      <p className={`dashboard__card-value ${valueModifier}`}>{value}</p>
    </div>
  );
}
