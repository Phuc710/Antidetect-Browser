import { Check, Fingerprint, Globe2, Layers3, LockKeyhole } from 'lucide-react';
import { loginShowcaseImage } from '../../assets/auth/login/index.js';

export function AuthIdentitySection(): JSX.Element {
  return (
    <section className="login-page__identity" aria-label="Giới thiệu Fingerprint Suite">
      <img
        className="login-page__showcase-image"
        src={loginShowcaseImage}
        alt=""
        aria-hidden="true"
      />
      <span className="login-page__showcase-overlay" aria-hidden="true" />
      <div className="login-page__identity-content">
        <div className="login-brand">
          <span className="login-brand__mark" aria-hidden="true">
            <Fingerprint />
          </span>
          <span className="login-brand__name">Fingerprint Suite</span>
        </div>

        <div className="login-page__intro">
          <span className="login-page__eyebrow">Browser workspace</span>
          <h1 className="login-page__headline">
            Một không gian riêng cho mọi danh tính trình duyệt.
          </h1>
          <p className="login-page__description">
            Quản lý profile, proxy và phiên làm việc trong một ứng dụng desktop
            nhất quán, an toàn và dễ kiểm soát.
          </p>
        </div>

        <ul className="login-benefits" aria-label="Tính năng chính">
          <li className="login-benefits__item">
            <span className="login-benefits__icon"><Layers3 /></span>
            <span><strong>Profile tách biệt</strong>Workspace độc lập cho từng phiên.</span>
          </li>
          <li className="login-benefits__item">
            <span className="login-benefits__icon"><Globe2 /></span>
            <span><strong>Proxy nhất quán</strong>Kiểm soát kết nối theo profile.</span>
          </li>
          <li className="login-benefits__item">
            <span className="login-benefits__icon"><LockKeyhole /></span>
            <span><strong>Session an toàn</strong>Token không xuất hiện trong giao diện.</span>
          </li>
        </ul>
      </div>

      <p className="login-page__identity-footer">
        <Check aria-hidden="true" /> Dữ liệu làm việc được lưu cục bộ trên thiết bị
      </p>
    </section>
  );
}
