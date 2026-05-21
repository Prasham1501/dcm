/**
 * PasswordModal — generic password gate, reused for Add-Slot and
 * Quota-Settings. The expected password is supplied by the caller so each
 * gate can set its own value if we ever want per-action passwords.
 */
import { useState } from 'react';
import { Lock } from 'lucide-react';

export function PasswordModal({
  title, message, expected, onOk, onCancel,
}: {
  title: string;
  message: string;
  expected: string;
  onOk: () => void;
  onCancel: () => void;
}) {
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState('');

  function submit() {
    if (pwd === expected) onOk();
    else { setError('Incorrect password'); setPwd(''); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-lg bg-app-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-app-border bg-app-header-bg px-4 py-2">
          <Lock className="h-4 w-4 text-app-accent" />
          <h3 className="text-sm font-bold text-app-text">{title}</h3>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-xs text-app-text-secondary">{message}</p>
          <input
            type="password"
            value={pwd}
            autoFocus
            onChange={(e) => { setPwd(e.target.value); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            className="w-full rounded border border-app-border bg-app-bg px-2 py-1.5 text-sm text-app-text focus:border-app-accent focus:outline-none"
            placeholder="Password"
          />
          {error && <div className="rounded bg-red-500/10 px-2 py-1 text-xs text-red-500">{error}</div>}
          <div className="flex justify-end gap-2">
            <button onClick={onCancel}
              className="rounded border border-app-border bg-app-bg px-3 py-1.5 text-xs text-app-text hover:bg-app-hover">
              Cancel
            </button>
            <button onClick={submit}
              className="rounded bg-app-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
              Unlock
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
