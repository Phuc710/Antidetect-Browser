import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth-store.js';
import { authService } from '../../services/auth-service.js';
import { Spinner } from '../../components/ui/Spinner.js';
import { AuthIdentitySection } from './AuthIdentitySection.js';
import './auth.css';

interface FormState {
  email: string;
  password: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  const normalizedEmail = form.email.trim();

  if (!normalizedEmail) {
    errors.email = 'Vui lòng nhập tài khoản / email.';
  }

  if (!form.password) {
    errors.password = 'Vui lòng nhập mật khẩu.';
  }

  return errors;
}

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const { setUser, setError: setStoreError } = useAuthStore();
  const [form, setForm] = useState<FormState>({ email: 'dev', password: 'dev01' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  function handleChange(field: keyof FormState, value: string): void {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      delete next.general;
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const validationErrors = validate(form);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const result = await authService.login(
        { email: form.email.trim(), password: form.password },
        { rememberDevice },
      );
      setUser(result.user);
      void navigate('/dashboard', { replace: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Đăng nhập thất bại. Vui lòng thử lại.';
      setErrors({ general: message });
      setStoreError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="login-page">
      <AuthIdentitySection />

      <section className="login-page__access" aria-labelledby="login-title">
        <div className="login-panel">
          <header className="login-panel__header">
            <p className="login-panel__overline">Chào mừng trở lại</p>
            <h2 id="login-title" className="login-panel__title">Đăng nhập</h2>
            <p className="login-panel__subtitle">
              Tiếp tục vào workspace của bạn (Test: dev / dev01).
            </p>
          </header>

          <form className="login-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
            {errors.general && (
              <div className="login-form__alert" role="alert" aria-live="polite">
                <AlertCircle aria-hidden="true" />
                <div><strong>Không thể đăng nhập</strong><span>{errors.general}</span></div>
              </div>
            )}

            <div className="login-field">
              <label className="login-field__label" htmlFor="login-email">Tài khoản / Email</label>
              <input
                className={`login-field__input${errors.email ? ' login-field__input--error' : ''}`}
                id="login-email"
                type="text"
                autoComplete="email"
                placeholder="dev"
                value={form.email}
                onChange={(event) => handleChange('email', event.target.value)}
                disabled={isLoading}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'login-email-error' : undefined}
              />
              {errors.email && <span id="login-email-error" className="login-field__error">{errors.email}</span>}
            </div>

            <div className="login-field">
              <div className="login-field__heading">
                <label className="login-field__label" htmlFor="login-password">Mật khẩu</label>
                <Link className="login-form__link" to="/quen-mat-khau">Quên mật khẩu?</Link>
              </div>
              <div className="login-field__control">
                <input
                  className={`login-field__input login-field__input--password${errors.password ? ' login-field__input--error' : ''}`}
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="dev01"
                  value={form.password}
                  onChange={(event) => handleChange('password', event.target.value)}
                  disabled={isLoading}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'login-password-error' : undefined}
                />
                <button
                  className="login-field__visibility"
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  disabled={isLoading}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
              {errors.password && <span id="login-password-error" className="login-field__error">{errors.password}</span>}
            </div>

            <label className="login-form__remember">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(event) => setRememberDevice(event.target.checked)}
                disabled={isLoading}
              />
              <span aria-hidden="true"><Check /></span>
              Ghi nhớ thiết bị này
            </label>

            <button className="button button--primary login-form__submit" type="submit" disabled={isLoading}>
              {isLoading ? <Spinner size="sm" /> : null}
              {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>

            <div className="login-form__separator"><span>hoặc</span></div>

            <button className="button button--secondary login-form__google" type="button" disabled title="Sắp có">
              <span className="login-form__google-mark" aria-hidden="true">G</span>
              Tiếp tục với Google
              <span className="login-form__coming-soon">Sắp có</span>
            </button>

            <p className="login-form__register">
              Chưa có tài khoản? <Link className="login-form__link" to="/dang-ky">Tạo tài khoản</Link>
            </p>
          </form>
        </div>
      </section>
    </div>
  );
}
