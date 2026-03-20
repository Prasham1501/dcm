import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { usePatientStore } from '@/stores/patientStore';
import { useViewerStore } from '@/stores/viewerStore';
import { EditPatientModal } from './EditPatientModal';
import { CreatePatientModal } from './CreatePatientModal';
import { ConfirmDialog } from '../shared/ConfirmDialog';

export function PatientActionBar() {
  const navigate = useNavigate();
  const {
    selectAll,
    invertSelection,
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

    // Use Export nomenclature
    const firstName = selected[0].patientName.replace(/[^a-z0-9]/gi, '_');
    const dateStr = new Date().toISOString().slice(0, 10);
    const downloadName = selected.length === 1 
      ? `${firstName}.zip`
      : `DICOM_Export_${dateStr}.zip`;

    try {
      // 1. Get all study Orthanc IDs for selected patients
      const studyIds: string[] = [];
      
      for (const p of selected) {
        if (p.orthancId) {
          studyIds.push(p.orthancId);
        }
      }

      if (studyIds.length === 0) {
        alert('No DICOM data found for selected patients');
        return;
      }

      // 2. Prepare the export on server
      const response = await fetch('/api/patient/backup-studies.php?action=prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ study_ids: studyIds })
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error);

      // 3. Trigger download
      const downloadUrl = `/api/patient/backup-studies.php?action=download&job_id=${result.job_id}&filename=${encodeURIComponent(downloadName)}`;
      window.location.href = downloadUrl;

    } catch (err: any) {
      alert('Export failed: ' + err.message);
    }
  };

  return (
    <div className="border-t border-app-border bg-app-surface">
      {/* Row 1: Action buttons */}
      <div className="flex items-center justify-center gap-1.5 px-3 py-1.5">
        <ActionButton label="Open" onClick={() => {
          const p = selectedPatient;
          if (!p) {
            alert('Select a patient first');
            return;
          }
          if (p.filePaths && p.filePaths.length > 0) {
            useViewerStore.getState().loadStudyFiles({
              patientName: p.patientName,
              patientId: p.patientId,
              studyDate: p.studyDate,
              filePaths: p.filePaths,
            });
            navigate('/viewer');
          } else if (p.studyInstanceUID || p.orthancId) {
            useViewerStore.getState().loadStudy({
              patientId: p.patientId,
              patientName: p.patientName,
              studyDate: p.studyDate,
              studyUID: p.studyInstanceUID,
              orthancStudyId: p.orthancId,
            });
            navigate('/viewer');
          } else {
            alert('No DICOM data found for this patient');
          }
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
        <ActionButton label="Invert selection" onClick={invertSelection} />
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
      </div>

      {/* Row 2: Bottom buttons */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-app-border">
        <div className="flex items-center gap-1.5">
          {/* Nondicom button removed */}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-app-accent">DELETE</span>

          <label className="flex items-center gap-1.5 text-xs text-app-text-secondary">
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
