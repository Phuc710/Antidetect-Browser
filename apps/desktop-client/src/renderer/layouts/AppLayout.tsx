import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { TitleBar } from './TitleBar.js';
import { StatusBar } from './StatusBar.js';
import './AppLayout.css';

export function AppLayout(): JSX.Element {
  return (
    <div className="app-layout">
      {/* Custom Titlebar */}
      <TitleBar />

      {/* Main layout */}
      <div className="app-layout__main">
        {/* Sidebar */}
        <Sidebar />

        {/* Page content */}
        <main className="app-layout__content">
          <Outlet />
        </main>
      </div>

      {/* Status bar */}
      <StatusBar />
    </div>
  );
}
