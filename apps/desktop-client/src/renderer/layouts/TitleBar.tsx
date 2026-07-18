import { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  Minus,
  Square,
  X,
  User as UserIcon,
  Sun,
  Moon,
  Monitor,
  ChevronDown,
  Palette,
} from 'lucide-react';
import { useAuthStore } from '../store/auth-store.js';
import { useTheme } from '../store/theme-store.js';
import { LanguageSelector } from '../components/LanguageSelector/LanguageSelector.js';
import './TitleBar.css';

export function TitleBar(): JSX.Element {
  const { user } = useAuthStore();
  const { mode, resolvedTheme, setThemeMode } = useTheme();
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown khi click bên ngoài
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setThemeMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="title-bar">
      {/* Left: Logo + app name */}
      <div className="title-bar__logo">
        <ShieldCheck className="title-bar__logo-icon" />
        <span className="title-bar__logo-text">Antidetect Browser</span>
      </div>

      {/* Center: User Account, Language & Theme Dropdown */}
      <div className="title-bar__user-section" ref={menuRef}>
        {user && (
          <div className="title-bar__user-info">
            <span className="title-bar__user-avatar">
              <UserIcon />
            </span>
            <span>{user.name || user.email}</span>
          </div>
        )}

        <LanguageSelector />

        {/* Nút đổi Giao diện (Themes) */}
        <button
          type="button"
          className="title-bar__user-trigger"
          onClick={() => setThemeMenuOpen((prev) => !prev)}
          title="Đổi giao diện Sáng / Tối"
          aria-expanded={themeMenuOpen}
        >
          {resolvedTheme === 'light' ? <Sun size={15} /> : <Moon size={15} />}
          <span className="title-bar__mode-label">{mode}</span>
          <ChevronDown size={13} />
        </button>

        {themeMenuOpen && (
          <div className="title-bar__menu" role="menu">
            <div className="title-bar__menu-header">
              <Palette size={14} /> Chế độ giao diện
            </div>

            <button
              type="button"
              className={`title-bar__submenu-item ${mode === 'system' ? 'title-bar__submenu-item--active' : ''}`}
              onClick={() => {
                setThemeMode('system');
                setThemeMenuOpen(false);
              }}
            >
              <Monitor size={14} /> System (Hệ thống)
            </button>
            <button
              type="button"
              className={`title-bar__submenu-item ${mode === 'light' ? 'title-bar__submenu-item--active' : ''}`}
              onClick={() => {
                setThemeMode('light');
                setThemeMenuOpen(false);
              }}
            >
              <Sun size={14} /> Light (Giao diện sáng)
            </button>
            <button
              type="button"
              className={`title-bar__submenu-item ${mode === 'dark' ? 'title-bar__submenu-item--active' : ''}`}
              onClick={() => {
                setThemeMode('dark');
                setThemeMenuOpen(false);
              }}
            >
              <Moon size={14} /> Dark (Giao diện tối)
            </button>
          </div>
        )}
      </div>

      {/* Right: Window controls */}
      <div className="title-bar__controls">
        <button
          className="icon-button"
          aria-label="Thu nhỏ"
          onClick={() => {
            window.desktop.window.minimize().catch(() => { });
          }}
        >
          <Minus className="icon-button__icon" />
        </button>
        <button
          className="icon-button"
          aria-label="Phóng to"
          onClick={() => {
            window.desktop.window.maximize().catch(() => { });
          }}
        >
          <Square className="icon-button__icon--small" />
        </button>
        <button
          className="icon-button icon-button--danger"
          aria-label="Đóng"
          onClick={() => {
            window.desktop.window.close().catch(() => { });
          }}
        >
          <X className="icon-button__icon" />
        </button>
      </div>
    </div>
  );
}
