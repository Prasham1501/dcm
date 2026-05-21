/**
 * CatalogBrowser — generic modal that lists catalog rows with search and
 * "Add" buttons. Used for findings, syndromes, genes, investigations.
 *
 * Pagination is server-side (limit 100 per page) so very large catalogs
 * (genes can be 2k+ rows) stay responsive.
 *
 * Features:
 *  - Fast 150ms debounced search (search bar is always responsive)
 *  - Description preview on row hover/expand
 *  - Server-side pagination with page controls
 */
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { X, Search, Plus, Check, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

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
  /** Key of the description field on T for expanded preview. Defaults to 'description'. */
  descriptionKey?: keyof T | string;
}

const PAGE_SIZE = 100;

export function CatalogBrowser<T extends { id: number }>({
  title, subtitle, fetcher, columns, selectedIds,
  onAdd, onClose, extraActions, filterSlot, filterKey, descriptionKey = 'description' as keyof T,
}: Props<T>) {
  const [query, setQuery] = useState('');
  const [rows, setRows]   = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [addingIds, setAddingIds] = useState<Set<number>>(new Set());
  const [expandedId, setExpandedId] = useState<number | null>(null);

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

  // Debounced search (150 ms after last keystroke). Re-runs only when the
  // search term or external filter actually changes.
  useEffect(() => {
    const t = setTimeout(() => { void load(query, 0); }, 150);
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

  // Instant client-side relevance sort: re-orders existing rows immediately
  // as the user types, before the server response arrives.
  const sortedRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;

    // Detect primary name key from first column
    const nameKey = (columns[0]?.key ?? 'name') as string;

    return [...rows].sort((a, b) => {
      const aName = String((a as any)[nameKey] ?? '').toLowerCase();
      const bName = String((b as any)[nameKey] ?? '').toLowerCase();

      // Score: 0 = exact, 1 = starts with, 2 = contains in name, 3 = rest
      const score = (n: string) => {
        if (n === q) return 0;
        if (n.startsWith(q)) return 1;
        if (n.includes(q)) return 2;
        return 3;
      };
      const diff = score(aName) - score(bName);
      return diff !== 0 ? diff : aName.localeCompare(bName);
    });
  }, [rows, query, columns]);

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
            {loading && <Loader2 size={12} className="absolute right-2.5 top-2.5 text-blue-500 animate-spin" />}
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search… results load instantly"
              className="w-full pl-8 pr-8 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {filterSlot}
          <span className="text-xs text-slate-500 whitespace-nowrap">
            {total.toLocaleString()} total
          </span>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto relative">
          {error && (
            <div className="m-4 px-3 py-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded">
              {error}
            </div>
          )}
          {sortedRows.length === 0 && !loading ? (
            <div className="text-center py-10 text-slate-500 text-sm">No results</div>
          ) : sortedRows.length === 0 && loading ? (
            <div className="flex items-center justify-center py-10 text-slate-500">
              <Loader2 size={18} className="animate-spin mr-2" /> Loading…
            </div>
          ) : (
            <div className={loading ? 'opacity-60 transition-opacity' : ''}>
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
                {sortedRows.map((row) => {
                  const isSelected = selectedIds.has(row.id);
                  const isAdding = addingIds.has(row.id);
                  const isExpanded = expandedId === row.id;
                  const desc = (row as any)[descriptionKey] as string | null;
                  return (
                    <>
                      <tr
                        key={row.id}
                        className={`border-t border-slate-100 dark:border-slate-700/40 hover:bg-slate-50/60 dark:hover:bg-slate-700/20 cursor-pointer ${isExpanded ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}
                        onClick={() => setExpandedId(isExpanded ? null : row.id)}
                      >
                        {columns.map((c) => (
                          <td key={String(c.key)} className="px-4 py-2 align-top text-slate-700 dark:text-slate-200">
                            {c.render ? c.render(row) : (
                              c.key === descriptionKey
                                ? <span className="line-clamp-1">{String((row as any)[c.key] ?? '')}</span>
                                : String((row as any)[c.key] ?? '')
                            )}
                          </td>
                        ))}
                        <td className="px-4 py-1.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {desc && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : row.id); }}
                                className="p-1 text-slate-400 hover:text-slate-600"
                                title="Show description"
                              >
                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              </button>
                            )}
                            {extraActions?.(row)}
                            {isSelected ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                                <Check size={12} /> Added
                              </span>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleAdd(row); }}
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
                      {isExpanded && desc && (
                        <tr key={`${row.id}-desc`} className="bg-blue-50/30 dark:bg-blue-900/10">
                          <td colSpan={columns.length + 1} className="px-6 py-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed border-b border-blue-100 dark:border-blue-900/30">
                            {desc}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
            </div>
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
