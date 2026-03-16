import { useState } from 'react';
import { Save, Printer, FileText, X } from 'lucide-react';
import { useReportStore } from '@/stores/reportStore';
import { useHospitalConfigStore, getFormattedAddress } from '@/stores/hospitalConfigStore';
import type { Report } from '@/types/study';

interface ReportEditorProps {
  studyId: string;
  mode: 'create' | 'edit';
  existingReport?: Report;
  patientName?: string;
  studyDate?: string;
  studyDescription?: string;
  onClose: () => void;
  onSave: () => void;
}

const REPORT_TEMPLATES = [
  { id: 'ob', name: 'Obstetric Ultrasound' },
  { id: 'abd', name: 'Abdominal Ultrasound' },
  { id: 'thy', name: 'Thyroid Ultrasound' },
  { id: 'vas', name: 'Vascular Ultrasound' },
  { id: 'msk', name: 'Musculoskeletal Ultrasound' },
  { id: 'breast', name: 'Breast Ultrasound' },
  { id: 'custom', name: 'Custom Report' },
];

export function ReportEditor({
  studyId,
  mode,
  existingReport,
  patientName = 'Unknown Patient',
  studyDate = '',
  studyDescription = '',
  onClose,
  onSave,
}: ReportEditorProps) {
  const reportStore = useReportStore();
  const hospitalConfig = useHospitalConfigStore();

  const [template, setTemplate] = useState(existingReport ? 'custom' : 'ob');
  const [findings, setFindings] = useState(existingReport?.findings || '');
  const [impression, setImpression] = useState(existingReport?.impression || '');
  const [recommendation, setRecommendation] = useState(existingReport?.recommendation || '');
  const [doctor, setDoctor] = useState(existingReport?.doctor || 'Dr. R. Patel');
  const [status, setStatus] = useState<'draft' | 'final'>(
    existingReport?.status === 'final' ? 'final' : 'draft'
  );
  const [title, setTitle] = useState(
    existingReport?.title || `${studyDescription || 'Ultrasound'} Report`
  );

  // Header fields default from hospital config
  const [headerLine1, setHeaderLine1] = useState(hospitalConfig.hospitalName);
  const [headerLine2, setHeaderLine2] = useState(getFormattedAddress(hospitalConfig));
  const [headerLine3, setHeaderLine3] = useState(
    [hospitalConfig.phone ? `Phone: ${hospitalConfig.phone}` : '', hospitalConfig.email ? `Email: ${hospitalConfig.email}` : '']
      .filter(Boolean)
      .join(' | ')
  );

  const handleSave = () => {
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    reportStore.saveReport(studyId, {
      title,
      date: existingReport?.date || today,
      doctor,
      findings,
      impression,
      recommendation,
      status,
    });
    onSave();
  };

  const handlePrint = () => {
    // Save first, then print
    handleSave();
    // Small delay to ensure store is updated
    setTimeout(() => {
      reportStore.printReport(studyId);
    }, 100);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-app-bg border-2 border-app-accent rounded-lg shadow-2xl w-[820px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-app-accent text-white">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span className="text-sm font-bold">
              {mode === 'edit' ? 'Edit Report' : 'Create Report'}
            </span>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-lg font-bold">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Patient & Template row */}
          <div className="flex gap-4">
            <div className="flex-1 p-3 bg-app-surface border border-app-border rounded">
              <div className="text-[10px] font-bold text-app-text-secondary mb-1">PATIENT</div>
              <div className="text-xs font-semibold text-app-text">{patientName}</div>
              <div className="text-[10px] text-app-text-muted">{studyDate} | {studyDescription}</div>
            </div>
            <div className="w-56">
              <label className="block text-[10px] font-semibold text-app-text-secondary mb-1">Report Template</label>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm"
              >
                {REPORT_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="w-40">
              <label className="block text-[10px] font-semibold text-app-text-secondary mb-1">Reporting Doctor</label>
              <select
                value={doctor}
                onChange={(e) => setDoctor(e.target.value)}
                className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm"
              >
                <option>Dr. R. Patel</option>
                <option>Dr. S. Kumar</option>
                <option>Dr. A. Sharma</option>
                <option>Dr. M. Desai</option>
              </select>
            </div>
          </div>

          {/* Report Title */}
          <div>
            <label className="block text-xs font-bold text-app-accent mb-1">Report Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm font-semibold focus:border-app-accent focus:outline-none"
            />
          </div>

          {/* Report Header Customization */}
          <div>
            <h4 className="text-xs font-bold text-app-accent mb-2">Report Header</h4>
            <div className="space-y-2">
              <input
                type="text"
                value={headerLine1}
                onChange={(e) => setHeaderLine1(e.target.value)}
                placeholder="Hospital/Clinic Name"
                className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm font-semibold"
              />
              <input
                type="text"
                value={headerLine2}
                onChange={(e) => setHeaderLine2(e.target.value)}
                placeholder="Address"
                className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm"
              />
              <input
                type="text"
                value={headerLine3}
                onChange={(e) => setHeaderLine3(e.target.value)}
                placeholder="Phone, Email, etc."
                className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm"
              />
            </div>
          </div>

          {/* Findings */}
          <div>
            <label className="block text-xs font-bold text-app-accent mb-1">Findings</label>
            <textarea
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              rows={5}
              placeholder="Enter ultrasound findings..."
              className="w-full px-3 py-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm resize-y focus:border-app-accent focus:outline-none leading-relaxed"
            />
          </div>

          {/* Impression */}
          <div>
            <label className="block text-xs font-bold text-app-accent mb-1">Impression</label>
            <textarea
              value={impression}
              onChange={(e) => setImpression(e.target.value)}
              rows={3}
              placeholder="Enter impression..."
              className="w-full px-3 py-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm resize-y focus:border-app-accent focus:outline-none leading-relaxed"
            />
          </div>

          {/* Recommendation */}
          <div>
            <label className="block text-xs font-bold text-app-accent mb-1">Recommendation</label>
            <textarea
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              rows={2}
              placeholder="Enter recommendation..."
              className="w-full px-3 py-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm resize-y focus:border-app-accent focus:outline-none leading-relaxed"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-app-border">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-app-text">
              <input
                type="radio"
                checked={status === 'draft'}
                onChange={() => setStatus('draft')}
                className="accent-app-accent"
              />
              Draft
            </label>
            <label className="flex items-center gap-1 text-xs text-app-text">
              <input
                type="radio"
                checked={status === 'final'}
                onChange={() => setStatus('final')}
                className="accent-app-accent"
              />
              Final
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold border-2 border-app-border text-app-text bg-app-bg rounded hover:bg-app-hover transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors flex items-center gap-1"
            >
              <Printer className="w-3 h-3" />
              Print
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-semibold border-2 border-app-accent text-white bg-app-accent rounded hover:bg-app-accent-hover transition-colors flex items-center gap-1"
            >
              <Save className="w-3 h-3" />
              Save Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
