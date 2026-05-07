import { useState, useRef } from 'react';
import type { Patient } from '@/types/patient';

interface CreatePatientModalProps {
  onSave: (patient: Patient) => void;
  onClose: () => void;
}

export function CreatePatientModal({ onSave, onClose }: CreatePatientModalProps) {
  const [form, setForm] = useState({
    patientId: '',
    patientName: '',
    age: '',
    sex: '' as Patient['sex'],
    studyDescription: '',
    referringPhysician: '',
    modality: 'US',
    accessionNumber: '',
  });
  const [filePaths, setFilePaths] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Pick DCM files via Electron dialog (if available) or browser file input */
  const handleBrowseFiles = async () => {
    const api = (window as any).electronAPI;
    if (api?.invoke) {
      try {
        const result = await api.invoke('show-open-dialog', {
          properties: ['openFile', 'multiSelections'],
          filters: [
            { name: 'DICOM Files', extensions: ['dcm', 'DCM'] },
            { name: 'All Files', extensions: ['*'] },
          ],
          title: 'Select DICOM Files',
        });
        if (result && !result.canceled && result.filePaths?.length) {
          setFilePaths(result.filePaths);
        }
      } catch { /* fallback to native input */ fileInputRef.current?.click(); }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleBrowseFolder = async () => {
    const api = (window as any).electronAPI;
    if (api?.invoke) {
      try {
        const result = await api.invoke('show-open-dialog', {
          properties: ['openDirectory'],
          title: 'Select DICOM Folder',
        });
        if (result && !result.canceled && result.filePaths?.length) {
          // Scan folder for DICOM files
          const scanResult = await api.invoke('list-dicom-files', result.filePaths[0]);
          if (scanResult?.success && scanResult.files.length > 0) {
            setFilePaths(scanResult.files);
          } else {
            // Fallback: store folder path if scan finds nothing or fails
            setFilePaths(result.filePaths);
          }
        }
      } catch { /* ignore */ }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    // In browser mode, file.path may not be available; use file.name as fallback
    const paths = files.map((f: any) => f.path || f.name).filter(Boolean);
    if (paths.length) setFilePaths(paths);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patientName.trim()) {
      alert('Patient name is required');
      return;
    }
    const today = new Date();
    const studyDate = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;
    const patient: Patient = {
      id: crypto.randomUUID(),
      patientId: form.patientId || `P${Date.now()}`,
      patientName: form.patientName,
      age: form.age,
      sex: form.sex,
      studyDate,
      studyDescription: form.studyDescription,
      images: filePaths.length || 0,
      modality: form.modality,
      accessionNumber: form.accessionNumber,
      referringPhysician: form.referringPhysician,
      printed: false,
      filePaths: filePaths.length ? filePaths : undefined,
    };
    onSave(patient);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      {/* Hidden native file input fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".dcm,.DCM"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />
      <div
        className="bg-app-bg border border-app-border rounded-lg shadow-xl p-6 min-w-[450px] max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-app-text mb-4">Create New Patient</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-app-text-secondary mb-1">Patient ID (auto-generated if empty)</label>
            <input
              type="text"
              value={form.patientId}
              onChange={(e) => setForm({ ...form, patientId: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-app-border rounded bg-app-bg text-app-text"
              placeholder="Leave empty for auto-generated ID"
            />
          </div>
          <div>
            <label className="block text-xs text-app-text-secondary mb-1">Patient Name *</label>
            <input
              type="text"
              value={form.patientName}
              onChange={(e) => setForm({ ...form, patientName: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-app-border rounded bg-app-bg text-app-text"
              required
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-app-text-secondary mb-1">Age</label>
              <input
                type="text"
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-app-border rounded bg-app-bg text-app-text"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-app-text-secondary mb-1">Sex</label>
              <select
                value={form.sex}
                onChange={(e) => setForm({ ...form, sex: e.target.value as Patient['sex'] })}
                className="w-full px-3 py-2 text-sm border border-app-border rounded bg-app-bg text-app-text"
              >
                <option value="">--</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-app-text-secondary mb-1">Study Description</label>
            <input
              type="text"
              value={form.studyDescription}
              onChange={(e) => setForm({ ...form, studyDescription: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-app-border rounded bg-app-bg text-app-text"
            />
          </div>
          <div>
            <label className="block text-xs text-app-text-secondary mb-1">Referring Physician</label>
            <input
              type="text"
              value={form.referringPhysician}
              onChange={(e) => setForm({ ...form, referringPhysician: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-app-border rounded bg-app-bg text-app-text"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-app-text-secondary mb-1">Modality</label>
              <input
                type="text"
                value={form.modality}
                onChange={(e) => setForm({ ...form, modality: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-app-border rounded bg-app-bg text-app-text"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-app-text-secondary mb-1">Accession Number</label>
              <input
                type="text"
                value={form.accessionNumber}
                onChange={(e) => setForm({ ...form, accessionNumber: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-app-border rounded bg-app-bg text-app-text"
              />
            </div>
          </div>
          {/* DCM File / Folder Path */}
          <div>
            <label className="block text-xs text-app-text-secondary mb-1">DCM Files / Folder (optional)</label>
            <div className="flex gap-2">
              <div className="flex-1 px-3 py-2 text-xs border border-app-border rounded bg-app-bg text-app-text truncate">
                {filePaths.length === 0
                  ? <span className="text-app-text-muted">No files selected</span>
                  : filePaths.length === 1
                    ? filePaths[0]
                    : `${filePaths.length} files selected`
                }
              </div>
              <button
                type="button"
                onClick={handleBrowseFiles}
                className="px-3 py-2 text-xs border border-app-border rounded text-app-text hover:bg-app-hover transition-colors whitespace-nowrap"
                title="Select .dcm files"
              >
                Files
              </button>
              <button
                type="button"
                onClick={handleBrowseFolder}
                className="px-3 py-2 text-xs border border-app-border rounded text-app-text hover:bg-app-hover transition-colors whitespace-nowrap"
                title="Select folder containing DICOM files"
              >
                Folder
              </button>
            </div>
            {filePaths.length > 1 && (
              <p className="text-[10px] text-app-text-muted mt-1 truncate">{filePaths[0]}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-app-border rounded text-app-text hover:bg-app-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm rounded bg-app-accent text-white hover:bg-app-accent/80 transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
