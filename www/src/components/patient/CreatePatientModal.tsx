import { useState, useRef, useMemo } from 'react';
import type { Patient } from '@/types/patient';

const IMAGE_EXTS = /\.(png|jpe?g|bmp)$/i;
const REFERRING_KEY = 'clinical-referring-physicians';

/** Standard DICOM modality codes for the New Patient dropdown.
 *  (DICOM PS3.3 C.7.3.1.1.1 — the common imaging set.) */
const MODALITIES: { code: string; label: string }[] = [
  { code: 'US', label: 'US — Ultrasound' },
  { code: 'CR', label: 'CR — Computed Radiography' },
  { code: 'DX', label: 'DX — Digital Radiography' },
  { code: 'CT', label: 'CT — Computed Tomography' },
  { code: 'MR', label: 'MR — Magnetic Resonance' },
  { code: 'MG', label: 'MG — Mammography' },
  { code: 'XA', label: 'XA — X-Ray Angiography' },
  { code: 'RF', label: 'RF — Radio Fluoroscopy' },
  { code: 'NM', label: 'NM — Nuclear Medicine' },
  { code: 'PT', label: 'PT — PET' },
  { code: 'ES', label: 'ES — Endoscopy' },
  { code: 'OT', label: 'OT — Other' },
];

function bmpAwareMime(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'bmp') return 'image/bmp';
  return 'image/jpeg';
}

function loadReferringPhysicians(): string[] {
  try { return JSON.parse(localStorage.getItem(REFERRING_KEY) || '[]'); } catch { return []; }
}

/** Upload image files to the PHP converter, returns .dcm file paths. */
async function convertImagesToDicom(
  imageFiles: File[],
  meta: { patient_name: string; patient_id: string; age: string; sex: string; modality: string; study_description: string; referring_physician: string; accession_number: string },
): Promise<{ files: string[]; errors: string[] }> {
  const fd = new FormData();
  for (const f of imageFiles) fd.append('images[]', f);
  for (const [k, v] of Object.entries(meta)) fd.append(k, v);

  const resp = await fetch('/api/dicom/convert-image.php', { method: 'POST', body: fd });
  const data = await resp.json();
  if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return { files: data.files ?? [], errors: data.errors ?? [] };
}

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
  const [imageFiles, setImageFiles] = useState<File[]>([]);  // browser-side PNG/JPEG
  const [converting, setConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const referringList = useMemo(() => loadReferringPhysicians(), []);

  /** Pick DCM or image files via Electron dialog (if available) or browser file input */
  const handleBrowseFiles = async () => {
    const api = (window as any).electronAPI;
    if (api?.invoke) {
      try {
        const result = await api.invoke('show-open-dialog', {
          properties: ['openFile', 'multiSelections'],
          filters: [
            { name: 'DICOM & Images', extensions: ['dcm', 'DCM', 'png', 'jpg', 'jpeg', 'bmp'] },
            { name: 'All Files', extensions: ['*'] },
          ],
          title: 'Select DICOM or Image Files',
        });
        if (result && !result.canceled && result.filePaths?.length) {
          const dcm: string[] = [];
          const imgs: string[] = [];
          for (const fp of result.filePaths as string[]) {
            if (IMAGE_EXTS.test(fp)) imgs.push(fp);
            else dcm.push(fp);
          }
          setFilePaths(dcm);
          // For Electron, read image files into File objects so we can POST them
          if (imgs.length) {
            const files: File[] = [];
            for (const fp of imgs) {
              try {
                const buf: ArrayBuffer = await api.invoke('read-file-buffer', fp);
                const name = fp.split(/[\\/]/).pop() || 'image.png';
                files.push(new File([buf], name, { type: bmpAwareMime(name) }));
              } catch { /* skip unreadable */ }
            }
            setImageFiles(files);
          } else {
            setImageFiles([]);
          }
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
          title: 'Select DICOM or Image Folder',
        });
        if (result && !result.canceled && result.filePaths?.length) {
          const folderPath = result.filePaths[0];

          // Scan for DICOM files
          const scanResult = await api.invoke('list-dicom-files', folderPath);
          const dcmFiles: string[] = scanResult?.success ? scanResult.files : [];

          // Scan for image files (PNG/JPEG) in the same folder
          let imgFilePaths: string[] = [];
          try {
            const imgResult = await api.invoke('list-image-files', folderPath);
            if (imgResult?.success) imgFilePaths = imgResult.files;
          } catch { /* IPC not available, skip */ }

          if (dcmFiles.length) setFilePaths(dcmFiles);
          else setFilePaths([]);

          // Read image files into File objects for conversion
          if (imgFilePaths.length) {
            const files: File[] = [];
            for (const fp of imgFilePaths) {
              try {
                const buf: ArrayBuffer = await api.invoke('read-file-buffer', fp);
                const name = fp.split(/[\\/]/).pop() || 'image.png';
                files.push(new File([buf], name, { type: bmpAwareMime(name) }));
              } catch { /* skip unreadable */ }
            }
            setImageFiles(files);
          } else {
            setImageFiles([]);
          }

          if (!dcmFiles.length && !imgFilePaths.length) {
            alert('No DICOM or image files found in the selected folder.');
          }
        }
      } catch { /* ignore */ }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const dcmPaths: string[] = [];
    const imgs: File[] = [];
    for (const f of files) {
      if (IMAGE_EXTS.test(f.name)) {
        imgs.push(f);
      } else {
        dcmPaths.push((f as any).path || f.name);
      }
    }
    if (dcmPaths.length) setFilePaths(dcmPaths);
    if (imgs.length) setImageFiles(imgs);
    if (!dcmPaths.length && !imgs.length) {
      // All files, treat as DCM
      const paths = files.map((f: any) => f.path || f.name).filter(Boolean);
      if (paths.length) setFilePaths(paths);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patientName.trim()) {
      alert('Patient name is required');
      return;
    }

    let allPaths = [...filePaths];

    // Convert PNG/JPEG files to DICOM first
    if (imageFiles.length > 0) {
      setConverting(true);
      try {
        const result = await convertImagesToDicom(imageFiles, {
          patient_name: form.patientName,
          patient_id: form.patientId || `P${Date.now()}`,
          age: form.age,
          sex: form.sex,
          modality: form.modality,
          study_description: form.studyDescription,
          referring_physician: form.referringPhysician,
          accession_number: form.accessionNumber,
        });
        allPaths = [...allPaths, ...result.files];
        if (result.errors.length) {
          console.warn('[CreatePatient] Conversion warnings:', result.errors);
        }
      } catch (err: any) {
        alert('Image conversion failed: ' + (err.message || 'Unknown error'));
        setConverting(false);
        return;
      }
      setConverting(false);
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
      images: allPaths.length || 0,
      modality: form.modality,
      accessionNumber: form.accessionNumber,
      referringPhysician: form.referringPhysician,
      printed: false,
      filePaths: allPaths.length ? allPaths : undefined,
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
        accept=".dcm,.DCM,.png,.jpg,.jpeg,.bmp"
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
            {referringList.length > 0 ? (
              <select
                value={form.referringPhysician}
                onChange={(e) => setForm({ ...form, referringPhysician: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-app-border rounded bg-app-bg text-app-text"
              >
                <option value="">-- Select --</option>
                {referringList.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={form.referringPhysician}
                onChange={(e) => setForm({ ...form, referringPhysician: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-app-border rounded bg-app-bg text-app-text"
              />
            )}
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-app-text-secondary mb-1">Modality</label>
              <select
                value={form.modality}
                onChange={(e) => setForm({ ...form, modality: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-app-border rounded bg-app-bg text-app-text"
              >
                {MODALITIES.map((m) => (
                  <option key={m.code} value={m.code}>{m.label}</option>
                ))}
              </select>
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
            <label className="block text-xs text-app-text-secondary mb-1">DICOM / Non-DICOM Image Files (optional) — DCM, JPG, JPEG, PNG, BMP</label>
            <div className="flex gap-2">
              <div className="flex-1 px-3 py-2 text-xs border border-app-border rounded bg-app-bg text-app-text truncate">
                {filePaths.length === 0 && imageFiles.length === 0
                  ? <span className="text-app-text-muted">No files selected</span>
                  : (() => {
                      const total = filePaths.length + imageFiles.length;
                      const parts: string[] = [];
                      if (filePaths.length) parts.push(`${filePaths.length} DICOM`);
                      if (imageFiles.length) parts.push(`${imageFiles.length} image${imageFiles.length > 1 ? 's' : ''}`);
                      return total === 1
                        ? (filePaths[0] || imageFiles[0]?.name || '1 file')
                        : `${total} files (${parts.join(' + ')})`;
                    })()
                }
              </div>
              <button
                type="button"
                onClick={handleBrowseFiles}
                className="px-3 py-2 text-xs border border-app-border rounded text-app-text hover:bg-app-hover transition-colors whitespace-nowrap"
                title="Select .dcm, .png, .jpg files"
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
              disabled={converting}
              className="px-4 py-2 text-sm rounded bg-app-accent text-white hover:bg-app-accent/80 transition-colors disabled:opacity-50"
            >
              {converting ? 'Converting images…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
