import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Mail } from 'lucide-react';
import { authService } from '../../services/auth-service.js';
import { Spinner } from '../../components/ui/Spinner.js';
import { AuthIdentitySection } from './AuthIdentitySection.js';
import './auth.css';

export function ForgotPasswordPage(): JSX.Element {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError('');

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Vui lòng nhập email hợp lệ.');
      return;
    }

    setIsLoading(true);
    try {
      await authService.forgotPassword(normalizedEmail);
      setSent(true);
    } catch {
      setError('Không thể gửi email lúc này. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="login-page">
      <AuthIdentitySection />

      <section className="login-page__access" aria-labelledby="forgot-title">
        <div className="login-panel">
          <header className="login-panel__header">
            <p className="login-panel__overline">Khôi phục truy cập</p>
            <h2 id="forgot-title" className="login-panel__title">Quên mật khẩu</h2>
            <p className="login-panel__subtitle">
              {sent ? 'Kiểm tra hộp thư của bạn' : 'Nhập email để nhận liên kết đặt lại mật khẩu.'}
            </p>
          </header>

          {sent ? (
            <div className="login-form">
              <div className="login-form__alert login-form__alert--info">
                <Mail aria-hidden="true" />
                <div>
                  <strong>Đã gửi email khôi phục</strong>
                  <span>Chúng tôi đã gửi hướng dẫn tới <strong>{email}</strong>. Vui lòng kiểm tra hòm thư.</span>
                </div>
              </div>

              <Link to="/dang-nhap" className="button button--primary login-form__submit login-form__submit--link">
                <ArrowLeft size={16} /> Quay lại Đăng nhập
              </Link>
            </div>
          ) : (
            <form className="login-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
              {error && (
                <div className="login-form__alert" role="alert" aria-live="polite">
                  <AlertCircle aria-hidden="true" />
                  <div><strong>Không thể gửi</strong><span>{error}</span></div>
                </div>
              )}

              <div className="login-field">
                <label className="login-field__label" htmlFor="forgot-email">Email</label>
                <input
                  className={`login-field__input${error ? ' login-field__input--error' : ''}`}
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  disabled={isLoading}
                  aria-invalid={Boolean(error)}
                />
                {error && <span className="login-field__error">{error}</span>}
              </div>

              <button className="button button--primary login-form__submit" type="submit" disabled={isLoading}>
                {isLoading ? (
                  <Spinner size="sm" />
                ) : (
                  <Mail size={16} />
                )}
                {isLoading ? 'Đang gửi...' : 'Gửi email đặt lại mật khẩu'}
              </button>

              <p className="login-form__register">
                <Link className="login-form__link login-form__link--icon" to="/dang-nhap">
                  <ArrowLeft size={14} /> Quay lại Đăng nhập
                </Link>
              </p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
