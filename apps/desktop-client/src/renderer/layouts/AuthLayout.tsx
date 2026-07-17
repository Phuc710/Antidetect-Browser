import { Outlet } from 'react-router-dom';
import { TitleBar } from './TitleBar.js';
import './AuthLayout.css';

export function AuthLayout(): JSX.Element {
  return (
    <div className="auth-layout">
      {/* Custom Titlebar cho phép kéo thả và điều khiển cửa sổ trên màn hình Login/Register */}
      <TitleBar />
      <main className="auth-layout__content">
        <Outlet />
      </main>
    </div>
  );
}
