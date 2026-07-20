import { Outlet } from 'react-router-dom';
import { Bell, ChevronDown, Inbox, MapPin, Upload, User, Key, Sliders, Wifi, Monitor, Lock, Languages, Contrast, LogOut, ChevronRight } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Sidebar } from './Sidebar.js';
import { TitleBar } from './TitleBar.js';
import { useAuthStore } from '../store/auth-store.js';
import { authService } from '../services/auth-service.js';
import { useTheme } from '../store/theme-store.js';
import './AppLayout.css';

function WorkspaceTopbar(): JSX.Element {
  const { user, clear } = useAuthStore();
  const { mode, setThemeMode } = useTheme();

  const teamName = user?.name ? `${user.name}'s Team` : "athanhphuc7102005's Team";
  const avatarInitials = user?.name 
    ? user.name.slice(0, 2).toUpperCase() 
    : 'AT';

  async function handleLogout() {
    try {
      await authService.logout();
    } finally {
      clear();
    }
  }

  return (
    <div className="workspace-topbar">
      <div className="workspace-topbar__spacer" />
      <div className="workspace-topbar__actions">
        <button type="button" className="workspace-topbar__location">
          <MapPin size={15} />
          <span>VN/Can Duoc</span>
          <small>(14.191.220.68)</small>
        </button>
        <button type="button" className="workspace-topbar__icon-btn workspace-topbar__icon-btn--badge" title="Upload">
          <Upload size={16} />
          <span>1</span>
        </button>
        <button type="button" className="workspace-topbar__icon-btn" title="Notifications">
          <Bell size={16} />
        </button>
        <button type="button" className="workspace-topbar__icon-btn" title="Messages">
          <Inbox size={16} />
        </button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" className="workspace-topbar__team">
              <span className="workspace-topbar__avatar">{avatarInitials}</span>
              <span>{teamName}</span>
              <ChevronDown size={14} />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content className="topbar-menu" sideOffset={6} align="end">
              <DropdownMenu.Item className="topbar-menu__item">
                <User size={14} />
                <span>Profile</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item className="topbar-menu__item">
                <Key size={14} />
                <span>Security</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item className="topbar-menu__item">
                <Sliders size={14} />
                <span>Preferences</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item className="topbar-menu__item">
                <Wifi size={14} />
                <span>Network</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item className="topbar-menu__item">
                <Monitor size={14} />
                <span>Login History</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item className="topbar-menu__item">
                <Lock size={14} />
                <span>Set lock password</span>
              </DropdownMenu.Item>

              <DropdownMenu.Separator className="topbar-menu__separator" />

              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger className="topbar-menu__item">
                  <Languages size={14} />
                  <span>Language</span>
                  <ChevronRight size={14} className="topbar-menu__chevron" />
                </DropdownMenu.SubTrigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.SubContent className="topbar-menu" sideOffset={2} alignOffset={-5}>
                    <DropdownMenu.Item className="topbar-menu__item">
                      <span>Tiếng Việt</span>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item className="topbar-menu__item">
                      <span>English</span>
                    </DropdownMenu.Item>
                  </DropdownMenu.SubContent>
                </DropdownMenu.Portal>
              </DropdownMenu.Sub>

              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger className="topbar-menu__item">
                  <Contrast size={14} />
                  <span>Theme Mode</span>
                  <ChevronRight size={14} className="topbar-menu__chevron" />
                </DropdownMenu.SubTrigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.SubContent className="topbar-menu" sideOffset={2} alignOffset={-5}>
                    <DropdownMenu.Item 
                      className={`topbar-menu__item${mode === 'light' ? ' topbar-menu__item--active' : ''}`}
                      onSelect={() => setThemeMode('light')}
                    >
                      <span>Sáng (Light)</span>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item 
                      className={`topbar-menu__item${mode === 'dark' ? ' topbar-menu__item--active' : ''}`}
                      onSelect={() => setThemeMode('dark')}
                    >
                      <span>Tối (Dark)</span>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item 
                      className={`topbar-menu__item${mode === 'system' ? ' topbar-menu__item--active' : ''}`}
                      onSelect={() => setThemeMode('system')}
                    >
                      <span>Hệ thống (System)</span>
                    </DropdownMenu.Item>
                  </DropdownMenu.SubContent>
                </DropdownMenu.Portal>
              </DropdownMenu.Sub>

              <DropdownMenu.Separator className="topbar-menu__separator" />

              <DropdownMenu.Item className="topbar-menu__item topbar-menu__item--logout" onSelect={handleLogout}>
                <LogOut size={14} />
                <span>Logout</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}

export function AppLayout(): JSX.Element {
  return (
    <div className="app-layout">
      <TitleBar />

      <div className="app-layout__main">
        <Sidebar />

        <div className="app-layout__workspace">
          <WorkspaceTopbar />
          <main className="app-layout__content">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
