import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  UserPlus,
} from 'lucide-react';
import { authService } from '../../services/auth-service.js';
import { Spinner } from '../../components/ui/Spinner.js';
import { AuthIdentitySection } from './AuthIdentitySection.js';
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
  terms?: string;
  general?: string;
}

function validate(form: FormState, agreedTerms: boolean): FormErrors {
  const errors: FormErrors = {};

  if (!form.name.trim()) {
    errors.name = 'Vui lòng nhập họ và tên.';
  }

  const normalizedEmail = form.email.trim();
  if (!normalizedEmail) {
    errors.email = 'Vui lòng nhập email.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
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

  if (!agreedTerms) {
    errors.terms = 'Bạn phải đồng ý với Điều khoản sử dụng.';
  }

  return errors;
}

export function RegisterPage(): JSX.Element {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(true);
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
    const validationErrors = validate(form, agreedTerms);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      await authService.register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      // Đăng ký thành công -> chuyển sang đăng nhập
      void navigate('/dang-nhap', { replace: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Đăng ký tài khoản thất bại.';
      setErrors({ general: message });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="login-page">
      <AuthIdentitySection />

      <section className="login-page__access" aria-labelledby="register-title">
        <div className="login-panel">
          <header className="login-panel__header">
            <p className="login-panel__overline">Bắt đầu ngay hôm nay</p>
            <h2 id="register-title" className="login-panel__title">Tạo tài khoản mới</h2>
            <p className="login-panel__subtitle">
              Điền thông tin để tạo workspace riêng của bạn.
            </p>
          </header>

          <form className="login-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
            {errors.general && (
              <div className="login-form__alert" role="alert" aria-live="polite">
                <AlertCircle aria-hidden="true" />
                <div><strong>Lỗi đăng ký</strong><span>{errors.general}</span></div>
              </div>
            )}

            {/* Full Name */}
            <div className="login-field">
              <label className="login-field__label" htmlFor="register-name">Họ và tên</label>
              <input
                className={`login-field__input${errors.name ? ' login-field__input--error' : ''}`}
                id="register-name"
                type="text"
                autoComplete="name"
                placeholder="Nguyễn Văn A"
                value={form.name}
                onChange={(event) => handleChange('name', event.target.value)}
                disabled={isLoading}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'register-name-error' : undefined}
              />
              {errors.name && <span id="register-name-error" className="login-field__error">{errors.name}</span>}
            </div>

            {/* Email */}
            <div className="login-field">
              <label className="login-field__label" htmlFor="register-email">Email</label>
              <input
                className={`login-field__input${errors.email ? ' login-field__input--error' : ''}`}
                id="register-email"
                type="email"
                autoComplete="email"
                placeholder="name@company.com"
                value={form.email}
                onChange={(event) => handleChange('email', event.target.value)}
                disabled={isLoading}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'register-email-error' : undefined}
              />
              {errors.email && <span id="register-email-error" className="login-field__error">{errors.email}</span>}
            </div>

            {/* Password */}
            <div className="login-field">
              <label className="login-field__label" htmlFor="register-password">Mật khẩu</label>
              <div className="login-field__control">
                <input
                  className={`login-field__input login-field__input--password${errors.password ? ' login-field__input--error' : ''}`}
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Tối thiểu 8 ký tự"
                  value={form.password}
                  onChange={(event) => handleChange('password', event.target.value)}
                  disabled={isLoading}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'register-password-error' : undefined}
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
              {errors.password && <span id="register-password-error" className="login-field__error">{errors.password}</span>}
            </div>

            {/* Confirm Password */}
            <div className="login-field">
              <label className="login-field__label" htmlFor="register-confirm">Xác nhận mật khẩu</label>
              <div className="login-field__control">
                <input
                  className={`login-field__input login-field__input--password${errors.confirmPassword ? ' login-field__input--error' : ''}`}
                  id="register-confirm"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Nhập lại mật khẩu"
                  value={form.confirmPassword}
                  onChange={(event) => handleChange('confirmPassword', event.target.value)}
                  disabled={isLoading}
                  aria-invalid={Boolean(errors.confirmPassword)}
                  aria-describedby={errors.confirmPassword ? 'register-confirm-error' : undefined}
                />
                <button
                  className="login-field__visibility"
                  type="button"
                  onClick={() => setShowConfirmPassword((visible) => !visible)}
                  disabled={isLoading}
                  aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showConfirmPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
              {errors.confirmPassword && <span id="register-confirm-error" className="login-field__error">{errors.confirmPassword}</span>}
            </div>

            {/* Terms Checkbox */}
            <label className="login-form__remember">
              <input
                type="checkbox"
                checked={agreedTerms}
                onChange={(event) => {
                  setAgreedTerms(event.target.checked);
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.terms;
                    return next;
                  });
                }}
                disabled={isLoading}
              />
              <span aria-hidden="true"><Check /></span>
              Tôi đồng ý với Điều khoản & Chính sách bảo mật
            </label>
            {errors.terms && <span className="login-field__error">{errors.terms}</span>}

            {/* Submit */}
            <button className="button button--primary login-form__submit" type="submit" disabled={isLoading}>
              {isLoading ? (
                <Spinner size="sm" />
              ) : (
                <UserPlus size={16} />
              )}
              {isLoading ? 'Đang tạo tài khoản...' : 'Đăng ký ngay'}
            </button>

            <p className="login-form__register">
              Đã có tài khoản? <Link className="login-form__link" to="/dang-nhap">Đăng nhập</Link>
            </p>
          </form>
        </div>
      </section>
    </div>
  );
}
