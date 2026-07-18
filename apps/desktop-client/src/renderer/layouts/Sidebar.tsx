import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Globe,
  Puzzle,
  UsersRound,
  Receipt,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '../store/auth-store.js';
import './Sidebar.css';

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Tổng quan' },
  { to: '/profiles', icon: Users, label: 'Profiles' },
  { to: '/proxies', icon: Globe, label: 'Proxy' },
  { to: '/extensions', icon: Puzzle, label: 'Extensions' },
  { to: '/workspace', icon: UsersRound, label: 'Workspace' },
  { to: '/billing', icon: Receipt, label: 'Gói dịch vụ' },
  { to: '/settings', icon: Settings, label: 'Cài đặt' },
];

export function Sidebar(): JSX.Element {
  const { clear } = useAuthStore();

  async function handleLogout(): Promise<void> {
    await window.desktop.auth.logout().catch(() => { });
    clear();
  }

  return (
    <aside className="sidebar">
      <nav className="sidebar__nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
            }
          >
            <item.icon className="sidebar__link-icon" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="sidebar__footer">
        <button
          onClick={() => void handleLogout()}
          className="sidebar__logout-button"
        >
          <LogOut className="sidebar__link-icon" />
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
