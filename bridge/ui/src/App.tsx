import { useEffect, useState } from 'react';
import { Settings, FileText, Info, Moon, Sun, Minus, Palette } from 'lucide-react';
import { useConfigStore } from './stores/configStore';
import { SlotsPage } from './pages/SlotsPage';
import { LogsPage } from './pages/LogsPage';
import { AboutPage } from './pages/AboutPage';
import { BrandingPage } from './pages/BrandingPage';
import { StatusBar } from './components/StatusBar';

type Tab = 'slots' | 'branding' | 'logs' | 'about';

const TABS: { id: Tab; label: string; icon: typeof Settings }[] = [
  { id: 'slots', label: 'Printer Slots', icon: Settings },
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'logs', label: 'Logs', icon: FileText },
  { id: 'about', label: 'About', icon: Info },
];

export function App() {
  const [tab, setTab] = useState<Tab>('slots');
  const [dark, setDark] = useState(true);
  const load = useConfigStore((s) => s.load);
  const loadPrinters = useConfigStore((s) => s.loadSystemPrinters);
  const refresh = useConfigStore((s) => s.refreshSlotStatus);

  useEffect(() => {
    load();
    loadPrinters();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [load, loadPrinters, refresh]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  return (
    <div className="flex h-screen flex-col bg-app-bg text-app-text">
      {/* Title bar */}
      <header className="flex items-center justify-between bg-app-accent px-4 py-2 text-white">
        <div className="flex items-center gap-2 text-sm font-bold tracking-wide">
          <span className="rounded bg-white/20 px-2 py-0.5 text-xs">ACCURATE</span>
          <span>Bridge</span>
          <span className="ml-2 text-xs font-normal opacity-80">Printing bridge for DICOM modalities</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDark((d) => !d)}
            title={dark ? 'Light mode' : 'Dark mode'}
            className="rounded p-1 hover:bg-white/20"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={() => window.bridgeAPI.hideToTray()}
            title="Hide to tray"
            className="rounded p-1 hover:bg-white/20"
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex border-b border-app-border bg-app-header-bg">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2 text-xs font-semibold transition-colors ${
                active
                  ? 'border-app-accent text-app-accent'
                  : 'border-transparent text-app-text-secondary hover:bg-app-hover'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* Page */}
      <main className="flex-1 overflow-auto bg-app-bg">
        {tab === 'slots' && <SlotsPage />}
        {tab === 'branding' && <BrandingPage />}
        {tab === 'logs' && <LogsPage />}
        {tab === 'about' && <AboutPage />}
      </main>

      <StatusBar />
    </div>
  );
}
