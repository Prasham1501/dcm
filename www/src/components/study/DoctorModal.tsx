import { useState } from 'react';
import { Stethoscope, X, Save } from 'lucide-react';
import { useStudyMetaStore } from '@/stores/studyMetaStore';

interface DoctorModalProps {
  studyId: string;
  currentDoctor: string;
  onClose: () => void;
}

const DOCTORS = [
  'Dr. R. Patel',
  'Dr. S. Kumar',
  'Dr. A. Sharma',
  'Dr. M. Desai',
  'Dr. P. Gupta',
  'Dr. N. Singh',
];

export function DoctorModal({ studyId, currentDoctor, onClose }: DoctorModalProps) {
  const [doctor, setDoctor] = useState(currentDoctor);
  const [customDoctor, setCustomDoctor] = useState('');
  const [useCustom, setUseCustom] = useState(!DOCTORS.includes(currentDoctor) && currentDoctor !== '');
  const studyMeta = useStudyMetaStore();

  const handleSave = () => {
    const finalDoctor = useCustom ? customDoctor : doctor;
    if (finalDoctor.trim()) {
      studyMeta.setDoctor(studyId, finalDoctor.trim());
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-app-bg border-2 border-app-accent rounded-lg shadow-2xl w-[400px]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-app-accent text-white rounded-t-lg">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4" />
            <span className="text-sm font-bold">Assign Doctor</span>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-lg font-bold">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Select from list */}
          <div>
            <label className="block text-[10px] font-semibold text-app-text-secondary mb-1">Select Doctor</label>
            <select
              value={useCustom ? '' : doctor}
              onChange={(e) => { setDoctor(e.target.value); setUseCustom(false); }}
              className="w-full h-8 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm"
            >
              <option value="">-- Select --</option>
              {DOCTORS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Or enter custom */}
          <div>
            <label className="block text-[10px] font-semibold text-app-text-secondary mb-1">Or Enter Custom Name</label>
            <input
              type="text"
              value={customDoctor}
              onChange={(e) => { setCustomDoctor(e.target.value); setUseCustom(true); }}
              placeholder="Enter doctor name..."
              className="w-full h-8 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
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
