import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth-store.js';
import { LoadingScreen } from '../components/ui/LoadingScreen.js';

// Bảo vệ các route cần đăng nhập
export function ProtectedRoute(): JSX.Element {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return <LoadingScreen message="Đang kiểm tra phiên đăng nhập..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/dang-nhap" replace />;
  }

  return <Outlet />;
}
