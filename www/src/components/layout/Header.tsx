import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, User, Settings, LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { cn } from '@/utils/cn';

const pageTitles: Record<string, string> = {
  '/': 'Patients',
  '/dashboard': 'Dashboard',
  '/patients': 'Patients',
  '/viewer': 'Viewer',
  '/reports': 'Reports',
  '/settings': 'Settings',
};

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const pageTitle = pageTitles[location.pathname] || 'DICOM Viewer Pro';

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setDropdownOpen(false);
    logout();
    navigate('/login');
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4">
      {/* Left: Page title */}
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-semibold text-foreground">{pageTitle}</h1>
      </div>

      {/* Center: Search (placeholder) */}
      <div className="hidden md:block" />

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        <ThemeToggle />

        {/* Notifications */}
        <button
          className={cn(
            'relative flex h-8 w-8 items-center justify-center rounded-lg',
            'text-foreground-secondary hover:bg-background-hover hover:text-foreground',
            'transition-colors'
          )}
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>

        {/* User dropdown */}
        <div className="relative ml-2" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-2 py-1.5',
              'text-foreground-secondary hover:bg-background-hover',
              'transition-colors'
            )}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-accent">
              <User className="h-3.5 w-3.5" />
            </div>
            <span className="hidden text-sm font-medium text-foreground sm:block">
              {user?.displayName || 'User'}
            </span>
            <ChevronDown
              className={cn(
                'hidden h-3.5 w-3.5 transition-transform sm:block',
                dropdownOpen && 'rotate-180'
              )}
            />
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div
              className={cn(
                'absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-lg',
                'border border-border bg-background shadow-lg',
                'animate-fade-in'
              )}
            >
              <div className="border-b border-border px-3 py-2">
                <p className="text-sm font-medium text-foreground">
                  {user?.displayName || 'User'}
                </p>
                <p className="text-xs text-foreground-muted">
                  {user?.role || 'Administrator'}
                </p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => setDropdownOpen(false)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground-secondary hover:bg-background-hover transition-colors"
                >
                  <User className="h-3.5 w-3.5" />
                  Profile
                </button>
                <button
                  onClick={() => setDropdownOpen(false)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground-secondary hover:bg-background-hover transition-colors"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Settings
                </button>
              </div>
              <div className="border-t border-border py-1">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-background-hover transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
