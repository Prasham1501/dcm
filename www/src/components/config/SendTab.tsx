import { useState, useEffect, useRef } from 'react';
import { useSendToStore } from '@/stores/sendToStore';

export function SendTab() {
  const { destinations, addDestination, removeDestination, updateDestination } = useSendToStore();

  const [editName, setEditName] = useState('');
  const [editHost, setEditHost] = useState('');
  const [editPort, setEditPort] = useState('');
  const [editAeTitle, setEditAeTitle] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [echoLoading, setEchoLoading] = useState(false);
  const migrated = useRef(false);

  // One-time migration from old localStorage 'dicom-send-nodes' to sendToStore
  useEffect(() => {
    if (migrated.current) return;
    migrated.current = true;
    try {
      const raw = localStorage.getItem('dicom-send-nodes');
      if (!raw) return;
      const oldNodes: Array<{ id: string; location: string; ipAddress: string; port: string; aeTitle: string }> = JSON.parse(raw);
      if (!Array.isArray(oldNodes) || oldNodes.length === 0) return;
      const existing = useSendToStore.getState().destinations;
      for (const node of oldNodes) {
        const alreadyExists = existing.some(d => d.host === node.ipAddress && d.port === parseInt(node.port) && d.aeTitle === node.aeTitle);
        if (!alreadyExists) {
          addDestination({ name: node.location, host: node.ipAddress, port: parseInt(node.port) || 104, aeTitle: node.aeTitle || 'ORTHANC', protocol: 'dicom' });
        }
      }
      localStorage.removeItem('dicom-send-nodes');
    } catch { /* ignore migration errors */ }
  }, [addDestination]);

  const clearForm = () => {
    setEditName(''); setEditHost(''); setEditPort(''); setEditAeTitle('');
    setSelectedId(null);
  };

  const handleAddOrUpdate = () => {
    if (!editName.trim() || !editHost.trim() || !editPort.trim()) return;
    if (selectedId) {
      updateDestination(selectedId, { name: editName.trim(), host: editHost.trim(), port: parseInt(editPort) || 104, aeTitle: editAeTitle.trim() || 'ORTHANC' });
      setStatusMsg({ text: 'Destination updated', type: 'success' });
    } else {
      addDestination({ name: editName.trim(), host: editHost.trim(), port: parseInt(editPort) || 104, aeTitle: editAeTitle.trim() || 'ORTHANC', protocol: 'dicom' });
      setStatusMsg({ text: 'Destination added', type: 'success' });
    }
    clearForm();
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleDelete = () => {
    if (!selectedId) return;
    removeDestination(selectedId);
    clearForm();
  };

  const handleSelect = (dest: typeof destinations[0]) => {
    setSelectedId(dest.id);
    setEditName(dest.name);
    setEditHost(dest.host);
    setEditPort(String(dest.port));
    setEditAeTitle(dest.aeTitle);
  };

  const handleEcho = async () => {
    const host = selectedId ? destinations.find(d => d.id === selectedId)?.host || editHost : editHost;
    const port = selectedId ? destinations.find(d => d.id === selectedId)?.port || parseInt(editPort) : parseInt(editPort);
    const aeTitle = selectedId ? destinations.find(d => d.id === selectedId)?.aeTitle || editAeTitle : editAeTitle;
    if (!host || !port || !aeTitle) {
      setStatusMsg({ text: 'Fill in Host, Port, and AE Title to test', type: 'error' });
      setTimeout(() => setStatusMsg(null), 3000);
      return;
    }
    setEchoLoading(true);
    setStatusMsg({ text: `Testing connection to ${host}:${port} (${aeTitle})…`, type: 'info' });
    try {
      const api = (window as any).electronAPI;
      if (api?.dicomEcho) {
        const result = await api.dicomEcho({ host, port, aeTitle });
        setStatusMsg(result.success
          ? { text: `✓ C-ECHO successful — ${host}:${port} (${aeTitle}) is reachable`, type: 'success' }
          : { text: `✗ C-ECHO failed: ${result.error}`, type: 'error' });
      } else {
        setStatusMsg({ text: 'DICOM Echo requires Electron desktop app', type: 'error' });
      }
    } catch (err: any) {
      setStatusMsg({ text: `✗ Echo error: ${err.message}`, type: 'error' });
    } finally {
      setEchoLoading(false);
      setTimeout(() => setStatusMsg(null), 5000);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-app-text-secondary">
        Configure DICOM send destinations. Studies can be sent to these devices via C-STORE from the patient list (right-click → Send To).
      </p>

      {statusMsg && (
        <div className={`px-3 py-2 text-xs rounded border ${
          statusMsg.type === 'success' ? 'text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
          : statusMsg.type === 'error' ? 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          : 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
        }`}>
          {statusMsg.text}
        </div>
      )}

      <div className="flex gap-4">
        {/* Left: Form inputs */}
        <div className="flex-1 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-app-text-secondary mb-1">Location / Name:</label>
            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none" placeholder="e.g. Radiology Workstation" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-app-text-secondary mb-1">IP Address / Hostname:</label>
            <input type="text" value={editHost} onChange={(e) => setEditHost(e.target.value)} className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none" placeholder="e.g. 192.168.1.50" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-app-text-secondary mb-1">Port Number:</label>
            <input type="text" value={editPort} onChange={(e) => setEditPort(e.target.value)} className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none" placeholder="e.g. 11112" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-app-text-secondary mb-1">AE Title:</label>
            <input type="text" value={editAeTitle} onChange={(e) => setEditAeTitle(e.target.value)} className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none" placeholder="e.g. RAD_WS" />
          </div>

          <div className="flex gap-2">
            <button onClick={handleAddOrUpdate} className="px-4 py-1.5 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors">
              {selectedId ? 'Update' : 'Add >'}
            </button>
            <button onClick={handleEcho} disabled={echoLoading || (!editHost && !selectedId)} className="px-4 py-1.5 text-xs font-semibold border-2 border-blue-500 text-blue-500 bg-app-bg rounded hover:bg-blue-500 hover:text-white transition-colors disabled:opacity-40">
              {echoLoading ? 'Testing…' : 'Test Echo'}
            </button>
            {selectedId && (
              <button onClick={clearForm} className="px-4 py-1.5 text-xs font-semibold border border-app-border text-app-text bg-app-bg rounded hover:bg-app-hover transition-colors">New</button>
            )}
          </div>
        </div>

        {/* Right: Destination list */}
        <div className="w-56 flex flex-col">
          <div className="flex-1 border border-app-border rounded bg-app-bg overflow-auto max-h-52">
            {destinations.length === 0 && <div className="px-3 py-4 text-xs text-app-text-muted text-center">No destinations configured</div>}
            {destinations.map((dest) => (
              <div key={dest.id} onClick={() => handleSelect(dest)} className={`px-3 py-2 text-xs cursor-pointer border-b border-app-border last:border-b-0 ${selectedId === dest.id ? 'bg-blue-600 text-white' : 'hover:bg-app-hover text-app-text'}`}>
                <div className="font-semibold">{dest.name}</div>
                <div className={selectedId === dest.id ? 'text-blue-100' : 'text-app-text-muted'}>{dest.host}:{dest.port} ({dest.aeTitle})</div>
              </div>
            ))}
          </div>
          <button onClick={handleDelete} disabled={!selectedId} className="mt-2 px-4 py-1.5 text-xs font-semibold border-2 border-red-500 text-red-500 bg-app-bg rounded hover:bg-red-500 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Delete</button>
        </div>
      </div>
    </div>
  );
}
