import { usePatientStore } from '@/stores/patientStore';

export function PatientSearchBar() {
  const { filters, setFilter, applyFilters, clearFilters } = usePatientStore();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') applyFilters();
  };

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-app-border bg-app-surface overflow-x-auto flex-nowrap">
      {/* Patient ID */}
      <div className="flex items-center">
        <label className="text-xs font-semibold text-app-accent mr-1 whitespace-nowrap">Patient ID</label>
        <input
          type="text"
          value={filters.patientId}
          onChange={(e) => setFilter('patientId', e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-24 h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:outline-none focus:border-app-accent"
        />
        <span className="text-app-accent mx-0.5 text-xs font-bold">+</span>
      </div>

      {/* Patient Name */}
      <div className="flex items-center">
        <label className="text-xs font-semibold text-app-accent mr-1 whitespace-nowrap">Patient Name</label>
        <input
          type="text"
          value={filters.patientName}
          onChange={(e) => setFilter('patientName', e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-32 h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:outline-none focus:border-app-accent"
        />
        <span className="text-app-accent mx-0.5 text-xs font-bold">+</span>
      </div>

      {/* Referring Physician */}
      <div className="flex items-center">
        <label className="text-xs font-semibold text-app-accent mr-1 whitespace-nowrap">Referring Physician</label>
        <select
          value={filters.referringPhysician}
          onChange={(e) => setFilter('referringPhysician', e.target.value)}
          className="w-28 h-7 px-1 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:outline-none focus:border-app-accent"
        >
          <option value="">All</option>
          <option value="Dr. R. Patel">Dr. R. Patel</option>
          <option value="Dr. S. Gupta">Dr. S. Gupta</option>
          <option value="Dr. M. Joshi">Dr. M. Joshi</option>
          <option value="Dr. A. Singh">Dr. A. Singh</option>
          <option value="Dr. V. Kulkarni">Dr. V. Kulkarni</option>
          <option value="Dr. P. Reddy">Dr. P. Reddy</option>
        </select>
        <span className="text-app-accent mx-0.5 text-xs font-bold">+</span>
      </div>

      {/* Study Description */}
      <div className="flex items-center">
        <label className="text-xs font-semibold text-app-accent mr-1 whitespace-nowrap">Study Description</label>
        <select
          value={filters.studyDescription}
          onChange={(e) => setFilter('studyDescription', e.target.value)}
          className="w-24 h-7 px-1 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:outline-none focus:border-app-accent"
        >
          <option value="">All</option>
          <option value="OB">OB</option>
          <option value="ABD">ABD</option>
          <option value="VAS">VAS</option>
        </select>
        <span className="text-app-accent mx-0.5 text-xs font-bold">+</span>
      </div>

      {/* Accession Number */}
      <div className="flex items-center">
        <label className="text-xs font-semibold text-app-accent mr-1 whitespace-nowrap">Accession Number</label>
        <input
          type="text"
          value={filters.accessionNumber}
          onChange={(e) => setFilter('accessionNumber', e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-24 h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:outline-none focus:border-app-accent"
        />
        <span className="text-app-accent mx-0.5 text-xs font-bold">+</span>
      </div>

      {/* Modality */}
      <div className="flex items-center">
        <label className="text-xs font-semibold text-app-accent mr-1 whitespace-nowrap">Modality</label>
        <select
          value={filters.modality}
          onChange={(e) => setFilter('modality', e.target.value)}
          className="w-16 h-7 px-1 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:outline-none focus:border-app-accent"
        >
          <option value="">All</option>
          <option value="US">US</option>
          <option value="CT">CT</option>
          <option value="MR">MR</option>
        </select>
      </div>

      {/* Clr and Go buttons */}
      <button
        onClick={clearFilters}
        className="ml-1 h-7 px-3 text-xs font-bold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors"
      >
        Clr
      </button>
      <button
        onClick={applyFilters}
        className="h-7 px-3 text-xs font-bold border-2 border-app-accent text-white bg-app-accent rounded hover:opacity-90 transition-opacity"
      >
        Go
      </button>
    </div>
  );
}
