import { NavLink, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Bot,
  Boxes,
  ChevronRight,
  CreditCard,
  Flame,
  Gift,
  Globe2,
  Layers3,
  Network,
  Plus,
  RefreshCw,
  Store,
  UserSquare2,
  Users,
} from 'lucide-react';
import './Sidebar.css';

interface SidebarLink {
  readonly to: string;
  readonly label: string;
  readonly icon: JSX.Element;
  readonly accent?: boolean;
  readonly trailing?: JSX.Element;
}

function NavItem({ item }: { item: SidebarLink }): JSX.Element {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''} ${item.accent ? 'sidebar__link--accent' : ''}`}
    >
      {item.icon}
      <span>{item.label}</span>
      {item.trailing}
    </NavLink>
  );
}

export function Sidebar(): JSX.Element {
  const navigate = useNavigate();
  const primaryLinks: readonly SidebarLink[] = [
    { to: '/profiles', label: 'Profiles', icon: <UserSquare2 className="sidebar__link-icon" /> },
    { to: '/projects', label: 'Projects', icon: <Layers3 className="sidebar__link-icon" /> },
  ];
  const toolLinks: readonly SidebarLink[] = [
    { to: '/proxies', label: 'Proxies', icon: <Globe2 className="sidebar__link-icon" />, trailing: <Flame className="sidebar__hot-icon" /> },
    { to: '/accounts', label: 'Accounts', icon: <UserSquare2 className="sidebar__link-icon" /> },
    { to: '/extensions', label: 'Extensions', icon: <Boxes className="sidebar__link-icon" /> },
  ];
  const automationLinks: readonly SidebarLink[] = [
    { to: '/roxyclaw', label: 'RoxyClaw', icon: <Bot className="sidebar__link-icon" /> },
    { to: '/skills', label: 'AI Skills Hub', icon: <Store className="sidebar__link-icon" />, accent: true },
    { to: '/synchronizer', label: 'Synchronizer', icon: <RefreshCw className="sidebar__link-icon" /> },
    { to: '/api', label: 'API & AI MCP', icon: <Network className="sidebar__link-icon" /> },
  ];
  const teamworkLinks: readonly SidebarLink[] = [
    { to: '/settings', label: 'Team Management', icon: <Users className="sidebar__link-icon" /> },
    { to: '/billing', label: 'Billing Center', icon: <CreditCard className="sidebar__link-icon" /> },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <button type="button" className="sidebar__brand-container" onClick={() => navigate('/profiles')}>
          <span className="sidebar__logo" />
          <span className="sidebar__brand">RoxyBrowser</span>
        </button>
        <button type="button" className="sidebar__create-btn" onClick={() => navigate('/profiles/create')}>
          <Plus size={16} />
          <span>Create Profile</span>
        </button>
      </div>

      <nav className="sidebar__nav">
        <div className="sidebar__nav-group">
          {primaryLinks.map((item) => <NavItem item={item} key={item.to} />)}
        </div>

        <div className="sidebar__nav-group">
          <span className="sidebar__group-label">Tools</span>
          {toolLinks.map((item) => <NavItem item={item} key={item.to} />)}
        </div>

        <div className="sidebar__nav-group">
          <span className="sidebar__group-label">Automation</span>
          {automationLinks.map((item) => <NavItem item={item} key={item.to} />)}
        </div>

        <div className="sidebar__nav-group">
          <span className="sidebar__group-label">Teamwork</span>
          {teamworkLinks.map((item) => <NavItem item={item} key={item.to} />)}
        </div>
      </nav>

      <div className="sidebar__footer">
        <button type="button" className="sidebar__footer-link">
          <BookOpen size={16} />
          <span>Tutorial</span>
          <span className="sidebar__toggle" />
        </button>
        <button type="button" className="sidebar__footer-link">
          <Gift size={16} />
          <span>Referral Program</span>
        </button>
        <div className="sidebar__usage-card">
          <div className="sidebar__usage-header">
            <span className="sidebar__usage-plan">Free</span>
            <button type="button" className="sidebar__upgrade-btn">
              <span>Upgrade</span>
              <ChevronRight size={13} />
            </button>
          </div>
          <div className="sidebar__progress-row">
            <span className="sidebar__progress-bar is-filled" />
            <span className="sidebar__progress-bar" />
            <span className="sidebar__progress-bar" />
          </div>
          <div className="sidebar__usage-count">
            <span>Profile usage</span>
            <span>1 / 5</span>
          </div>
          <button type="button" className="sidebar__trial-button">
            <Gift size={13} />
            <span>5-day free trial</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
