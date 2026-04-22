/**
 * FindingsPanel — Click-to-select preset findings with auto-impression.
 * Supports multi-template selections (selections persist across template switches).
 * Supports doctor-added custom findings persisted to localStorage.
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ChevronDown, ChevronUp, FileText, Zap, ClipboardCopy,
  CheckCircle2, Circle, RotateCcw, Plus, X, Pencil,
} from 'lucide-react';
import type { TemplateKey } from '@/lib/usgExtraction/types';
import {
  FINDINGS_TEMPLATES, TEMPLATE_KEYS, generateImpression,
  type FindingGroup, type FindingOption,
} from '@/lib/usgExtraction/findingsTemplates';
import type { OBComputedResult } from '@/lib/usgExtraction/obCalculations';

interface FindingsPanelProps {
  /** Auto-detected template from extraction, or null for manual selection */
  detectedTemplate?: TemplateKey;
  /** OB data for impression generation */
  obData?: OBComputedResult | null;
  /** Callback to insert generated findings + impression into the editor */
  onInsert: (html: string) => void;
  /** Compact mode: skip the expand/collapse header (parent controls visibility) */
  compact?: boolean;
}

// ─── Custom Findings persistence ─────────────────────────────

const CUSTOM_FINDINGS_KEY = 'usg-custom-findings';

interface CustomFinding {
  label: string;
  text: string;
}

type CustomFindingsMap = Record<string, Record<string, CustomFinding[]>>;
// shape: { [templateKey]: { [groupName]: CustomFinding[] } }

function loadCustomFindings(): CustomFindingsMap {
  try {
    const raw = localStorage.getItem(CUSTOM_FINDINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveCustomFindings(map: CustomFindingsMap) {
  localStorage.setItem(CUSTOM_FINDINGS_KEY, JSON.stringify(map));
}

// Helper: get merged groups (preset + custom) for a given template key
function getMergedGroups(templateKey: TemplateKey, customFindings: CustomFindingsMap) {
  const tmpl = FINDINGS_TEMPLATES[templateKey];
  if (!tmpl) return [];
  const customs = customFindings[templateKey] || {};
  return tmpl.groups.map(g => {
    const groupCustoms = customs[g.name] || [];
    const customOptions: FindingOption[] = groupCustoms.map(c => ({
      label: c.label,
      text: c.text,
      isNormal: false,
    }));
    return {
      ...g,
      options: [...g.options, ...customOptions],
      customCount: groupCustoms.length,
    };
  });
}

export function FindingsPanel({ detectedTemplate, obData, onInsert, compact }: FindingsPanelProps) {
  const [activeTemplate, setActiveTemplate] = useState<TemplateKey>(detectedTemplate || 'abdominal');
  const [expanded, setExpanded] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Multi-template selections: { templateKey: { groupName: optionIndex } }
  const [allSelections, setAllSelections] = useState<Record<string, Record<string, number>>>({});

  // Derive current template's selections
  const selections = allSelections[activeTemplate] || {};

  // Custom findings state
  const [customFindings, setCustomFindings] = useState<CustomFindingsMap>(loadCustomFindings);
  const [addingCustom, setAddingCustom] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState('');
  const customInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (addingCustom && customInputRef.current) {
      customInputRef.current.focus();
    }
  }, [addingCustom]);

  const template = FINDINGS_TEMPLATES[activeTemplate];

  // Merged groups for the CURRENT template (for rendering)
  const mergedGroups = useMemo(() => {
    return getMergedGroups(activeTemplate, customFindings);
  }, [template, activeTemplate, customFindings]);

  const addCustomFinding = useCallback((groupName: string) => {
    const text = customInput.trim();
    if (!text) return;
    const label = text.length > 30 ? text.slice(0, 30) + '…' : text;
    setCustomFindings(prev => {
      const next = { ...prev };
      if (!next[activeTemplate]) next[activeTemplate] = {};
      if (!next[activeTemplate][groupName]) next[activeTemplate][groupName] = [];
      next[activeTemplate][groupName] = [...next[activeTemplate][groupName], { label, text }];
      saveCustomFindings(next);
      return next;
    });
    setCustomInput('');
    setAddingCustom(null);
  }, [customInput, activeTemplate]);

  const removeCustomFinding = useCallback((groupName: string, customIdx: number) => {
    setCustomFindings(prev => {
      const next = { ...prev };
      if (!next[activeTemplate]?.[groupName]) return prev;
      next[activeTemplate][groupName] = next[activeTemplate][groupName].filter((_, i) => i !== customIdx);
      if (next[activeTemplate][groupName].length === 0) delete next[activeTemplate][groupName];
      saveCustomFindings(next);
      return next;
    });
  }, [activeTemplate]);

  const toggleGroup = useCallback((groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  }, []);

  const selectFinding = useCallback((groupName: string, optIdx: number) => {
    setAllSelections(prev => {
      const templateSels = { ...(prev[activeTemplate] || {}) };
      if (templateSels[groupName] === optIdx) {
        delete templateSels[groupName];
      } else {
        templateSels[groupName] = optIdx;
      }
      return { ...prev, [activeTemplate]: templateSels };
    });
  }, [activeTemplate]);

  const selectAllNormal = useCallback(() => {
    const normals: Record<string, number> = {};
    mergedGroups.forEach(g => {
      const normalIdx = g.options.findIndex(o => o.isNormal);
      if (normalIdx >= 0) normals[g.name] = normalIdx;
    });
    setAllSelections(prev => ({ ...prev, [activeTemplate]: normals }));
  }, [mergedGroups, activeTemplate]);

  const clearAll = useCallback(() => {
    setAllSelections(prev => ({ ...prev, [activeTemplate]: {} }));
  }, [activeTemplate]);

  const clearAllTemplates = useCallback(() => {
    setAllSelections({});
  }, []);

  // Count selections per template (for tab badges)
  const templateCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [k, sels] of Object.entries(allSelections)) {
      const c = Object.keys(sels).length;
      if (c > 0) counts[k] = c;
    }
    return counts;
  }, [allSelections]);

  const totalSelectionCount = useMemo(() => {
    return Object.values(templateCounts).reduce((a, b) => a + b, 0);
  }, [templateCounts]);

  const currentSelectionCount = Object.keys(selections).length;

  // Build ALL selected findings texts across ALL templates
  const allSelectedTexts = useMemo(() => {
    const texts: string[] = [];
    for (const [tKey, sels] of Object.entries(allSelections)) {
      if (Object.keys(sels).length === 0) continue;
      const groups = getMergedGroups(tKey as TemplateKey, customFindings);
      for (const g of groups) {
        const idx = sels[g.name];
        if (idx !== undefined && g.options[idx]) {
          texts.push(g.options[idx].text);
        }
      }
    }
    return texts;
  }, [allSelections, customFindings]);

  // Determine primary template for impression generation
  const primaryTemplate = useMemo((): TemplateKey => {
    if (Object.keys(allSelections['obstetric'] || {}).length > 0) return 'obstetric';
    let maxKey: TemplateKey = activeTemplate;
    let maxCount = 0;
    for (const [k, sels] of Object.entries(allSelections)) {
      const count = Object.keys(sels).length;
      if (count > maxCount) { maxCount = count; maxKey = k as TemplateKey; }
    }
    return maxKey;
  }, [allSelections, activeTemplate]);

  // Generate impression from ALL selections
  const impression = useMemo(() => {
    if (allSelectedTexts.length === 0) return '';
    return generateImpression(allSelectedTexts, primaryTemplate, obData ? {
      compositeGA: obData.compositeGA,
      computedEFW: obData.computedEFW ? {
        value: obData.computedEFW.value,
        unit: obData.computedEFW.unit,
        percentile: obData.computedEFW.percentile,
      } : undefined,
      afiResult: obData.afiResult ? {
        value: obData.afiResult.value,
        interpretation: obData.afiResult.interpretation,
      } : undefined,
    } : undefined);
  }, [allSelectedTexts, primaryTemplate, obData]);

  // Generate final HTML from ALL template selections
  const generateHtml = useCallback(() => {
    if (allSelectedTexts.length === 0) return '';

    const findingsHtml = allSelectedTexts
      .map(t => `<p style="margin:2px 0;font-size:15px">${t}</p>`)
      .join('');

    const impressionHtml = impression
      ? impression.split('\n').map(l => `<p style="margin:2px 0;font-size:15px">${l}</p>`).join('')
      : '';

    return `
<div style="margin:12px 0">
  <h3 style="margin:10px 0 4px;font-size:16px;font-weight:bold;color:#333;border-bottom:1px solid #ddd;padding-bottom:2px">Findings</h3>
  ${findingsHtml}
  ${impressionHtml ? `
  <h3 style="margin:14px 0 4px;font-size:16px;font-weight:bold;color:#333;border-bottom:1px solid #ddd;padding-bottom:2px">Impression</h3>
  ${impressionHtml}
  ` : ''}
</div>`;
  }, [allSelectedTexts, impression]);

  const handleInsert = useCallback(() => {
    const html = generateHtml();
    if (html) onInsert(html);
  }, [generateHtml, onInsert]);

  if (mergedGroups.length === 0) return null;

  const content = (
    <div className="overflow-y-auto flex-1">
      {/* Template selector tabs */}
      <div className="flex flex-wrap gap-0.5 px-2 py-1 border-b border-app-border/50 sticky top-0 bg-app-surface z-10">
        {TEMPLATE_KEYS.map(({ key, label }) => {
          const count = templateCounts[key] || 0;
          return (
            <button
              key={key}
              onClick={() => setActiveTemplate(key)}
              className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors flex items-center gap-1 ${
                activeTemplate === key
                  ? 'bg-app-accent text-white'
                  : 'text-app-text-secondary hover:bg-app-hover'
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`inline-flex items-center justify-center min-w-[14px] h-[14px] text-[9px] font-bold rounded-full ${
                  activeTemplate === key
                    ? 'bg-white/30 text-white'
                    : 'bg-app-accent/20 text-app-accent'
                }`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-app-border/30 sticky top-[30px] bg-app-surface z-10">
        <button
          onClick={selectAllNormal}
          className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded border border-green-500/40 text-green-600 hover:bg-green-500/10 font-medium"
        >
          <CheckCircle2 className="w-3 h-3" />
          All Normal
        </button>
        <button
          onClick={clearAll}
          className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded border border-app-border text-app-text-secondary hover:bg-app-hover font-medium"
          title="Clear selections in current template"
        >
          <RotateCcw className="w-3 h-3" />
          Clear
        </button>
        {totalSelectionCount > 0 && (
          <>
            {Object.keys(templateCounts).length > 1 && (
              <button
                onClick={clearAllTemplates}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded border border-red-400/40 text-red-500 hover:bg-red-500/10 font-medium"
                title="Clear all selections across all templates"
              >
                <X className="w-3 h-3" />
                Clear All
              </button>
            )}
            <button
              onClick={handleInsert}
              className="flex items-center gap-1 px-2.5 py-0.5 text-[10px] rounded border border-app-accent bg-app-accent text-white hover:bg-app-accent/90 font-semibold ml-auto transition-colors"
            >
              <ClipboardCopy className="w-3 h-3" />
              Insert ({totalSelectionCount})
            </button>
          </>
        )}
      </div>

      {/* Finding groups */}
      {mergedGroups.map(group => {
        const isOpen = expandedGroups.has(group.name);
        const selectedIdx = selections[group.name];
        const hasSelection = selectedIdx !== undefined;
        const selectedOpt = hasSelection ? group.options[selectedIdx] : null;
        const presetCount = template.groups.find(g => g.name === group.name)?.options.length ?? 0;

        return (
          <div key={group.name} className="border-b border-app-border/20">
            <button
              onClick={() => toggleGroup(group.name)}
              className="w-full flex items-center gap-1.5 px-3 py-1 text-xs hover:bg-app-hover/30 transition-colors"
            >
              {hasSelection ? (
                <CheckCircle2 className={`w-3 h-3 flex-shrink-0 ${selectedOpt?.isNormal ? 'text-green-500' : 'text-amber-500'}`} />
              ) : (
                <Circle className="w-3 h-3 text-app-text-secondary/40 flex-shrink-0" />
              )}
              <span className={`font-medium ${hasSelection ? 'text-app-text' : 'text-app-text-secondary'}`}>
                {group.name}
              </span>
              {hasSelection && (
                <span className={`text-[10px] ml-1 truncate max-w-[200px] ${selectedOpt?.isNormal ? 'text-green-600' : 'text-amber-600'}`}>
                  — {selectedOpt?.label}
                </span>
              )}
              <span className="ml-auto">
                {isOpen ? <ChevronUp className="w-3 h-3 text-app-text-secondary/50" /> : <ChevronDown className="w-3 h-3 text-app-text-secondary/50" />}
              </span>
            </button>

            {isOpen && (
              <div className="px-3 pb-1.5 pt-0.5">
                <div className="flex flex-wrap gap-1">
                  {group.options.map((opt, optIdx) => {
                    const isSelected = selectedIdx === optIdx;
                    const isCustom = optIdx >= presetCount;
                    return (
                      <span key={optIdx} className="relative inline-flex items-center group/opt">
                        <button
                          onClick={() => selectFinding(group.name, optIdx)}
                          title={opt.text}
                          className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                            isSelected
                              ? opt.isNormal
                                ? 'bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-300 font-semibold'
                                : 'bg-amber-500/20 border-amber-500/50 text-amber-700 dark:text-amber-300 font-semibold'
                              : isCustom
                                ? 'border-purple-400/50 text-purple-600 dark:text-purple-300 hover:bg-purple-500/10 hover:border-purple-400'
                                : 'border-app-border/50 text-app-text-secondary hover:bg-app-hover hover:border-app-border'
                          }`}
                        >
                          {opt.label}
                        </button>
                        {isCustom && (
                          <button
                            onClick={(e) => { e.stopPropagation(); removeCustomFinding(group.name, optIdx - presetCount); }}
                            className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 opacity-0 group-hover/opt:opacity-100 transition-opacity"
                            title="Remove custom finding"
                          >
                            <X className="w-2 h-2" />
                          </button>
                        )}
                      </span>
                    );
                  })}
                  {addingCustom !== group.name && (
                    <button
                      onClick={() => { setAddingCustom(group.name); setCustomInput(''); }}
                      className="px-2 py-0.5 text-[10px] rounded border border-dashed border-purple-400/50 text-purple-500 hover:bg-purple-500/10 flex items-center gap-0.5"
                      title="Add custom finding"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      Custom
                    </button>
                  )}
                </div>
                {addingCustom === group.name && (
                  <div className="mt-1.5 flex gap-1">
                    <textarea
                      ref={customInputRef}
                      value={customInput}
                      onChange={e => setCustomInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addCustomFinding(group.name); }
                        if (e.key === 'Escape') { setAddingCustom(null); setCustomInput(''); }
                      }}
                      placeholder="Type custom finding text and press Enter..."
                      className="flex-1 px-2 py-1 text-[10px] rounded border border-purple-400/50 bg-app-bg text-app-text placeholder:text-app-text-secondary/40 resize-none"
                      rows={2}
                    />
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => addCustomFinding(group.name)}
                        disabled={!customInput.trim()}
                        className="px-1.5 py-0.5 text-[9px] rounded bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => { setAddingCustom(null); setCustomInput(''); }}
                        className="px-1.5 py-0.5 text-[9px] rounded border border-app-border text-app-text-secondary hover:bg-app-hover"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Live impression preview */}
      {impression && (
        <div className="px-3 py-2 bg-blue-500/5 border-t border-blue-500/20">
          <div className="text-[9px] font-bold uppercase tracking-widest text-blue-500/70 mb-1">
            Auto-Impression Preview
          </div>
          <div className="text-[11px] text-app-text leading-relaxed whitespace-pre-line">
            {impression}
          </div>
        </div>
      )}
    </div>
  );

  // Compact mode: no header wrapper, just content
  if (compact) {
    return <div className="flex flex-col h-full bg-app-surface/30">{content}</div>;
  }

  // Standalone mode: with expand/collapse header
  return (
    <div className="border-b border-app-border shrink-0 bg-app-surface/30">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-app-hover/50 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-app-accent" />
          <span className="text-[10px] font-semibold text-app-text-secondary uppercase tracking-wide">
            Findings & Impression
          </span>
          {totalSelectionCount > 0 && (
            <span className="text-[10px] text-app-accent font-semibold">
              ({totalSelectionCount})
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-app-text-secondary" /> : <ChevronDown className="w-3.5 h-3.5 text-app-text-secondary" />}
      </button>
      {expanded && <div className="max-h-72 overflow-y-auto">{content}</div>}
    </div>
  );
}
