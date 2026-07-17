import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, ShieldCheck } from 'lucide-react';
import './auth.css';

export function ForgotPasswordPage(): JSX.Element {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError('');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Vui lòng nhập email hợp lệ.');
      return;
    }

    setIsLoading(true);
    try {
      await window.desktop.auth.forgotPassword(email.trim());
      setSent(true);
    } catch {
      setError('Không thể gửi email lúc này. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-header__icon-wrapper">
            <ShieldCheck className="auth-header__icon" />
          </div>
          <div className="auth-header__text">
            <h1 className="auth-header__title">Quên mật khẩu</h1>
            <p className="auth-header__subtitle">
              {sent ? 'Kiểm tra hộp thư của bạn' : 'Nhập email để đặt lại mật khẩu'}
            </p>
          </div>
        </div>

        <div className="auth-form">
          {sent ? (
            <div className="auth-card--success-content">
              <div className="auth-card__success-icon-wrapper">
                <div className="auth-card__success-icon-circle">
                  <Mail className="auth-card__success-icon" />
                </div>
              </div>
              <p className="auth-card__success-title">
                Email đã được gửi!
              </p>
              <p className="auth-card__success-message">
                Kiểm tra hộp thư <span className="auth-card__success-email">{email}</span> và làm theo hướng dẫn để đặt lại mật khẩu.
              </p>
              <Link
                to="/dang-nhap"
                className="auth-link auth-card__back-link"
              >
                <ArrowLeft className="auth-card__back-icon" />
                Về trang đăng nhập
              </Link>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} noValidate>
              {error && (
                <div className="auth-form__error-box">
                  <p className="auth-form__error-text">{error}</p>
                </div>
              )}
              <div className="form-group form-group--last">
                <label htmlFor="forgot-email" className="form-group__label">
                  Email
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  disabled={isLoading}
                  placeholder="ten@email.com"
                  className={`form-group__input ${error ? 'form-group__input--error' : ''}`}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                id="forgot-submit-btn"
                className="auth-form__submit-btn"
              >
                {isLoading ? (
                  <div className="spinner" />
                ) : (
                  <Mail className="auth-form__submit-icon" />
                )}
                {isLoading ? 'Đang gửi...' : 'Gửi email đặt lại mật khẩu'}
              </button>

              <div className="auth-form__footer-text">
                <Link
                  to="/dang-nhap"
                  className="auth-link auth-card__back-link"
                >
                  <ArrowLeft className="auth-card__back-icon" />
                  Quay lại đăng nhập
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
