import { Outlet } from 'react-router-dom';
import { Bell, ChevronDown, Inbox, MapPin, Upload } from 'lucide-react';
import { Sidebar } from './Sidebar.js';
import { TitleBar } from './TitleBar.js';
import './AppLayout.css';

function WorkspaceTopbar(): JSX.Element {
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
        <button type="button" className="workspace-topbar__team">
          <span className="workspace-topbar__avatar">AT</span>
          <span>athanhphuc7102005's Team</span>
          <ChevronDown size={14} />
        </button>
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
