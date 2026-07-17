import { Navigate, Outlet } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../store/auth-store.js';

// Chuyển hướng về dashboard nếu đã đăng nhập
export function AuthRoute(): JSX.Element {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-screen__logo-wrapper">
          <ShieldCheck className="loading-screen__logo" />
        </div>
        <h1 className="loading-screen__title">Antidetect Browser</h1>
        <div className="loading-screen__spinner" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
