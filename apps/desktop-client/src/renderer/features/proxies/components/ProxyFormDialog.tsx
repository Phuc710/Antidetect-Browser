import { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { ProxyView, CreateProxyInput, UpdateProxyInput, ProxyTestResult, ProxyProtocol, ProxyAuthMode } from 'shared';
import { useCreateProxy, useUpdateProxy, useTestProxy } from '../hooks/proxy-hooks.js';
import { randomUUID } from '../utils/uuid.js';
import './ProxyFormDialog.css';

interface ProxyFormDialogProps {
  open: boolean;
  editTarget?: ProxyView | undefined; // undefined = Create mode
  onClose(): void;
  onSaved(proxy: ProxyView): void;
}

interface FormState {
  name: string;
  protocol: ProxyProtocol;
  host: string;
  port: string;
  authMode: ProxyAuthMode;
  username: string;
  password: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  protocol: 'http',
  host: '',
  port: '',
  authMode: 'none',
  username: '',
  password: '',
};

export function ProxyFormDialog({ open, editTarget, onClose, onSaved }: ProxyFormDialogProps): JSX.Element | null {
  const isEdit = Boolean(editTarget);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<ProxyTestResult | null>(null);
  const [currentTestId, setCurrentTestId] = useState<string | null>(null);

  const { create, loading: creating, error: createError, clearError: clearCreateError } = useCreateProxy(onSaved);
  const { update, loading: updating, error: updateError, clearError: clearUpdateError } = useUpdateProxy(onSaved);
  const { testDraft, testingIds } = useTestProxy();

  const isTesting = currentTestId ? testingIds.has(currentTestId) : false;
  const isSaving = creating || updating;

  // Populate form khi edit mode
  useEffect(() => {
    if (open && editTarget) {
      setForm({
        name: editTarget.name,
        protocol: editTarget.protocol,
        host: editTarget.host,
        port: String(editTarget.port),
        authMode: editTarget.authMode,
        username: editTarget.usernameMasked ? '' : '', // Luôn trống — xem EditProxy rule
        password: '', // KHÔNG pre-fill password — bảo mật
      });
    } else if (open && !editTarget) {
      setForm(EMPTY_FORM);
    }
    setTestResult(null);
    setValidationError(null);
    setShowPassword(false);
  }, [open, editTarget]);

  function handleClose() {
    if (isSaving) return;
    onClose();
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setValidationError(null);
    clearCreateError();
    clearUpdateError();
    setTestResult(null);
  }

  function validate(): boolean {
    if (!form.name.trim()) {
      setValidationError('Tên proxy không được để trống.');
      return false;
    }
    if (!form.host.trim()) {
      setValidationError('Host không được để trống.');
      return false;
    }
    const port = parseInt(form.port);
    if (isNaN(port) || port < 1 || port > 65535) {
      setValidationError('Port phải là số nguyên từ 1 đến 65535.');
      return false;
    }
    if (form.authMode === 'username_password' && !form.username.trim()) {
      setValidationError('Username không được để trống khi dùng xác thực username/password.');
      return false;
    }
    return true;
  }

  async function handleTest() {
    if (!validate()) return;
    const testId = randomUUID();
    setCurrentTestId(testId);
    setTestResult(null);
    try {
      const result = await testDraft({
        testId,
        protocol: form.protocol,
        host: form.host.trim(),
        port: parseInt(form.port),
        authMode: form.authMode,
        username: form.authMode === 'username_password' ? form.username.trim() : undefined,
        password: form.authMode === 'username_password' ? form.password : undefined,
      });
      setTestResult(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Test thất bại.';
      setValidationError(message);
    } finally {
      setCurrentTestId(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const port = parseInt(form.port);

    if (isEdit && editTarget) {
      const input: UpdateProxyInput = {
        proxyId: editTarget.id,
        name: form.name.trim(),
        protocol: form.protocol,
        host: form.host.trim(),
        port,
        authMode: form.authMode,
        username: form.authMode === 'username_password' ? form.username.trim() : undefined,
        // password undefined = giữ cũ; '' = người dùng bỏ trống → không thay đổi
        password: form.password ? form.password : undefined,
      };
      await update(input);
    } else {
      const input: CreateProxyInput = {
        name: form.name.trim(),
        protocol: form.protocol,
        host: form.host.trim(),
        port,
        authMode: form.authMode,
        username: form.authMode === 'username_password' ? form.username.trim() : undefined,
        password: form.authMode === 'username_password' ? form.password : undefined,
      };
      await create(input);
    }
  }

  if (!open) return null;

  const serverError = createError ?? updateError;

  return (
    <div className="proxy-dialog__backdrop" onClick={handleClose} role="dialog" aria-modal="true" aria-label={isEdit ? 'Chỉnh sửa Proxy' : 'Thêm Proxy mới'}>
      <div className="proxy-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="proxy-dialog__header">
          <h2 className="proxy-dialog__title">{isEdit ? 'Chỉnh sửa Proxy' : 'Thêm Proxy mới'}</h2>
          <button className="proxy-dialog__close" onClick={handleClose} aria-label="Đóng" disabled={isSaving}>
            <X size={16} />
          </button>
        </header>

        {/* Form */}
        <form className="proxy-dialog__body" onSubmit={handleSubmit} noValidate>
          {/* Name */}
          <div className="proxy-dialog__field">
            <label htmlFor="proxy-form-name" className="proxy-dialog__label">Tên proxy *</label>
            <input
              id="proxy-form-name"
              type="text"
              className="proxy-dialog__input"
              placeholder="Vietnam Residential 01"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              autoFocus
              disabled={isSaving}
            />
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
                  Password {isEdit ? '(để trống = giữ nguyên)' : '*'}
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
            onClick={handleTest}
            disabled={isSaving || isTesting}
          >
            {isTesting ? <Loader2 size={14} className="proxy-dialog__spin" /> : null}
            <span>{isTesting ? 'Đang kiểm tra...' : 'Test kết nối'}</span>
          </button>
          <div className="proxy-dialog__footer-right">
            <button
              type="button"
              className="button button--secondary"
              onClick={handleClose}
              disabled={isSaving}
            >
              Hủy
            </button>
            <button
              type="submit"
              form=""
              className="button button--primary"
              onClick={handleSubmit}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 size={14} className="proxy-dialog__spin" /> : null}
              <span>{isSaving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Lưu Proxy'}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
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
