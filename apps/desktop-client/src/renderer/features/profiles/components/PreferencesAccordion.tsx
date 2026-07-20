import { Plus, Minus } from 'lucide-react';

interface Preferences {
  readonly syncBookmarks: boolean;
  readonly syncHistory: boolean;
  readonly syncTabs: boolean;
  readonly syncCookie: boolean;
  readonly syncExtensions: boolean;
  readonly syncPasswords: boolean;
  readonly syncIndexedDB: boolean;
  readonly syncLocalStorage: boolean;
  readonly syncSessionStorage: boolean;
  readonly clearCache: boolean;
  readonly clearCookies: boolean;
  readonly clearLocalStorage: boolean;
  readonly randomStartup: boolean;
  readonly savePassword: boolean;
  readonly stopNoNetwork: boolean;
  readonly stopIpChange: boolean;
  readonly stopCountryChange: boolean;
  readonly openDashboard: boolean;
  readonly ipReminder: boolean;
  readonly googleSignIn: boolean;
  readonly blacklist: string;
  readonly whitelist: string;
}

interface PreferencesAccordionProps {
  readonly expanded: boolean;
  readonly prefs: Preferences;
  readonly onToggle: () => void;
  readonly onUpdate: (patch: Partial<Preferences>) => void;
}

export function PreferencesAccordion({
  expanded,
  prefs,
  onToggle,
  onUpdate,
}: PreferencesAccordionProps): JSX.Element {
  const syncItems = [
    ['syncBookmarks', 'Bookmarks Sync'],
    ['syncHistory', 'History Sync'],
    ['syncTabs', 'Active Tabs Sync'],
    ['syncCookie', 'Cookies Sync'],
    ['syncExtensions', 'Extensions Sync'],
    ['syncPasswords', 'Passwords Sync'],
    ['syncIndexedDB', 'IndexedDB Sync'],
    ['syncLocalStorage', 'LocalStorage Sync'],
    ['syncSessionStorage', 'SessionStorage Sync'],
  ] as const;

  const cleanupItems = [
    ['clearCache', 'Clear Cache after closing'],
    ['clearCookies', 'Clear Cookies after closing'],
    ['clearLocalStorage', 'Clear LocalStorage after closing'],
  ] as const;

  const otherItems = [
    ['randomStartup', 'Random startup window position'],
    ['savePassword', 'Save Passwords in browser'],
    ['stopNoNetwork', 'Stop launching if no connection'],
    ['stopIpChange', 'Stop running if IP changes'],
    ['stopCountryChange', 'Stop running if Country changes'],
    ['openDashboard', 'Open Dashboard on launch'],
    ['ipReminder', 'IP Reminder on launch'],
    ['googleSignIn', 'Allow Google Sign-in'],
  ] as const;

  return (
    <section className="create-profile-accordion">
      <button
        type="button"
        className="create-profile-accordion__trigger"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className="create-profile-accordion__trigger-left">
          <span className="create-profile-accordion__icon">{expanded ? <Minus size={13} /> : <Plus size={13} />}</span>
          <span>Preferences & Browser Sync</span>
        </span>
      </button>
      {expanded && (
        <div className="create-profile-accordion__content">
          {/* Sync group */}
          <h3 className="create-profile-pref-group-title">Cloud Data Synchronization</h3>
          <div className="create-profile-preference-grid">
            {syncItems.map(([field, label]) => (
              <label className="create-profile-preference-item" key={field}>
                <input
                  type="checkbox"
                  checked={prefs[field]}
                  onChange={(e) => onUpdate({ [field]: e.target.checked })}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          {/* Cleanup group */}
          <h3 className="create-profile-pref-group-title" style={{ marginTop: 'var(--space-4)' }}>
            Data Cleanup Preferences
          </h3>
          <div className="create-profile-preference-grid">
            {cleanupItems.map(([field, label]) => (
              <label className="create-profile-preference-item" key={field}>
                <input
                  type="checkbox"
                  checked={prefs[field]}
                  onChange={(e) => onUpdate({ [field]: e.target.checked })}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          {/* Other options */}
          <h3 className="create-profile-pref-group-title" style={{ marginTop: 'var(--space-4)' }}>
            Safety & Window Controls
          </h3>
          <div className="create-profile-preference-grid">
            {otherItems.map(([field, label]) => (
              <label className="create-profile-preference-item" key={field}>
                <input
                  type="checkbox"
                  checked={prefs[field]}
                  onChange={(e) => onUpdate({ [field]: e.target.checked })}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          {/* Blacklist / Whitelist Textareas */}
          <div className="create-profile-fields" style={{ marginTop: 'var(--space-4)' }}>
            <div className="create-profile-row create-profile-row--textarea">
              <span className="create-profile-row-label">URL Access Blacklist</span>
              <div className="create-profile-row-control">
                <textarea
                  value={prefs.blacklist}
                  placeholder="One URL per line, add new lines for multiple"
                  onChange={(e) => onUpdate({ blacklist: e.target.value })}
                />
              </div>
            </div>
            <div className="create-profile-row create-profile-row--textarea">
              <span className="create-profile-row-label">URL Access Whitelist</span>
              <div className="create-profile-row-control">
                <textarea
                  value={prefs.whitelist}
                  placeholder="One URL per line, add new lines for multiple"
                  onChange={(e) => onUpdate({ whitelist: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
