import { useState } from 'react';
import type { Patient } from '@/types/patient';

interface CreatePatientModalProps {
  onSave: (patient: Patient) => void;
  onClose: () => void;
}

export function CreatePatientModal({ onSave, onClose }: CreatePatientModalProps) {
  const [form, setForm] = useState({
    patientId: '',
    patientName: '',
    age: '',
    sex: '' as Patient['sex'],
    studyDescription: '',
    referringPhysician: '',
    modality: 'US',
    accessionNumber: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patientName.trim()) {
      alert('Patient name is required');
      return;
    }
    const today = new Date();
    const studyDate = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;
    const patient: Patient = {
      id: crypto.randomUUID(),
      patientId: form.patientId || `P${Date.now()}`,
      patientName: form.patientName,
      age: form.age,
      sex: form.sex,
      studyDate,
      studyDescription: form.studyDescription,
      images: 0,
      modality: form.modality,
      accessionNumber: form.accessionNumber,
      referringPhysician: form.referringPhysician,
      printed: false,
    };
    onSave(patient);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-app-bg border border-app-border rounded-lg shadow-xl p-6 min-w-[450px] max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-app-text mb-4">Create New Patient</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-app-text-secondary mb-1">Patient ID (auto-generated if empty)</label>
            <input
              type="text"
              value={form.patientId}
              onChange={(e) => setForm({ ...form, patientId: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-app-border rounded bg-app-bg text-app-text"
              placeholder="Leave empty for auto-generated ID"
            />
          </div>
          <div>
            <label className="block text-xs text-app-text-secondary mb-1">Patient Name *</label>
            <input
              type="text"
              value={form.patientName}
              onChange={(e) => setForm({ ...form, patientName: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-app-border rounded bg-app-bg text-app-text"
              required
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-app-text-secondary mb-1">Age</label>
              <input
                type="text"
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-app-border rounded bg-app-bg text-app-text"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-app-text-secondary mb-1">Sex</label>
              <select
                value={form.sex}
                onChange={(e) => setForm({ ...form, sex: e.target.value as Patient['sex'] })}
                className="w-full px-3 py-2 text-sm border border-app-border rounded bg-app-bg text-app-text"
              >
                <option value="">--</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-app-text-secondary mb-1">Study Description</label>
            <input
              type="text"
              value={form.studyDescription}
              onChange={(e) => setForm({ ...form, studyDescription: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-app-border rounded bg-app-bg text-app-text"
            />
          </div>
          <div>
            <label className="block text-xs text-app-text-secondary mb-1">Referring Physician</label>
            <input
              type="text"
              value={form.referringPhysician}
              onChange={(e) => setForm({ ...form, referringPhysician: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-app-border rounded bg-app-bg text-app-text"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-app-text-secondary mb-1">Modality</label>
              <input
                type="text"
                value={form.modality}
                onChange={(e) => setForm({ ...form, modality: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-app-border rounded bg-app-bg text-app-text"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-app-text-secondary mb-1">Accession Number</label>
              <input
                type="text"
                value={form.accessionNumber}
                onChange={(e) => setForm({ ...form, accessionNumber: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-app-border rounded bg-app-bg text-app-text"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-app-border rounded text-app-text hover:bg-app-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm rounded bg-app-accent text-white hover:bg-app-accent/80 transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
