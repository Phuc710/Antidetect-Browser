import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth-store.js';
import { LoginPage } from '../pages/auth/LoginPage.js';
import { RegisterPage } from '../pages/auth/RegisterPage.js';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage.js';
import { DashboardPage } from '../pages/dashboard/DashboardPage.js';
import { ProfilesPage } from '../pages/profiles/ProfilesPage.js';
import { ProxiesPage } from '../pages/proxies/ProxiesPage.js';
import { SettingsPage } from '../pages/settings/SettingsPage.js';
import { AppLayout } from '../layouts/AppLayout.js';
import { AuthLayout } from '../layouts/AuthLayout.js';
import { ProtectedRoute } from './ProtectedRoute.js';
import { AuthRoute } from './AuthRoute.js';
import { ToastContainer } from '../components/ui/Toast.js';
import { authService } from '../services/auth-service.js';

export function App(): JSX.Element {
  const { setUser, setLoading } = useAuthStore();

  // Kiểm tra session khi app khởi động qua AuthService (Singleton OOP)
  useEffect(() => {
    authService.getMe()
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
      {/* Toast notifications hiển thị chính giữa trên cùng (Center Top/Mid) cho toàn app */}
      <ToastContainer />

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
            <Route path="/profiles" element={<ProfilesPage />} />
            <Route path="/proxies" element={<ProxiesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        {/* Redirect mặc định */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
