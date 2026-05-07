import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { usePatientStore } from '@/stores/patientStore';
import type { PatientFilters } from '@/types/patient';

// ─── Autocomplete Input ───────────────────────────────────────────────────────
interface AutocompleteInputProps {
  value: string;
  filterKey: keyof PatientFilters;
  suggestions: string[];
  placeholder?: string;
  width?: string;
  onSelect: (val: string) => void;
  onChange: (val: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

function AutocompleteInput({
  value,
  filterKey,
  suggestions,
  placeholder,
  width = 'w-28',
  onSelect,
  onChange,
  onKeyDown,
}: AutocompleteInputProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter suggestions
  const matches = value.trim().length > 0
    ? suggestions
        .filter((s) => s.toLowerCase().includes(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase())
        .slice(0, 8)
    : [];

  const showDropdown = open && matches.length > 0;

  // Recompute dropdown position whenever it opens or window scrolls
  useEffect(() => {
    if (!showDropdown || !inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 2,
      left: rect.left,
      minWidth: Math.max(rect.width, 160),
      zIndex: 99999,
    });
  }, [showDropdown, value]);

  // Close on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      if (!inputRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setHighlighted(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDropdown]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setOpen(true);
    setHighlighted(-1);
  };

  const handleKeyDownInternal = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showDropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlighted((h) => Math.min(h + 1, matches.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlighted((h) => Math.max(h - 1, -1));
        return;
      }
      if (e.key === 'Enter' && highlighted >= 0) {
        e.preventDefault();
        onSelect(matches[highlighted]);
        setOpen(false);
        setHighlighted(-1);
        return;
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setHighlighted(-1);
        return;
      }
    }
    onKeyDown?.(e);
  };

  const pick = useCallback((val: string) => {
    onSelect(val);
    setOpen(false);
    setHighlighted(-1);
  }, [onSelect]);

  const dropdown = showDropdown
    ? createPortal(
        <ul
          style={dropdownStyle}
          className="bg-white border-2 border-app-accent rounded shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3)] max-h-48 overflow-y-auto pointer-events-auto"
        >
          {matches.map((m, i) => (
            <li
              key={m}
              onMouseDown={(e) => { e.preventDefault(); pick(m); }}
              className={`px-3 py-1.5 text-xs cursor-pointer font-medium whitespace-nowrap transition-colors ${
                i === highlighted
                  ? 'bg-app-accent text-white'
                  : 'text-gray-900 hover:bg-gray-100'
              }`}
            >
              {m}
            </li>
          ))}
        </ul>,
        document.body
      )
    : null;

  return (
    <>
      <input
        ref={inputRef}
        id={`filter-${filterKey}`}
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDownInternal}
        placeholder={placeholder}
        autoComplete="off"
        className={`${width} h-7 2xl:h-9 px-2 text-xs 2xl:text-sm border border-app-border bg-app-bg text-app-text rounded-sm focus:outline-none focus:border-app-accent`}
      />
      {dropdown}
    </>
  );
}

// ─── Patient Search Bar ───────────────────────────────────────────────────────
export function PatientSearchBar() {
  const { filters, setFilter, applyFilters, clearFilters, patients } = usePatientStore();

  // Build unique sorted suggestion lists from the full patients array
  const patientIds = [...new Set(patients.map((p) => p.patientId).filter(Boolean))].sort();
  const patientNames = [...new Set(patients.map((p) => p.patientName).filter(Boolean))].sort();
  const accessionNumbers = [...new Set(patients.map((p) => p.accessionNumber).filter(Boolean))].sort();

  // Load referring physicians from clinical config (localStorage) + patient data
  const configPhysicians: string[] = (() => {
    try { return JSON.parse(localStorage.getItem('clinical-referring-physicians') || '[]'); } catch { return []; }
  })();
  const patientPhysicians = [...new Set(patients.map((p) => p.referringPhysician).filter(Boolean))];
  const allPhysicians = [...new Set([...configPhysicians, ...patientPhysicians])].sort();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') applyFilters();
  };

  // When user picks a suggestion, set the filter and immediately apply
  const pick = (key: keyof PatientFilters) => (val: string) => {
    setFilter(key, val);
    // Tiny defer so the state update lands before applyFilters reads it
    setTimeout(() => applyFilters(), 0);
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-app-border bg-app-surface flex-wrap">
      {/* Patient ID */}
      <div className="flex items-center">
        <label htmlFor="filter-patientId" className="text-xs 2xl:text-sm font-semibold text-app-accent mr-1 whitespace-nowrap">
          Patient ID
        </label>
        <AutocompleteInput
          value={filters.patientId}
          filterKey="patientId"
          suggestions={patientIds}
          width="w-24"
          onChange={(v) => setFilter('patientId', v)}
          onSelect={pick('patientId')}
          onKeyDown={handleKeyDown}
        />
        <span className="text-app-accent mx-0.5 text-xs font-bold">+</span>
      </div>

      {/* Patient Name */}
      <div className="flex items-center">
        <label htmlFor="filter-patientName" className="text-xs 2xl:text-sm font-semibold text-app-accent mr-1 whitespace-nowrap">
          Patient Name
        </label>
        <AutocompleteInput
          value={filters.patientName}
          filterKey="patientName"
          suggestions={patientNames}
          width="w-32"
          onChange={(v) => setFilter('patientName', v)}
          onSelect={pick('patientName')}
          onKeyDown={handleKeyDown}
        />
        <span className="text-app-accent mx-0.5 text-xs font-bold">+</span>
      </div>

      {/* Referring Physician */}
      <div className="flex items-center">
        <label className="text-xs 2xl:text-sm font-semibold text-app-accent mr-1 whitespace-nowrap">Referring Physician</label>
        <select
          value={filters.referringPhysician}
          onChange={(e) => setFilter('referringPhysician', e.target.value)}
          className="w-28 2xl:w-36 h-7 2xl:h-9 px-1 text-xs 2xl:text-sm border border-app-border bg-app-bg text-app-text rounded-sm focus:outline-none focus:border-app-accent"
        >
          <option value="">All</option>
          {allPhysicians.map((doc) => (
            <option key={doc} value={doc}>{doc}</option>
          ))}
        </select>
        <span className="text-app-accent mx-0.5 text-xs font-bold">+</span>
      </div>

      {/* Study Description */}
      <div className="flex items-center">
        <label className="text-xs 2xl:text-sm font-semibold text-app-accent mr-1 whitespace-nowrap">Study Description</label>
        <select
          value={filters.studyDescription}
          onChange={(e) => setFilter('studyDescription', e.target.value)}
          className="w-24 2xl:w-32 h-7 2xl:h-9 px-1 text-xs 2xl:text-sm border border-app-border bg-app-bg text-app-text rounded-sm focus:outline-none focus:border-app-accent"
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
        <label htmlFor="filter-accessionNumber" className="text-xs 2xl:text-sm font-semibold text-app-accent mr-1 whitespace-nowrap">
          Accession Number
        </label>
        <AutocompleteInput
          value={filters.accessionNumber}
          filterKey="accessionNumber"
          suggestions={accessionNumbers}
          width="w-24"
          onChange={(v) => setFilter('accessionNumber', v)}
          onSelect={pick('accessionNumber')}
          onKeyDown={handleKeyDown}
        />
        <span className="text-app-accent mx-0.5 text-xs font-bold">+</span>
      </div>

      {/* Modality */}
      <div className="flex items-center">
        <label className="text-xs 2xl:text-sm font-semibold text-app-accent mr-1 whitespace-nowrap">Modality</label>
        <select
          value={filters.modality}
          onChange={(e) => setFilter('modality', e.target.value)}
          className="w-16 2xl:w-20 h-7 2xl:h-9 px-1 text-xs 2xl:text-sm border border-app-border bg-app-bg text-app-text rounded-sm focus:outline-none focus:border-app-accent"
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
        className="ml-1 h-7 2xl:h-9 px-2 2xl:px-3 text-[10px] 2xl:text-xs font-bold border border-gray-400 text-gray-500 bg-app-bg rounded hover:bg-gray-100 transition-colors"
        title="Clear all fields"
      >
        Clear
      </button>
      <button
        onClick={applyFilters}
        className="h-7 2xl:h-9 px-4 2xl:px-5 text-xs 2xl:text-sm font-bold border-2 border-app-accent text-white bg-app-accent rounded hover:opacity-90 transition-opacity"
      >
        Go
      </button>
    </div>
  );
}
