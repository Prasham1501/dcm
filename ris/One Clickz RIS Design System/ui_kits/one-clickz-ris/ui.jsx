/* Shared UI primitives for the One Clickz RIS kit.
   Plain, mostly-cosmetic recreations of the production components.
   Exposed on window for the other Babel scripts. */
const { useState, useEffect, useRef } = React;

/* Lucide icon helper — renders a fresh node and lets lucide hydrate it. */
function Icon({ name, size = 16, className = '', style = {} }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && window.lucide) {
      ref.current.innerHTML = '';
      const el = document.createElement('i');
      el.setAttribute('data-lucide', name);
      ref.current.appendChild(el);
      window.lucide.createIcons({ attrs: { width: size, height: size }, nameAttr: 'data-lucide', icons: window.lucide.icons });
    }
  }, [name, size]);
  return <span ref={ref} className={className} style={{ display: 'inline-flex', lineHeight: 0, ...style }} />;
}

function Button({ variant = 'secondary', size, icon, iconRight, children, className = '', ...rest }) {
  const cls = ['btn', `btn-${variant}`, size ? `btn-${size}` : '', className].filter(Boolean).join(' ');
  const isz = size === 'sm' ? 14 : 15;
  return (
    <button className={cls} {...rest}>
      {icon && <Icon name={icon} size={isz} />}
      {children}
      {iconRight && <Icon name={iconRight} size={isz} />}
    </button>
  );
}

function IconButton({ icon, bordered, sm, className = '', ...rest }) {
  const cls = ['iconbtn', bordered ? 'bordered' : '', sm ? 'iconbtn-sm' : '', className].filter(Boolean).join(' ');
  return <button className={cls} {...rest}><Icon name={icon} size={sm ? 14 : 17} /></button>;
}

function Field({ label, required, hint, error, children }) {
  return (
    <label className="field">
      {label && <span className="field-label">{label}{required && <span className="req"> *</span>}</span>}
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

function Input({ label, required, hint, error, className = '', ...rest }) {
  const inp = <input className={`input ${error ? 'error' : ''} ${className}`} {...rest} />;
  return label ? <Field label={label} required={required} hint={hint} error={error}>{inp}</Field> : inp;
}

function Textarea({ label, required, hint, rows = 3, className = '', ...rest }) {
  const ta = <textarea className={`textarea ${className}`} rows={rows} {...rest} />;
  return label ? <Field label={label} required={required} hint={hint}>{ta}</Field> : ta;
}

function Select({ label, required, hint, error, options = [], placeholder, className = '', children, ...rest }) {
  const sel = (
    <select className={`select ${error ? 'error' : ''} ${className}`} {...rest}>
      {placeholder && <option value="">{placeholder}</option>}
      {children || options.map((o) => {
        const val = typeof o === 'string' ? o : o.value;
        const lab = typeof o === 'string' ? o : o.label;
        return <option key={val} value={val}>{lab}</option>;
      })}
    </select>
  );
  return label ? <Field label={label} required={required} hint={hint} error={error}>{sel}</Field> : sel;
}

function DateRange({ from, to, onFrom, onTo, label = 'Date range' }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="daterange">
        <input type="date" className="input" style={{ width: 150 }} value={from} onChange={(e) => onFrom(e.target.value)} />
        <span className="dash">—</span>
        <input type="date" className="input" style={{ width: 150 }} value={to} onChange={(e) => onTo(e.target.value)} />
      </div>
    </div>
  );
}

function Toggle({ on, onChange }) {
  return <button type="button" className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)} aria-pressed={on} />;
}

function StatTile({ icon, label, value, accent, delta, deltaDir }) {
  return (
    <div className="stat">
      <div className="stat-top">
        {icon && <span className="stat-ico"><Icon name={icon} size={16} /></span>}
        <span className="stat-label">{label}</span>
      </div>
      <div className={`stat-value ${accent ? 'accent' : ''}`}>{value}</div>
      {delta && <div className={`stat-delta ${deltaDir || ''}`}>{delta}</div>}
    </div>
  );
}

const STATUS_MAP = {
  acquired:    { cls: 'chip-warning', icon: 'clock',         label: 'Acquired' },
  pending:     { cls: 'chip-warning', icon: 'clock',         label: 'Pending' },
  in_progress: { cls: 'chip-warning', icon: 'loader',        label: 'In progress' },
  reported:    { cls: 'chip-success', icon: 'check',         label: 'Reported' },
  delivered:   { cls: 'chip-success', icon: 'package-check', label: 'Delivered' },
  collected:   { cls: 'chip-success', icon: 'package-check', label: 'Collected' },
  paid:        { cls: 'chip-success', icon: 'check',         label: 'Paid' },
  partial:     { cls: 'chip-warning', icon: 'circle-dollar-sign', label: 'Partial' },
  unpaid:      { cls: 'chip-danger',  icon: 'circle-alert',  label: 'Unpaid' },
  refund:      { cls: 'chip-danger',  icon: 'rotate-ccw',    label: 'Refund' },
};
function StatusChip({ status, label, icon, variant }) {
  const m = STATUS_MAP[status] || { cls: `chip-${variant || 'neutral'}`, icon, label: label || status };
  return <span className={`chip ${m.cls}`}>{m.icon && <Icon name={m.icon} size={12} />}{label || m.label}</span>;
}

const MOD_COLOR = { US:'var(--mod-us)', CT:'var(--mod-ct)', MR:'var(--mod-mr)', XR:'var(--mod-xr)', CR:'var(--mod-xr)', DX:'var(--mod-xr)', MG:'var(--mod-mg)' };
function ModalityTag({ modality }) {
  const c = MOD_COLOR[modality] || 'var(--app-text-muted)';
  return <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontWeight:600, fontSize:12 }}><span className="mod-dot" style={{ background:c }} />{modality}</span>;
}

function SectionHeader({ icon, title, sub, children }) {
  return (
    <div className="section-header">
      {icon && <span className="sh-icon"><Icon name={icon} size={17} /></span>}
      <span className="sh-title">{title}</span>
      {sub && <span className="sh-sub">{sub}</span>}
      {children && <span className="sh-actions">{children}</span>}
    </div>
  );
}

function DataTable({ columns, rows, rowKey, onRowClick, selectedKey, empty, foot }) {
  if (!rows || rows.length === 0) {
    return <div className="table-wrap">{empty || <EmptyState icon="inbox" title="Nothing here yet" />}</div>;
  }
  return (
    <div className="table-wrap">
      <table className="dt">
        <thead><tr>{columns.map((c) => <th key={c.key} className={c.num ? 'num' : ''} style={c.width ? { width: c.width } : {}}>{c.header}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => {
            const k = rowKey ? rowKey(r) : r.id;
            return (
              <tr key={k} className={`${onRowClick ? 'clickable' : ''} ${selectedKey === k ? 'selected' : ''}`} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                {columns.map((c) => <td key={c.key} className={c.num ? 'num' : ''}>{c.render ? c.render(r) : r[c.key]}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
      {foot && <div className="dt-foot">{foot}</div>}
    </div>
  );
}

function EmptyState({ icon = 'inbox', title, sub, action }) {
  return (
    <div className="empty">
      <div className="ico"><Icon name={icon} size={20} /></div>
      {title && <div className="et">{title}</div>}
      {sub && <div className="es">{sub}</div>}
      {action}
    </div>
  );
}

function Modal({ title, sub, icon, wide, onClose, children, footer }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`}>
        <div className="modal-head">
          {icon && <span className="sh-icon" style={{ color:'var(--app-accent)', display:'flex' }}><Icon name={icon} size={18} /></span>}
          <div>
            <div className="mt">{title}</div>
            {sub && <div className="ms">{sub}</div>}
          </div>
          <div style={{ marginLeft:'auto' }}><IconButton icon="x" onClick={onClose} /></div>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

function Banner({ kind = 'info', icon, children }) {
  const ic = icon || (kind === 'success' ? 'check-circle' : kind === 'warning' ? 'alert-triangle' : 'info');
  return <div className={`banner banner-${kind}`}><Icon name={ic} size={16} />{children}</div>;
}

/* Toast system */
const ToastCtx = React.createContext(() => {});
function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = (msg, kind = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <Icon name={t.kind === 'success' ? 'check-circle' : t.kind === 'error' ? 'circle-x' : 'info'} size={17} />
            <span className="tx">{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
const useToast = () => React.useContext(ToastCtx);

function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.value} className={`tab ${active === t.value ? 'active' : ''}`} onClick={() => onChange(t.value)}>{t.label}</button>
      ))}
    </div>
  );
}

Object.assign(window, {
  Icon, Button, IconButton, Field, Input, Textarea, Select, DateRange, Toggle,
  StatTile, StatusChip, ModalityTag, SectionHeader, DataTable, EmptyState,
  Modal, Banner, ToastProvider, useToast, Tabs,
});
