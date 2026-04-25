import { useRef, useState } from 'react';
import { useHospitalConfigStore, type PrinterConfig } from '@/stores/hospitalConfigStore';
import { Trash2, Star, Power, Plus } from 'lucide-react';

export function PrinterTab() {
  const config = useHospitalConfigStore();
  const [showAddPrinter, setShowAddPrinter] = useState(false);
  const [newPrinter, setNewPrinter] = useState({ name: '', displayName: '', type: 'Laser' });

  const handleAddPrinter = () => {
    if (!newPrinter.name.trim()) return;
    const printer: PrinterConfig = {
      name: newPrinter.name.trim(),
      displayName: newPrinter.displayName.trim() || newPrinter.name.trim(),
      type: newPrinter.type,
      isDefault: config.printers.length === 0,
      isActive: true,
    };
    config.addPrinter(printer);
    setNewPrinter({ name: '', displayName: '', type: 'Laser' });
    setShowAddPrinter(false);
  };

  return (
    <div className="space-y-5">
      <p className="text-xs text-app-text-secondary">
        Configure printers available for printing DICOM images. Only printers added here can be used within the software.
      </p>

      {/* Configured Printers */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border flex items-center justify-between">
          <span>Configured Printers</span>
          <button
            onClick={() => setShowAddPrinter(!showAddPrinter)}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold border border-app-accent text-app-accent rounded hover:bg-app-accent hover:text-white transition-colors"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </h3>

        {showAddPrinter && (
          <div className="mb-3 p-3 border border-app-border rounded bg-app-surface space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-semibold text-app-text-secondary mb-1">Printer Name</label>
                <input type="text" value={newPrinter.name} onChange={(v) => setNewPrinter(p => ({ ...p, name: v.target.value }))} className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-app-text-secondary mb-1">Display Name</label>
                <input type="text" value={newPrinter.displayName} onChange={(v) => setNewPrinter(p => ({ ...p, displayName: v.target.value }))} className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-app-text-secondary mb-1">Type</label>
                <select value={newPrinter.type} onChange={(v) => setNewPrinter(p => ({ ...p, type: v.target.value }))} className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none">
                  <option value="Laser">Laser</option>
                  <option value="Inkjet">Inkjet</option>
                  <option value="DICOM Thermal">DICOM Thermal</option>
                  <option value="DICOM Dry Laser">DICOM Dry Laser</option>
                  <option value="Virtual">Virtual</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddPrinter} className="px-3 py-1 text-xs font-semibold border-2 border-app-accent text-white bg-app-accent rounded hover:bg-app-accent-hover transition-colors">Add Printer</button>
              <button onClick={() => setShowAddPrinter(false)} className="px-3 py-1 text-xs font-semibold border border-app-border text-app-text rounded hover:bg-app-hover transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {config.printers.length === 0 ? (
          <div className="text-xs text-app-text-muted py-4 text-center border border-dashed border-app-border rounded">
            No printers configured. Click "Add" to add a printer.
          </div>
        ) : (
          <div className="border border-app-border rounded overflow-hidden">
            {config.printers.map((printer) => (
              <div key={printer.name} className="flex items-center gap-2 px-3 py-2 border-b border-app-border last:border-b-0 text-xs">
                <div className="flex-1">
                  <div className="font-semibold text-app-text flex items-center gap-2">
                    {printer.displayName || printer.name}
                    {printer.isDefault && <span className="text-[9px] px-1.5 py-0.5 rounded bg-app-accent text-white">DEFAULT</span>}
                    {!printer.isActive && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">DISABLED</span>}
                  </div>
                  <div className="text-[10px] text-app-text-muted">{printer.name} &middot; {printer.type}</div>
                </div>
                <button onClick={() => config.setDefaultPrinter(printer.name)} title="Set as default" className={`p-1 rounded hover:bg-app-hover ${printer.isDefault ? 'text-yellow-500' : 'text-app-text-muted'}`}>
                  <Star className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => config.togglePrinterActive(printer.name)} title="Toggle active" className={`p-1 rounded hover:bg-app-hover ${printer.isActive ? 'text-green-500' : 'text-red-400'}`}>
                  <Power className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => config.removePrinter(printer.name)} title="Remove" className="p-1 rounded hover:bg-app-hover text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info note */}
      <div className="px-3 py-2 text-xs text-app-text-muted bg-app-surface border border-app-border rounded">
        <strong>Note:</strong> Only printers configured here will be available for printing. Set a default printer by clicking the star icon. Disabled printers will not appear in the print dialog.
      </div>
    </div>
  );
}
