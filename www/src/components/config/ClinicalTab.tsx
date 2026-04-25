import { useState, useEffect } from 'react';
import { useHospitalConfigStore } from '@/stores/hospitalConfigStore';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const PERFORMING_KEY = 'clinical-performing-physicians';
const REFERRING_KEY = 'clinical-referring-physicians';

function loadList(key: string): string[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function saveList(key: string, list: string[]) {
  localStorage.setItem(key, JSON.stringify(list));
}

export function ClinicalTab() {
  const hospitalName = useHospitalConfigStore(s => s.hospitalName);
  const updateField = useHospitalConfigStore(s => s.updateField);

  const [performing, setPerforming] = useState<string[]>(() => loadList(PERFORMING_KEY));
  const [referring, setReferring] = useState<string[]>(() => loadList(REFERRING_KEY));

  const [newPerforming, setNewPerforming] = useState('');
  const [newReferring, setNewReferring] = useState('');
  const [editingPerforming, setEditingPerforming] = useState<number | null>(null);
  const [editingReferring, setEditingReferring] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => { saveList(PERFORMING_KEY, performing); }, [performing]);
  useEffect(() => { saveList(REFERRING_KEY, referring); }, [referring]);

  // Performing physicians CRUD
  const addPerforming = () => {
    if (!newPerforming.trim()) return;
    setPerforming([...performing, newPerforming.trim()]);
    setNewPerforming('');
  };
  const deletePerforming = (i: number) => setPerforming(performing.filter((_, idx) => idx !== i));
  const startEditPerforming = (i: number) => { setEditingPerforming(i); setEditValue(performing[i]); };
  const saveEditPerforming = () => {
    if (editingPerforming === null || !editValue.trim()) return;
    setPerforming(performing.map((p, i) => i === editingPerforming ? editValue.trim() : p));
    setEditingPerforming(null); setEditValue('');
  };

  // Referring physicians CRUD
  const addReferring = () => {
    if (!newReferring.trim()) return;
    setReferring([...referring, newReferring.trim()]);
    setNewReferring('');
  };
  const deleteReferring = (i: number) => setReferring(referring.filter((_, idx) => idx !== i));
  const startEditReferring = (i: number) => { setEditingReferring(i); setEditValue(referring[i]); };
  const saveEditReferring = () => {
    if (editingReferring === null || !editValue.trim()) return;
    setReferring(referring.map((p, i) => i === editingReferring ? editValue.trim() : p));
    setEditingReferring(null); setEditValue('');
  };

  return (
    <div className="space-y-5">
      {/* Hospital Name */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border">Hospital Name</h3>
        <input
          type="text"
          value={hospitalName}
          onChange={(e) => updateField('hospitalName', e.target.value)}
          className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
          placeholder="Enter hospital name"
        />
      </div>

      {/* Performing Physicians */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border">Performing Physicians</h3>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newPerforming}
            onChange={(e) => setNewPerforming(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPerforming()}
            className="flex-1 h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
            placeholder="e.g. Dr. A. Sharma"
          />
          <button onClick={addPerforming} className="flex items-center gap-1 px-3 py-1 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors">
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
        <div className="border border-app-border rounded overflow-hidden max-h-32 overflow-y-auto">
          {performing.length === 0 && <div className="px-3 py-3 text-xs text-app-text-muted text-center">No performing physicians added</div>}
          {performing.map((doc, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs border-b border-app-border last:border-b-0 bg-app-surface">
              {editingPerforming === i ? (
                <div className="flex-1 flex gap-1">
                  <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveEditPerforming()} className="flex-1 h-6 px-1 text-xs border border-app-accent bg-app-bg text-app-text rounded-sm focus:outline-none" autoFocus />
                  <button onClick={saveEditPerforming} className="px-2 text-xs text-green-600 hover:text-green-800 font-semibold">Save</button>
                  <button onClick={() => setEditingPerforming(null)} className="px-2 text-xs text-app-text-muted hover:text-app-text">Cancel</button>
                </div>
              ) : (
                <>
                  <span className="text-app-text">{doc}</span>
                  <div className="flex gap-1">
                    <button onClick={() => startEditPerforming(i)} className="p-0.5 text-app-text-muted hover:text-app-accent"><Pencil className="w-3 h-3" /></button>
                    <button onClick={() => deletePerforming(i)} className="p-0.5 text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Referring Physicians */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border">Referring Physicians</h3>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newReferring}
            onChange={(e) => setNewReferring(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addReferring()}
            className="flex-1 h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
            placeholder="e.g. Dr. R. Patel"
          />
          <button onClick={addReferring} className="flex items-center gap-1 px-3 py-1 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors">
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
        <div className="border border-app-border rounded overflow-hidden max-h-32 overflow-y-auto">
          {referring.length === 0 && <div className="px-3 py-3 text-xs text-app-text-muted text-center">No referring physicians added</div>}
          {referring.map((doc, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs border-b border-app-border last:border-b-0 bg-app-surface">
              {editingReferring === i ? (
                <div className="flex-1 flex gap-1">
                  <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveEditReferring()} className="flex-1 h-6 px-1 text-xs border border-app-accent bg-app-bg text-app-text rounded-sm focus:outline-none" autoFocus />
                  <button onClick={saveEditReferring} className="px-2 text-xs text-green-600 hover:text-green-800 font-semibold">Save</button>
                  <button onClick={() => setEditingReferring(null)} className="px-2 text-xs text-app-text-muted hover:text-app-text">Cancel</button>
                </div>
              ) : (
                <>
                  <span className="text-app-text">{doc}</span>
                  <div className="flex gap-1">
                    <button onClick={() => startEditReferring(i)} className="p-0.5 text-app-text-muted hover:text-app-accent"><Pencil className="w-3 h-3" /></button>
                    <button onClick={() => deleteReferring(i)} className="p-0.5 text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
