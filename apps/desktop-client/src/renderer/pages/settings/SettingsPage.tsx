import { useState, useEffect } from 'react';
import { RefreshCw, Copy, Check, Settings, Cpu } from 'lucide-react';
import './SettingsPage.css';

interface LocalApiConfig {
  enabled: boolean;
  port: number;
}

interface RequestLog {
  id: string;
  method: string;
  path: string;
  status: number;
  timestamp: string;
  error?: string;
}

export function SettingsPage(): JSX.Element {
  const [activeTab, setActiveTab] = useState<'general' | 'developer'>('developer');
  
  // Local API States
  const [config, setConfig] = useState<LocalApiConfig>({ enabled: false, port: 50325 });
  const [apiKey, setApiKey] = useState('••••••••••••••••••••••••••••••••');
  const [keyRotated, setKeyRotated] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const [scopes, setScopes] = useState<{ launch: boolean; read: boolean; write: boolean }>({
    launch: true,
    read: true,
    write: false,
  });

  const [requestLogs, setRequestLogs] = useState<RequestLog[]>([]);

  useEffect(() => {
    // Load config on component mount
    window.desktop.localApi.getConfig()
      .then((cfg) => {
        setConfig({ enabled: cfg.enabled, port: cfg.port });
        setScopes(cfg.scopes);
      })
      .catch(() => {});

    // Initial fetch of logs
    window.desktop.localApi.getLogs()
      .then((logs) => setRequestLogs(logs))
      .catch(() => {});

    // Poll logs every 3 seconds
    const interval = setInterval(() => {
      window.desktop.localApi.getLogs()
        .then((logs) => setRequestLogs(logs))
        .catch(() => {});
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  async function handleToggleEnabled() {
    const nextEnabled = !config.enabled;
    try {
      await window.desktop.localApi.setEnabled(nextEnabled);
      setConfig((prev) => ({ ...prev, enabled: nextEnabled }));
    } catch {
      alert('Không thể cập nhật trạng thái Local API.');
    }
  }

  async function handleRotateKey() {
    if (!window.confirm('Xoay API Key mới? Các script đang chạy sẽ mất kết nối cho đến khi cập nhật khóa mới.')) {
      return;
    }
    try {
      const newKey = await window.desktop.localApi.rotateKey();
      setApiKey(newKey);
      setKeyRotated(true);
    } catch {
      alert('Xoay API key thất bại.');
    }
  }

  function handleCopyKey() {
    navigator.clipboard.writeText(apiKey).then(() => {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    });
  }

  function handleCopyUrl() {
    navigator.clipboard.writeText(`http://127.0.0.1:${config.port}`).then(() => {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    });
  }

  async function handleToggleScope(scopeName: 'launch' | 'read' | 'write') {
    const nextScopes = { ...scopes, [scopeName]: !scopes[scopeName] };
    try {
      await window.desktop.localApi.setScopes(nextScopes);
      setScopes(nextScopes);
    } catch {
      alert('Không thể cập nhật quyền truy cập.');
    }
  }

  return (
    <div className="settings-page">
      <header className="settings-page__header">
        <h1 className="settings-page__title">Cài đặt hệ thống</h1>
      </header>

      <div className="settings-page__container">
        {/* Sidebar Tabs */}
        <aside className="settings-page__sidebar" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'general'}
            className={`settings-page__tab ${activeTab === 'general' ? 'settings-page__tab--active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <Settings size={16} />
            <span>Chung</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'developer'}
            className={`settings-page__tab ${activeTab === 'developer' ? 'settings-page__tab--active' : ''}`}
            onClick={() => setActiveTab('developer')}
          >
            <Cpu size={16} />
            <span>Developer / Local API</span>
          </button>
        </aside>

        {/* Content Panel */}
        <main className="settings-page__content">
          {activeTab === 'general' && (
            <section className="settings-panel">
              <h2 className="settings-panel__title">Cấu hình chung</h2>
              <p className="settings-panel__desc">Các cấu hình hệ thống cơ bản.</p>
              
              <div className="settings-panel__group">
                <label className="settings-panel__label">Khởi động cùng Windows</label>
                <div className="settings-panel__control">
                  <input type="checkbox" className="settings-panel__toggle" defaultChecked />
                </div>
              </div>
            </section>
          )}

          {activeTab === 'developer' && (
            <section className="settings-panel">
              <header className="settings-panel__header">
                <h2 className="settings-panel__title">Local API Automation</h2>
                <p className="settings-panel__desc">
                  Cho phép các công cụ tự động hóa bên ngoài (Selenium, Playwright) kết nối và điều khiển trình duyệt của bạn qua cổng HTTP Localhost.
                </p>
              </header>

              {/* Status Section */}
              <div className="settings-panel__group">
                <div className="settings-panel__info">
                  <div className="settings-panel__label">Trạng thái Local API Server</div>
                  <div className="settings-panel__sub">Bật để kích hoạt lắng nghe tại 127.0.0.1</div>
                </div>
                <div className="settings-panel__control">
                  <button
                    onClick={handleToggleEnabled}
                    className={`button ${config.enabled ? 'button--primary' : 'button--secondary'}`}
                  >
                    {config.enabled ? 'Đang bật' : 'Đang tắt'}
                  </button>
                </div>
              </div>

              {config.enabled && (
                <div className="settings-panel__status-banner">
                  <span className="status-indicator status-indicator--running">
                    <span className="status-indicator__dot" />
                    <span className="status-indicator__label">ONLINE — Lắng nghe tại cổng {config.port}</span>
                  </span>
                </div>
              )}

              {/* Address Field */}
              <div className="settings-panel__group">
                <div className="settings-panel__info">
                  <label htmlFor="settings-api-address" className="settings-panel__label">Địa chỉ API Endpoint</label>
                  <div className="settings-panel__sub font-mono">http://127.0.0.1:{config.port}</div>
                </div>
                <button id="settings-api-address" className="button button--secondary" onClick={handleCopyUrl}>
                  {copiedUrl ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedUrl ? 'Đã chép' : 'Sao chép'}</span>
                </button>
              </div>

              {/* API Key Rotation */}
              <div className="settings-panel__group">
                <div className="settings-panel__info">
                  <label htmlFor="settings-api-key" className="settings-panel__label">Khóa kết nối API Key</label>
                  <div className="settings-panel__sub">
                    <span className="font-mono text-muted">{apiKey}</span>
                  </div>
                  {keyRotated && (
                    <div className="settings-panel__alert" role="alert">
                      Hãy sao chép khóa ngay bây giờ. Khóa chỉ hiển thị đầy đủ một lần duy nhất vì lý do bảo mật.
                    </div>
                  )}
                </div>
                <div className="settings-panel__actions">
                  <button id="settings-api-key" className="button button--secondary" onClick={handleCopyKey} disabled={!keyRotated && apiKey.startsWith('•')}>
                    {copiedKey ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedKey ? 'Đã chép' : 'Sao chép'}</span>
                  </button>
                  <button className="button button--secondary" onClick={handleRotateKey}>
                    <RefreshCw size={14} />
                    <span>Xoay Khóa</span>
                  </button>
                </div>
              </div>

              {/* Security Scope Toggles */}
              <div className="settings-panel__group-box">
                <h3 className="settings-panel__box-title">Quyền truy cập (Access Scopes)</h3>
                
                <div className="settings-panel__box-row">
                  <span>Khởi chạy trình duyệt qua API</span>
                  <input
                    type="checkbox"
                    checked={scopes.launch}
                    onChange={() => handleToggleScope('launch')}
                    className="settings-panel__toggle"
                  />
                </div>
                
                <div className="settings-panel__box-row">
                  <span>Đọc dữ liệu Profile</span>
                  <input
                    type="checkbox"
                    checked={scopes.read}
                    onChange={() => handleToggleScope('read')}
                    className="settings-panel__toggle"
                  />
                </div>

                <div className="settings-panel__box-row">
                  <span>Sửa đổi Profile / Tạo mới</span>
                  <input
                    type="checkbox"
                    checked={scopes.write}
                    onChange={() => handleToggleScope('write')}
                    className="settings-panel__toggle"
                  />
                </div>
              </div>

              {/* Recent Request Logs */}
              <div className="settings-panel__group-box">
                <h3 className="settings-panel__box-title">Nhật ký yêu cầu gần đây</h3>
                {requestLogs.length === 0 ? (
                  <p className="settings-panel__desc">
                    Chưa có nhật ký yêu cầu HTTP nào. Dữ liệu giám sát nhật ký trực tiếp sẽ tự động xuất hiện khi có yêu cầu được gửi tới Local API.
                  </p>
                ) : (
                  <div className="settings-logs-table-wrap">
                    <table className="settings-logs-table">
                      <thead>
                        <tr>
                          <th>Thời gian</th>
                          <th>Phương thức</th>
                          <th>Đường dẫn</th>
                          <th>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {requestLogs.map((log) => (
                          <tr key={log.id}>
                            <td>{new Date(log.timestamp).toLocaleTimeString()}</td>
                            <td>
                              <span className={`method-badge method-badge--${log.method.toLowerCase()}`}>
                                {log.method}
                              </span>
                            </td>
                            <td className="font-mono">{log.path}</td>
                            <td>
                              <span className={`status-badge ${log.status >= 200 && log.status < 300 ? 'status-badge--success' : 'status-badge--error'}`}>
                                {log.status} {log.error ? `(${log.error})` : ''}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </section>
          )}
        </main>
      </div>
    </div>
  );
}
