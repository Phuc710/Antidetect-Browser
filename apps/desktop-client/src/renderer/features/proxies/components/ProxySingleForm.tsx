import { Eye, EyeOff, Loader2, XCircle, CheckCircle, Clock } from 'lucide-react';
import type { ProxyProtocol, ProxyTestResult } from 'shared';
import type { FormState } from '../proxy-batch-model.js';

interface ProxySingleFormProps {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  recognitionText: string;
  onRecognitionChange(text: string): void;
  showPassword: boolean;
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
  validationError: string | null;
  serverError: string | null;
  testResult: ProxyTestResult | null;
  isTesting: boolean;
  isSaving: boolean;
  isEdit: boolean;
  onTest(): void;
  onCancel(): void;
  onSubmit(e: React.FormEvent): void;
}

export function ProxySingleForm({
  form,
  setForm,
  recognitionText,
  onRecognitionChange,
  showPassword,
  setShowPassword,
  validationError,
  serverError,
  testResult,
  isTesting,
  isSaving,
  isEdit,
  onTest,
  onCancel,
  onSubmit,
}: ProxySingleFormProps): JSX.Element {
  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <>
      <form className="proxy-dialog__body" onSubmit={onSubmit} noValidate>
        {/* Intelligent Recognition */}
        <div className="proxy-dialog__field">
          <label htmlFor="proxy-recognition" className="proxy-dialog__label">Nhận dạng thông minh (Hỗ trợ proxy Tĩnh/Xoay)</label>
          <textarea
            id="proxy-recognition"
            className="proxy-dialog__textarea font-mono"
            placeholder="Ví dụ: 192.168.0.1:8000:username:password[http://refresh-url.com]{Notes}"
            value={recognitionText}
            onChange={(e) => onRecognitionChange(e.target.value)}
            disabled={isSaving}
          />
        </div>

        {/* IP Type Selection */}
        <div className="proxy-dialog__field">
          <label className="proxy-dialog__label">Loại IP</label>
          <div className="proxy-dialog__ip-types">
            <label className="proxy-dialog__radio-label">
              <input
                type="radio"
                name="ipType"
                checked={form.ipType === 'ipv4'}
                onChange={() => setField('ipType', 'ipv4')}
                disabled={isSaving}
              />
              <span>IPv4</span>
            </label>
            <label className="proxy-dialog__radio-label">
              <input
                type="radio"
                name="ipType"
                checked={form.ipType === 'ipv6'}
                onChange={() => setField('ipType', 'ipv6')}
                disabled={isSaving}
              />
              <span>IPv6</span>
            </label>
          </div>
        </div>

        {/* Protocol + Host + Port row */}
        <div className="proxy-dialog__row">
          <div className="proxy-dialog__field proxy-dialog__field--protocol">
            <label htmlFor="proxy-form-protocol" className="proxy-dialog__label">Giao thức *</label>
            <div className="proxy-dialog__select-wrap">
              <select
                id="proxy-form-protocol"
                className="proxy-dialog__select"
                value={form.protocol}
                onChange={(e) => setField('protocol', e.target.value as ProxyProtocol)}
                disabled={isSaving}
              >
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
                <option value="socks5">SOCKS5</option>
              </select>
            </div>
          </div>

          <div className="proxy-dialog__field proxy-dialog__field--host">
            <label htmlFor="proxy-form-host" className="proxy-dialog__label">Host / IP *</label>
            <input
              id="proxy-form-host"
              type="text"
              className="proxy-dialog__input font-mono"
              placeholder="103.45.67.89"
              value={form.host}
              onChange={(e) => setField('host', e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="proxy-dialog__field proxy-dialog__field--port">
            <label htmlFor="proxy-form-port" className="proxy-dialog__label">Port *</label>
            <input
              id="proxy-form-port"
              type="text"
              inputMode="numeric"
              className="proxy-dialog__input font-mono"
              placeholder="1080"
              value={form.port}
              onChange={(e) => setField('port', e.target.value)}
              disabled={isSaving}
            />
          </div>
        </div>

        {/* Auth mode */}
        <div className="proxy-dialog__field">
          <label className="proxy-dialog__label">Xác thực</label>
          <div className="proxy-dialog__auth-tabs" role="radiogroup">
            <button
              type="button"
              role="radio"
              aria-checked={form.authMode === 'none'}
              className={`proxy-dialog__auth-tab ${form.authMode === 'none' ? 'proxy-dialog__auth-tab--active' : ''}`}
              onClick={() => setField('authMode', 'none')}
              disabled={isSaving}
            >
              Không yêu cầu
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={form.authMode === 'username_password'}
              className={`proxy-dialog__auth-tab ${form.authMode === 'username_password' ? 'proxy-dialog__auth-tab--active' : ''}`}
              onClick={() => setField('authMode', 'username_password')}
              disabled={isSaving}
            >
              Username &amp; Password
            </button>
          </div>
        </div>

        {/* Credential fields — chỉ hiện khi username_password */}
        {form.authMode === 'username_password' && (
          <div className="proxy-dialog__credentials">
            <div className="proxy-dialog__field">
              <label htmlFor="proxy-form-username" className="proxy-dialog__label">Username *</label>
              <input
                id="proxy-form-username"
                type="text"
                className="proxy-dialog__input"
                placeholder="proxy_user"
                value={form.username}
                onChange={(e) => setField('username', e.target.value)}
                disabled={isSaving}
                autoComplete="off"
              />
            </div>
            <div className="proxy-dialog__field">
              <label htmlFor="proxy-form-password" className="proxy-dialog__label">
                Mật khẩu {isEdit ? '(để trống = giữ nguyên)' : '*'}
              </label>
              <div className="proxy-dialog__password-wrap">
                <input
                  id="proxy-form-password"
                  type={showPassword ? 'text' : 'password'}
                  className="proxy-dialog__input proxy-dialog__input--password"
                  placeholder={isEdit ? '(Giữ nguyên credential hiện tại)' : 'Mật khẩu'}
                  value={form.password}
                  onChange={(e) => setField('password', e.target.value)}
                  disabled={isSaving}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="proxy-dialog__reveal"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  disabled={isSaving}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Refresh URL */}
        <div className="proxy-dialog__field">
          <label htmlFor="proxy-refresh-url" className="proxy-dialog__label">URL làm mới</label>
          <input
            id="proxy-refresh-url"
            type="text"
            className="proxy-dialog__input font-mono"
            placeholder="Nhập URL để xoay IP (nếu có)"
            value={form.refreshUrl}
            onChange={(e) => setField('refreshUrl', e.target.value)}
            disabled={isSaving}
          />
        </div>

        {/* IP Detection & Notes Row */}
        <div className="proxy-dialog__row">
          <div className="proxy-dialog__field proxy-dialog__field--detection">
            <label htmlFor="proxy-detection" className="proxy-dialog__label">Kiểm tra IP</label>
            <div className="proxy-dialog__select-wrap">
              <select id="proxy-detection" className="proxy-dialog__select" disabled={isSaving}>
                <option>IPRust.io</option>
                <option>IP2Location</option>
              </select>
            </div>
          </div>
          <div className="proxy-dialog__field proxy-dialog__field--notes">
            <label htmlFor="proxy-notes" className="proxy-dialog__label">Ghi chú</label>
            <input
              id="proxy-notes"
              type="text"
              className="proxy-dialog__input"
              placeholder="Ghi chú proxy"
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              disabled={isSaving}
            />
          </div>
        </div>

        {/* Errors */}
        {(validationError ?? serverError) && (
          <div className="proxy-dialog__error" role="alert">
            <XCircle size={14} />
            <span>{validationError ?? serverError}</span>
          </div>
        )}

        {/* Test result panel */}
        {testResult && <TestResultPanel result={testResult} />}
      </form>

      {/* Footer actions */}
      <footer className="proxy-dialog__footer">
        <button
          type="button"
          className="button button--secondary"
          onClick={onTest}
          disabled={isSaving || isTesting}
        >
          {isTesting ? <Loader2 size={14} className="proxy-dialog__spin" /> : null}
          <span>{isTesting ? 'Đang kiểm tra...' : 'Test kết nối'}</span>
        </button>
        <div className="proxy-dialog__footer-right">
          <button
            type="button"
            className="button button--secondary"
            onClick={onCancel}
            disabled={isSaving}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="button button--primary"
            onClick={onSubmit}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 size={14} className="proxy-dialog__spin" /> : null}
            <span>{isSaving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Lưu Proxy'}</span>
          </button>
        </div>
      </footer>
    </>
  );
}

function TestResultPanel({ result }: { result: ProxyTestResult }): JSX.Element {
  const isOnline = result.status === 'online';
  return (
    <div className={`proxy-test-result ${isOnline ? 'proxy-test-result--online' : 'proxy-test-result--error'}`}>
      <div className="proxy-test-result__status">
        {isOnline
          ? <CheckCircle size={14} className="proxy-test-result__icon proxy-test-result__icon--ok" />
          : <XCircle size={14} className="proxy-test-result__icon proxy-test-result__icon--fail" />
        }
        <span className="proxy-test-result__label">
          {STATUS_LABEL[result.status] ?? result.status}
        </span>
      </div>
      {isOnline && (
        <dl className="proxy-test-result__details">
          {result.publicIp && (
            <><dt>IP</dt><dd className="font-mono">{result.publicIp}</dd></>
          )}
          {result.city && result.countryCode && (
            <><dt>Vị trí</dt><dd>{result.city}, {result.countryCode.toUpperCase()}</dd></>
          )}
          {result.timezone && (
            <><dt>Timezone</dt><dd>{result.timezone}</dd></>
          )}
          {result.latencyMs != null && (
            <><dt><Clock size={11} /></dt><dd className={result.latencyMs < 200 ? 'proxy-test-result__latency--fast' : 'proxy-test-result__latency--slow'}>{result.latencyMs} ms</dd></>
          )}
        </dl>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  online: 'Kết nối thành công',
  offline: 'Không kết nối được',
  timeout: 'Quá thời gian chờ (15s)',
  authentication_error: 'Sai thông tin đăng nhập',
  configuration_error: 'Cấu hình không hợp lệ',
};
