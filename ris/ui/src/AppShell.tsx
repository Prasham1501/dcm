import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, ListChecks, Receipt, Moon, Sun, Network,
  MonitorUp, Settings,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { IconButton } from '@/components/RisUi';

const NAV = [
  { to: '/dashboard',  label: 'Dashboard',  Icon: LayoutDashboard },
  { to: '/reception',  label: 'Reception',  Icon: ClipboardList  },
  { to: '/worklist',   label: 'Worklist',   Icon: ListChecks     },
  { to: '/console',    label: 'Console Simulator', Icon: MonitorUp },
  { to: '/network',    label: 'Network & DICOM', Icon: Network },
  { to: '/billing',    label: 'Day Book',   Icon: Receipt        },
  { to: '/settings',   label: 'Settings', Icon: Settings },
];

const ROUTE_META: Record<string, { title: string; crumb: string }> = {
  '/dashboard': { title: 'Dashboard', crumb: 'Operational overview' },
  '/reception': { title: 'Reception', crumb: 'Registration, visits, payment' },
  '/worklist': { title: 'Worklist', crumb: 'Reception collection console' },
  '/console': { title: 'Console Simulator', crumb: 'Laptop workflow testing' },
  '/network': { title: 'Network & DICOM', crumb: 'Machine, worklist, and DICOM transfer setup' },
  '/billing': { title: 'Day Book', crumb: 'Collections and Excel CSV exports' },
  '/commission': { title: 'Commission', crumb: 'Referring-doctor payouts' },
  '/settings': { title: 'Settings', crumb: 'License, branding, receipts, and database reset' },
};

const ADMIN_ONLY = new Set(['/commission']);
const BILLING_ROLES = new Set(['admin', 'super_admin', 'receptionist']);
const WORKLIST_ROLES = new Set(['receptionist']);

function canSee(path: string, role = '') {
  if (ADMIN_ONLY.has(path)) return role === 'admin' || role === 'super_admin';
  if (path === '/settings') return true;
  if (path === '/network') return true;
  if (path === '/billing') return BILLING_ROLES.has(role);
  if (path === '/worklist') return WORKLIST_ROLES.has(role);
  if (path === '/console') return WORKLIST_ROLES.has(role);
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
