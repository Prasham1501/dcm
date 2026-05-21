/**
 * AbnormalAssessmentTab — DST (Decision Support Tree) workflow.
 *
 *  Findings → ranked Syndromes → suggested Genes → suggested Investigations
 *
 * The user opens a browser modal for each catalog, picks items, and the
 * dstStore syncs everything to the server immediately.
 */
import { useEffect, useMemo, useState } from 'react';
import { Trash2, Plus, Loader2, TestTube, Dna, Activity, FileSearch } from 'lucide-react';
import { useCurrentExamination } from '@/features/fetal/stores/examinationStore';
import { useDstStore } from '@/features/fetal/stores/dstStore';
import { useUIStore } from '@/stores/uiStore';
import { CatalogBrowser } from '@/features/fetal/components/CatalogBrowser';
import { catalogsApi, type Finding, type Syndrome, type Gene, type Investigation } from '@/features/fetal/api/catalogsApi';

type BrowserKind = null | 'finding' | 'syndrome' | 'gene' | 'investigation';

export function AbnormalAssessmentTab() {
  const examination = useCurrentExamination();
  const examId = examination?.id ?? null;

  const loadForExamination = useDstStore((s) => s.loadForExamination);
  const findings           = useDstStore((s) => s.findings);
  const syndromes          = useDstStore((s) => s.syndromes);
  const genes              = useDstStore((s) => s.genes);
  const investigations     = useDstStore((s) => s.investigations);
  const matches            = useDstStore((s) => s.matches);
  const matchLoading       = useDstStore((s) => s.matchLoading);
  const loading            = useDstStore((s) => s.loading);
  const pendingOps         = useDstStore((s) => s.pendingOps);
  const error              = useDstStore((s) => s.error);

  const addFinding       = useDstStore((s) => s.addFinding);
  const addSyndrome      = useDstStore((s) => s.addSyndrome);
  const addGene          = useDstStore((s) => s.addGene);
  const addInvestigation = useDstStore((s) => s.addInvestigation);
  const removeItem       = useDstStore((s) => s.removeItem);
  const toggleInclude    = useDstStore((s) => s.toggleInclude);

  const addToast = useUIStore((s) => s.addToast);
  const [browser, setBrowser]            = useState<BrowserKind>(null);
  const [invCategory, setInvCategory]    = useState<'basic' | 'specific'>('basic');

  useEffect(() => {
    if (examId) {
      loadForExamination(examId).catch((e) =>
        addToast(`Failed to load selections: ${(e as Error).message}`, 'error'),
      );
    }
  }, [examId, loadForExamination, addToast]);

  if (!examId) {
    return (
      <div className="p-6 text-sm text-slate-500">
        Select or create an examination to record findings.
      </div>
    );
  }

  const findingIds   = useMemo(() => new Set(findings.map((f) => f.id)),       [findings]);
  const syndromeIds  = useMemo(() => new Set(syndromes.map((s) => s.id)),      [syndromes]);
  const geneIds      = useMemo(() => new Set(genes.map((g) => g.id)),          [genes]);
  const invIds       = useMemo(() => new Set(investigations.map((i) => i.id)), [investigations]);

  // ── Wrapped add handlers (toast + close on success) ─────────────
  const handleAddFinding = async (row: Finding) => {
    await addFinding(row.id);
    addToast(`Added: ${row.name}`, 'success');
  };
  const handleAddSyndrome = async (row: Syndrome) => {
    await addSyndrome(row.id);
    addToast(`Added: ${row.name}`, 'success');
  };
  const handleAddGene = async (row: Gene) => {
    await addGene(row.id);
    addToast(`Added: ${row.symbol}`, 'success');
  };
  const handleAddInvestigation = async (row: Investigation) => {
    await addInvestigation(row.id, invCategory);
    addToast(`Added: ${row.name}`, 'success');
  };
  /** Add-from-match-table (one-click from the ranked syndromes panel). */
  const handleAddMatchedSyndrome = async (m: typeof matches[number]) => {
    try {
      await addSyndrome(m.id, { num: m.overlap, den: m.total_findings });
      addToast(`Added syndrome: ${m.name}`, 'success');
    } catch (e) {
      addToast(`Failed: ${(e as Error).message}`, 'error');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {error && (
        <div className="px-3 py-2 text-xs text-red-700 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
          {error}
        </div>
      )}

      {/* Save indicator pill */}
      {pendingOps > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-blue-600">
          <Loader2 size={12} className="animate-spin" /> Saving…
        </div>
      )}

      {/* ── Findings ──────────────────────────────────────────────── */}
      <SectionCard
        icon={<FileSearch size={16} className="text-rose-500" />}
        title="Findings"
        subtitle={`${findings.length} selected · ${findings.length} finding${findings.length === 1 ? '' : 's'} will be included in your PDF report`}
        onAdd={() => setBrowser('finding')}
      >
        {findings.length === 0 ? (
          <EmptyHint text="No findings yet. Click + to add from the catalog." />
        ) : (
          <ChipGrid>
            {findings.map((f) => (
              <Chip key={f.id}
                label={f.name}
                meta={f.system ?? undefined}
                description={f.description ?? undefined}
                included={!!f.include_in_report}
                onToggleInclude={(v) => toggleInclude('finding', f.id, v)}
                onRemove={() => removeItem('finding', f.id)}
              />
            ))}
          </ChipGrid>
        )}
      </SectionCard>

      {/* ── Match-scored syndromes table ──────────────────────────── */}
      {findings.length > 0 && (
        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          <header className="px-4 py-2 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Activity size={14} className="text-amber-600" />
              Suggested syndromes (ranked by overlap)
            </div>
            {matchLoading && <Loader2 size={12} className="animate-spin text-slate-400" />}
          </header>
          {matches.length === 0 ? (
            <div className="text-xs text-slate-500 px-4 py-3">
              No matching syndromes in catalog. Run a catalog import to expand the knowledge base.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/30 text-xs uppercase text-slate-500">
                <tr>
                  <th className="text-left px-4 py-1.5">Syndrome</th>
                  <th className="text-left px-4 py-1.5 w-20">OMIM</th>
                  <th className="text-left px-4 py-1.5 w-24">Match</th>
                  <th className="text-right px-4 py-1.5 w-24">Action</th>
                </tr>
              </thead>
              <tbody>
                {matches.slice(0, 12).map((m) => (
                  <tr key={m.id} className="border-t border-slate-100 dark:border-slate-700/40">
                    <td className="px-4 py-1.5">{m.name}</td>
                    <td className="px-4 py-1.5 text-xs text-slate-400 font-mono">{m.omim_id ?? '—'}</td>
                    <td className="px-4 py-1.5">
                      <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                        {m.match_label}
                      </span>
                    </td>
                    <td className="px-4 py-1.5 text-right">
                      {syndromeIds.has(m.id) ? (
                        <span className="text-xs text-emerald-600 font-medium">Added</span>
                      ) : (
                        <button
                          onClick={() => handleAddMatchedSyndrome(m)}
                          className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                        >
                          Add
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* ── Syndromes selected ───────────────────────────────────── */}
      <SectionCard
        icon={<Activity size={16} className="text-purple-500" />}
        title="Syndromes"
        subtitle={`${syndromes.length} selected`}
        onAdd={() => setBrowser('syndrome')}
      >
        {syndromes.length === 0 ? (
          <EmptyHint text="No syndromes selected. Browse catalog or pick from ranked suggestions above." />
        ) : (
          <ChipGrid>
            {syndromes.map((s) => (
              <Chip key={s.id}
                label={s.name}
                meta={s.match_score_num != null ? `${s.match_score_num}/${s.match_score_den}` : (s.omim_id ?? undefined)}
                description={s.description ?? undefined}
                included={!!s.include_in_report}
                onToggleInclude={(v) => toggleInclude('syndrome', s.id, v)}
                onRemove={() => removeItem('syndrome', s.id)}
              />
            ))}
          </ChipGrid>
        )}
      </SectionCard>

      {/* ── Genes ────────────────────────────────────────────────── */}
      <SectionCard
        icon={<Dna size={16} className="text-emerald-600" />}
        title="Genes"
        subtitle={`${genes.length} selected`}
        onAdd={() => setBrowser('gene')}
      >
        {genes.length === 0 ? (
          <EmptyHint text="No genes selected." />
        ) : (
          <ChipGrid>
            {genes.map((g) => (
              <Chip key={g.id}
                label={g.symbol}
                meta={g.full_name ?? undefined}
                description={g.description ?? undefined}
                included={!!g.include_in_report}
                onToggleInclude={(v) => toggleInclude('gene', g.id, v)}
                onRemove={() => removeItem('gene', g.id)}
              />
            ))}
          </ChipGrid>
        )}
      </SectionCard>

      {/* ── Investigations (split into basic / specific) ────────── */}
      <SectionCard
        icon={<TestTube size={16} className="text-sky-600" />}
        title="Investigations"
        subtitle={`${investigations.length} selected`}
        onAdd={() => setBrowser('investigation')}
        addAccessory={
          <select
            value={invCategory}
            onChange={(e) => setInvCategory(e.target.value as any)}
            className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            title="Category for next investigation added"
          >
            <option value="basic">Basic</option>
            <option value="specific">Specific</option>
          </select>
        }
      >
        {investigations.length === 0 ? (
          <EmptyHint text="No investigations selected." />
        ) : (
          <div className="space-y-3">
            {(['basic', 'specific'] as const).map((cat) => {
              const list = investigations.filter((i) => i.category === cat);
              if (list.length === 0) return null;
              return (
                <div key={cat}>
                  <div className="text-xs font-medium text-slate-500 mb-1 uppercase">{cat}</div>
                  <ChipGrid>
                    {list.map((i) => (
                      <Chip key={i.id}
                        label={i.name}
                        description={i.description ?? undefined}
                        included={!!i.include_in_report}
                        onToggleInclude={(v) => toggleInclude('investigation', i.id, v)}
                        onRemove={() => removeItem('investigation', i.id)}
                      />
                    ))}
                  </ChipGrid>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {loading && (
        <div className="flex items-center justify-center py-4 text-slate-500 text-xs">
          <Loader2 size={14} className="animate-spin mr-1.5" /> Loading selections…
        </div>
      )}

      {/* ── Browser modals ───────────────────────────────────────── */}
      {browser === 'finding' && (
        <CatalogBrowser
          title="Findings"
          subtitle="Click Add to attach a finding to this examination."
          fetcher={(o) => catalogsApi.findings(o)}
          columns={[
            { key: 'name',        label: 'Finding',  width: '40%' },
            { key: 'system',      label: 'System',   width: '20%' },
            { key: 'description', label: 'Description' },
          ]}
          selectedIds={findingIds}
          onAdd={(r) => handleAddFinding(r as Finding)}
          onClose={() => setBrowser(null)}
        />
      )}
      {browser === 'syndrome' && (
        <CatalogBrowser
          title="Syndromes"
          fetcher={(o) => catalogsApi.syndromes(o)}
          columns={[
            { key: 'name',        label: 'Syndrome', width: '45%' },
            { key: 'omim_id',     label: 'OMIM',     width: '15%' },
            { key: 'description', label: 'Description' },
          ]}
          selectedIds={syndromeIds}
          onAdd={(r) => handleAddSyndrome(r as Syndrome)}
          onClose={() => setBrowser(null)}
        />
      )}
      {browser === 'gene' && (
        <CatalogBrowser
          title="Genes"
          subtitle="Search 2 000+ gene entries by symbol or full name."
          fetcher={(o) => catalogsApi.genes(o)}
          columns={[
            { key: 'symbol',      label: 'Symbol',    width: '15%' },
            { key: 'full_name',   label: 'Full name', width: '45%' },
            { key: 'hgnc_id',     label: 'HGNC',      width: '15%' },
            { key: 'description', label: 'Notes' },
          ]}
          selectedIds={geneIds}
          onAdd={(r) => handleAddGene(r as Gene)}
          onClose={() => setBrowser(null)}
        />
      )}
      {browser === 'investigation' && (
        <CatalogBrowser
          title="Investigations"
          subtitle={`Next addition will be filed as "${invCategory}". Change category in the side dropdown above.`}
          fetcher={(o) => catalogsApi.investigations(o)}
          columns={[
            { key: 'name',        label: 'Investigation', width: '40%' },
            { key: 'category',    label: 'Default',       width: '15%' },
            { key: 'description', label: 'Description' },
          ]}
          selectedIds={invIds}
          onAdd={(r) => handleAddInvestigation(r as Investigation)}
          onClose={() => setBrowser(null)}
        />
      )}
    </div>
  );
}

// ── Local presentational components ──────────────────────────────

function SectionCard({
  icon, title, subtitle, onAdd, addAccessory, children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onAdd: () => void;
  addAccessory?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <header className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</div>
            {subtitle && <div className="text-[11px] text-slate-500">{subtitle}</div>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {addAccessory}
          <button
            onClick={onAdd}
            className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            <Plus size={12} /> Browse
          </button>
        </div>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <div className="text-xs text-slate-400 italic">{text}</div>;
}

function ChipGrid({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

function Chip({
  label, meta, description, included, onToggleInclude, onRemove,
}: {
  label: string;
  meta?: string;
  description?: string;
  included: boolean;
  onToggleInclude: (v: boolean) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className={`rounded-lg border text-xs ${
        included
          ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
          : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/30 text-slate-500 line-through'
      }`}
    >
      <div className="flex items-center gap-2 px-2.5 py-1"
        title={description || (included ? 'In report' : 'Excluded from report')}
      >
        <input
          type="checkbox"
          checked={included}
          onChange={(e) => onToggleInclude(e.target.checked)}
          className="rounded"
          title="Include in PDF report"
        />
        <span
          className="font-medium cursor-pointer hover:underline"
          onClick={() => description && setExpanded(!expanded)}
        >
          {label}
        </span>
        {meta && <span className="text-[10px] text-slate-500 font-mono">{meta}</span>}
        <button
          onClick={onRemove}
          className="text-slate-400 hover:text-red-500 ml-0.5"
          title="Remove"
        >
          <Trash2 size={11} />
        </button>
      </div>
      {expanded && description && (
        <div className="px-3 pb-2 pt-0.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-600/50">
          {description}
        </div>
      )}
    </div>
  );
}
