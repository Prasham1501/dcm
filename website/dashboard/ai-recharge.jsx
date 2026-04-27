// AI Credits — recharge with predefined packs.

const AI_PACKS = [
  { id: 'starter',  credits: 500,    price: 1499,   per: 3.0,  badge: null },
  { id: 'practice', credits: 2500,   price: 6499,   per: 2.6,  badge: 'Save 13%' },
  { id: 'clinic',   credits: 10000,  price: 22999,  per: 2.3,  badge: 'Save 23%' },
  { id: 'hospital', credits: 50000,  price: 99999,  per: 2.0,  badge: 'Save 33%' },
];

const AIRecharge = ({ onSuccess, onCancel }) => {
  const [pack, setPack] = React.useState('practice');
  const [processing, setProcessing] = React.useState(false);
  const [progress, setProgress] = React.useState('');
  const toast = useToast();
  const { user } = useAuth();

  const selected = AI_PACKS.find(p => p.id === pack);
  const subtotal = selected.price;
  const gst = Math.round(subtotal * 0.18);
  const total = subtotal + gst;

  const submit = async () => {
    setProcessing(true); setProgress('Preparing order…');
    try {
      const result = await openCheckout({
        type: 'ai',
        amount: subtotal,
        credits: selected.credits,
        items: [{ name: `AI credits · ${selected.credits.toLocaleString('en-IN')} pack`, qty: selected.credits, rate: selected.per, amount: subtotal }],
        user,
        description: `${selected.credits.toLocaleString('en-IN')} AI credits`,
        onProgress: setProgress,
      });
      toast?.('AI credits added to your account', 'success');
      onSuccess?.(result);
    } catch (e) {
      if (e.message !== 'Payment cancelled') toast?.(e.message || 'Payment failed', 'error');
    } finally { setProcessing(false); setProgress(''); }
  };

  return (
    <div className="space-y-5">
      <div className="text-sm text-[var(--muted)]">
        Each credit = one AI inference. Bigger packs cost less per call. Credits never expire.
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {AI_PACKS.map(p => {
          const active = pack === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setPack(p.id)}
              className={`relative text-left rounded-2xl border p-4 transition ${
                active
                  ? 'border-rose bg-rose-soft/40 dark:bg-rose/10 ring-2 ring-rose/30'
                  : 'border-[var(--line)] bg-white dark:bg-white/[0.03] hover:border-rose/40'
              }`}
            >
              {p.badge && (
                <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-full bg-amber-400 text-ink text-[10px] font-bold uppercase tracking-wider shadow">{p.badge}</span>
              )}
              <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-[var(--muted)]">{p.id.charAt(0).toUpperCase() + p.id.slice(1)}</div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-display text-2xl font-bold">{p.credits.toLocaleString('en-IN')}</span>
                <span className="text-xs text-[var(--muted)]">credits</span>
              </div>
              <div className="mt-2 font-display text-lg font-bold text-rose">{fmt.inr(p.price)}</div>
              <div className="text-[11px] font-mono text-[var(--muted)] mt-0.5">₹{p.per}/call</div>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-paper2 dark:bg-white/[0.04] p-5">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-[var(--muted)]">Subtotal</span><span className="font-mono">{fmt.inr(subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-[var(--muted)]">GST (18%)</span><span className="font-mono">{fmt.inr(gst)}</span></div>
          <div className="flex justify-between text-base pt-2 mt-2 border-t border-[var(--line)] font-bold">
            <span>Total payable</span><span className="font-display text-xl">{fmt.inr(total)}</span>
          </div>
        </div>
      </div>

      {processing && (
        <div className="rounded-xl border border-rose/30 bg-rose-soft/40 dark:bg-rose/10 p-3.5 flex items-center gap-3 text-sm">
          <span className="h-4 w-4 border-2 border-rose/30 border-t-rose rounded-full animate-spin"/>
          <span className="font-semibold">{progress}</span>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <DButton variant="ghost" onClick={onCancel} disabled={processing}>Cancel</DButton>
        <DButton variant="primary" onClick={submit} loading={processing}>Pay {fmt.inr(total)}</DButton>
      </div>
    </div>
  );
};

window.AIRecharge = AIRecharge;
window.AI_PACKS = AI_PACKS;
