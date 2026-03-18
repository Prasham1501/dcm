import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatientStore } from '@/stores/patientStore';
import { useViewerStore } from '@/stores/viewerStore';
import type { Patient } from '@/types/patient';
import { PatientContextMenu } from './PatientContextMenu';

export function PatientTable() {
  const navigate = useNavigate();
  const { filteredPatients, selectedPatient, selectedPatients, selectPatient, togglePatientSelection, clearSelection } = usePatientStore();
  const loadStudyFiles = useViewerStore((s) => s.loadStudyFiles);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; patient: Patient } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Keep a ref to selectedPatients so handleRowClick doesn't re-create on every selection change
  const selectedPatientsRef = useRef(selectedPatients);
  selectedPatientsRef.current = selectedPatients;

  const handleRowClick = useCallback((patient: Patient, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+click: toggle this patient in/out of multi-selection
      togglePatientSelection(patient.id);
    } else {
      // Normal click on already-selected sole record → deselect it
      // Normal click on any other record → select only that one
      const sel = selectedPatientsRef.current;
      const isSoleSelection = sel.size === 1 && sel.has(patient.id);
      if (isSoleSelection) {
        clearSelection();
      } else {
        selectPatient(patient);
      }
    }
  }, [selectPatient, togglePatientSelection, clearSelection]);

  const handleRowDoubleClick = useCallback((patient: Patient) => {
    if (patient.filePaths && patient.filePaths.length > 0) {
      loadStudyFiles({
        patientName: patient.patientName,
        patientId: patient.patientId,
        studyDate: patient.studyDate,
        filePaths: patient.filePaths,
      });
    }
    navigate('/viewer');
  }, [navigate, loadStudyFiles]);

  const handleContextMenu = useCallback((e: React.MouseEvent, patient: Patient) => {
    e.preventDefault();
    selectPatient(patient);
    setContextMenu({ x: e.clientX, y: e.clientY, patient });
  }, [selectPatient]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  const columns = [
    { key: 'printed', label: 'P', width: 'w-8' },
    { key: 'patientId', label: 'Patient ID', width: 'w-44' },
    { key: 'patientName', label: 'Patient Name', width: 'w-48' },
    { key: 'age', label: 'Age', width: 'w-14' },
    { key: 'sex', label: 'Sex', width: 'w-10' },
    { key: 'studyDate', label: 'Study Date', width: 'w-28' },
    { key: 'studyDescription', label: 'Study Description', width: 'w-36' },
    { key: 'images', label: 'Images', width: 'w-16' },
    { key: 'modality', label: 'Modality', width: 'w-20' },
    { key: 'accessionNumber', label: 'Accession Number', width: 'w-36' },
    { key: 'referringPhysician', label: 'Referring Physician', width: 'w-40' },
  ];

  const multiCount = selectedPatients.size;

  return (
    <div ref={tableRef} className="flex-1 overflow-auto border-b border-app-border flex flex-col">
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="bg-app-header-bg border-b-2 border-app-accent">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`${col.width} px-3 py-2.5 text-left font-bold text-app-accent uppercase tracking-wide border-r border-app-border last:border-r-0 select-none`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredPatients.map((patient) => {
            const isSelected = selectedPatient?.id === patient.id || selectedPatients.has(patient.id);
            return (
              <tr
                key={patient.id}
                onClick={(e) => handleRowClick(patient, e)}
                onDoubleClick={() => handleRowDoubleClick(patient)}
                onContextMenu={(e) => handleContextMenu(e, patient)}
                className={`border-b border-app-border cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-app-hover text-app-text'
                }`}
              >
                <td className="px-3 py-2 border-r border-app-border">
                  {patient.printed && <span className="text-app-accent font-bold">P</span>}
                </td>
                <td className="px-3 py-2 border-r border-app-border font-mono text-[11px]">{patient.patientId}</td>
                <td className="px-3 py-2 border-r border-app-border font-semibold">{patient.patientName}</td>
                <td className="px-3 py-2 border-r border-app-border">{patient.age}</td>
                <td className="px-3 py-2 border-r border-app-border">{patient.sex}</td>
                <td className="px-3 py-2 border-r border-app-border">{patient.studyDate}</td>
                <td className="px-3 py-2 border-r border-app-border">{patient.studyDescription}</td>
                <td className="px-3 py-2 border-r border-app-border text-center">{patient.images}</td>
                <td className="px-3 py-2 border-r border-app-border">{patient.modality}</td>
                <td className="px-3 py-2 border-r border-app-border">{patient.accessionNumber}</td>
                <td className="px-3 py-2">{patient.referringPhysician}</td>
              </tr>
            );
          })}
          {filteredPatients.length === 0 && (
            <tr>
              <td colSpan={11} className="px-3 py-12 text-center text-app-text-muted">
                No patients found matching your filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Selection hint bar */}
      <div className="sticky bottom-0 flex items-center justify-between px-3 py-1 bg-app-surface border-t border-app-border text-[10px] text-app-text-muted select-none">
        <span>
          {multiCount > 1
            ? <span className="text-app-accent font-semibold">{multiCount} records selected</span>
            : multiCount === 1
              ? <span>{selectedPatient?.patientName ?? '1 record selected'}</span>
              : <span>No selection</span>
          }
        </span>
        <span className="opacity-60">
          Click to select · <kbd className="border border-app-border rounded px-1 bg-app-bg">Ctrl</kbd>+Click to multi-select · Click selected row to deselect
        </span>
      </div>

      {contextMenu && (
        <PatientContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          patient={contextMenu.patient}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
