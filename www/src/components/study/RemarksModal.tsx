import { useState } from 'react';
import { MessageSquare, X, Save } from 'lucide-react';
import { useStudyMetaStore } from '@/stores/studyMetaStore';

interface RemarksModalProps {
  studyId: string;
  studyDescription: string;
  onClose: () => void;
}

export function RemarksModal({ studyId, studyDescription, onClose }: RemarksModalProps) {
  const studyMeta = useStudyMetaStore();
  const [remarks, setRemarks] = useState(studyMeta.remarks[studyId] || '');

  const handleSave = () => {
    studyMeta.setRemarks(studyId, remarks.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-app-bg border-2 border-app-accent rounded-lg shadow-2xl w-[450px]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-app-accent text-white rounded-t-lg">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            <span className="text-sm font-bold">Study Remarks</span>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-lg font-bold">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="text-xs text-app-text-secondary">
            Study: <span className="font-semibold text-app-text">{studyDescription}</span>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-app-text-secondary mb-1">Remarks / Notes</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={5}
              placeholder="Enter remarks or notes about this study..."
              className="w-full px-3 py-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm resize-y focus:border-app-accent focus:outline-none leading-relaxed"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-app-border">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold border-2 border-app-border text-app-text bg-app-bg rounded hover:bg-app-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-xs font-semibold border-2 border-app-accent text-white bg-app-accent rounded hover:bg-app-accent-hover transition-colors flex items-center gap-1"
          >
            <Save className="w-3 h-3" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
