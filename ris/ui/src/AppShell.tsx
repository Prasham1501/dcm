import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Receipt, Moon, Sun, Network,
  Settings, FileText,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { IconButton } from '@/components/RisUi';

const NAV = [
  { to: '/dashboard',  label: 'Dashboard',  Icon: LayoutDashboard },
  { to: '/reception',  label: 'Reception',  Icon: ClipboardList  },
  { to: '/results',    label: 'Result Entry', Icon: FileText },
  { to: '/network',    label: 'Network & DICOM', Icon: Network },
  { to: '/billing',    label: 'Day Book',   Icon: Receipt        },
  // PCPNDT temporarily hidden from the sidebar (route still works if navigated to directly).
  // { to: '/pcpndt',     label: 'PCPNDT', Icon: FileText },
  { to: '/settings',   label: 'Settings', Icon: Settings },
];

const ROUTE_META: Record<string, { title: string; crumb: string }> = {
  '/dashboard': { title: 'Dashboard', crumb: 'Operational overview' },
  '/reception': { title: 'Reception', crumb: 'Registration, visit status, report delivery' },
  '/results': { title: 'Result Entry', crumb: 'Enter, authenticate, and print lab results' },
  '/network': { title: 'Network & DICOM', crumb: 'Machine, worklist, and DICOM transfer setup' },
  '/billing': { title: 'Day Book', crumb: 'Collections and Excel CSV exports' },
  '/commission': { title: 'Commission', crumb: 'Referring-doctor payouts' },
  '/pcpndt': { title: 'PCPNDT', crumb: 'Form F prefill, print, and submission tracking' },
  '/settings': { title: 'Settings', crumb: 'License, branding, receipts, and database reset' },
};

const ADMIN_ONLY = new Set(['/commission']);
const BILLING_ROLES = new Set(['admin', 'super_admin', 'receptionist']);
const WORKLIST_ROLES = new Set(['receptionist']);
const todayInput = () => new Date().toISOString().slice(0, 10);
const monthStartInput = () => new Date().toISOString().slice(0, 8) + '01';

function canSee(path: string, role = '') {
  if (ADMIN_ONLY.has(path)) return role === 'admin' || role === 'super_admin';
  if (path === '/settings') return true;
  if (path === '/network') return true;
  if (path === '/billing') return BILLING_ROLES.has(role);
  if (path === '/pcpndt') return WORKLIST_ROLES.has(role) || role === 'admin' || role === 'super_admin';
  return true;
}

export function AppShell() {
  const { user } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const routeLocation = useLocation();
  const role = (user?.role as string) || '';
  const initials = (user?.name || user?.email || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const location = routeLocation.pathname;
  const meta = ROUTE_META[location] || ROUTE_META['/dashboard'];

  useEffect(() => {
    if (!user) return undefined;

    const run = () => {
      const today = todayInput();
      const monthStart = monthStartInput();

      void import('@/features/settings/api/settingsApi').then((api) => {
        void api.apiNetworkInfo().catch(() => undefined);
        void api.apiDicomNodes().catch(() => undefined);
        void api.apiMasters('centers', { active: '1' }).catch(() => undefined);
        void api.apiMasters('pros', { active: '1' }).catch(() => undefined);
        void api.apiMasters('lookups', { category: 'patient_group' }).catch(() => undefined);
        void api.apiMasters('lookups', { category: 'dispatch_mode' }).catch(() => undefined);
        if (role === 'admin' || role === 'super_admin') {
          void api.apiBranding().catch(() => undefined);
          void api.apiCounters().catch(() => undefined);
          void api.apiIntegration().catch(() => undefined);
        }
      }).catch(() => undefined);

      void import('@/features/reception/api/receptionApi').then((api) => {
        void api.apiListServices().catch(() => undefined);
        void api.apiListReferringDoctors().catch(() => undefined);
        if (WORKLIST_ROLES.has(role)) {
          void api.apiReceptionVisits({
            from: monthStart,
            to: today,
            page: 1,
            page_size: 50,
            include_totals: 0,
          }).catch(() => undefined);
        }
      }).catch(() => undefined);

      if (WORKLIST_ROLES.has(role)) {
        void import('@/features/worklist/api/worklistApi').then((api) => {
          void api.apiDoctorList('scheduled,sent_to_viewer,acquired,reported,delivered').catch(() => undefined);
          void api.apiCollectionList().catch(() => undefined);
        }).catch(() => undefined);
      }

      if (BILLING_ROLES.has(role)) {
        void import('@/features/billing/api/billingApi').then((api) => {
          void api.apiGetDaybook(today, today).catch(() => undefined);
        }).catch(() => undefined);
      }

      if (role === 'admin' || role === 'super_admin' || WORKLIST_ROLES.has(role)) {
        void import('@/features/pcpndt/api/pcpndtApi').then((api) => {
          void api.apiPcpndtOrders().catch(() => undefined);
        }).catch(() => undefined);
      }

      if (role === 'admin' || role === 'super_admin') {
        void import('@/features/commission/api/commissionApi').then((api) => {
          void api.apiGetCommissionEnabled().catch(() => undefined);
        }).catch(() => undefined);
      }
    };

    const timer = window.setTimeout(run, 250);
    return () => window.clearTimeout(timer);
  }, [role, user]);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="name">One Clickz RIS</div>
          <div className="sub">Radiology Information System</div>
        </div>

        <nav className="sidebar-nav">
          {NAV.filter(({ to }) => canSee(to, role)).map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => {
                if (to === '/reception' && location === '/reception') {
                  window.dispatchEvent(new CustomEvent('ris:reception-reselect'));
                }
              }}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : ''}`
              }
            >
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          {user && (
            <div className="userbox">
              <span className="avatar">{initials}</span>
              <div style={{ minWidth: 0 }}>
                <div className="uname">{user.name || user.email}</div>
                <div className="urole">{String(user.role || 'user').replace('_', ' ')}</div>
              </div>
            </div>
          )}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="title">{meta.title}</div>
          <div className="crumb">{meta.crumb}</div>
          <div className="spacer" />
          <IconButton icon={theme === 'dark' ? Sun : Moon} bordered onClick={toggleTheme} title="Toggle theme" />
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
