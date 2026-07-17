import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth-store.js';
import { LoginPage } from '../pages/auth/LoginPage.js';
import { RegisterPage } from '../pages/auth/RegisterPage.js';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage.js';
import { DashboardPage } from '../pages/dashboard/DashboardPage.js';
import { AppLayout } from '../layouts/AppLayout.js';
import { AuthLayout } from '../layouts/AuthLayout.js';
import { ProtectedRoute } from './ProtectedRoute.js';
import { AuthRoute } from './AuthRoute.js';

export function App(): JSX.Element {
  const { setUser, setLoading } = useAuthStore();

  // Kiểm tra session khi app khởi động
  useEffect(() => {
    window.desktop.auth.getMe()
      .then((user) => {
        setUser(user);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [setUser, setLoading]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth routes — chỉ truy cập khi chưa đăng nhập */}
        <Route element={<AuthRoute />}>
          <Route element={<AuthLayout />}>
            <Route path="/dang-nhap" element={<LoginPage />} />
            <Route path="/dang-ky" element={<RegisterPage />} />
            <Route path="/quen-mat-khau" element={<ForgotPasswordPage />} />
          </Route>
        </Route>

        {/* Protected routes — yêu cầu đăng nhập */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            {/* TODO: thêm routes cho profiles, proxies, etc. theo RFC tiếp theo */}
          </Route>
        </Route>

        {/* Redirect mặc định */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
