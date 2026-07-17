import { ShieldCheck, Minus, Square, X } from 'lucide-react';
import { useAuthStore } from '../store/auth-store.js';
import './TitleBar.css';

export function TitleBar(): JSX.Element {
  const { user } = useAuthStore();

  return (
    <div className="title-bar">
      {/* Left: Logo + app name */}
      <div className="title-bar__logo">
        <ShieldCheck className="title-bar__logo-icon" />
        <span className="title-bar__logo-text">Antidetect Browser</span>
      </div>

      {/* Center: User info */}
      {user && (
        <div className="title-bar__user">
          {user.email}
        </div>
      )}

      {/* Right: Window controls */}
      <div className="title-bar__controls">
        <button
          className="icon-button"
          aria-label="Thu nhỏ"
          onClick={() => {
            window.desktop.window.minimize().catch(() => {});
          }}
        >
          <Minus className="icon-button__icon" />
        </button>
        <button
          className="icon-button"
          aria-label="Phóng to"
          onClick={() => {
            window.desktop.window.maximize().catch(() => {});
          }}
        >
          <Square className="icon-button__icon--small" />
        </button>
        <button
          className="icon-button icon-button--danger"
          aria-label="Đóng"
          onClick={() => {
            window.desktop.window.close().catch(() => {});
          }}
        >
          <X className="icon-button__icon" />
        </button>
      </div>
    </div>
  );
}
