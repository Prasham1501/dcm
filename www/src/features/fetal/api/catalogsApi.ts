/**
 * Client for the fetal catalogs API (read-only listing/search + match scoring).
 */

const BASE = '/api/fetal/catalogs.php';

async function parseJson(res: Response) {
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch {
    throw new Error(`Non-JSON response (status ${res.status}): ${text.slice(0, 120)}`);
  }
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || `HTTP ${res.status}`);
  }
  return json;
}

export interface Finding {
  id: number;
  name: string;
  system: string | null;
  description: string | null;
  details_md?: string | null;
  syndromes?:      Array<{ id: number; name: string }>;
  investigations?: Array<{ id: number; name: string; category: string }>;
}

export interface Syndrome {
  id: number;
  name: string;
  omim_id: string | null;
  description: string | null;
  references_md?: string | null;
  findings?: Array<{ id: number; name: string }>;
  genes?:    Array<{ id: number; symbol: string; full_name: string | null }>;
}

export interface Gene {
  id: number;
  symbol: string;
  full_name: string | null;
  hgnc_id: string | null;
  description: string | null;
  syndromes?: Array<{ id: number; name: string }>;
}

export interface Investigation {
  id: number;
  name: string;
  category: 'basic' | 'specific';
  description: string | null;
}

export interface MatchedSyndrome {
  id: number;
  name: string;
  omim_id: string | null;
  overlap: number;
  total_findings: number;
  match_label: string;   // "N/M"
}

export interface PagedResult<T> {
  data: T[];
  total: number;
}

interface ListOpts {
  q?: string;
  limit?: number;
  offset?: number;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') usp.append(k, String(v));
  }
  return usp.toString();
}

export const catalogsApi = {
  async findings(opts: ListOpts & { system?: string } = {}): Promise<PagedResult<Finding>> {
    const qs = buildQuery({ resource: 'findings', ...opts });
    const res = await fetch(`${BASE}?${qs}`, { credentials: 'include' });
    const json = await parseJson(res);
    return { data: json.data, total: json.total };
  },

  async syndromes(opts: ListOpts = {}): Promise<PagedResult<Syndrome>> {
    const qs = buildQuery({ resource: 'syndromes', ...opts });
    const res = await fetch(`${BASE}?${qs}`, { credentials: 'include' });
    const json = await parseJson(res);
    return { data: json.data, total: json.total };
  },

  async genes(opts: ListOpts = {}): Promise<PagedResult<Gene>> {
    const qs = buildQuery({ resource: 'genes', ...opts });
    const res = await fetch(`${BASE}?${qs}`, { credentials: 'include' });
    const json = await parseJson(res);
    return { data: json.data, total: json.total };
  },

  async investigations(opts: ListOpts & { category?: 'basic' | 'specific' } = {}): Promise<PagedResult<Investigation>> {
    const qs = buildQuery({ resource: 'investigations', ...opts });
    const res = await fetch(`${BASE}?${qs}`, { credentials: 'include' });
    const json = await parseJson(res);
    return { data: json.data, total: json.total };
  },

  async findingDetail(id: number): Promise<Finding> {
    const res = await fetch(`${BASE}?resource=finding&id=${id}`, { credentials: 'include' });
    const json = await parseJson(res);
    return json.data;
  },

  async syndromeDetail(id: number): Promise<Syndrome> {
    const res = await fetch(`${BASE}?resource=syndrome&id=${id}`, { credentials: 'include' });
    const json = await parseJson(res);
    return json.data;
  },

  async geneDetail(id: number): Promise<Gene> {
    const res = await fetch(`${BASE}?resource=gene&id=${id}`, { credentials: 'include' });
    const json = await parseJson(res);
    return json.data;
  },

  /** Rank syndromes by overlap with the given finding ids. */
  async matchSyndromes(findingIds: number[]): Promise<MatchedSyndrome[]> {
    if (findingIds.length === 0) return [];
    const qs = buildQuery({ resource: 'match', finding_ids: findingIds.join(',') });
    const res = await fetch(`${BASE}?${qs}`, { credentials: 'include' });
    const json = await parseJson(res);
    return json.data;
  },
};
