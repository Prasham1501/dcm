import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatientStore } from '@/stores/patientStore';
import { openCRViewerPopup } from '@/stores/crViewerStore';
import { useReportStore } from '@/stores/reportStore';
import type { Patient } from '@/types/patient';
import { PatientContextMenu } from './PatientContextMenu';
import { FileText, Printer } from 'lucide-react';

export function PatientTable() {
  const navigate = useNavigate();
  const { filteredPatients, selectedPatient, selectedPatients, selectPatient, togglePatientSelection } = usePatientStore();
  const { getReportsForPatient } = useReportStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; patient: Patient } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Open standalone report editor window for a patient
  const handleOpenReport = useCallback(async (e: React.MouseEvent, patient: Patient) => {
    e.stopPropagation(); // Don't select the row
    const pid = patient.patientId || patient.id;
    localStorage.setItem('report-launch', JSON.stringify({
      patientName: patient.patientName,
      patientId: pid,
      studyDate: patient.studyDate,
      timestamp: Date.now(),
    }));
    const api = (window as any).electronAPI;
    if (api?.openReportEditor) {
      try {
        await api.openReportEditor();
        return;
      } catch (e) { console.warn('Failed to open report editor:', e); }
    }
    // Fallback: navigate in current window
    navigate('/report-editor');
  }, [navigate]);

  const handleRowClick = useCallback((patient: Patient, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+click: toggle this patient in/out of multi-selection
      togglePatientSelection(patient.id);
    } else {
      // Single click: always select only this record, deselect everything else
      selectPatient(patient);
    }
  }, [selectPatient, togglePatientSelection]);

  const handleRowDoubleClick = useCallback((patient: Patient) => {
    if (patient.filePaths && patient.filePaths.length > 0) {
      openCRViewerPopup({
        patientName: patient.patientName,
        patientId: patient.patientId,
        studyDate: patient.studyDate,
        filePaths: patient.filePaths,
      }, navigate);
    }
  }, [navigate]);

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
    { key: 'report', label: 'Rep', width: 'w-12' },
  ];

  const multiCount = selectedPatients.size;

  return (
    <div ref={tableRef} className="flex-1 overflow-auto border-b border-app-border flex flex-col">
      <table className="w-full text-xs 2xl:text-sm border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="bg-app-header-bg border-b-2 border-app-accent">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`${col.width} px-3 2xl:px-4 py-2.5 2xl:py-3 text-left font-bold text-app-accent uppercase tracking-wide border-r border-app-border last:border-r-0 select-none`}
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
                <td className="px-3 py-2 border-r border-app-border text-center font-semibold">
                  {patient.printed ? (
                    <span className="text-green-600">Y</span>
                  ) : (
                    <span></span>
                  )}
                </td>
                <td className="px-3 py-2 border-r border-app-border font-semibold">{patient.patientId}</td>
                <td className="px-3 py-2 border-r border-app-border font-semibold">{patient.patientName}</td>
                <td className="px-3 py-2 border-r border-app-border font-semibold">{patient.age}</td>
                <td className="px-3 py-2 border-r border-app-border font-semibold">{patient.sex}</td>
                <td className="px-3 py-2 border-r border-app-border font-semibold">{patient.studyDate}</td>
                <td className="px-3 py-2 border-r border-app-border font-semibold">{patient.studyDescription}</td>
                <td className="px-3 py-2 border-r border-app-border text-center font-semibold">{patient.images}</td>
                <td className="px-3 py-2 border-r border-app-border font-semibold">{patient.modality}</td>
                <td className="px-3 py-2 border-r border-app-border font-semibold">{patient.accessionNumber}</td>
                <td className="px-3 py-2 border-r border-app-border font-semibold">{patient.referringPhysician}</td>
                <td className="px-3 py-2 text-center">
                  {(() => {
                    const pid = patient.patientId || patient.id;
                    const reports = getReportsForPatient(pid);
                    if (reports.length === 0) return null;
                    const anyPrinted = reports.some(r => (r.printCount || 0) > 0);
                    const anyFinal = reports.some(r => r.status === 'final');
                    // Color: green if printed, blue if finalised, amber if draft only
                    const colorCls = anyPrinted
                      ? 'bg-green-500/15 text-green-600 hover:bg-green-600 hover:text-white'
                      : anyFinal
                        ? 'bg-blue-500/15 text-blue-500 hover:bg-blue-500 hover:text-white'
                        : 'bg-app-accent/15 text-app-accent hover:bg-app-accent hover:text-white';
                    const tip = anyPrinted
                      ? `Printed — ${reports.length} report${reports.length > 1 ? 's' : ''}`
                      : anyFinal
                        ? `Final — ${reports.length} report${reports.length > 1 ? 's' : ''}`
                        : `Draft — ${reports.length} report${reports.length > 1 ? 's' : ''}`;
                    return (
                      <button
                        onClick={(e) => handleOpenReport(e, patient)}
                        title={tip}
                        className={`inline-flex items-center justify-center w-6 h-6 rounded transition-colors ${colorCls}`}
                      >
                        {anyPrinted ? <Printer className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })()}
                </td>
              </tr>
            );
          })}
          {filteredPatients.length === 0 && (
            <tr>
              <td colSpan={12} className="px-3 py-12 text-center text-app-text-muted">
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
