/**
 * CatalogBrowser — generic modal that lists catalog rows with search and
 * "Add" buttons. Used for findings, syndromes, genes, investigations.
 *
 * Pagination is server-side (limit 100 per page) so very large catalogs
 * (genes can be 2k+ rows) stay responsive.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Search, Plus, Check, Loader2 } from 'lucide-react';

interface ColumnDef<T> {
  key: keyof T | string;
  label: string;
  width?: string;
  render?: (row: T) => React.ReactNode;
}

interface Props<T extends { id: number }> {
  title: string;
  subtitle?: string;
  fetcher: (opts: { q?: string; limit: number; offset: number }) => Promise<{ data: T[]; total: number }>;
  columns: ColumnDef<T>[];
  selectedIds: Set<number>;
  onAdd: (row: T) => Promise<void> | void;
  onClose: () => void;
  extraActions?: (row: T) => React.ReactNode;
  /** Optional filter slot rendered to the right of the search bar. */
  filterSlot?: React.ReactNode;
  /** When set, refetches whenever it changes (use a key like 'category:basic'). */
  filterKey?: string;
}

const PAGE_SIZE = 100;

export function CatalogBrowser<T extends { id: number }>({
  title, subtitle, fetcher, columns, selectedIds,
  onAdd, onClose, extraActions, filterSlot, filterKey,
}: Props<T>) {
  const [query, setQuery] = useState('');
  const [rows, setRows]   = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [addingIds, setAddingIds] = useState<Set<number>>(new Set());

  // Keep the latest fetcher in a ref so `load` doesn't change identity when the
  // parent re-renders with a fresh inline arrow. Without this, every store update
  // (e.g. adding a row) reruns the search effect and flashes the loading state,
  // making the modal appear to flicker / close.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async (q: string, off: number) => {
    setLoading(true); setError(null);
    try {
      const r = await fetcherRef.current({ q, limit: PAGE_SIZE, offset: off });
      setRows(r.data); setTotal(r.total); setOffset(off);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search (300 ms after last keystroke). Re-runs only when the
  // search term or external filter actually changes.
  useEffect(() => {
    const t = setTimeout(() => { void load(query, 0); }, 300);
    return () => clearTimeout(t);
  }, [query, filterKey, load]);

  const handleAdd = async (row: T) => {
    setAddingIds((s) => new Set(s).add(row.id));
    try {
      await onAdd(row);
    } finally {
      setAddingIds((s) => { const n = new Set(s); n.delete(row.id); return n; });
    }
  };

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-start justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </header>

        {/* Search + filter row */}
        <div className="px-5 py-3 flex items-center gap-3 border-b border-slate-100 dark:border-slate-700/60">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {filterSlot}
          <span className="text-xs text-slate-500 whitespace-nowrap">
            {total.toLocaleString()} total
          </span>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {error && (
            <div className="m-4 px-3 py-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded">
              {error}
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-500">
              <Loader2 size={18} className="animate-spin mr-2" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">No results</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/40 sticky top-0">
                <tr className="text-xs uppercase text-slate-500">
                  {columns.map((c) => (
                    <th key={String(c.key)} className="text-left px-4 py-1.5" style={c.width ? { width: c.width } : undefined}>
                      {c.label}
                    </th>
                  ))}
                  <th className="text-right px-4 py-1.5 w-32">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isSelected = selectedIds.has(row.id);
                  const isAdding = addingIds.has(row.id);
                  return (
                    <tr key={row.id} className="border-t border-slate-100 dark:border-slate-700/40 hover:bg-slate-50/60 dark:hover:bg-slate-700/20">
                      {columns.map((c) => (
                        <td key={String(c.key)} className="px-4 py-2 align-top text-slate-700 dark:text-slate-200">
                          {c.render ? c.render(row) : String((row as any)[c.key] ?? '')}
                        </td>
                      ))}
                      <td className="px-4 py-1.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {extraActions?.(row)}
                          {isSelected ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                              <Check size={12} /> Added
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAdd(row)}
                              disabled={isAdding}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded"
                            >
                              {isAdding ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                              Add
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination footer */}
        {totalPages > 1 && (
          <footer className="px-5 py-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
            <span className="text-slate-500">Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => load(query, Math.max(0, offset - PAGE_SIZE))}
                disabled={offset === 0 || loading}
                className="px-2 py-1 border border-slate-300 dark:border-slate-600 rounded disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                ← Prev
              </button>
              <button
                onClick={() => load(query, offset + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= total || loading}
                className="px-2 py-1 border border-slate-300 dark:border-slate-600 rounded disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Next →
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}
