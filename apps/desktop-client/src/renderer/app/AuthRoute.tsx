import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth-store.js';
import { LoadingScreen } from '../components/ui/LoadingScreen.js';

// Chuyển hướng về dashboard nếu đã đăng nhập
export function AuthRoute(): JSX.Element {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return <LoadingScreen message="Đang khởi động..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
