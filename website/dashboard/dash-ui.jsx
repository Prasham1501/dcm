// Dashboard UI primitives — shared across all modules.

const DCard = ({ children, className = "", title, action, padding = "p-6" }) => (
  <div className={`rounded-2xl border border-[var(--line)] bg-white dark:bg-white/[0.03] ${className}`}>
    {(title || action) && (
      <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-4 border-b border-[var(--line)]">
        {title && <div className="font-display font-bold text-base">{title}</div>}
        {action && <div>{action}</div>}
      </div>
    )}
    <div className={padding}>{children}</div>
  </div>
);

const StatCard = ({ label, value, sub, tone = "rose", icon }) => {
  const tones = {
    rose: 'text-rose bg-rose-soft dark:bg-rose/15',
    teal: 'text-teal bg-teal-soft dark:bg-teal/15',
    amber: 'text-amber-600 bg-amber-100 dark:bg-amber-500/15',
    emerald: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-500/15',
  };
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white dark:bg-white/[0.03] p-5">
      <div className="flex items-start justify-between">
        <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-[var(--muted)]">{label}</div>
        {icon && <div className={`h-8 w-8 grid place-items-center rounded-lg ${tones[tone]}`}>{icon}</div>}
      </div>
      <div className="mt-3 font-display text-3xl font-bold tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-xs text-[var(--muted)]">{sub}</div>}
    </div>
  );
};

const Pill = ({ children, tone = "slate" }) => {
  const tones = {
    slate: 'bg-paper2 dark:bg-white/10 text-ink/70 dark:text-paper/70 border-[var(--line)]',
    rose: 'bg-rose-soft dark:bg-rose/15 text-rose-dark dark:text-rose border-rose/30',
    emerald: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300/40',
    amber: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300/40',
    teal: 'bg-teal-soft dark:bg-teal/15 text-teal dark:text-teal border-teal/30',
  };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold uppercase tracking-wider ${tones[tone] || tones.slate}`}>{children}</span>;
};

const DButton = ({ children, variant = "primary", size = "md", className = "", onClick, type = "button", disabled, loading }) => {
  const sizes = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm', lg: 'h-11 px-5 text-sm' };
  const variants = {
    primary: 'bg-rose text-white hover:bg-rose-dark shadow-sm',
    ghost: 'bg-white dark:bg-white/[0.04] border border-[var(--line)] hover:bg-paper2 dark:hover:bg-white/[0.07]',
    danger: 'bg-white dark:bg-white/[0.04] border border-rose/40 text-rose hover:bg-rose-soft dark:hover:bg-rose/10',
    dark: 'bg-ink dark:bg-paper text-white dark:text-ink hover:opacity-90',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${sizes[size]} ${variants[variant]} ${className}`}>
      {loading && <span className="h-3.5 w-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin"/>}
      {children}
    </button>
  );
};

const EmptyState = ({ icon, title, body, action }) => (
  <div className="text-center py-16 px-6">
    {icon && <div className="mx-auto h-14 w-14 rounded-2xl bg-paper2 dark:bg-white/[0.04] grid place-items-center text-[var(--muted)] mb-4">{icon}</div>}
    <div className="font-display font-bold text-lg">{title}</div>
    {body && <div className="mt-1 text-sm text-[var(--muted)] max-w-sm mx-auto">{body}</div>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

const Loading = () => (
  <div className="flex items-center justify-center py-16">
    <span className="h-6 w-6 border-2 border-rose/20 border-t-rose rounded-full animate-spin"/>
  </div>
);

// Modal
const Modal = ({ open, onClose, title, children, footer, width, size = "md" }) => {
  const sizeMap = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  const w = width || sizeMap[size] || sizeMap.md;
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={onClose}/>
      <div className={`relative w-full ${w} rounded-2xl bg-white dark:bg-mid2 border border-[var(--line)] shadow-2xl max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line)] shrink-0">
          <div className="font-display font-bold text-lg">{title}</div>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-paper2 dark:hover:bg-white/[0.06]">
            <I.X size={16}/>
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-[var(--line)] flex items-center justify-end gap-2 shrink-0">{footer}</div>}
      </div>
    </div>
  );
};

// Toast — global
const ToastCtx = React.createContext(null);
const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = React.useState([]);
  const push = (msg, tone = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  };
  push.showToast = push;
  push.addToast = push;
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-6 right-6 z-[200] space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold flex items-center gap-2 min-w-[260px] ${
            t.tone === 'error' ? 'bg-rose text-white border-rose-dark' :
            t.tone === 'warn' ? 'bg-amber-500 text-white border-amber-600' :
            'bg-emerald-600 text-white border-emerald-700'
          }`}>
            {t.tone === 'error' ? <I.X size={16}/> : t.tone === 'warn' ? <I.Bell size={16}/> : <I.Check size={16}/>}
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
};
const useToast = () => React.useContext(ToastCtx);

// Format helpers
const fmt = {
  inr: (n) => '₹' + Number(n).toLocaleString('en-IN'),
  num: (n) => Number(n).toLocaleString('en-IN'),
  date: (ts) => new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
  time: (ts) => new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  datetime: (ts) => new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
  rel: (ts) => {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  },
};

// Form primitives
const DLabel = ({ children, required, className = "" }) => (
  <label className={`block text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5 ${className}`}>
    {children}{required && <span className="text-rose ml-0.5">*</span>}
  </label>
);

const DInput = React.forwardRef(({ className = "", ...rest }, ref) => (
  <input ref={ref} {...rest} className={`h-10 w-full px-3 rounded-lg border border-[var(--line)] bg-white dark:bg-white/[0.04] text-sm focus:outline-none focus:ring-2 focus:ring-rose/40 focus:border-rose ${className}`}/>
));

// Modal accepts both `width` and `size` ('sm'|'md'|'lg')
const _origModal = Modal;

Object.assign(window, { DCard, StatCard, Pill, DButton, EmptyState, Loading, Modal, ToastProvider, useToast, fmt, DLabel, DInput });
