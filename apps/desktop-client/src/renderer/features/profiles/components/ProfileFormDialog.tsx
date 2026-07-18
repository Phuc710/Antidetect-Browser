import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import type {
  ProfileView,
  CreateProfileInput,
  UpdateProfileInput,
  BrowserEngine,
  BrowserDistribution,
  BrowserChannel,
} from 'shared';
import type { ProxyView } from 'shared';
import { useCreateProfile, useUpdateProfile } from '../../../hooks/useProfiles.js';
import './ProfileFormDialog.css';

interface ProfileFormDialogProps {
  open: boolean;
  editTarget?: ProfileView | undefined; // undefined = Create mode
  onClose(): void;
  onSaved(profile: ProfileView): void;
}

interface FormState {
  name: string;
  os: 'windows' | 'mac' | 'linux';
  engine: BrowserEngine;
  distribution: BrowserDistribution;
  channel: BrowserChannel;
  version: string;
  proxyId: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  os: 'windows',
  engine: 'chromium',
  distribution: 'chromium',
  channel: 'stable',
  version: '149.x',
  proxyId: '',
  notes: '',
};

export function ProfileFormDialog({ open, editTarget, onClose, onSaved }: ProfileFormDialogProps): JSX.Element | null {
  const isEdit = Boolean(editTarget);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [proxies, setProxies] = useState<ProxyView[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { create, loading: creating, error: createError } = useCreateProfile(onSaved);
  const { update, loading: updating, error: updateError } = useUpdateProfile(onSaved);

  const isSaving = creating || updating;

  useEffect(() => {
    if (open) {
      window.desktop.proxy.list({ limit: 100, offset: 0 })
        .then((res) => setProxies(res.items))
        .catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (open && editTarget) {
      setForm({
        name: editTarget.name,
        os: editTarget.os,
        engine: editTarget.engine ?? 'chromium',
        distribution: editTarget.distribution ?? 'chromium',
        channel: editTarget.channel ?? 'stable',
        version: editTarget.browserVersion ?? '149.x',
        proxyId: editTarget.proxyId || '',
        notes: editTarget.notes || '',
      });
    } else if (open && !editTarget) {
      setForm(EMPTY_FORM);
    }
    setValidationError(null);
  }, [open, editTarget]);

  function handleClose() {
    if (isSaving) return;
    onClose();
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setValidationError(null);
  }

  function validate(): boolean {
    if (!form.name.trim()) {
      setValidationError('Tên profile không được để trống.');
      return false;
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    if (isEdit && editTarget) {
      const input: UpdateProfileInput = {
        profileId: editTarget.id,
        name: form.name.trim(),
        proxyId: form.proxyId || null,
        notes: form.notes.trim() || undefined,
        expectedVersion: editTarget.version,
      };
      await update(input);
    } else {
      const input: CreateProfileInput = {
        name: form.name.trim(),
        os: form.os,
        engine: form.engine,
        distribution: form.distribution,
        channel: form.channel,
        browserVersion: form.version,
        proxyId: form.proxyId || undefined,
        notes: form.notes.trim() || undefined,
      };
      await create(input);
    }
  }

  if (!open) return null;

  const serverError = createError || updateError;

  return (
    <div className="profile-dialog__backdrop" onClick={handleClose} role="dialog" aria-modal="true" aria-label={isEdit ? 'Chỉnh sửa Profile' : 'Thêm Profile mới'}>
      <div className="profile-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="profile-dialog__header">
          <h2 className="profile-dialog__title">{isEdit ? 'Chỉnh sửa Profile' : 'Tạo Profile mới'}</h2>
          <button className="profile-dialog__close" onClick={handleClose} aria-label="Đóng" disabled={isSaving}>
            <X size={16} />
          </button>
        </header>

        {/* Form Body */}
        <form className="profile-dialog__body" onSubmit={handleSubmit} noValidate>
          {/* Name */}
          <div className="profile-dialog__field">
            <label htmlFor="profile-form-name" className="profile-dialog__label">Tên Profile *</label>
            <input
              id="profile-form-name"
              type="text"
              className="profile-dialog__input"
              placeholder="Ví dụ: Profile Nuôi Clone FB 01"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              autoFocus
              disabled={isSaving}
            />
          </div>

          {/* OS + Family */}
          <div className="profile-dialog__row">
            <div className="profile-dialog__field">
              <label htmlFor="profile-form-os" className="profile-dialog__label">Hệ điều hành</label>
              <div className="profile-dialog__select-wrap">
                <select
                  id="profile-form-os"
                  className="profile-dialog__select"
                  value={form.os}
                  onChange={(e) => setField('os', e.target.value as any)}
                  disabled={isSaving || isEdit}
                >
                  <option value="windows">Windows (Stealth)</option>
                  <option value="mac">macOS (Stealth)</option>
                  <option value="linux">Linux (Stealth)</option>
                </select>
              </div>
            </div>

            {/* Browser Family */}
            <div className="profile-dialog__field">
              <label className="profile-dialog__label">Browser family</label>
              <div className="profile-dialog__radios">
                <label className="profile-dialog__radio-item">
                  <input
                    type="radio"
                    name="browser-family"
                    value="chromium"
                    checked={form.engine === 'chromium'}
                    onChange={() => {
                      setField('engine', 'chromium');
                      setField('distribution', 'chromium');
                    }}
                    disabled={isSaving || isEdit}
                  />
                  Chromium
                </label>
                <label className="profile-dialog__radio-item">
                  <input
                    type="radio"
                    name="browser-family"
                    value="firefox"
                    checked={form.engine === 'firefox'}
                    onChange={() => {
                      setField('engine', 'firefox');
                      setField('distribution', 'firefox');
                    }}
                    disabled={isSaving || isEdit}
                  />
                  Firefox
                </label>
                <label className="profile-dialog__radio-item profile-dialog__radio-item--disabled">
                  <input type="radio" name="browser-family" disabled />
                  WebKit — Not available
                </label>
              </div>
            </div>
          </div>

          {/* Browser Distribution, Channel & Version */}
          <div className="profile-dialog__row">
            <div className="profile-dialog__field">
              <label htmlFor="profile-form-dist" className="profile-dialog__label">Browser distribution</label>
              <div className="profile-dialog__select-wrap">
                <select
                  id="profile-form-dist"
                  className="profile-dialog__select"
                  value={form.distribution}
                  onChange={(e) => setField('distribution', e.target.value as any)}
                  disabled={isSaving || isEdit}
                >
                  {form.engine === 'chromium' ? (
                    <>
                      <option value="chromium">Managed Chromium</option>
                      <option value="chrome">Google Chrome</option>
                      <option value="edge">Microsoft Edge</option>
                      <option value="brave">Brave Browser</option>
                    </>
                  ) : (
                    <option value="firefox">Mozilla Firefox</option>
                  )}
                </select>
              </div>
            </div>

            <div className="profile-dialog__field">
              <label htmlFor="profile-form-channel" className="profile-dialog__label">Channel</label>
              <div className="profile-dialog__select-wrap">
                <select
                  id="profile-form-channel"
                  className="profile-dialog__select"
                  value={form.channel}
                  onChange={(e) => setField('channel', e.target.value as any)}
                  disabled={isSaving || isEdit}
                >
                  <option value="stable">Stable</option>
                  <option value="beta">Beta</option>
                  <option value="dev">Dev</option>
                  <option value="canary">Canary</option>
                </select>
              </div>
            </div>
          </div>

          <div className="profile-dialog__field">
            <label htmlFor="profile-form-version" className="profile-dialog__label">Version</label>
            <div className="profile-dialog__select-wrap">
              <select
                id="profile-form-version"
                className="profile-dialog__select"
                value={form.version}
                onChange={(e) => setField('version', e.target.value)}
                disabled={isSaving || isEdit}
              >
                <option value="149.x">Recommended — 149.x</option>
                <option value="148.x">Version 148.x</option>
                <option value="147.x">Version 147.x</option>
              </select>
            </div>
          </div>

          {/* Proxy Assignment */}
          <div className="profile-dialog__field">
            <label htmlFor="profile-form-proxy" className="profile-dialog__label">Gán Proxy</label>
            <div className="profile-dialog__select-wrap">
              <select
                id="profile-form-proxy"
                className="profile-dialog__select"
                value={form.proxyId}
                onChange={(e) => setField('proxyId', e.target.value)}
                disabled={isSaving}
              >
                <option value="">Không dùng Proxy (Kết nối trực tiếp)</option>
                {proxies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} [{p.protocol.toUpperCase()} — {p.host}:{p.port}]
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div className="profile-dialog__field">
            <label htmlFor="profile-form-notes" className="profile-dialog__label">Ghi chú</label>
            <textarea
              id="profile-form-notes"
              className="profile-dialog__textarea"
              placeholder="Nhập ghi chú phụ cho profile..."
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              disabled={isSaving}
              rows={3}
            />
          </div>

          {/* Validation & Server errors */}
          {(validationError || serverError) && (
            <div className="profile-dialog__error" role="alert">
              <span>{validationError || serverError}</span>
            </div>
          )}
        </form>

        {/* Footer Actions */}
        <footer className="profile-dialog__footer">
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
            className="button button--primary"
            onClick={handleSubmit}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="profile-dialog__spin" size={14} /> : null}
            <span>{isSaving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo Profile'}</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
