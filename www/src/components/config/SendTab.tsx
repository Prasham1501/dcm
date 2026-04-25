import { useState, useEffect } from 'react';

interface DicomSendNode {
  id: string;
  location: string;
  ipAddress: string;
  port: string;
  aeTitle: string;
}

const STORAGE_KEY = 'dicom-send-nodes';

function loadNodes(): DicomSendNode[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveNodes(nodes: DicomSendNode[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes));
}

export function SendTab() {
  const [nodes, setNodes] = useState<DicomSendNode[]>(loadNodes);

  const [editNode, setEditNode] = useState<DicomSendNode>({
    id: '', location: '', ipAddress: '', port: '', aeTitle: '',
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Persist whenever nodes change
  useEffect(() => { saveNodes(nodes); }, [nodes]);

  const clearForm = () => {
    setEditNode({ id: '', location: '', ipAddress: '', port: '', aeTitle: '' });
    setSelectedId(null);
  };

  const handleAdd = () => {
    if (!editNode.location || !editNode.ipAddress || !editNode.port) return;
    if (selectedId) {
      // Update existing
      setNodes(nodes.map(n => n.id === selectedId ? { ...editNode, id: selectedId } : n));
      setStatusMsg('Destination updated');
    } else {
      // Add new
      setNodes([...nodes, { ...editNode, id: Date.now().toString() }]);
      setStatusMsg('Destination added');
    }
    clearForm();
    setTimeout(() => setStatusMsg(null), 2000);
  };

  const handleDelete = () => {
    if (!selectedId) return;
    setNodes(nodes.filter(n => n.id !== selectedId));
    clearForm();
  };

  const handleSelect = (node: DicomSendNode) => {
    setSelectedId(node.id);
    setEditNode({ ...node });
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-app-text-secondary">
        Configure DICOM send destinations. Images can be sent to these locations from the viewer.
      </p>

      {statusMsg && (
        <div className="px-3 py-2 text-xs text-green-600 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
          {statusMsg}
        </div>
      )}

      <div className="flex gap-4">
        {/* Left: Form inputs */}
        <div className="flex-1 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-app-text-secondary mb-1">Location:</label>
            <input type="text" value={editNode.location} onChange={(e) => setEditNode({ ...editNode, location: e.target.value })} className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none" placeholder="e.g. Radiology Workstation" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-app-text-secondary mb-1">IP Address:</label>
            <input type="text" value={editNode.ipAddress} onChange={(e) => setEditNode({ ...editNode, ipAddress: e.target.value })} className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none" placeholder="e.g. 192.168.1.50" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-app-text-secondary mb-1">Port Number:</label>
            <input type="text" value={editNode.port} onChange={(e) => setEditNode({ ...editNode, port: e.target.value })} className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none" placeholder="e.g. 11112" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-app-text-secondary mb-1">AE Title:</label>
            <input type="text" value={editNode.aeTitle} onChange={(e) => setEditNode({ ...editNode, aeTitle: e.target.value })} className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none" placeholder="e.g. RAD_WS" />
          </div>

          <div className="flex gap-2">
            <button onClick={handleAdd} className="px-4 py-1.5 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors">
              {selectedId ? 'Update' : 'Add >'}
            </button>
            {selectedId && (
              <button onClick={clearForm} className="px-4 py-1.5 text-xs font-semibold border border-app-border text-app-text bg-app-bg rounded hover:bg-app-hover transition-colors">New</button>
            )}
          </div>
        </div>

        {/* Right: Node list */}
        <div className="w-56 flex flex-col">
          <div className="flex-1 border border-app-border rounded bg-app-bg overflow-auto max-h-52">
            {nodes.length === 0 && <div className="px-3 py-4 text-xs text-app-text-muted text-center">No destinations configured</div>}
            {nodes.map((node) => (
              <div key={node.id} onClick={() => handleSelect(node)} className={`px-3 py-2 text-xs cursor-pointer border-b border-app-border last:border-b-0 ${selectedId === node.id ? 'bg-blue-600 text-white' : 'hover:bg-app-hover text-app-text'}`}>
                <div className="font-semibold">{node.location}</div>
                <div className={selectedId === node.id ? 'text-blue-100' : 'text-app-text-muted'}>{node.ipAddress}:{node.port} ({node.aeTitle})</div>
              </div>
            ))}
          </div>
          <button onClick={handleDelete} disabled={!selectedId} className="mt-2 px-4 py-1.5 text-xs font-semibold border-2 border-red-500 text-red-500 bg-app-bg rounded hover:bg-red-500 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Delete</button>
        </div>
      </div>
    </div>
  );
}
