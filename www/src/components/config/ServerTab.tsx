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

export function ServerTab() {
  const [servers, setServers] = useState<DicomNode[]>([]);
  const [editServer, setEditServer] = useState<ServerFormState>({ ...EMPTY_FORM });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Load nodes from backend on mount */
  const loadNodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nodes = await settingsService.getNodes();
      setServers(nodes);
    } catch (err: any) {
      console.error('[ServerTab] Failed to load nodes:', err);
      setError(err?.message || 'Failed to load DICOM nodes');
      // Keep whatever is in state as fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNodes();
  }, [loadNodes]);

  const clearForm = () => {
    setEditServer({ ...EMPTY_FORM });
    setSelectedId(null);
  };

  const handleAdd = async () => {
    if (!editServer.name.trim() || !editServer.host_name.trim() || !editServer.port.trim()) return;

    setSaving(true);
    setError(null);
    try {
      const nodePayload: Omit<DicomNode, 'id'> & { id?: number } = {
        name: editServer.name,
        ae_title: editServer.ae_title,
        host_name: editServer.host_name,
        port: parseInt(editServer.port, 10) || 0,
        is_default: editServer.is_default,
      };

      if (selectedId !== null) {
        nodePayload.id = selectedId;
      }

      await settingsService.saveNode(nodePayload);
      // Reload from backend to get server-assigned IDs and canonical state
      await loadNodes();
      clearForm();
    } catch (err: any) {
      console.error('[ServerTab] Failed to save node:', err);
      setError(err?.message || 'Failed to save DICOM node');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (selectedId === null) return;

    setSaving(true);
    setError(null);
    try {
      await settingsService.deleteNode(selectedId);
      await loadNodes();
      clearForm();
    } catch (err: any) {
      console.error('[ServerTab] Failed to delete node:', err);
      setError(err?.message || 'Failed to delete DICOM node');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectServer = (server: DicomNode) => {
    setSelectedId(server.id);
    setEditServer({
      id: server.id,
      name: server.name,
      ae_title: server.ae_title,
      host_name: server.host_name,
      port: String(server.port),
      is_default: server.is_default,
    });
  };

  return (
    <div className="space-y-5">
      <p className="text-xs text-app-text-secondary">
        Configure Orthanc PACS server connections for retrieving and storing DICOM studies.
      </p>

      {error && (
        <div className="px-3 py-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 underline hover:no-underline"
          >
            dismiss
          </button>
        </div>
      )}

      <div className="flex gap-4">
        {/* Left: Form */}
        <div className="flex-1 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-app-text-secondary mb-1">Server Name</label>
            <input
              type="text"
              value={editServer.name}
              onChange={(e) => setEditServer({ ...editServer, name: e.target.value })}
              className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
              placeholder="e.g. Hospital PACS"
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-app-text-secondary mb-1">IP Address / Host</label>
            <input
              type="text"
              value={editServer.host_name}
              onChange={(e) => setEditServer({ ...editServer, host_name: e.target.value })}
              className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
              placeholder="e.g. 192.168.1.100"
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-app-text-secondary mb-1">Port Number</label>
            <input
              type="text"
              value={editServer.port}
              onChange={(e) => setEditServer({ ...editServer, port: e.target.value })}
              className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
              placeholder="e.g. 8042"
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-app-text-secondary mb-1">AE Title</label>
            <input
              type="text"
              value={editServer.ae_title}
              onChange={(e) => setEditServer({ ...editServer, ae_title: e.target.value })}
              className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
              placeholder="e.g. ORTHANC"
              disabled={saving}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_default"
              checked={editServer.is_default}
              onChange={(e) => setEditServer({ ...editServer, is_default: e.target.checked })}
              disabled={saving}
              className="accent-app-accent"
            />
            <label htmlFor="is_default" className="text-xs text-app-text-secondary">Default server</label>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving}
              className="px-4 py-1.5 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : selectedId !== null ? 'Update' : 'Add >'}
            </button>
            {selectedId !== null && (
              <button
                onClick={clearForm}
                disabled={saving}
                className="px-4 py-1.5 text-xs font-semibold border border-app-border text-app-text bg-app-bg rounded hover:bg-app-hover transition-colors disabled:opacity-50"
              >
                New
              </button>
            )}
          </div>
        </div>

        {/* Right: Server list */}
        <div className="w-56 flex flex-col">
          <div className="flex-1 border border-app-border rounded bg-app-bg overflow-auto max-h-52">
            {loading && (
              <div className="px-3 py-4 text-xs text-app-text-muted text-center">Loading...</div>
            )}
            {!loading && servers.length === 0 && (
              <div className="px-3 py-4 text-xs text-app-text-muted text-center">No servers configured</div>
            )}
            {!loading && servers.map((server) => (
              <div
                key={server.id}
                onClick={() => handleSelectServer(server)}
                className={`px-3 py-2 text-xs cursor-pointer border-b border-app-border last:border-b-0 ${
                  selectedId === server.id
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-app-hover text-app-text'
                }`}
              >
                <div className="font-semibold">
                  {server.name}
                  {server.is_default && (
                    <span className={`ml-1 text-[10px] ${selectedId === server.id ? 'text-blue-200' : 'text-app-accent'}`}>
                      (default)
                    </span>
                  )}
                </div>
                <div className={selectedId === server.id ? 'text-blue-100' : 'text-app-text-muted'}>
                  {server.host_name}:{server.port}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={handleDelete}
            disabled={selectedId === null || saving}
            className="mt-2 px-4 py-1.5 text-xs font-semibold border-2 border-red-500 text-red-500 bg-app-bg rounded hover:bg-red-500 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving && selectedId !== null ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
