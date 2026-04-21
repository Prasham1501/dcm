import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  MonitorPlay,
  FileText,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  Heart,
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/utils/cn';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  disabled?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Patients', path: '/patients', icon: Users },
  { label: 'Viewer', path: '/viewer', icon: MonitorPlay, disabled: true },
  { label: 'Reports', path: '/reports', icon: FileText, disabled: true },
  { label: 'Settings', path: '/settings', icon: Settings, disabled: true },
];

const APP_VERSION = '1.0.0';

export function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const collapsed = !sidebarOpen;

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-slate-700/50 bg-[#1e293b] transition-all duration-300',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          'flex h-14 items-center border-b border-slate-700/50 px-4',
          collapsed ? 'justify-center' : 'gap-3'
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500">
          <Heart className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <div className="flex flex-col overflow-hidden">
            <span className="truncate text-sm font-semibold text-slate-100">
              DICOM Viewer
            </span>
            <span className="truncate text-2xs text-slate-400">
              Pro Edition
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            if (item.disabled) {
              return (
                <li key={item.path}>
                  <div
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 cursor-not-allowed',
                      collapsed && 'justify-center px-2'
                    )}
                    title={collapsed ? `${item.label} (coming soon)` : undefined}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    {!collapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                    {!collapsed && (
                      <span className="ml-auto rounded bg-slate-700/60 px-1.5 py-0.5 text-2xs text-slate-500">
                        Soon
                      </span>
                    )}
                  </div>
                </li>
              );
            }

            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      collapsed && 'justify-center px-2',
                      isActive
                        ? 'bg-blue-500/15 text-blue-400 font-medium'
                        : 'text-slate-300 hover:bg-slate-700/50 hover:text-slate-100'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={cn(
                          'h-[18px] w-[18px] shrink-0',
                          isActive ? 'text-blue-400' : 'text-slate-400'
                        )}
                      />
                      {!collapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom: Version + Collapse */}
      <div className="border-t border-slate-700/50 px-2 py-2">
        {!collapsed && (
          <div className="mb-2 px-3">
            <span className="text-2xs text-slate-500">v{APP_VERSION}</span>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400',
            'hover:bg-slate-700/50 hover:text-slate-200 transition-colors',
            collapsed && 'justify-center px-2'
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <ChevronsLeft className="h-4 w-4 shrink-0" />
              <span className="truncate">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
