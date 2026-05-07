import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatientStore } from '@/stores/patientStore';
import { openCRViewerPopup } from '@/stores/crViewerStore';
import { useReportStore } from '@/stores/reportStore';
import type { Patient } from '@/types/patient';
import { PatientContextMenu } from './PatientContextMenu';
import { FileText, Printer, Undo2, ChevronUp, ChevronDown } from 'lucide-react';

type SortDir = 'asc' | 'desc' | null;

export function PatientTable() {
  const navigate = useNavigate();
  const { filteredPatients, selectedPatient, selectedPatients, selectPatient, togglePatientSelection, newStudyIds } = usePatientStore();
  const { getReportsForPatient } = useReportStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; patient: Patient } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  // Listen for IPC "patient-printed" broadcast from popup windows
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.on) return;
    const unsub = api.on('patient-printed', (data: { patientId: string; patientName: string }) => {
      const { patients, editPatient } = usePatientStore.getState();
      const matched = patients.find(p => p.patientId === data.patientId && p.patientName === data.patientName);
      if (matched) editPatient(matched.id, { printed: true });
    });
    return () => { if (typeof unsub === 'function') unsub(); };
  }, []);

  // Merge state
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [mergePatients, setMergePatients] = useState<Patient[]>([]);
  const [mergePrimaryId, setMergePrimaryId] = useState<string>('');
  const [mergeUndo, setMergeUndo] = useState<{ removedPatient: Patient; mergedInto: string; originalFilePaths: string[] } | null>(null);
  const mergeUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Open merge dialog for 2 selected patients
  const handleMergeClick = useCallback(() => {
    const selected = filteredPatients.filter(p => selectedPatients.has(p.id));
    if (selected.length !== 2) return;
    setMergePatients(selected);
    setMergePrimaryId(selected[0].id);
    setShowMergeDialog(true);
  }, [filteredPatients, selectedPatients]);

  const handleMergeConfirm = useCallback(() => {
    if (mergePatients.length !== 2 || !mergePrimaryId) return;
    const primary = mergePatients.find(p => p.id === mergePrimaryId)!;
    const secondary = mergePatients.find(p => p.id !== mergePrimaryId)!;
    const { editPatient, deletePatient } = usePatientStore.getState();

    // Save original state for undo
    const originalFilePaths = [...(primary.filePaths || [])];
    const mergedFilePaths = [...(primary.filePaths || []), ...(secondary.filePaths || [])];
    const mergedImages = (primary.images || 0) + (secondary.images || 0);

    // Merge file paths into primary
    editPatient(primary.id, {
      filePaths: mergedFilePaths,
      images: mergedImages,
    });

    // Remove secondary from list (soft delete — just remove from local state)
    const { patients } = usePatientStore.getState();
    const filtered = patients.filter(p => p.id !== secondary.id);
    usePatientStore.setState({
      patients: filtered,
      filteredPatients: filtered,
      selectedPatients: new Set(),
      selectedPatient: null,
    });

    // Set undo state with 10 second timer
    setMergeUndo({ removedPatient: secondary, mergedInto: primary.id, originalFilePaths });
    if (mergeUndoTimerRef.current) clearTimeout(mergeUndoTimerRef.current);
    mergeUndoTimerRef.current = setTimeout(() => setMergeUndo(null), 10000);

    setShowMergeDialog(false);
  }, [mergePatients, mergePrimaryId]);

  const handleMergeUndo = useCallback(() => {
    if (!mergeUndo) return;
    const { editPatient } = usePatientStore.getState();
    // Restore primary's original file paths
    editPatient(mergeUndo.mergedInto, { filePaths: mergeUndo.originalFilePaths, images: mergeUndo.originalFilePaths.length });
    // Re-add removed patient
    const { patients } = usePatientStore.getState();
    usePatientStore.setState({
      patients: [...patients, mergeUndo.removedPatient],
      filteredPatients: [...patients, mergeUndo.removedPatient],
    });
    setMergeUndo(null);
    if (mergeUndoTimerRef.current) clearTimeout(mergeUndoTimerRef.current);
  }, [mergeUndo]);

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
    // Clear new-study highlight when user opens the study
    if (newStudyIds.has(patient.id)) {
      usePatientStore.getState().clearNewHighlight(patient.id);
    }
    if (patient.filePaths && patient.filePaths.length > 0) {
      openCRViewerPopup({
        patientName: patient.patientName,
        patientId: patient.patientId,
        studyDate: patient.studyDate,
        filePaths: patient.filePaths,
      }, navigate);
    }
  }, [navigate, newStudyIds]);

  const handleContextMenu = useCallback((e: React.MouseEvent, patient: Patient) => {
    e.preventDefault();
    // If the right-clicked patient is already in the multi-selection, preserve it
    if (!selectedPatients.has(patient.id)) {
      selectPatient(patient);
    }
    setContextMenu({ x: e.clientX, y: e.clientY, patient });
  }, [selectPatient, selectedPatients]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  const columns = [
    { key: 'printed', label: 'P', width: 'w-8', sortable: true },
    { key: 'patientId', label: 'Patient ID', width: 'w-44', sortable: true },
    { key: 'patientName', label: 'Patient Name', width: 'w-48', sortable: true },
    { key: 'age', label: 'Age', width: 'w-14', sortable: true },
    { key: 'sex', label: 'Sex', width: 'w-10', sortable: true },
    { key: 'studyDate', label: 'Study Date', width: 'w-28', sortable: true },
    { key: 'studyDescription', label: 'Study Description', width: 'w-36', sortable: true },
    { key: 'images', label: 'Images', width: 'w-16', sortable: true },
    { key: 'modality', label: 'Modality', width: 'w-20', sortable: true },
    { key: 'accessionNumber', label: 'Accession Number', width: 'w-36', sortable: true },
    { key: 'referringPhysician', label: 'Referring Physician', width: 'w-40', sortable: true },
    { key: 'report', label: 'Rep', width: 'w-12', sortable: false },
  ];

  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      // Cycle: asc → desc → none
      setSortDir(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc');
      if (sortDir === 'desc') setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }, [sortKey, sortDir]);

  const sortedPatients = useMemo(() => {
    if (!sortKey || !sortDir) return filteredPatients;
    return [...filteredPatients].sort((a, b) => {
      let aVal: any = (a as any)[sortKey];
      let bVal: any = (b as any)[sortKey];
      // Handle booleans (printed)
      if (typeof aVal === 'boolean') { aVal = aVal ? 1 : 0; bVal = bVal ? 1 : 0; }
      // Handle numbers (images)
      if (sortKey === 'images') { aVal = Number(aVal) || 0; bVal = Number(bVal) || 0; }
      // Parse study date for proper date sorting (DD-MM-YYYY)
      if (sortKey === 'studyDate') {
        const parseDate = (d: string) => {
          if (!d) return 0;
          const parts = d.split(/[-/.]/);
          if (parts.length === 3) return new Date(+parts[2], +parts[1] - 1, +parts[0]).getTime();
          return new Date(d).getTime() || 0;
        };
        aVal = parseDate(aVal); bVal = parseDate(bVal);
      }
      // String comparison
      if (typeof aVal === 'string') { aVal = aVal.toLowerCase(); bVal = (bVal || '').toLowerCase(); }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredPatients, sortKey, sortDir]);

  const multiCount = selectedPatients.size;

  return (
    <div ref={tableRef} className="flex-1 min-h-0 overflow-auto border-b border-app-border flex flex-col">
      <table className="w-full text-xs 2xl:text-sm border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="bg-app-header-bg border-b-2 border-app-accent">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
                className={`${col.width} px-3 2xl:px-4 py-2.5 2xl:py-3 text-center font-bold text-app-accent uppercase tracking-wide border-r border-app-border last:border-r-0 select-none ${col.sortable ? 'cursor-pointer hover:bg-app-accent/10 transition-colors' : ''}`}
              >
                <span className="inline-flex items-center gap-1 justify-center">
                  {col.label}
                  {col.sortable && sortKey === col.key && sortDir && (
                    sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedPatients.map((patient) => {
            const isSelected = selectedPatient?.id === patient.id || selectedPatients.has(patient.id);
            const isNew = newStudyIds.has(patient.id);
            return (
              <tr
                key={patient.id}
                onClick={(e) => handleRowClick(patient, e)}
                onDoubleClick={() => handleRowDoubleClick(patient)}
                onContextMenu={(e) => handleContextMenu(e, patient)}
                className={`border-b border-app-border cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : isNew
                      ? 'hover:bg-app-hover text-green-500 font-semibold'
                      : 'hover:bg-app-hover text-app-text'
                }`}
              >
                <td className="px-3 py-2 text-center border-r border-app-border font-semibold">
                  {patient.printed ? (
                    <span className="text-green-600">Y</span>
                  ) : (
                    <span></span>
                  )}
                </td>
                <td className="px-3 py-2 text-center border-r border-app-border font-semibold">{patient.patientId}</td>
                <td className="px-3 py-2 text-center border-r border-app-border font-semibold">{patient.patientName}</td>
                <td className="px-3 py-2 text-center border-r border-app-border font-semibold">{patient.age}</td>
                <td className="px-3 py-2 text-center border-r border-app-border font-semibold">{patient.sex}</td>
                <td className="px-3 py-2 text-center border-r border-app-border font-semibold">{patient.studyDate}</td>
                <td className="px-3 py-2 text-center border-r border-app-border font-semibold">{patient.studyDescription}</td>
                <td className="px-3 py-2 text-center border-r border-app-border font-semibold">{patient.images}</td>
                <td className="px-3 py-2 text-center border-r border-app-border font-semibold">{patient.modality}</td>
                <td className="px-3 py-2 text-center border-r border-app-border font-semibold">{patient.accessionNumber}</td>
                <td className="px-3 py-2 text-center border-r border-app-border font-semibold">{patient.referringPhysician}</td>
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
          {sortedPatients.length === 0 && (
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
        <div className="flex items-center gap-2">
          <span>
            {multiCount > 1
              ? <span className="text-app-accent font-semibold">{multiCount} records selected</span>
              : multiCount === 1
                ? <span>{selectedPatient?.patientName ?? '1 record selected'}</span>
                : <span>No selection</span>
            }
          </span>
        </div>
        <span className="opacity-60">
          Click to select · <kbd className="border border-app-border rounded px-1 bg-app-bg">Ctrl</kbd>+Click to multi-select · Click selected row to deselect
        </span>
      </div>

      {/* Merge undo toast */}
      {mergeUndo && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-lg shadow-xl text-white text-sm">
          <span>Records merged successfully</span>
          <button
            onClick={handleMergeUndo}
            className="flex items-center gap-1 px-3 py-1 text-xs font-bold bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Undo
          </button>
          <span className="text-[10px] text-gray-400">10s</span>
        </div>
      )}

      {/* Merge dialog */}
      {showMergeDialog && mergePatients.length === 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowMergeDialog(false)}>
          <div className="bg-app-surface border border-app-border rounded-lg shadow-2xl p-5 w-[420px]" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-app-text mb-3">Merge Records</h3>
            <p className="text-xs text-app-text-muted mb-3">Select which patient record to keep. The other record's images will be merged into it.</p>
            <div className="space-y-2 mb-4">
              {mergePatients.map(p => (
                <label
                  key={p.id}
                  className={`flex items-center gap-3 p-2.5 rounded border cursor-pointer transition-colors ${
                    mergePrimaryId === p.id
                      ? 'border-app-accent bg-app-accent/10'
                      : 'border-app-border hover:bg-app-hover'
                  }`}
                >
                  <input
                    type="radio"
                    name="merge-primary"
                    checked={mergePrimaryId === p.id}
                    onChange={() => setMergePrimaryId(p.id)}
                    className="accent-[var(--app-accent)]"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-app-text truncate">{p.patientName}</div>
                    <div className="text-[10px] text-app-text-muted">ID: {p.patientId} · {p.images || 0} images · {p.studyDate}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleMergeConfirm}
                className="flex-1 px-3 py-2 text-xs font-bold bg-app-accent text-white rounded hover:opacity-90 transition-colors"
              >
                Merge Records
              </button>
              <button
                onClick={() => setShowMergeDialog(false)}
                className="px-3 py-2 text-xs font-semibold border border-app-border text-app-text-secondary rounded hover:bg-app-hover transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <PatientContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          patient={contextMenu.patient}
          onClose={() => setContextMenu(null)}
          canMerge={multiCount === 2}
          onMerge={handleMergeClick}
        />
      )}
    </div>
  );
}
