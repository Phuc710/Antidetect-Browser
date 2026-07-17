import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../store/auth-store.js';
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
  if (!form.email) {
    errors.email = 'Vui lòng nhập email.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Email không đúng định dạng.';
  }
  if (!form.password) {
    errors.password = 'Vui lòng nhập mật khẩu.';
  } else if (form.password.length < 8) {
    errors.password = 'Mật khẩu phải có ít nhất 8 ký tự.';
  }
  return errors;
}

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const { setUser, setError: setStoreError } = useAuthStore();

  const [form, setForm] = useState<FormState>({ email: '', password: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  function handleChange(field: keyof FormState, value: string): void {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field] || errors.general) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        delete next.general;
        return next;
      });
    }
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();

    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const result = await window.desktop.auth.login({
        email: form.email.trim(),
        password: form.password,
      });
      setUser(result.user);
      void navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const code = (err as Error & { code?: string }).code;
      let message = 'Đăng nhập thất bại. Vui lòng thử lại.';

      if (code === 'INVALID_CREDENTIALS') {
        message = 'Email hoặc mật khẩu không đúng.';
      } else if (code === 'NETWORK_ERROR') {
        message = 'Không thể kết nối máy chủ. Kiểm tra kết nối mạng.';
      }

      setErrors({ general: message });
      setStoreError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-header">
          <div className="auth-header__icon-wrapper">
            <ShieldCheck className="auth-header__icon" />
          </div>
          <div className="auth-header__text">
            <h1 className="auth-header__title">Antidetect Browser</h1>
            <p className="auth-header__subtitle">Đăng nhập vào tài khoản của bạn</p>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="auth-form"
          noValidate
        >
          {/* General error */}
          {errors.general && (
            <div className="auth-form__error-box">
              <p className="auth-form__error-text">{errors.general}</p>
            </div>
          )}

          {/* Email */}
          <div className="form-group">
            <label htmlFor="login-email" className="form-group__label">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              disabled={isLoading}
              placeholder="ten@email.com"
              className={`form-group__input ${errors.email ? 'form-group__input--error' : ''}`}
            />
            {errors.email && (
              <p className="form-group__error-msg">{errors.email}</p>
            )}
          </div>

          {/* Password */}
          <div className="form-group form-group--last">
            <div className="form-group__header">
              <label htmlFor="login-password" className="form-group__label">
                Mật khẩu
              </label>
              <Link
                to="/quen-mat-khau"
                className="auth-link auth-link--small"
                tabIndex={-1}
              >
                Quên mật khẩu?
              </Link>
            </div>
            <div className="form-group__input-wrapper">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => handleChange('password', e.target.value)}
                disabled={isLoading}
                placeholder="••••••••"
                className={`form-group__input form-group__input--password ${errors.password ? 'form-group__input--error' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                className="form-group__toggle-btn"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff className="auth-form__submit-icon" /> : <Eye className="auth-form__submit-icon" />}
              </button>
            </div>
            {errors.password && (
              <p className="form-group__error-msg">{errors.password}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            id="login-submit-btn"
            className="auth-form__submit-btn"
          >
            {isLoading ? (
              <div className="spinner" />
            ) : (
              <LogIn className="auth-form__submit-icon" />
            )}
            {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>

          {/* Register link */}
          <p className="auth-form__footer-text">
            Chưa có tài khoản?{' '}
            <Link to="/dang-ky" className="auth-link">
              Đăng ký ngay
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
