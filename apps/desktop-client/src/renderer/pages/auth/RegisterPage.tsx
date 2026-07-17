import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, ShieldCheck } from 'lucide-react';
import './auth.css';

interface FormState {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) {
    errors.name = 'Vui lòng nhập họ và tên.';
  }
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
  if (form.password !== form.confirmPassword) {
    errors.confirmPassword = 'Mật khẩu xác nhận không khớp.';
  }
  return errors;
}

export function RegisterPage(): JSX.Element {
  const [form, setForm] = useState<FormState>({
    name: '', email: '', password: '', confirmPassword: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

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
      await window.desktop.auth.register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Đăng ký tài khoản thất bại.';
      setErrors({ general: message });
    } finally {
      setIsLoading(false);
    }
  }

  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-card auth-card--success">
          <div className="auth-card__success-icon-wrapper">
            <div className="auth-card__success-icon-circle">
              <ShieldCheck className="auth-card__success-icon" />
            </div>
          </div>
          <h2 className="auth-header__title">Đăng ký thành công!</h2>
          <p className="auth-header__subtitle">
            Kiểm tra email để xác nhận tài khoản trước khi đăng nhập.
          </p>
          <div style={{ marginTop: '24px' }}>
            <Link
              to="/dang-nhap"
              className="auth-link--button"
            >
              Về trang đăng nhập
            </Link>
          </div>
        </div>
      </div>
    );
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
            <h1 className="auth-header__title">Tạo tài khoản mới</h1>
            <p className="auth-header__subtitle">Điền thông tin để bắt đầu</p>
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

          {/* Name */}
          <div className="form-group">
            <label htmlFor="reg-name" className="form-group__label">
              Họ và tên
            </label>
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              disabled={isLoading}
              placeholder="Nguyễn Văn A"
              className={`form-group__input ${errors.name ? 'form-group__input--error' : ''}`}
            />
            {errors.name && <p className="form-group__error-msg">{errors.name}</p>}
          </div>

          {/* Email */}
          <div className="form-group">
            <label htmlFor="reg-email" className="form-group__label">
              Email
            </label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              disabled={isLoading}
              placeholder="ten@email.com"
              className={`form-group__input ${errors.email ? 'form-group__input--error' : ''}`}
            />
            {errors.email && <p className="form-group__error-msg">{errors.email}</p>}
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="reg-password" className="form-group__label">
              Mật khẩu
            </label>
            <input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => handleChange('password', e.target.value)}
              disabled={isLoading}
              placeholder="••••••••"
              className={`form-group__input ${errors.password ? 'form-group__input--error' : ''}`}
            />
            {errors.password && <p className="form-group__error-msg">{errors.password}</p>}
          </div>

          {/* Confirm Password */}
          <div className="form-group form-group--last">
            <label htmlFor="reg-confirm" className="form-group__label">
              Xác nhận mật khẩu
            </label>
            <input
              id="reg-confirm"
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(e) => handleChange('confirmPassword', e.target.value)}
              disabled={isLoading}
              placeholder="••••••••"
              className={`form-group__input ${errors.confirmPassword ? 'form-group__input--error' : ''}`}
            />
            {errors.confirmPassword && <p className="form-group__error-msg">{errors.confirmPassword}</p>}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="auth-form__submit-btn"
          >
            {isLoading ? (
              <div className="spinner" />
            ) : (
              <UserPlus className="auth-form__submit-icon" />
            )}
            {isLoading ? 'Đang tạo tài khoản...' : 'Đăng ký tài khoản'}
          </button>

          {/* Login link */}
          <p className="auth-form__footer-text">
            Đã có tài khoản?{' '}
            <Link to="/dang-nhap" className="auth-link">
              Đăng nhập ngay
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
