import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, FlaskConical, Pencil, Save, Trash2 } from 'lucide-react';
import { Banner, Button, EmptyState, SectionHeader, SelectInput, TextInput } from '@/components/RisUi';
import type { Service } from '@/features/reception/api/receptionApi';
import { apiImportCsv } from '@/features/settings/api/settingsApi';
import { apiListParameters, apiSaveParameter, apiDeleteParameter, type TestParameter } from '../api/resultsApi';

const PARAM_TEMPLATE = ['service_code', 'parameter', 'unit', 'low', 'high', 'sex', 'formula', 'is_heading', 'sort_order'];

function downloadCsvTemplate(name: string, headers: string[]) {
  const blob = new Blob([headers.join(',') + '\n'], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${name}_template.csv`; a.click();
  URL.revokeObjectURL(url);
}

type ParamKind = 'numeric' | 'text' | 'heading';

interface ParamForm {
  id?: number;
  name: string;
  kind: ParamKind;
  unit: string;
  low: string;
  high: string;
  normal_text: string;
  formula: string;
  sort_order: number;
}

const EMPTY: ParamForm = { name: '', kind: 'numeric', unit: '', low: '', high: '', normal_text: '', formula: '', sort_order: 0 };

// Common lab units the doctor can pick or type over.
const UNIT_OPTIONS = [
  '%', 'mg/dL', 'g/dL', 'mmol/L', 'mEq/L', 'IU/L', 'U/L', 'ng/mL', 'pg/mL', 'µIU/mL', 'µg/dL',
  'cells/cu.mm', 'x10³/µL', 'x10⁶/µL', 'million/cu.mm', 'fL', 'pg', 'mm/hr', '/hpf', 'ratio', 'sec',
];

export function ParametersCard({ services }: { services: Service[] }) {
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [params, setParams] = useState<TestParameter[]>([]);
  const [form, setForm] = useState<ParamForm>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Default to the first test, and keep selection valid as the catalogue changes (new test added).
  useEffect(() => {
    if (services.length === 0) { setServiceId(null); return; }
    if (serviceId == null || !services.some((s) => s.id === serviceId)) {
      setServiceId(services[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services]);

  const loadParams = async (sid: number) => {
    try { setParams(await apiListParameters(sid)); } catch (e: any) { setError(e?.message || 'Failed to load parameters'); }
  };

  useEffect(() => { if (serviceId) loadParams(serviceId); }, [serviceId]);

  const editParam = (p: TestParameter) => {
    const r = p.ranges?.[0];
    setForm({
      id: p.id,
      name: p.name,
      kind: Number(p.is_heading) === 1 ? 'heading' : (p.input_type === 'text' ? 'text' : 'numeric'),
      unit: p.unit || '',
      low: r?.low != null ? String(r.low) : '',
      high: r?.high != null ? String(r.high) : '',
      normal_text: r?.normal_text || '',
      formula: p.formula || '',
      sort_order: Number(p.sort_order ?? 0),
    });
  };

  const save = async () => {
    if (!serviceId) { setError('Pick a test first'); return; }
    if (!form.name.trim()) { setError('Enter a parameter name'); return; }
    setBusy(true); setError(null); setMessage(null);
    try {
      const isHeading = form.kind === 'heading';
      const isNumeric = form.kind === 'numeric';
      let ranges: any[] = [];
      if (!isHeading) {
        if (isNumeric && (form.low || form.high)) {
          ranges = [{ sex: 'any', age_min_days: 0, age_max_days: 54750, low: form.low || null, high: form.high || null, normal_text: form.normal_text || null }];
        } else if (form.normal_text) {
          ranges = [{ sex: 'any', age_min_days: 0, age_max_days: 54750, low: null, high: null, normal_text: form.normal_text }];
        }
      }
      // New params append after the current list; edited params keep their order.
      const sortOrder = form.id ? form.sort_order : (params.reduce((m, p) => Math.max(m, Number(p.sort_order || 0)), 0) + 1);
      await apiSaveParameter({
        id: form.id,
        service_id: serviceId,
        name: form.name.trim(),
        unit: isNumeric ? (form.unit || null) : null,
        input_type: isHeading ? 'text' : form.kind,
        formula: isNumeric ? (form.formula || null) : null,
        is_heading: isHeading ? 1 : 0,
        sort_order: sortOrder,
        ranges,
      } as any);
      setForm(EMPTY);
      await loadParams(serviceId);
      setMessage('Parameter saved');
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: TestParameter) => {
    if (!window.confirm(`Delete parameter "${p.name}"?`)) return;
    setBusy(true);
    try { await apiDeleteParameter(p.id); if (serviceId) await loadParams(serviceId); } catch (e: any) { setError(e?.message || 'Delete failed'); } finally { setBusy(false); }
  };

  const importCsv = async (file?: File | null) => {
    if (!file) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const res = await apiImportCsv('test_parameters', file);
      if (serviceId) await loadParams(serviceId);
      setMessage(`Imported ${res.created}, skipped ${res.skipped}${res.errors?.length ? `, errors ${res.errors.length}` : ''}.`);
    } catch (e: any) { setError(e?.message || 'Import failed'); }
    finally { setBusy(false); }
  };

  const isHeading = form.kind === 'heading';
  const isNumeric = form.kind === 'numeric';

  return (
    <div className="card card-pad mt-5">
      <SectionHeader icon={FlaskConical} title="Test parameters" sub="Define the rows that appear under a test report (e.g. Haemoglobin, WBC), their units and normal ranges." />
      {error && <Banner kind="warning">{error}</Banner>}
      {message && <div className="banner banner-success mt-3">{message}</div>}

      <div className="actions mt-3">
        <label className="btn btn-secondary">
          <FileSpreadsheet size={15} /> Import parameters CSV
          <input type="file" accept=".csv,text/csv" hidden onChange={(e) => importCsv(e.target.files?.[0])} />
        </label>
        <Button variant="ghost" icon={Download} onClick={() => downloadCsvTemplate('test_parameters', PARAM_TEMPLATE)}>Download template</Button>
      </div>

      <SelectInput label="Test" value={String(serviceId ?? '')} onChange={(e) => { setServiceId(Number(e.target.value)); setForm(EMPTY); }} className="mt-3">
        {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </SelectInput>

      <div className="grid-2 mt-3">
        <TextInput label="Parameter name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Haemoglobin" />
        <SelectInput label="Type" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as ParamKind })}>
          <option value="numeric">Numeric value (with normal range)</option>
          <option value="text">Text value (e.g. Positive / Negative)</option>
          <option value="heading">Section heading (no value)</option>
        </SelectInput>
      </div>

      {isNumeric && (
        <>
          <div className="grid-3 mt-3">
            <TextInput label="Unit" list="param-units" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="Pick or type" hint="e.g. g/dL, %, mg/dL" />
            <datalist id="param-units">{UNIT_OPTIONS.map((u) => <option key={u} value={u} />)}</datalist>
            <TextInput label="Normal range — Low" type="number" value={form.low} onChange={(e) => setForm({ ...form, low: e.target.value })} placeholder="e.g. 13" />
            <TextInput label="Normal range — High" type="number" value={form.high} onChange={(e) => setForm({ ...form, high: e.target.value })} placeholder="e.g. 17" />
          </div>
          <div className="grid-2 mt-3">
            <TextInput label="Auto-calculate (optional)" value={form.formula} onChange={(e) => setForm({ ...form, formula: e.target.value })} placeholder="e.g. 28.7*{HbA1c} - 46.7" hint="Reference another parameter in { }; leave blank for normal entry" />
            <TextInput label="Range note (optional)" value={form.normal_text} onChange={(e) => setForm({ ...form, normal_text: e.target.value })} placeholder="Shown if Low/High not used" />
          </div>
        </>
      )}
      {form.kind === 'text' && (
        <div className="grid-2 mt-3">
          <TextInput label="Normal value (optional)" value={form.normal_text} onChange={(e) => setForm({ ...form, normal_text: e.target.value })} placeholder="e.g. Negative" />
        </div>
      )}

      <div className="actions mt-3">
        <Button variant="primary" icon={Save} disabled={busy || !form.name.trim()} onClick={save}>{form.id ? 'Update parameter' : 'Add parameter'}</Button>
        {form.id ? <Button variant="secondary" onClick={() => setForm(EMPTY)}>Cancel edit</Button> : null}
      </div>

      <div className="divider" />
      {params.length === 0 ? <EmptyState title="No parameters" sub="Add the first row for this test above." /> : (
        <div className="table-wrap">
          <table className="dt">
            <thead><tr><th>Parameter</th><th>Type</th><th>Unit</th><th>Normal range</th><th /></tr></thead>
            <tbody>
              {params.map((p) => {
                const r = p.ranges?.[0];
                const ref = r ? (r.normal_text || [r.low, r.high].filter((x) => x != null).join(' - ')) : '';
                const kind = Number(p.is_heading) === 1 ? 'Heading' : (p.input_type === 'text' ? 'Text' : 'Numeric');
                return (
                  <tr key={p.id}>
                    <td className="strong">{Number(p.is_heading) === 1 ? `▸ ${p.name}` : p.name}{p.formula ? <span className="field-hint"> (auto)</span> : null}</td>
                    <td className="field-hint">{kind}</td>
                    <td>{p.unit || '-'}</td>
                    <td className="field-hint">{ref || '-'}</td>
                    <td>
                      <div className="actions">
                        <Button size="sm" variant="secondary" icon={Pencil} onClick={() => editParam(p)}>Edit</Button>
                        <Button size="sm" variant="danger" icon={Trash2} disabled={busy} onClick={() => remove(p)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
