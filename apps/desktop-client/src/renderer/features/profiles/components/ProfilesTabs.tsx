import React from 'react';
import { Share2, Trash2, Settings, Tag } from 'lucide-react';
import type { TabType } from '../types.js';
import { Tooltip } from '../../../components/ui/Tooltip/index.js';
import { profileTabConfigs } from '../config/profileTabConfigs.js';

interface ProfilesTabsProps {
  readonly activeTab: TabType;
  readonly tabCounts: Record<TabType, number>;
  readonly onTabChange: (tab: TabType) => void;
  readonly onOpenTagManager: () => void;
}

export function ProfilesTabs({
  activeTab,
  tabCounts,
  onTabChange,
  onOpenTagManager,
}: ProfilesTabsProps): JSX.Element {
  const getTabIcon = (tabId: TabType): React.ReactNode => {
    if (tabId === 'transferring') {
      return <Share2 size={14} strokeWidth={1.75} />;
    }
    if (tabId === 'trash') {
      return <Trash2 size={14} strokeWidth={1.75} />;
    }
    return null;
  };

  const tabsList = Object.keys(profileTabConfigs) as TabType[];

  return (
    <nav className="ptabs" aria-label="Profile tabs">
      <div className="ptabs__list">
        {tabsList.map((tabId) => {
          const config = profileTabConfigs[tabId];
          const count = tabCounts[tabId];
          const icon = getTabIcon(tabId);

          return (
            <button
              key={tabId}
              type="button"
              className={`ptabs__tab ${activeTab === tabId ? 'ptabs__tab--active' : ''}`}
              onClick={() => onTabChange(tabId)}
            >
              {icon && <span className="ptabs__tab-icon">{icon}</span>}
              {config.label}
              {count > 0 && <span className="ptabs__tab-count">{count}</span>}
            </button>
          );
        })}
      </div>
      <div className="ptabs__utils">
        <Tooltip content="Column settings" variant="compact">
          <button type="button" className="ptabs__util-btn" aria-label="Column settings">
            <Settings size={16} strokeWidth={1.75} />
          </button>
        </Tooltip>
        <div className="ptabs__divider-vertical" />
        <Tooltip content="Tag Management" variant="compact">
          <button
            type="button"
            className="ptabs__util-btn ptabs__util-btn--active"
            aria-label="Tag Management"
            onClick={onOpenTagManager}
          >
            <Tag size={16} strokeWidth={1.75} />
          </button>
        </Tooltip>
      </div>
    </nav>
  );
}
