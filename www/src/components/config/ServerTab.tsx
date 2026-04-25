import { useState, useEffect, useCallback } from 'react';
import { settingsService, type DicomNode } from '@/services/settingsService';

interface ServerFormState {
  id: number | null;
  name: string;
  ae_title: string;
  host_name: string;
  port: string;
  is_default: boolean;
}

const EMPTY_FORM: ServerFormState = {
  id: null, name: '', ae_title: '', host_name: '', port: '', is_default: false,
};

const LS_NODES_KEY = 'dicom-server-nodes';
const LS_FILTER_KEY = 'dicom-filter-secondary';

function loadLocalNodes(): DicomNode[] {
  try { return JSON.parse(localStorage.getItem(LS_NODES_KEY) || '[]'); } catch { return []; }
}
function saveLocalNodes(nodes: DicomNode[]) {
  localStorage.setItem(LS_NODES_KEY, JSON.stringify(nodes));
}

export function ServerTab() {
  const [servers, setServers] = useState<DicomNode[]>([]);
  const [editServer, setEditServer] = useState<ServerFormState>({ ...EMPTY_FORM });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [filterSecondary, setFilterSecondary] = useState(() => {
    const stored = localStorage.getItem(LS_FILTER_KEY);
    return stored !== null ? stored === 'true' : true;
  });
  const [useApi, setUseApi] = useState(true);

  /** Load nodes - try API first, fallback to localStorage */
  const loadNodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nodes = await settingsService.getNodes();
      setServers(nodes);
      saveLocalNodes(nodes); // cache locally
      setUseApi(true);
    } catch (err: any) {
      console.warn('[ServerTab] API unavailable, using localStorage:', err?.message);
      const localNodes = loadLocalNodes();
      setServers(localNodes);
      setUseApi(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNodes(); }, [loadNodes]);

  // Load filter preference
  useEffect(() => {
    settingsService.getSettings().then((settings) => {
      if (settings.filter_secondary_images !== undefined) {
        const val = settings.filter_secondary_images === true || settings.filter_secondary_images === 'true' || settings.filter_secondary_images === '1';
        setFilterSecondary(val);
        localStorage.setItem(LS_FILTER_KEY, String(val));
      }
    }).catch(() => { /* use localStorage value */ });
  }, []);

  const clearForm = () => { setEditServer({ ...EMPTY_FORM }); setSelectedId(null); };

  const handleAdd = async () => {
    if (!editServer.name.trim() || !editServer.host_name.trim() || !editServer.port.trim()) return;
    setSaving(true); setError(null);
    try {
      const nodePayload: Omit<DicomNode, 'id'> & { id?: number } = {
        name: editServer.name, ae_title: editServer.ae_title,
        host_name: editServer.host_name, port: parseInt(editServer.port, 10) || 0,
        is_default: editServer.is_default,
      };
      if (selectedId !== null) nodePayload.id = selectedId;

      if (useApi) {
        try {
          await settingsService.saveNode(nodePayload);
          await loadNodes(); clearForm();
          return;
        } catch { /* fall through to local save */ }
      }

      // localStorage fallback
      let localNodes = loadLocalNodes();
      if (selectedId !== null) {
        localNodes = localNodes.map(n => n.id === selectedId ? { ...nodePayload, id: selectedId } as DicomNode : n);
      } else {
        const newId = Date.now();
        localNodes.push({ ...nodePayload, id: newId } as DicomNode);
      }
      if (nodePayload.is_default) {
        localNodes = localNodes.map(n => ({ ...n, is_default: n.id === (selectedId ?? localNodes[localNodes.length - 1].id) }));
      }
      saveLocalNodes(localNodes);
      setServers(localNodes);
      clearForm();
      setStatusMsg('Node saved locally');
      setTimeout(() => setStatusMsg(null), 2000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save DICOM node');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (selectedId === null) return;
    setSaving(true); setError(null);
    try {
      if (useApi) {
        try {
          await settingsService.deleteNode(selectedId);
          await loadNodes(); clearForm();
          return;
        } catch { /* fall through */ }
      }
      // localStorage fallback
      const localNodes = loadLocalNodes().filter(n => n.id !== selectedId);
      saveLocalNodes(localNodes);
      setServers(localNodes);
      clearForm();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete DICOM node');
    } finally { setSaving(false); }
  };

  const handleSelectServer = (server: DicomNode) => {
    setSelectedId(server.id);
    setEditServer({
      id: server.id, name: server.name, ae_title: server.ae_title,
      host_name: server.host_name, port: String(server.port), is_default: server.is_default,
    });
  };

  const handleExportConfig = () => {
    const config = { servers, filterSecondary, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `dicom-server-config-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    setStatusMsg('Configuration exported successfully');
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleImportConfig = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const config = JSON.parse(text);
        if (!config.servers || !Array.isArray(config.servers)) throw new Error('Invalid config file');
        // Save all imported nodes
        const imported: DicomNode[] = config.servers.map((s: any, i: number) => ({
          id: s.id || Date.now() + i,
          name: s.name, ae_title: s.ae_title,
          host_name: s.host_name, port: s.port, is_default: s.is_default,
        }));
        saveLocalNodes(imported);
        setServers(imported);
        if (config.filterSecondary !== undefined) {
          setFilterSecondary(config.filterSecondary);
          localStorage.setItem(LS_FILTER_KEY, String(config.filterSecondary));
        }
        // Also try API
        if (useApi) {
          for (const server of config.servers) {
            try { await settingsService.saveNode({ name: server.name, ae_title: server.ae_title, host_name: server.host_name, port: server.port, is_default: server.is_default }); } catch { /* ignore */ }
          }
        }
        setStatusMsg('Configuration imported successfully');
        setTimeout(() => setStatusMsg(null), 3000);
      } catch (err: any) { setError('Failed to import: ' + (err.message || 'Invalid file')); }
    };
    input.click();
  };

  const handleApply = async () => {
    setSaving(true); setStatusMsg(null);
    localStorage.setItem(LS_FILTER_KEY, String(filterSecondary));
    try {
      await settingsService.updateSettings({ filter_secondary_images: filterSecondary });
      setStatusMsg('Settings applied successfully');
    } catch {
      setStatusMsg('Settings saved locally');
    }
    setTimeout(() => setStatusMsg(null), 3000);
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      <p className="text-xs text-app-text-secondary">
        Configure Orthanc PACS server connections for retrieving and storing DICOM studies.
      </p>

      {error && (
        <div className="px-3 py-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline hover:no-underline">dismiss</button>
        </div>
      )}
      {statusMsg && (
        <div className="px-3 py-2 text-xs text-green-600 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
          {statusMsg}
        </div>
      )}

      {/* Server Status */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border">Server Settings</h3>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-xs font-semibold text-app-text-secondary mb-1">Server Port</label>
            <input type="text" value="8043" readOnly className="w-full h-7 px-2 text-xs border border-app-border bg-app-surface text-app-text-muted rounded-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-app-text-secondary mb-1">Server Status</label>
            <div className="flex items-center gap-2 h-7">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-green-600 font-semibold">Running</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-app-text-secondary mb-1">Default AET</label>
            <input type="text" value={servers.find(s => s.is_default)?.ae_title || 'ORTHANC'} readOnly className="w-full h-7 px-2 text-xs border border-app-border bg-app-surface text-app-text-muted rounded-sm" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-app-text mb-3">
          <input type="checkbox" checked={filterSecondary} onChange={(e) => setFilterSecondary(e.target.checked)} className="accent-app-accent w-3.5 h-3.5" />
          Filter secondary/derived images
        </label>
      </div>

      {/* DICOM Nodes */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border">DICOM Nodes</h3>
        <div className="flex gap-4">
          <div className="flex-1 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-app-text-secondary mb-1">Server Name</label>
              <input type="text" value={editServer.name} onChange={(e) => setEditServer({ ...editServer, name: e.target.value })} className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none" placeholder="e.g. Hospital PACS" disabled={saving} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-app-text-secondary mb-1">IP Address / Host</label>
              <input type="text" value={editServer.host_name} onChange={(e) => setEditServer({ ...editServer, host_name: e.target.value })} className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none" placeholder="e.g. 192.168.1.100" disabled={saving} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-app-text-secondary mb-1">Port Number</label>
              <input type="text" value={editServer.port} onChange={(e) => setEditServer({ ...editServer, port: e.target.value })} className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none" placeholder="e.g. 8043" disabled={saving} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-app-text-secondary mb-1">AE Title</label>
              <input type="text" value={editServer.ae_title} onChange={(e) => setEditServer({ ...editServer, ae_title: e.target.value })} className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none" placeholder="e.g. ORTHANC" disabled={saving} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_default" checked={editServer.is_default} onChange={(e) => setEditServer({ ...editServer, is_default: e.target.checked })} disabled={saving} className="accent-app-accent" />
              <label htmlFor="is_default" className="text-xs text-app-text-secondary">Default server</label>
            </div>
            <div className="flex gap-2">
              <button onClick={handleAdd} disabled={saving} className="px-4 py-1.5 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? 'Saving...' : selectedId !== null ? 'Update' : 'Add >'}
              </button>
              {selectedId !== null && (
                <button onClick={clearForm} disabled={saving} className="px-4 py-1.5 text-xs font-semibold border border-app-border text-app-text bg-app-bg rounded hover:bg-app-hover transition-colors disabled:opacity-50">New</button>
              )}
            </div>
          </div>
          <div className="w-56 flex flex-col">
            <div className="flex-1 border border-app-border rounded bg-app-bg overflow-auto max-h-52">
              {loading && <div className="px-3 py-4 text-xs text-app-text-muted text-center">Loading...</div>}
              {!loading && servers.length === 0 && <div className="px-3 py-4 text-xs text-app-text-muted text-center">No servers configured</div>}
              {!loading && servers.map((server) => (
                <div key={server.id} onClick={() => handleSelectServer(server)} className={`px-3 py-2 text-xs cursor-pointer border-b border-app-border last:border-b-0 ${selectedId === server.id ? 'bg-blue-600 text-white' : 'hover:bg-app-hover text-app-text'}`}>
                  <div className="font-semibold">
                    {server.name}
                    {server.is_default && <span className={`ml-1 text-[10px] ${selectedId === server.id ? 'text-blue-200' : 'text-app-accent'}`}>(default)</span>}
                  </div>
                  <div className={selectedId === server.id ? 'text-blue-100' : 'text-app-text-muted'}>{server.host_name}:{server.port}</div>
                </div>
              ))}
            </div>
            <button onClick={handleDelete} disabled={selectedId === null || saving} className="mt-2 px-4 py-1.5 text-xs font-semibold border-2 border-red-500 text-red-500 bg-app-bg rounded hover:bg-red-500 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {saving && selectedId !== null ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2 border-t border-app-border">
        <button onClick={handleExportConfig} className="px-4 py-1.5 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors">Export Config</button>
        <button onClick={handleImportConfig} className="px-4 py-1.5 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors">Import Config</button>
        <button onClick={handleApply} disabled={saving} className="px-4 py-1.5 text-xs font-semibold border-2 border-green-600 text-green-600 bg-app-bg rounded hover:bg-green-600 hover:text-white transition-colors disabled:opacity-50">
          {saving ? 'Applying...' : 'Apply'}
        </button>
      </div>
    </div>
  );
}
