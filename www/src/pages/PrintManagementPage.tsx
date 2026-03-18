import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sun, Moon } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';
import { PrintHistory } from '@/components/print/PrintHistory';
import { PrinterModal } from '@/components/print/PrinterModal';
import { usePrintStore } from '@/stores/printStore';

export function PrintManagementPage() {
  const navigate = useNavigate();
  const { mode, toggleTheme } = useThemeStore();
  const { settings, showPrinterModal, setShowPrinterModal } = usePrintStore();

  return (
    <div className="flex flex-col h-screen bg-app-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-app-header-bg border-b-2 border-app-accent">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-1 text-app-accent hover:bg-app-hover rounded">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-app-accent">MediView Pro 1.0</span>
          <span className="text-xs text-app-text-muted">|</span>
          <span className="text-sm font-semibold text-app-text">Print Management</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-app-text-secondary">
            Current Printer: <span className="font-semibold text-app-text">{settings.defaultPrinter}</span>
          </span>
          <button
            onClick={() => setShowPrinterModal(true)}
            className="px-3 py-1 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors"
          >
            Change Printer
          </button>
          <button onClick={toggleTheme} className="p-1 rounded hover:bg-app-hover transition-colors text-app-text-secondary">
            {mode === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <PrintHistory />
        </div>
      </div>

      {/* Printer modal */}
      {showPrinterModal && <PrinterModal />}
    </div>
  );
}
