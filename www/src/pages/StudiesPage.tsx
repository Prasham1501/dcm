import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '@/stores/themeStore';
import { useReportStore } from '@/stores/reportStore';
import { useStudyMetaStore } from '@/stores/studyMetaStore';
import { usePatientStore } from '@/stores/patientStore';
import { useViewerStore } from '@/stores/viewerStore';
import { Sun, Moon, ArrowLeft, FileText, Eye, Stethoscope, MessageSquare, Merge } from 'lucide-react';
import { DoctorModal } from '@/components/study/DoctorModal';
import { RemarksModal } from '@/components/study/RemarksModal';
import { ReportEditor } from '@/components/report/ReportEditor';
import type { Report } from '@/types/study';

export function StudiesPage() {
  const navigate = useNavigate();
  const { mode, toggleTheme } = useThemeStore();
  const reportStore = useReportStore();
  const studyMeta = useStudyMetaStore();
  const { patients } = usePatientStore();
  const loadStudyFiles = useViewerStore((s) => s.loadStudyFiles);

  const [selectedStudyId, setSelectedStudyId] = useState<string | null>(null);
  const [reportPanelOpen, setReportPanelOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDoctorModal, setShowDoctorModal] = useState<string | null>(null);
  const [showRemarksModal, setShowRemarksModal] = useState<string | null>(null);
  const [showReportEditor, setShowReportEditor] = useState<{studyId: string; mode: 'create' | 'edit'} | null>(null);

  const filteredStudies = useMemo(() => {
    if (!searchTerm) return patients;
    const term = searchTerm.toLowerCase();
    return patients.filter(p =>
      p.patientName.toLowerCase().includes(term) ||
      p.patientId.toLowerCase().includes(term) ||
      p.studyDescription.toLowerCase().includes(term) ||
      p.accessionNumber.toLowerCase().includes(term)
    );
  }, [patients, searchTerm]);

  const selectedPatient = patients.find(p => p.id === selectedStudyId);
  const selectedReport: Report | undefined = selectedStudyId
    ? reportStore.getReport(selectedStudyId)
    : undefined;

  const handleViewReport = (patientId: string) => {
    setSelectedStudyId(patientId);
    setReportPanelOpen(true);
  };

  const handleOpenInViewer = (patientId: string) => {
    const p = patients.find(pt => pt.id === patientId);
    if (p?.filePaths && p.filePaths.length > 0) {
      loadStudyFiles({
        patientName: p.patientName,
        patientId: p.patientId,
        studyDate: p.studyDate,
        filePaths: p.filePaths,
      });
    }
    navigate('/viewer');
  };

  return (
    <div className="flex flex-col h-screen bg-app-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-app-header-bg border-b-2 border-app-accent">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-1 text-app-accent hover:bg-app-hover rounded"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-app-accent">MediView Pro</span>
          <span className="text-xs text-app-text-muted">|</span>
          <span className="text-sm font-semibold text-app-text">Studies</span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search studies..."
            className="h-7 w-56 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
          />
          <button
            onClick={() => alert('Select 2 or more studies to merge by clicking their rows while holding Ctrl.')}
            className="px-3 py-1 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors flex items-center gap-1"
          >
            <Merge className="w-3 h-3" />
            Merge Studies
          </button>
          <button
            onClick={toggleTheme}
            className="p-1 rounded hover:bg-app-hover transition-colors text-app-text-secondary"
          >
            {mode === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Studies table */}
        <div className="flex-1 overflow-auto">
          {filteredStudies.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-app-text-muted">
              <FileText className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-sm font-semibold">No studies available</p>
              <p className="text-xs mt-1">Use the folder sync on the patients page to load DICOM studies</p>
              <button
                onClick={() => navigate('/')}
                className="mt-4 px-4 py-1.5 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors"
              >
                Go to Patients
              </button>
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-app-header-bg border-b-2 border-app-accent">
                  <th className="px-3 py-2.5 text-left font-bold text-app-accent uppercase tracking-wide border-r border-app-border">Patient</th>
                  <th className="px-3 py-2.5 text-left font-bold text-app-accent uppercase tracking-wide border-r border-app-border w-24">Date</th>
                  <th className="px-3 py-2.5 text-left font-bold text-app-accent uppercase tracking-wide border-r border-app-border w-16">Mod</th>
                  <th className="px-3 py-2.5 text-left font-bold text-app-accent uppercase tracking-wide border-r border-app-border w-28">Description</th>
                  <th className="px-3 py-2.5 text-left font-bold text-app-accent uppercase tracking-wide border-r border-app-border w-16">Images</th>
                  <th className="px-3 py-2.5 text-left font-bold text-app-accent uppercase tracking-wide border-r border-app-border w-20">Doctor</th>
                  <th className="px-3 py-2.5 text-center font-bold text-app-accent uppercase tracking-wide w-48">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudies.map((patient) => {
                  const hasReport = !!reportStore.getReport(patient.id);
                  const assignedDoctor = studyMeta.doctors[patient.id] || patient.referringPhysician;
                  return (
                    <tr
                      key={patient.id}
                      onClick={() => setSelectedStudyId(patient.id)}
                      className={`border-b border-app-border cursor-pointer transition-colors ${
                        selectedStudyId === patient.id
                          ? 'bg-blue-600 text-white'
                          : 'hover:bg-app-hover text-app-text'
                      }`}
                    >
                      <td className="px-3 py-2.5 border-r border-app-border">
                        <div className="font-semibold">{patient.patientName}</div>
                        <div className={`text-[10px] font-mono ${selectedStudyId === patient.id ? 'text-blue-100' : 'text-app-text-muted'}`}>
                          {patient.patientId}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 border-r border-app-border">{patient.studyDate}</td>
                      <td className="px-3 py-2.5 border-r border-app-border font-semibold">{patient.modality}</td>
                      <td className="px-3 py-2.5 border-r border-app-border">{patient.studyDescription}</td>
                      <td className="px-3 py-2.5 border-r border-app-border text-center">{patient.images}</td>
                      <td className="px-3 py-2.5 border-r border-app-border text-[10px] truncate max-w-[80px]">{assignedDoctor || '—'}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-1">
                          <ActionBtn
                            icon={<Eye className="w-3 h-3" />}
                            label="View"
                            onClick={(e) => { e.stopPropagation(); handleOpenInViewer(patient.id); }}
                            selected={selectedStudyId === patient.id}
                          />
                          <ActionBtn
                            icon={<FileText className="w-3 h-3" />}
                            label="Report"
                            onClick={(e) => { e.stopPropagation(); handleViewReport(patient.id); }}
                            selected={selectedStudyId === patient.id}
                            highlight={hasReport}
                          />
                          <ActionBtn
                            icon={<Stethoscope className="w-3 h-3" />}
                            label="Doctor"
                            onClick={(e) => { e.stopPropagation(); setShowDoctorModal(patient.id); }}
                            selected={selectedStudyId === patient.id}
                          />
                          <ActionBtn
                            icon={<MessageSquare className="w-3 h-3" />}
                            label="Remarks"
                            onClick={(e) => { e.stopPropagation(); setShowRemarksModal(patient.id); }}
                            selected={selectedStudyId === patient.id}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Report panel */}
        {reportPanelOpen && (
          <div className="w-[45%] border-l-2 border-app-accent flex flex-col bg-app-surface overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-app-header-bg border-b border-app-border">
              <span className="text-xs font-bold text-app-accent">
                {selectedReport ? 'Report' : 'No Report'}
                {selectedPatient && ` - ${selectedPatient.patientName}`}
              </span>
              <div className="flex items-center gap-2">
                {!selectedReport && selectedStudyId && (
                  <button
                    onClick={() => setShowReportEditor({ studyId: selectedStudyId, mode: 'create' })}
                    className="px-3 py-1 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors"
                  >
                    Create Report
                  </button>
                )}
                <button
                  onClick={() => setReportPanelOpen(false)}
                  className="text-app-text-muted hover:text-app-text text-lg font-bold px-1"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {selectedReport ? (
                <ReportView
                  report={selectedReport}
                  onEdit={() => setShowReportEditor({ studyId: selectedReport.studyId, mode: 'edit' })}
                  onPrint={() => reportStore.printReport(selectedReport.studyId)}
                  onExport={() => reportStore.printReport(selectedReport.studyId)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-app-text-muted">
                  <FileText className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">No report available for this study.</p>
                  {selectedStudyId && (
                    <button
                      onClick={() => setShowReportEditor({ studyId: selectedStudyId, mode: 'create' })}
                      className="mt-3 px-4 py-1.5 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors"
                    >
                      Create New Report
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1 bg-app-statusbar-bg border-t border-app-border text-xs text-app-text-secondary">
        <span>Total Studies: {filteredStudies.length}</span>
        <span>
          With Reports: {filteredStudies.filter(p => !!reportStore.getReport(p.id)).length} |
          Without Reports: {filteredStudies.filter(p => !reportStore.getReport(p.id)).length}
        </span>
      </div>

      {/* Modals */}
      {showDoctorModal && (
        <DoctorModal
          studyId={showDoctorModal}
          currentDoctor={studyMeta.doctors[showDoctorModal] || patients.find(p => p.id === showDoctorModal)?.referringPhysician || ''}
          onClose={() => setShowDoctorModal(null)}
        />
      )}
      {showRemarksModal && (() => {
        const patient = patients.find(p => p.id === showRemarksModal);
        return (
          <RemarksModal
            studyId={showRemarksModal}
            studyDescription={patient?.studyDescription || ''}
            onClose={() => setShowRemarksModal(null)}
          />
        );
      })()}
      {showReportEditor && <ReportEditor />}
    </div>
  );
}

function ActionBtn({ icon, label, onClick, selected, highlight }: {
  icon: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  selected: boolean;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 text-[10px] font-semibold rounded border transition-colors flex items-center gap-1 ${
        selected
          ? highlight
            ? 'border-green-300 text-green-100 hover:bg-green-700'
            : 'border-blue-300 text-blue-100 hover:bg-blue-700'
          : highlight
            ? 'border-green-600 text-green-700 hover:bg-green-50'
            : 'border-app-border text-app-text-secondary hover:bg-app-hover'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ReportView({ report, onEdit, onPrint, onExport }: {
  report: Report;
  onEdit: () => void;
  onPrint: () => void;
  onExport: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="pb-3 border-b-2 border-app-accent">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-app-accent">{report.title}</h3>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            report.status === 'final' ? 'bg-green-600 text-white' :
            report.status === 'draft' ? 'bg-yellow-500 text-black' :
            'bg-blue-500 text-white'
          }`}>
            {report.status.toUpperCase()}
          </span>
        </div>
        <div className="flex gap-4 mt-1 text-xs text-app-text-secondary">
          <span>Date: {report.date}</span>
          <span>Doctor: {report.doctor}</span>
        </div>
      </div>
      <div>
        <h4 className="text-xs font-bold text-app-accent mb-1">FINDINGS</h4>
        <p className="text-xs text-app-text leading-relaxed">{report.findings}</p>
      </div>
      <div>
        <h4 className="text-xs font-bold text-app-accent mb-1">IMPRESSION</h4>
        <p className="text-xs text-app-text leading-relaxed">{report.impression}</p>
      </div>
      <div>
        <h4 className="text-xs font-bold text-app-accent mb-1">RECOMMENDATION</h4>
        <p className="text-xs text-app-text leading-relaxed">{report.recommendation}</p>
      </div>
      <div className="flex gap-2 pt-3 border-t border-app-border">
        <button onClick={onEdit} className="px-3 py-1 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors">Edit Report</button>
        <button onClick={onPrint} className="px-3 py-1 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors">Print Report</button>
        <button onClick={onExport} className="px-3 py-1 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors">Export PDF</button>
      </div>
    </div>
  );
}
