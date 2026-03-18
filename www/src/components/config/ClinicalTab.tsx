import { useState } from 'react';

interface ClinicLocation {
  id: string;
  name: string;
  address: string;
  phone: string;
  active: boolean;
}

export function ClinicalTab() {
  const [multiClinicMode, setMultiClinicMode] = useState(false);
  const [locations, setLocations] = useState<ClinicLocation[]>([
    { id: '1', name: 'Main Branch', address: '123 Medical Complex, MG Road, Mumbai', phone: '+91 22 1234 5678', active: true },
    { id: '2', name: 'Satellite Clinic', address: '456 Health Center, Andheri West', phone: '+91 22 8765 4321', active: true },
  ]);

  const [editLocation, setEditLocation] = useState({ name: '', address: '', phone: '' });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleAdd = () => {
    if (!editLocation.name) return;
    setLocations([...locations, {
      id: Date.now().toString(),
      ...editLocation,
      active: true,
    }]);
    setEditLocation({ name: '', address: '', phone: '' });
  };

  const handleDelete = () => {
    if (!selectedId) return;
    setLocations(locations.filter(l => l.id !== selectedId));
    setSelectedId(null);
  };

  return (
    <div className="space-y-5">
      <p className="text-xs text-app-text-secondary">
        Configure clinical locations and multi-clinic settings.
      </p>

      {/* Multi-clinic toggle */}
      <div className="flex items-center gap-3 p-3 border border-app-border rounded bg-app-surface">
        <label className="flex items-center gap-2 text-xs font-semibold text-app-text cursor-pointer">
          <input
            type="checkbox"
            checked={multiClinicMode}
            onChange={(e) => setMultiClinicMode(e.target.checked)}
            className="accent-app-accent w-3.5 h-3.5"
          />
          Enable Multi-Clinic Mode
        </label>
        <span className="text-xs text-app-text-muted">
          (Allows managing multiple clinic locations with separate print counters)
        </span>
      </div>

      {/* Clinic Locations */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border">
          Clinic Locations
        </h3>

        <div className="flex gap-4">
          {/* Left: Form */}
          <div className="flex-1 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-app-text-secondary mb-1">Clinic Name:</label>
              <input
                type="text"
                value={editLocation.name}
                onChange={(e) => setEditLocation({ ...editLocation, name: e.target.value })}
                className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
                placeholder="e.g. Main Branch"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-app-text-secondary mb-1">Address:</label>
              <input
                type="text"
                value={editLocation.address}
                onChange={(e) => setEditLocation({ ...editLocation, address: e.target.value })}
                className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-app-text-secondary mb-1">Phone:</label>
              <input
                type="text"
                value={editLocation.phone}
                onChange={(e) => setEditLocation({ ...editLocation, phone: e.target.value })}
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

          {/* Right: Location list */}
          <div className="w-56 flex flex-col">
            <div className="flex-1 border border-app-border rounded bg-app-bg overflow-auto max-h-44">
              {locations.map((loc) => (
                <div
                  key={loc.id}
                  onClick={() => setSelectedId(loc.id)}
                  className={`px-3 py-2 text-xs cursor-pointer border-b border-app-border last:border-b-0 ${
                    selectedId === loc.id
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-app-hover text-app-text'
                  }`}
                >
                  <div className="font-semibold">{loc.name}</div>
                  <div className={selectedId === loc.id ? 'text-blue-100' : 'text-app-text-muted'}>
                    {loc.address}
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

      {/* Referring Physicians */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border">
          Default Referring Physicians
        </h3>
        <div className="space-y-1">
          {['Dr. R. Patel', 'Dr. S. Kumar', 'Dr. A. Sharma', 'Dr. M. Desai'].map((doc, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs bg-app-surface border border-app-border rounded">
              <span className="text-app-text">{doc}</span>
              <button className="text-red-400 hover:text-red-600 text-xs">×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
