import type { ReactNode } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle,
  CircleAlert,
  Clock,
  FileSpreadsheet,
  Inbox,
  Info,
  Loader,
  PackageCheck,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger';

export function Button({
  variant = 'secondary',
  size,
  icon: Icon,
  children,
  className = '',
  ...rest
}: {
  variant?: ButtonVariant;
  size?: 'sm' | 'lg';
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = ['btn', `btn-${variant}`, size ? `btn-${size}` : '', className].filter(Boolean).join(' ');
  return (
    <button className={cls} {...rest}>
      {Icon ? <Icon aria-hidden /> : null}
      {children}
    </button>
  );
}

export function IconButton({
  icon: Icon,
  bordered,
  sm,
  className = '',
  ...rest
}: {
  icon: LucideIcon;
  bordered?: boolean;
  sm?: boolean;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={['iconbtn', bordered ? 'bordered' : '', sm ? 'iconbtn-sm' : '', className].filter(Boolean).join(' ')} {...rest}>
      <Icon aria-hidden />
    </button>
  );
}

export function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <label className="field">
      {label ? <span className="field-label">{label}{required ? <span className="req"> *</span> : null}</span> : null}
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function TextInput({
  label,
  required,
  hint,
  error,
  className = '',
  ...rest
}: {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const input = <input className={['input', error ? 'error' : '', className].filter(Boolean).join(' ')} {...rest} />;
  return label ? <Field label={label} required={required} hint={hint} error={error}>{input}</Field> : input;
}

export function SelectInput({
  label,
  required,
  hint,
  error,
  className = '',
  children,
  ...rest
}: {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  className?: string;
  children: ReactNode;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const select = <select className={['select', error ? 'error' : '', className].filter(Boolean).join(' ')} {...rest}>{children}</select>;
  return label ? <Field label={label} required={required} hint={hint} error={error}>{select}</Field> : select;
}

export function TextareaInput({
  label,
  required,
  hint,
  className = '',
  ...rest
}: {
  label?: string;
  required?: boolean;
  hint?: string;
  className?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const textarea = <textarea className={['textarea', className].filter(Boolean).join(' ')} {...rest} />;
  return label ? <Field label={label} required={required} hint={hint}>{textarea}</Field> : textarea;
}

export function DateRange({
  from,
  to,
  onFrom,
  onTo,
  label = 'Date range',
}: {
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  label?: string;
}) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="daterange">
        <input type="date" className="input" value={from} onChange={(event) => onFrom(event.target.value)} />
        <span className="dash">to</span>
        <input type="date" className="input" value={to} onChange={(event) => onTo(event.target.value)} />
      </div>
    </div>
  );
}

export function StatTile({
  icon: Icon,
  label,
  value,
  accent,
  sub,
}: {
  icon?: LucideIcon;
  label: string;
  value: ReactNode;
  accent?: boolean;
  sub?: ReactNode;
}) {
  return (
    <div className="stat">
      <div className="stat-top">
        {Icon ? <span className="stat-ico"><Icon aria-hidden /></span> : null}
        <span className="stat-label">{label}</span>
      </div>
      <div className={`stat-value ${accent ? 'accent' : ''}`}>{value}</div>
      {sub ? <div className="stat-delta">{sub}</div> : null}
    </div>
  );
}

const STATUS_MAP: Record<string, { cls: string; label: string; icon: LucideIcon }> = {
  acquired: { cls: 'chip-warning', label: 'Acquired', icon: Clock },
  sent_to_viewer: { cls: 'chip-warning', label: 'Sent', icon: Clock },
  scheduled: { cls: 'chip-warning', label: 'Scheduled', icon: Clock },
  pending: { cls: 'chip-warning', label: 'Pending', icon: Clock },
  in_progress: { cls: 'chip-warning', label: 'In progress', icon: Loader },
  reported: { cls: 'chip-success', label: 'Reported', icon: Check },
  delivered: { cls: 'chip-success', label: 'Delivered', icon: PackageCheck },
  collected: { cls: 'chip-success', label: 'Collected', icon: PackageCheck },
  paid: { cls: 'chip-success', label: 'Paid', icon: Check },
  partly_paid: { cls: 'chip-warning', label: 'Partly paid', icon: Clock },
  open: { cls: 'chip-warning', label: 'Open', icon: Clock },
  unpaid: { cls: 'chip-danger', label: 'Unpaid', icon: CircleAlert },
  refund: { cls: 'chip-danger', label: 'Refund', icon: RotateCcw },
  online: { cls: 'chip-success', label: 'Online', icon: CheckCircle },
  offline: { cls: 'chip-danger', label: 'Offline', icon: AlertTriangle },
};

export function StatusChip({ status, label, variant }: { status: string; label?: string; variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }) {
  const meta = STATUS_MAP[status] || { cls: `chip-${variant || 'neutral'}`, label: status, icon: Info };
  const Icon = meta.icon;
  return <span className={`chip ${meta.cls}`}><Icon aria-hidden />{label || meta.label}</span>;
}

const MOD_COLORS: Record<string, string> = {
  US: 'var(--mod-us)',
  CT: 'var(--mod-ct)',
  MR: 'var(--mod-mr)',
  XR: 'var(--mod-xr)',
  CR: 'var(--mod-xr)',
  DX: 'var(--mod-xr)',
  MG: 'var(--mod-mg)',
};

export function ModalityTag({ modality }: { modality?: string | null }) {
  if (!modality) return <span className="muted">-</span>;
  return (
    <span className="modality-tag">
      <span className="mod-dot" style={{ background: MOD_COLORS[modality] || 'var(--app-text-muted)' }} />
      {modality}
    </span>
  );
}

export function SectionHeader({
  icon: Icon,
  title,
  sub,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  sub?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="section-header">
      {Icon ? <span className="sh-icon"><Icon aria-hidden /></span> : null}
      <span className="sh-title">{title}</span>
      {sub ? <span className="sh-sub">{sub}</span> : null}
      {children ? <span className="sh-actions">{children}</span> : null}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, sub, action }: { icon?: LucideIcon; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="ico"><Icon aria-hidden /></div>
      <div className="et">{title}</div>
      {sub ? <div className="es">{sub}</div> : null}
      {action}
    </div>
  );
}

export function Banner({ kind = 'info', children }: { kind?: 'info' | 'success' | 'warning'; children: ReactNode }) {
  const Icon = kind === 'success' ? CheckCircle : kind === 'warning' ? AlertTriangle : Info;
  return <div className={`banner banner-${kind}`}><Icon aria-hidden />{children}</div>;
}

export function ExportLink({ href, children, size }: { href: string; children: ReactNode; size?: 'sm' }) {
  return (
    <a className={`btn btn-secondary ${size === 'sm' ? 'btn-sm' : ''}`} href={href}>
      <FileSpreadsheet aria-hidden />
      {children}
    </a>
  );
}
