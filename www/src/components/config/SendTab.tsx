import { useState } from 'react';

interface DicomNode {
  id: string;
  location: string;
  ipAddress: string;
  port: string;
  aeTitle: string;
}

export function SendTab() {
  const [nodes, setNodes] = useState<DicomNode[]>([
    { id: '1', location: 'Radiology Workstation', ipAddress: '192.168.1.50', port: '11112', aeTitle: 'RAD_WS' },
    { id: '2', location: 'Dr. Patel Office', ipAddress: '192.168.1.75', port: '11112', aeTitle: 'PATEL_WS' },
  ]);

  const [editNode, setEditNode] = useState<DicomNode>({
    id: '', location: '', ipAddress: '', port: '', aeTitle: '',
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleAdd = () => {
    if (!editNode.location || !editNode.ipAddress || !editNode.port) return;
    setNodes([...nodes, { ...editNode, id: Date.now().toString() }]);
    setEditNode({ id: '', location: '', ipAddress: '', port: '', aeTitle: '' });
  };

  const handleDelete = () => {
    if (!selectedId) return;
    setNodes(nodes.filter(n => n.id !== selectedId));
    setSelectedId(null);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-app-text-secondary">
        Configure to send images to other application
      </p>

      <div className="flex gap-4">
        {/* Left: Form inputs */}
        <div className="flex-1 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-app-text-secondary mb-1">Location:</label>
            <input
              type="text"
              value={editNode.location}
              onChange={(e) => setEditNode({ ...editNode, location: e.target.value })}
              className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-app-text-secondary mb-1">IP address:</label>
            <input
              type="text"
              value={editNode.ipAddress}
              onChange={(e) => setEditNode({ ...editNode, ipAddress: e.target.value })}
              className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-app-text-secondary mb-1">Port Number:</label>
            <input
              type="text"
              value={editNode.port}
              onChange={(e) => setEditNode({ ...editNode, port: e.target.value })}
              className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-app-text-secondary mb-1">AE Title:</label>
            <input
              type="text"
              value={editNode.aeTitle}
              onChange={(e) => setEditNode({ ...editNode, aeTitle: e.target.value })}
              className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
            />
          </div>

          <button
            onClick={handleAdd}
            className="px-4 py-1.5 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors"
          >
            Add &gt;
          </button>
        </div>

        {/* Right: Node list */}
        <div className="w-56 flex flex-col">
          <div className="flex-1 border border-app-border rounded bg-app-bg overflow-auto max-h-52">
            {nodes.map((node) => (
              <div
                key={node.id}
                onClick={() => { setSelectedId(node.id); setEditNode({ ...node }); }}
                className={`px-3 py-2 text-xs cursor-pointer border-b border-app-border last:border-b-0 ${
                  selectedId === node.id
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-app-hover text-app-text'
                }`}
              >
                <div className="font-semibold">{node.location}</div>
                <div className={selectedId === node.id ? 'text-blue-100' : 'text-app-text-muted'}>
                  {node.ipAddress}:{node.port} ({node.aeTitle})
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={handleDelete}
            disabled={!selectedId}
            className="mt-2 px-4 py-1.5 text-xs font-semibold border-2 border-red-500 text-red-500 bg-app-bg rounded hover:bg-red-500 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
