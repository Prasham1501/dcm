// Print Wallet — top-up flow with paper-size selection.
// Fix: clean state model — each paper has its own count, custom counts work, totals update reactively.

const PAPER_TYPES = [
  { id: 'a4_bw',     label: 'A4 B&W',         rate: 1,    color: 'rose',    desc: '80gsm · single-side' },
  { id: 'a4_color',  label: 'A4 Colour',      rate: 5,    color: 'amber',   desc: '80gsm · single-side' },
  { id: 'a5_bw',     label: 'A5 B&W',         rate: 0.5,  color: 'teal',    desc: 'Half-page · double-side OK' },
  { id: 'letter',    label: 'Letter',         rate: 1.2,  color: 'emerald', desc: '8.5×11" · 80gsm' },
  { id: 's3_film',   label: 'S3 Film (DICOM)',rate: 35,   color: 'rose',    desc: '8×10" radiology film' },
];

const PAPER_PRESETS = [
  { id: 'p100',   label: '100',   factor: 100 },
  { id: 'p500',   label: '500',   factor: 500 },
  { id: 'p1000',  label: '1,000', factor: 1000 },
  { id: 'p2500',  label: '2,500', factor: 2500 },
  { id: 'p5000',  label: '5,000', factor: 5000 },
  { id: 'custom', label: 'Custom',factor: 0    },
];

const PrintRecharge = ({ onSuccess, onCancel }) => {
  // Per-paper-type quantity. Initial: 0 for everything.
  const [qty, setQty] = React.useState(() =>
    Object.fromEntries(PAPER_TYPES.map(p => [p.id, 0]))
  );
  // Per-paper-type preset (which preset button was clicked, or 'custom').
  const [preset, setPreset] = React.useState(() =>
    Object.fromEntries(PAPER_TYPES.map(p => [p.id, null]))
  );
  const [processing, setProcessing] = React.useState(false);
  const [progress, setProgress] = React.useState('');
  const toast = useToast();
  const { user } = useAuth();

  // --- Quantity handlers ---
  const setPresetFor = (paperId, presetObj) => {
    if (presetObj.id === 'custom') {
      // Switch to custom — preserve existing qty so user can edit it; if 0, prefill with empty.
      setPreset(p => ({ ...p, [paperId]: 'custom' }));
      // do not touch qty
    } else {
      setPreset(p => ({ ...p, [paperId]: presetObj.id }));
      setQty(q => ({ ...q, [paperId]: presetObj.factor }));
    }
  };

  const setCustomQty = (paperId, value) => {
    // Only digits, allow empty (treat as 0).
    const cleaned = String(value).replace(/[^0-9]/g, '');
    const n = cleaned === '' ? 0 : parseInt(cleaned, 10);
    setQty(q => ({ ...q, [paperId]: Math.min(n, 100000) })); // cap at 100k
    setPreset(p => ({ ...p, [paperId]: 'custom' }));
  };

  const clearPaper = (paperId) => {
    setQty(q => ({ ...q, [paperId]: 0 }));
    setPreset(p => ({ ...p, [paperId]: null }));
  };

  // --- Totals ---
  const lineItems = PAPER_TYPES
    .filter(p => qty[p.id] > 0)
    .map(p => ({ paper: p, qty: qty[p.id], rate: p.rate, amount: qty[p.id] * p.rate }));
  const subtotal = lineItems.reduce((s, l) => s + l.amount, 0);
  const gst = Math.round(subtotal * 0.18);
  const total = subtotal + gst;
  const totalCredits = lineItems.reduce((s, l) => s + l.qty, 0);

  // --- Submit ---
  const submit = async () => {
    if (subtotal <= 0) { toast?.('Add at least one paper type', 'warn'); return; }
    setProcessing(true); setProgress('Preparing order…');
    try {
      const items = lineItems.map(l => ({
        name: `Print credits · ${l.paper.label}`,
        qty: l.qty, rate: l.rate, amount: l.amount,
        sku: l.paper.id,
      }));
      const result = await openCheckout({
        type: 'print',
        amount: subtotal,                    // pre-GST; backend re-computes
        credits: totalCredits,               // total pages
        items,
        user,
        description: `Print credits — ${totalCredits.toLocaleString('en-IN')} pages`,
        onProgress: setProgress,
      });
      toast?.('Top-up successful — invoice in your inbox', 'success');
      onSuccess?.(result);
    } catch (e) {
      if (e.message !== 'Payment cancelled') {
        toast?.(e.message || 'Payment failed', 'error');
      }
    } finally { setProcessing(false); setProgress(''); }
  };

  return (
    <div className="space-y-5">
      <div className="text-sm text-[var(--muted)]">
        Pick paper sizes and quantities. You'll be billed once for everything below.
      </div>

      <div className="space-y-3">
        {PAPER_TYPES.map(p => {
          const q = qty[p.id];
          const ps = preset[p.id];
          const lineAmount = q * p.rate;
          const active = q > 0;
          return (
            <div key={p.id} className={`rounded-2xl border p-4 transition ${active ? 'border-rose/60 bg-rose-soft dark:bg-rose/15 dark:border-rose/40' : 'border-[var(--line)] bg-white dark:bg-white/[0.03]'}`}>
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <div className={`font-display font-bold text-base ${active ? 'text-ink dark:text-paper' : 'text-ink dark:text-paper'}`}>{p.label}</div>
                    <span className={`font-mono text-xs font-bold ${active ? 'text-rose-dark dark:text-rose' : 'text-rose'}`}>₹{p.rate}/page</span>
                  </div>
                  <div className={`text-xs mt-0.5 ${active ? 'text-rose-dark/70 dark:text-paper/70' : 'text-[var(--muted)]'}`}>{p.desc}</div>
                </div>
                {active && (
                  <button onClick={() => clearPaper(p.id)} className="text-xs text-[var(--muted)] hover:text-rose font-semibold uppercase tracking-wider px-2 py-1 rounded">
                    Clear
                  </button>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {PAPER_PRESETS.map(pr => (
                  <button
                    key={pr.id}
                    onClick={() => setPresetFor(p.id, pr)}
                    className={`h-9 px-3.5 rounded-lg border text-xs font-bold transition ${
                      ps === pr.id
                        ? 'bg-rose text-white border-rose shadow-sm'
                        : 'bg-white dark:bg-white/[0.04] border-[var(--line)] hover:border-rose hover:text-rose'
                    }`}
                  >{pr.label}</button>
                ))}

                {ps === 'custom' && (
                  <div className="flex items-center gap-2 ml-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={q || ''}
                      onChange={(e) => setCustomQty(p.id, e.target.value)}
                      placeholder="Pages"
                      className="h-9 w-28 px-3 rounded-lg border border-[var(--line)] bg-white dark:bg-white/[0.04] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose/40 focus:border-rose"
                      autoFocus
                    />
                    <span className="text-xs text-[var(--muted)]">pages</span>
                  </div>
                )}
              </div>

              {active && (
                <div className="mt-3 flex items-center justify-between text-sm pt-3 border-t border-[var(--line)]">
                  <span className="font-mono text-[var(--muted)]">{q.toLocaleString('en-IN')} × ₹{p.rate}</span>
                  <span className="font-display font-bold">{fmt.inr(lineAmount)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div className="rounded-2xl border border-[var(--line)] bg-paper2 dark:bg-white/[0.04] p-5">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-[var(--muted)]">Subtotal</span><span className="font-mono">{fmt.inr(subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-[var(--muted)]">GST (18%)</span><span className="font-mono">{fmt.inr(gst)}</span></div>
          <div className="flex justify-between text-base pt-2 mt-2 border-t border-[var(--line)] font-bold">
            <span>Total payable</span><span className="font-display text-xl">{fmt.inr(total)}</span>
          </div>
          <div className="text-xs text-[var(--muted)] pt-1">{totalCredits.toLocaleString('en-IN')} total pages will be added to your wallet.</div>
        </div>
      </div>

      {processing && (
        <div className="rounded-xl border border-rose/30 bg-rose-soft/40 dark:bg-rose/10 p-3.5 flex items-center gap-3 text-sm">
          <span className="h-4 w-4 border-2 border-rose/30 border-t-rose rounded-full animate-spin"/>
          <span className="font-semibold">{progress}</span>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <DButton variant="ghost" onClick={onCancel} disabled={processing}>Cancel</DButton>
        <DButton variant="primary" onClick={submit} loading={processing} disabled={subtotal === 0}>
          Pay {fmt.inr(total)}
        </DButton>
      </div>
    </div>
  );
};

window.PrintRecharge = PrintRecharge;
window.PAPER_TYPES = PAPER_TYPES;
