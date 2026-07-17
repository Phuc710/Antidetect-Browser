import { Navigate, Outlet } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../store/auth-store.js';

// Bảo vệ các route cần đăng nhập
export function ProtectedRoute(): JSX.Element {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-screen__logo-wrapper">
          <ShieldCheck className="loading-screen__logo" />
        </div>
        <h1 className="loading-screen__title">Antidetect Browser</h1>
        <div className="loading-screen__spinner" />
        <p className="loading-screen__text">Đang kiểm tra phiên đăng nhập...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/dang-nhap" replace />;
  }

  return <Outlet />;
}
