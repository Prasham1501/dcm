import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { usePatientStore } from '@/stores/patientStore';
import { openCRViewerPopup } from '@/stores/crViewerStore';
import { openDualViewerPopup } from '@/stores/dualViewerStore';
import { localFileToImageId } from '@/lib/dicomLoader';
import { EditPatientModal } from './EditPatientModal';
import { CreatePatientModal } from './CreatePatientModal';
import { ConfirmDialog } from '../shared/ConfirmDialog';

/** Render a DICOM imageId to a JPEG Blob using the Cornerstone canvas. */
async function dicomToJpeg(imageId: string): Promise<Blob | null> {
  const cs = (window as any).__cornerstone;
  if (!cs) return null;
  try {
    const image = await cs.loadAndCacheImage(imageId);
    const div = document.createElement('div');
    div.style.cssText = `width:${image.width}px;height:${image.height}px;position:fixed;left:-99999px;top:0;visibility:hidden;`;
    document.body.appendChild(div);
    try {
      cs.enable(div);
      cs.displayImage(div, image);
      const el = cs.getEnabledElement(div);
      return await new Promise<Blob>((resolve, reject) => {
        el.canvas.toBlob(
          (b: Blob | null) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
          'image/jpeg',
          0.92
        );
      });
    } finally {
      try { cs.disable(div); } catch { /* ignore */ }
      document.body.removeChild(div);
    }
  } catch {
    return null;
  }
}

export function PatientActionBar() {
  const navigate = useNavigate();
  const {
    selectAll,
    selectedPatients,
    filteredPatients,
    selectedPatient,
    editPatient,
    createPatient,
    deleteSelected,
    importPatients,
    patients,
  } = usePatientStore();

  const [deleteMonths, setDeleteMonths] = useState('3');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const handleImportDicom = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const today = new Date();
    const studyDate = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;
    const newPatients = Array.from(files).map((file) => ({
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `imp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      patientId: `IMP${Date.now()}`,
      patientName: file.name.replace(/\.(dcm|dicom)$/i, ''),
      age: '',
      sex: '' as const,
      studyDate,
      studyDescription: 'Imported DICOM',
      images: 1,
      modality: 'OT',
      accessionNumber: '',
      referringPhysician: '',
      printed: false,
    }));
    importPatients(newPatients);
    alert(`Imported ${newPatients.length} file(s)`);
    e.target.value = '';
  };

  const handleReadBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      if (file.name.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(file);
        const jsonFile = zip.file('patients.json');
        if (!jsonFile) {
          alert('Invalid backup ZIP: patients.json not found');
          return;
        }
        const text = await jsonFile.async('string');
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
          importPatients(data);
          alert(`Restored ${data.length} patient(s) from ZIP backup`);
        } else {
          alert('Invalid backup format in ZIP');
        }
      } else {
        // JSON file
        const text = await file.text();
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
          importPatients(data);
          alert(`Restored ${data.length} patient(s) from backup`);
        } else {
          alert('Invalid backup format: expected an array of patients');
        }
      }
    } catch {
      alert('Failed to read backup file');
    }
  };

  const handleExportSelected = async () => {
    const selected = patients.filter((p) => selectedPatients.has(p.id));
    if (selected.length === 0) {
      alert('No patients selected');
      return;
    }

    const safeName = (s: string) =>
      s.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

    const p0 = selected[0];
    const dateStr = new Date().toISOString().slice(0, 10);
    const zipName = selected.length === 1
      ? `${safeName(p0.patientName)}_${p0.modality || 'DICOM'}.zip`
      : `DICOM_Export_${dateStr}.zip`;

    const hasFilePaths = selected.some(p => p.filePaths && p.filePaths.length > 0);

    if (hasFilePaths) {
      try {
        const zip = new JSZip();

        for (const p of selected) {
          if (!p.filePaths || p.filePaths.length === 0) continue;

          const folderLabel = `${safeName(p.patientName)}_${p.modality || 'DICOM'}`;
          const dest = selected.length > 1 ? zip.folder(folderLabel)! : zip;

          for (let i = 0; i < p.filePaths.length; i++) {
            const fp = p.filePaths[i];
            const imageId = localFileToImageId(fp);
            const jpegBlob = await dicomToJpeg(imageId);
            if (!jpegBlob) continue;
            const baseName = (fp.split(/[\\/]/).pop() || `image_${i + 1}`).replace(/\.[^.]+$/, '');
            dest.file(`${baseName}.jpg`, jpegBlob);
          }
        }

        const content = await zip.generateAsync({
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 1 },
        });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = zipName;
        link.click();
        URL.revokeObjectURL(link.href);
      } catch (err: any) {
        alert('Export failed: ' + err.message);
      }
      return;
    }

    // Fallback: server-side PHP backup for Orthanc-based patients
    const studyIds = selected.filter(p => p.orthancId).map(p => p.orthancId!);
    if (studyIds.length === 0) {
      alert('No DICOM data found for selected patients');
      return;
    }
    try {
      const response = await fetch('/api/patient/backup-studies.php?action=prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ study_ids: studyIds }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      window.location.href = `/api/patient/backup-studies.php?action=download&job_id=${result.job_id}&filename=${encodeURIComponent(zipName)}`;
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    }
  };

  return (
    <div className="border-t border-app-border bg-app-surface">
      {/* Single row: All action buttons combined */}
      <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 flex-wrap">
        <ActionButton label="Open" onClick={() => {
          const p = selectedPatient;
          if (!p) { alert('Select a patient first'); return; }
          if (p.filePaths && p.filePaths.length > 0) {
            openCRViewerPopup({
              patientName: p.patientName,
              patientId: p.patientId,
              studyDate: p.studyDate,
              filePaths: p.filePaths,
            }, navigate);
          } else {
            alert('No DICOM data found for this patient');
          }
        }} />
        <ActionButton label="Dual View" onClick={() => {
          const selected = filteredPatients.filter(p => selectedPatients.has(p.id) && p.filePaths?.length);
          if (selected.length < 2) {
            alert('Select 2 patients for dual view');
            return;
          }
          openDualViewerPopup({
            leftStudy: {
              patientName: selected[0].patientName,
              patientId: selected[0].patientId,
              studyDate: selected[0].studyDate,
              filePaths: selected[0].filePaths!,
            },
            rightStudy: {
              patientName: selected[1].patientName,
              patientId: selected[1].patientId,
              studyDate: selected[1].studyDate,
              filePaths: selected[1].filePaths!,
            },
          }, navigate);
        }} />
        <ActionButton
          label="Edit"
          onClick={() => {
            if (selectedPatient) setShowEditModal(true);
            else alert('Select a patient first');
          }}
        />
        <ActionButton label="Create new" onClick={() => setShowCreateModal(true)} />
        <ActionButton label="Import dicom" onClick={() => fileInputRef.current?.click()} />
        <ActionButton label="Select all" onClick={selectAll} />
        <ActionButton
          label="Delete selected"
          variant="danger"
          onClick={() => {
            if (selectedPatients.size === 0) {
              alert('No patients selected');
              return;
            }
            setShowDeleteConfirm(true);
          }}
        />

        {/* Delete N months dropdown */}
        <div className="flex items-center">
          <span className="text-xs text-app-text border border-app-border rounded-l px-2 py-1 bg-app-bg">
            Delete {deleteMonths} months past
          </span>
          <select
            value={deleteMonths}
            onChange={(e) => setDeleteMonths(e.target.value)}
            className="h-7 text-xs border border-l-0 border-app-border rounded-r bg-app-bg text-app-text px-1"
          >
            <option value="3">3</option>
            <option value="6">6</option>
            <option value="9">9</option>
            <option value="12">12</option>
          </select>
        </div>

        <ActionButton label="Export selected" onClick={handleExportSelected} />
        <ActionButton label="Read backup" onClick={() => backupInputRef.current?.click()} />

        <label className="flex items-center gap-1.5 text-xs text-app-text-secondary ml-2">
          <input type="checkbox" className="accent-app-accent w-3 h-3" />
          Delete after backup
        </label>

        <ActionButton
          label="Exit"
          onClick={() => {
            if (window.confirm('Exit application?')) window.close();
          }}
        />
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".dcm,.dicom"
        multiple
        className="hidden"
        onChange={handleImportDicom}
      />
      <input
        ref={backupInputRef}
        type="file"
        accept=".json,.zip"
        className="hidden"
        onChange={handleReadBackup}
      />

      {/* Modals */}
      {showEditModal && selectedPatient && (
        <EditPatientModal
          patient={selectedPatient}
          onSave={editPatient}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {showCreateModal && (
        <CreatePatientModal
          onSave={createPatient}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Selected Patients"
          message={`Are you sure you want to delete ${selectedPatients.size} selected patient(s)? This action cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={() => {
            deleteSelected();
            setShowDeleteConfirm(false);
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  variant = 'default',
}: {
  label: string;
  onClick?: () => void;
  variant?: 'default' | 'danger';
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs font-semibold border-2 rounded transition-colors ${
        variant === 'danger'
          ? 'border-red-500 text-red-500 bg-app-bg hover:bg-red-500 hover:text-white'
          : 'border-app-accent text-app-accent bg-app-bg hover:bg-app-accent hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}
