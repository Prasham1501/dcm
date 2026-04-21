import { useState } from 'react';
import { Printer, Check } from 'lucide-react';
import { usePrintStore } from '@/stores/printStore';
import { useHospitalConfigStore } from '@/stores/hospitalConfigStore';

export function PrinterModal() {
  const { settings, updateSettings, setShowPrinterModal } = usePrintStore();
  const { printers } = useHospitalConfigStore();
  const activePrinters = printers.filter((p) => p.isActive);
  const [selectedPrinter, setSelectedPrinter] = useState(
    settings.defaultPrinter || activePrinters.find((p) => p.isDefault)?.name || activePrinters[0]?.name || ''
  );

  const handleApply = () => {
    updateSettings({ defaultPrinter: selectedPrinter });
    setShowPrinterModal(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-app-bg border-2 border-app-accent rounded-lg shadow-2xl w-[520px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-app-accent text-white">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4" />
            <span className="text-sm font-bold">Select Printer</span>
          </div>
          <button
            onClick={() => setShowPrinterModal(false)}
            className="text-white/80 hover:text-white text-lg font-bold"
          >
            &times;
          </button>
        </div>

        {/* Printer list */}
        <div className="p-4">
          {activePrinters.length === 0 ? (
            <div className="text-xs text-app-text-muted py-8 text-center border border-dashed border-app-border rounded">
              No printers configured. Add printers in Config &gt; General.
            </div>
          ) : (
            <div className="border border-app-border rounded overflow-hidden">
              {activePrinters.map((printer) => (
                <div
                  key={printer.name}
                  onClick={() => setSelectedPrinter(printer.name)}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer border-b border-app-border last:border-b-0 transition-colors ${
                    selectedPrinter === printer.name
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-app-hover text-app-text'
                  }`}
                >
                  <Printer className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs font-semibold flex items-center gap-2">
                      {printer.displayName || printer.name}
                      {printer.isDefault && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                          selectedPrinter === printer.name ? 'bg-blue-400' : 'bg-app-accent text-white'
                        }`}>
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <div className={`text-[10px] ${
                      selectedPrinter === printer.name ? 'text-blue-100' : 'text-app-text-muted'
                    }`}>
                      {printer.type}
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                    selectedPrinter === printer.name ? 'text-green-200' : 'text-green-600'
                  }`}>
                    Ready
                  </span>
                  {selectedPrinter === printer.name && (
                    <Check className="w-4 h-4" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Print settings */}
        <div className="px-4 pb-4 space-y-3">
          <h4 className="text-xs font-bold text-app-accent">Print Settings</h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-app-text-secondary mb-1">Paper Size</label>
              <select
                value={settings.paperSize}
                onChange={(e) => updateSettings({ paperSize: e.target.value as any })}
                className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm"
              >
                <option value="A4">A4</option>
                <option value="A3">A3</option>
                <option value="Letter">Letter</option>
                <option value="Legal">Legal</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-app-text-secondary mb-1">Quality</label>
              <select
                value={settings.quality}
                onChange={(e) => updateSettings({ quality: e.target.value as any })}
                className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm"
              >
                <option value="draft">Draft</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-app-text-secondary mb-1">Copies</label>
              <input
                type="number"
                min="1"
                max="99"
                value={settings.copies}
                onChange={(e) => updateSettings({ copies: parseInt(e.target.value) || 1 })}
                className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            {[
              { key: 'borderEnabled', label: 'Print border' },
              { key: 'headerEnabled', label: 'Print header' },
              { key: 'footerEnabled', label: 'Print footer' },
              { key: 'logoEnabled', label: 'Show logo' },
              { key: 'patientInfoEnabled', label: 'Patient info' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-1.5 text-[10px] text-app-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={(settings as any)[key]}
                  onChange={(e) => updateSettings({ [key]: e.target.checked })}
                  className="accent-app-accent w-3 h-3"
                />
                {label}
              </label>
            ))}
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
            className="px-4 py-1.5 text-xs font-semibold border-2 border-app-accent text-white bg-app-accent rounded hover:bg-app-accent-hover transition-colors"
          >
            Set as Default
          </button>
        </div>
      </div>
    </div>
  );
}
