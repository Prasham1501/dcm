import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { PatientListPage } from '@/pages/PatientListPage';

export default function App() {
  const { mode } = useThemeStore();
  const { checkSession } = useAuthStore();

  // Apply theme class to html element
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    if (mode === 'dark') root.classList.add('dark');
  }, [mode]);

  // Check session on mount
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<PatientListPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="patients" element={<PatientListPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
