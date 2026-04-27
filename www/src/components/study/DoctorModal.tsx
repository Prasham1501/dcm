import { useState, useEffect, useRef } from 'react';
import { Stethoscope, X, Save, Plus } from 'lucide-react';
import { useStudyMetaStore } from '@/stores/studyMetaStore';

interface DoctorModalProps {
  studyId: string;
  currentDoctor: string;
  onClose: () => void;
}

const REFERRING_KEY = 'clinical-referring-physicians';

function loadReferringDoctors(): string[] {
  try { return JSON.parse(localStorage.getItem(REFERRING_KEY) || '[]'); } catch { return []; }
}
function saveReferringDoctors(list: string[]) {
  localStorage.setItem(REFERRING_KEY, JSON.stringify(list));
}

export function DoctorModal({ studyId, currentDoctor, onClose }: DoctorModalProps) {
  const [doctor, setDoctor] = useState(currentDoctor);
  const [doctors, setDoctors] = useState<string[]>(() => loadReferringDoctors());
  const [showDropdown, setShowDropdown] = useState(false);
  const [newDoctorName, setNewDoctorName] = useState('');
  const [showAddNew, setShowAddNew] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const studyMeta = useStudyMetaStore();

  // Filter doctors based on input
  const filtered = doctor.trim()
    ? doctors.filter(d => d.toLowerCase().includes(doctor.toLowerCase()))
    : doctors;

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSave = () => {
    if (doctor.trim()) {
      studyMeta.setDoctor(studyId, doctor.trim());
    }
    onClose();
  };

  const handleSelect = (d: string) => {
    setDoctor(d);
    setShowDropdown(false);
  };

  const handleAddNew = () => {
    const name = newDoctorName.trim();
    if (!name) return;
    if (doctors.some(d => d.toLowerCase() === name.toLowerCase())) return;
    const updated = [...doctors, name];
    setDoctors(updated);
    saveReferringDoctors(updated);
    setDoctor(name);
    setNewDoctorName('');
    setShowAddNew(false);
    setShowDropdown(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-app-bg border-2 border-app-accent rounded-lg shadow-2xl w-[400px]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-app-accent text-white rounded-t-lg">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4" />
            <span className="text-sm font-bold">Assign Referral Doctor</span>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-lg font-bold">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Doctor search/select combo */}
          <div className="relative">
            <label className="block text-[10px] font-semibold text-app-text-secondary mb-1">Referral Doctor</label>
            <input
              ref={inputRef}
              type="text"
              value={doctor}
              onChange={(e) => { setDoctor(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Type to search or select..."
              className="w-full h-8 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
            />
            {showDropdown && (
              <div ref={dropdownRef} className="absolute z-50 w-full mt-0.5 border border-app-border bg-app-bg rounded shadow-lg max-h-40 overflow-y-auto">
                {filtered.length === 0 && !showAddNew && (
                  <div className="px-3 py-2 text-xs text-app-text-muted text-center">No matching doctors</div>
                )}
                {filtered.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelect(d)}
                    className="w-full text-left px-3 py-1.5 text-xs text-app-text hover:bg-app-accent/20 transition-colors border-b border-app-border last:border-b-0"
                  >
                    {d}
                  </button>
                ))}
                {/* Add new doctor inline */}
                {showAddNew ? (
                  <div className="flex gap-1 p-1.5 border-t border-app-border bg-app-surface">
                    <input
                      type="text"
                      value={newDoctorName}
                      onChange={(e) => setNewDoctorName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddNew()}
                      placeholder="e.g. Dr. R. Patel"
                      className="flex-1 h-6 px-1.5 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:outline-none focus:border-app-accent"
                      autoFocus
                    />
                    <button onClick={handleAddNew} className="px-2 text-xs font-semibold text-green-600 hover:text-green-800">Add</button>
                    <button onClick={() => { setShowAddNew(false); setNewDoctorName(''); }} className="px-2 text-xs text-app-text-muted hover:text-app-text">Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddNew(true)}
                    className="w-full flex items-center gap-1 px-3 py-1.5 text-xs text-app-accent font-semibold hover:bg-app-accent/10 border-t border-app-border"
                  >
                    <Plus className="w-3 h-3" /> Add New Doctor
                  </button>
                )}
              </div>
            )}
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
