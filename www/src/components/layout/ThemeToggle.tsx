import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';
import { cn } from '@/utils/cn';

export function ThemeToggle() {
  const { mode, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        'relative flex h-8 w-8 items-center justify-center rounded-lg',
        'text-foreground-secondary hover:bg-background-hover hover:text-foreground',
        'transition-all duration-200'
      )}
      title={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      aria-label="Toggle theme"
    >
      <Sun
        className={cn(
          'h-4 w-4 absolute transition-all duration-300',
          mode === 'light'
            ? 'rotate-0 scale-100 opacity-100'
            : 'rotate-90 scale-0 opacity-0'
        )}
      />
      <Moon
        className={cn(
          'h-4 w-4 absolute transition-all duration-300',
          mode === 'dark'
            ? 'rotate-0 scale-100 opacity-100'
            : '-rotate-90 scale-0 opacity-0'
        )}
      />
    </button>
  );
}
