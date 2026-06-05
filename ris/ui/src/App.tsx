import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useThemeStore } from '@/stores/themeStore';
import { AppShell } from './AppShell';
import { DashboardPage } from './features/dashboard/routes/DashboardPage';
import { ReceptionPage } from './features/reception/routes/ReceptionPage';
import { WorklistPage } from './features/worklist/routes/WorklistPage';
import { ConsoleSimulatorPage } from './features/console/routes/ConsoleSimulatorPage';
import { NetworkPage } from './features/network/routes/NetworkPage';
import { DayBookPage } from './features/billing/routes/DayBookPage';
import { CommissionPage } from './features/commission/routes/CommissionPage';
import { PcpndtPage } from './features/pcpndt/routes/PcpndtPage';
import { SettingsPage } from './features/settings/routes/SettingsPage';
import { LicenseGate } from './features/license/LicenseGate';

export function App() {
  const { theme } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  return (
    <LicenseGate>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/reception" element={<ReceptionPage />} />
          <Route path="/worklist" element={<WorklistPage />} />
          <Route path="/console" element={<ConsoleSimulatorPage />} />
          <Route path="/network" element={<NetworkPage />} />
          <Route path="/billing" element={<DayBookPage />} />
          <Route path="/commission" element={<CommissionPage />} />
          <Route path="/pcpndt" element={<PcpndtPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </LicenseGate>
  );
}
