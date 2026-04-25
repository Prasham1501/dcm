import { useState, useEffect } from 'react';
import { Printer, Check, Plus, Trash2, Star, Power, RefreshCw } from 'lucide-react';
import { usePrintStore } from '@/stores/printStore';
import { useHospitalConfigStore, type PrinterConfig } from '@/stores/hospitalConfigStore';

interface SystemPrinter {
  name: string;
  displayName: string;
  description: string;
  status: number;
  isDefault: boolean;
}

export function PrinterModal() {
  const { settings, updateSettings, setShowPrinterModal } = usePrintStore();
  const configStore = useHospitalConfigStore();
  const [selectedPrinter, setSelectedPrinter] = useState(
    settings.defaultPrinter || configStore.printers.find((p) => p.isDefault)?.name || ''
  );

  // System printers from OS
  const [systemPrinters, setSystemPrinters] = useState<SystemPrinter[]>([]);
  const [loadingSystem, setLoadingSystem] = useState(false);
  const [showSystemPrinters, setShowSystemPrinters] = useState(false);

  const activePrinters = configStore.printers.filter((p) => p.isActive);

  const detectSystemPrinters = async () => {
    setLoadingSystem(true);
    try {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.getSystemPrinters) {
        const result = await electronAPI.getSystemPrinters();
        if (result.success) {
          setSystemPrinters(result.printers);
        }
      }
    } catch (e) {
      console.error('Failed to detect printers:', e);
    } finally {
      setLoadingSystem(false);
    }
  };

  useEffect(() => {
    detectSystemPrinters();
  }, []);

  const addSystemPrinter = (sp: SystemPrinter) => {
    // Don't add duplicates
    if (configStore.printers.some(p => p.name === sp.name)) return;
    const printer: PrinterConfig = {
      name: sp.name,
      displayName: sp.displayName || sp.name,
      type: sp.description || 'System Printer',
      isDefault: configStore.printers.length === 0,
      isActive: true,
    };
    configStore.addPrinter(printer);
  };

  const isAlreadyAdded = (name: string) => configStore.printers.some(p => p.name === name);

  const handleApply = () => {
    updateSettings({ defaultPrinter: selectedPrinter });
    setShowPrinterModal(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-app-bg border-2 border-app-accent rounded-lg shadow-2xl w-[620px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-app-accent text-white">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4" />
            <span className="text-sm font-bold">Printer Configuration</span>
          </div>
          <button
            onClick={() => setShowPrinterModal(false)}
            className="text-white/80 hover:text-white text-lg font-bold"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Add from System Printers */}
          <div>
            <h4 className="text-xs font-bold text-app-accent mb-2 flex items-center justify-between">
              <span>Available System Printers</span>
              <div className="flex gap-1">
                <button onClick={detectSystemPrinters} disabled={loadingSystem} className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold border border-app-accent text-app-accent rounded hover:bg-app-accent hover:text-white transition-colors disabled:opacity-50">
                  <RefreshCw className={`w-3 h-3 ${loadingSystem ? 'animate-spin' : ''}`} /> Detect
                </button>
                <button onClick={() => setShowSystemPrinters(!showSystemPrinters)} className="px-2 py-0.5 text-[10px] font-semibold border border-app-border text-app-text rounded hover:bg-app-hover transition-colors">
                  {showSystemPrinters ? 'Hide' : 'Show'}
                </button>
              </div>
            </h4>

            {showSystemPrinters && (
              <div className="border border-app-border rounded overflow-hidden mb-3 max-h-36 overflow-auto">
                {systemPrinters.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-app-text-muted text-center">
                    {loadingSystem ? 'Detecting printers...' : 'No system printers found. Click Detect to scan.'}
                  </div>
                ) : (
                  systemPrinters.map((sp) => (
                    <div key={sp.name} className="flex items-center gap-2 px-3 py-2 border-b border-app-border last:border-b-0 text-xs">
                      <Printer className="w-3.5 h-3.5 text-app-text-muted flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-app-text truncate flex items-center gap-1.5">
                          {sp.displayName || sp.name}
                          {sp.isDefault && <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-400">OS DEFAULT</span>}
                        </div>
                        <div className="text-[10px] text-app-text-muted truncate">{sp.name}</div>
                      </div>
                      {isAlreadyAdded(sp.name) ? (
                        <span className="text-[10px] text-green-500 font-semibold px-2">Added</span>
                      ) : (
                        <button
                          onClick={() => addSystemPrinter(sp)}
                          className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold border border-app-accent text-app-accent rounded hover:bg-app-accent hover:text-white transition-colors"
                        >
                          <Plus className="w-3 h-3" /> Add
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Configured Printers (select default) */}
          <div>
            <h4 className="text-xs font-bold text-app-accent mb-2">Configured Printers</h4>
            {configStore.printers.length === 0 ? (
              <div className="text-xs text-app-text-muted py-4 text-center border border-dashed border-app-border rounded">
                No printers configured. Click "Show" above to detect and add system printers.
              </div>
            ) : (
              <div className="border border-app-border rounded overflow-hidden max-h-44 overflow-auto">
                {configStore.printers.map((printer) => (
                  <div
                    key={printer.name}
                    onClick={() => printer.isActive && setSelectedPrinter(printer.name)}
                    className={`flex items-center gap-2 px-3 py-2 border-b border-app-border last:border-b-0 text-xs cursor-pointer transition-colors ${
                      selectedPrinter === printer.name
                        ? 'bg-blue-600 text-white'
                        : printer.isActive ? 'hover:bg-app-hover text-app-text' : 'opacity-50 text-app-text-muted'
                    }`}
                  >
                    <Printer className="w-4 h-4 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold flex items-center gap-1.5 truncate">
                        {printer.displayName || printer.name}
                        {printer.isDefault && (
                          <span className={`text-[9px] px-1 py-0.5 rounded ${selectedPrinter === printer.name ? 'bg-blue-400' : 'bg-app-accent text-white'}`}>DEFAULT</span>
                        )}
                        {!printer.isActive && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/20 text-red-400">DISABLED</span>
                        )}
                      </div>
                      <div className={`text-[10px] truncate ${selectedPrinter === printer.name ? 'text-blue-100' : 'text-app-text-muted'}`}>
                        {printer.name} &middot; {printer.type}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => configStore.setDefaultPrinter(printer.name)} title="Set as default" className={`p-1 rounded hover:bg-black/20 ${printer.isDefault ? 'text-yellow-400' : selectedPrinter === printer.name ? 'text-white/60' : 'text-app-text-muted'}`}>
                        <Star className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => configStore.togglePrinterActive(printer.name)} title="Toggle active" className={`p-1 rounded hover:bg-black/20 ${printer.isActive ? 'text-green-400' : 'text-red-400'}`}>
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => configStore.removePrinter(printer.name)} title="Remove" className={`p-1 rounded hover:bg-black/20 ${selectedPrinter === printer.name ? 'text-red-300' : 'text-red-400'}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {selectedPrinter === printer.name && (
                      <Check className="w-4 h-4 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-app-border">
          <button
            onClick={() => setShowPrinterModal(false)}
            className="px-4 py-1.5 text-xs font-semibold border-2 border-app-border text-app-text bg-app-bg rounded hover:bg-app-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!selectedPrinter}
            className="px-4 py-1.5 text-xs font-semibold border-2 border-app-accent text-white bg-app-accent rounded hover:bg-app-accent-hover transition-colors disabled:opacity-50"
          >
            Set as Default
          </button>
        </div>
      </div>
    </div>
  );
}
