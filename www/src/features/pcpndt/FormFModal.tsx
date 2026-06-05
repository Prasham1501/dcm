import { useEffect, useMemo, useState } from 'react';
import { X, Printer, Save, Upload, Loader2, AlertTriangle } from 'lucide-react';
import {
  pcpndtPrefill, pcpndtSave, pcpndtSetStatus, pcpndtFormHtmlUrl, PCPNDT_PORTAL_URL,
  pcpndtGetPortalCreds, pcpndtSetPortalCreds,
  type FormFFields, type PcpndtOptions,
} from './pcpndtApi';

interface Props {
  patientId?: string;
  patientName?: string;
  studyUid?: string;
  onClose: () => void;
}

const REQUIRED = [
  'clinic_name', 'clinic_registration_no', 'patient_name', 'patient_age',
  'husband_or_father_name', 'full_address', 'referring_doctor', 'procedure_date', 'performing_doctor',
];

const labels: Record<string, string> = {
  clinic_name: 'Clinic name', clinic_registration_no: 'Clinic Reg. No.', clinic_address: 'Clinic address',
  patient_name: 'Pregnant woman name', patient_age: 'Age (years)', husband_or_father_name: "Husband's / Father's name",
  full_address: 'Full postal address', phone: 'Telephone / Mobile', id_proof_type: 'ID proof type', id_proof_number: 'ID proof number',
  num_living_children: 'No. of living children', children_details: 'Children details (sex)',
  lmp_date: 'LMP', gestational_age: 'Gestational age', edd: 'EDD',
  family_history: 'Family genetic/medical history', basis_of_diagnosis: 'Basis of diagnosis',
  procedure_date: 'Date of procedure', complications: 'Complications', result: 'Result',
  referring_doctor: 'Referred by (doctor)', referring_doctor_address: 'Referring doctor address', referring_doctor_reg_no: 'Referring doctor Reg. No.',
  performing_doctor: 'Procedure conducted by', performing_doctor_qualification: 'Qualification', performing_doctor_reg_no: 'Performer Reg. No.',
  ref_no: 'Ref. No.',
};

export function FormFModal({ patientId, patientName, studyUid, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState('');
  const [fields, setFields] = useState<FormFFields>({});
  const [options, setOptions] = useState<PcpndtOptions>({ indications: [], procedures: [], basis_of_diagnosis: [] });
  const [risLinked, setRisLinked] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [ack, setAck] = useState('');
  const [showAck, setShowAck] = useState(false);

  // Government portal login (saved encrypted; configured once by an admin).
  const [portalUser, setPortalUser] = useState('');
  const [portalPass, setPortalPass] = useState('');
  const [portalHasPass, setPortalHasPass] = useState(false);
  const [portalMsg, setPortalMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    pcpndtGetPortalCreds('maharashtra')
      .then((pc) => { if (alive) { setPortalUser(pc.username || ''); setPortalHasPass(pc.has_password); } })
      .catch(() => { /* non-admin, or not configured yet */ });
    return () => { alive = false; };
  }, []);

  const savePortal = async () => {
    setPortalMsg(null);
    try {
      const r = await pcpndtSetPortalCreds('maharashtra', portalUser, portalPass);
      setPortalHasPass(r.has_password);
      setPortalPass('');
      setPortalMsg('Portal login saved');
      setTimeout(() => setPortalMsg(null), 2500);
    } catch (e: any) {
      setPortalMsg(e?.message || 'Save failed (admin only)');
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const pf = await pcpndtPrefill({ studyUid, patientId, patientName });
        if (!alive) return;
        setFormKey(pf.study_uid);
        setFields(pf.fields);
        setOptions(pf.options);
        setRisLinked(pf.ris_linked);
      } catch (e: any) {
        if (alive) setError(e?.message || 'Failed to load Form F');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [studyUid, patientId, patientName]);

  const missing = useMemo(() => {
    const m: string[] = [];
    for (const k of REQUIRED) if (!String(fields[k] ?? '').trim()) m.push(k);
    if (!String(fields.lmp_date ?? '').trim() && !String(fields.gestational_age ?? '').trim()) m.push('lmp_or_gestational_age');
    if (!(fields.indications?.length)) m.push('indications');
    return m;
  }, [fields]);

  const set = (k: string, v: any) => setFields((f) => ({ ...f, [k]: v }));
  const toggle = (k: 'indications' | 'procedures', v: string) =>
    setFields((f) => {
      const arr = new Set<string>(f[k] ?? []);
      arr.has(v) ? arr.delete(v) : arr.add(v);
      return { ...f, [k]: Array.from(arr) };
    });

  const save = async (): Promise<boolean> => {
    setSaving(true); setError(null); setSavedMsg(null);
    try {
      await pcpndtSave(formKey, fields);
      setSavedMsg('Saved');
      setTimeout(() => setSavedMsg(null), 2000);
      return true;
    } catch (e: any) {
      setError(e?.message || 'Save failed');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const onPrint = async () => { if (await save()) window.open(pcpndtFormHtmlUrl(formKey), '_blank'); };
  const onUpload = async () => {
    if (!(await save())) return;
    window.open(PCPNDT_PORTAL_URL, '_blank');
    setShowAck(true);
  };
  const recordAck = async () => {
    await pcpndtSetStatus(formKey, 'submitted', ack || undefined);
    setShowAck(false);
    setSavedMsg('Submission recorded');
    setTimeout(() => setSavedMsg(null), 2500);
  };

  const reqClass = (k: string) =>
    `w-full h-8 px-2 text-sm rounded border bg-app-bg text-app-text ${missing.includes(k) ? 'border-red-500' : 'border-black dark:border-white'}`;

  // NOTE: render function (not a component) — inline components remount on
  // every parent render and steal focus from the active input.
  const renderText = (k: string, opts: { type?: string; wide?: boolean } = {}) => {
    const { type = 'text', wide = false } = opts;
    return (
      <div key={k} className={wide ? 'col-span-2' : ''}>
        <label className="block text-[11px] text-app-text-muted mb-0.5">
          {labels[k] || k}{REQUIRED.includes(k) && <span className="text-red-500"> *</span>}
        </label>
        <input
          type={type}
          value={fields[k] ?? ''}
          onChange={(e) => set(k, e.target.value)}
          className={reqClass(k)}
        />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
      <div className="bg-app-bg border border-app-border rounded-lg shadow-2xl w-[920px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-app-border">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-app-accent">PCPNDT — Form F</span>
            {risLinked && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-500">RIS-linked</span>}
          </div>
          <button onClick={onClose} className="text-app-text-muted hover:text-app-text"><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-app-text-muted py-10 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : (
            <>
              {error && <div className="px-3 py-2 text-xs text-red-500 bg-red-500/10 border border-red-500/40 rounded">{error}</div>}
              {missing.length > 0 && (
                <div className="px-3 py-2 text-xs text-amber-600 bg-amber-500/10 border border-amber-500/40 rounded flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>Required for the government portal: {missing.map((m) => labels[m] || m.replace(/_/g, ' ')).join(', ')}</span>
                </div>
              )}

              <Section title="Genetic / Ultrasound Clinic">
                {renderText('clinic_name', { wide: true })}
                {renderText('clinic_registration_no')}
                {renderText('ref_no')}
                {renderText('clinic_address', { wide: true })}
              </Section>

              <Section title="Pregnant woman">
                {renderText('patient_name')}
                {renderText('patient_age')}
                {renderText('husband_or_father_name')}
                {renderText('phone')}
                {renderText('full_address', { wide: true })}
                {renderText('id_proof_type')}
                {renderText('id_proof_number')}
                {renderText('num_living_children')}
                {renderText('children_details')}
                {renderText('lmp_date', { type: 'date' })}
                {renderText('gestational_age')}
                {renderText('edd', { type: 'date' })}
              </Section>

              <Section title="Family history">
                {renderText('family_history', { wide: true })}
                <div>
                  <label className="block text-[11px] text-app-text-muted mb-0.5">{labels.basis_of_diagnosis}</label>
                  <input list="pcpndt-basis" value={fields.basis_of_diagnosis ?? ''} onChange={(e) => set('basis_of_diagnosis', e.target.value)} className={reqClass('basis_of_diagnosis')} />
                  <datalist id="pcpndt-basis">{options.basis_of_diagnosis.map((b) => <option key={b} value={b} />)}</datalist>
                </div>
              </Section>

              <Section title="Indication(s) for the procedure">
                <div className="col-span-2 space-y-1">
                  {options.indications.map((opt) => (
                    <label key={opt} className="flex items-start gap-2 text-xs text-app-text">
                      <input type="checkbox" checked={(fields.indications ?? []).includes(opt)} onChange={() => toggle('indications', opt)} className="mt-0.5" />
                      <span>{opt}</span>
                    </label>
                  ))}
                  {missing.includes('indications') && <div className="text-[11px] text-red-500">Select at least one indication.</div>}
                </div>
              </Section>

              <Section title="Procedure">
                <div>
                  <label className="block text-[11px] text-app-text-muted mb-0.5">Type</label>
                  <select value={fields.procedure_type ?? 'Non-invasive'} onChange={(e) => set('procedure_type', e.target.value)} className={reqClass('procedure_type')}>
                    <option>Non-invasive</option><option>Invasive</option>
                  </select>
                </div>
                {renderText('procedure_date', { type: 'date' })}
                <div className="col-span-2 space-y-1">
                  {options.procedures.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-xs text-app-text">
                      <input type="checkbox" checked={(fields.procedures ?? []).includes(opt)} onChange={() => toggle('procedures', opt)} />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
                {renderText('complications', { wide: true })}
                {renderText('result', { wide: true })}
                <div>
                  <label className="block text-[11px] text-app-text-muted mb-0.5">Result conveyed to woman</label>
                  <select value={fields.result_conveyed ?? 'No'} onChange={(e) => set('result_conveyed', e.target.value)} className={reqClass('result_conveyed')}>
                    <option>No</option><option>Yes</option>
                  </select>
                </div>
              </Section>

              <Section title="Referral & person conducting procedure">
                {renderText('referring_doctor')}
                {renderText('referring_doctor_reg_no')}
                {renderText('referring_doctor_address', { wide: true })}
                {renderText('performing_doctor')}
                {renderText('performing_doctor_qualification')}
                {renderText('performing_doctor_reg_no')}
              </Section>

              <Section title="Government portal login (Maharashtra) — saved encrypted, set once">
                <div>
                  <label className="block text-[11px] text-app-text-muted mb-0.5">Portal username</label>
                  <input value={portalUser} onChange={(e) => setPortalUser(e.target.value)} className={reqClass('portal_user')} />
                </div>
                <div>
                  <label className="block text-[11px] text-app-text-muted mb-0.5">Portal password</label>
                  <input type="password" value={portalPass} onChange={(e) => setPortalPass(e.target.value)}
                    placeholder={portalHasPass ? '•••••• (saved — leave blank to keep)' : ''} className={reqClass('portal_pass')} />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <button type="button" onClick={savePortal} className="px-3 py-1.5 text-xs font-semibold border border-app-border rounded hover:bg-app-hover">
                    Save portal login
                  </button>
                  {portalMsg && <span className="text-[11px] text-green-500">{portalMsg}</span>}
                  <span className="text-[11px] text-app-text-muted">Stored encrypted for the assisted portal upload (admin only).</span>
                </div>
              </Section>

              <div className="text-[11px] text-app-text-muted border border-app-border rounded p-2">
                On print, both statutory declarations (pregnant woman + doctor: sex not detected/disclosed) are added with the names above. The signed printout is the legally-required record (Rule 9(7)).
              </div>

              {showAck && (
                <div className="px-3 py-2 bg-blue-500/10 border border-blue-500/40 rounded flex items-center gap-2">
                  <span className="text-xs">Portal acknowledgment no.:</span>
                  <input value={ack} onChange={(e) => setAck(e.target.value)} className="h-7 px-2 text-sm rounded border border-black dark:border-white bg-app-bg" />
                  <button onClick={recordAck} className="px-2 py-1 text-xs rounded bg-blue-600 text-white">Record</button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-app-border">
          <span className="text-xs text-green-500">{savedMsg}</span>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving || loading} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-app-border rounded hover:bg-app-hover disabled:opacity-50">
              <Save className="w-3.5 h-3.5" /> Save draft
            </button>
            <button onClick={onPrint} disabled={saving || loading} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border-2 border-app-accent text-app-accent rounded hover:bg-app-accent hover:text-white disabled:opacity-50">
              <Printer className="w-3.5 h-3.5" /> Print / PDF
            </button>
            <button onClick={onUpload} disabled={saving || loading || missing.length > 0} title={missing.length ? 'Fill all required fields first' : 'Open portal pre-filled (assisted submit)'} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border-2 border-green-600 text-white bg-green-600 rounded hover:opacity-90 disabled:opacity-50">
              <Upload className="w-3.5 h-3.5" /> Upload to portal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-bold text-app-accent mb-1.5 pb-1 border-b border-app-border">{title}</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">{children}</div>
    </div>
  );
}
