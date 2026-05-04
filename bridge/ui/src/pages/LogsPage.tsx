import { useEffect, useRef, useState } from 'react';
import { Trash2, Pause, Play } from 'lucide-react';

interface Line { ts: string; level: string; message: string; }

function parseLine(raw: string): Line {
  const m = raw.match(/^(\S+)\s+\[(\w+)\]\s+(.*)$/);
  if (!m) return { ts: '', level: 'info', message: raw };
  return { ts: m[1], level: m[2].toLowerCase(), message: m[3] };
}

const COLORS: Record<string, string> = {
  debug: 'text-app-text-muted',
  info: 'text-app-text',
  warn: 'text-yellow-400',
  error: 'text-red-500',
};

export function LogsPage() {
  const [lines, setLines] = useState<Line[]>([]);
  const [paused, setPaused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    window.bridgeAPI.getLogTail(500).then((tail) => {
      if (cancelled) return;
      setLines(tail.map(parseLine));
    });
    const off = window.bridgeAPI.onLogLine((line) => {
      if (paused) return;
      setLines((prev) => [...prev.slice(-499), line as Line]);
    });
    return () => { cancelled = true; off(); };
  }, [paused]);

  useEffect(() => {
    if (paused) return;
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines, paused]);

  return (
    <div className="flex h-full flex-col p-4">
      <div className="flex items-center justify-between pb-2">
        <h2 className="text-base font-bold text-app-accent">Live Logs</h2>
        <div className="flex gap-1">
          <button
            onClick={() => setPaused((p) => !p)}
            className="flex items-center gap-1 rounded border border-app-border bg-app-bg px-2 py-1 text-2xs text-app-text hover:bg-app-hover"
          >
            {paused ? <><Play className="h-3 w-3" /> Resume</> : <><Pause className="h-3 w-3" /> Pause</>}
          </button>
          <button
            onClick={() => setLines([])}
            className="flex items-center gap-1 rounded border border-app-border bg-app-bg px-2 py-1 text-2xs text-app-text hover:bg-app-hover"
          >
            <Trash2 className="h-3 w-3" /> Clear
          </button>
        </div>
      </div>
      <div
        ref={ref}
        className="flex-1 overflow-auto rounded border border-app-border bg-black p-2 font-mono text-2xs"
      >
        {lines.length === 0 ? (
          <div className="text-app-text-muted">No log entries yet.</div>
        ) : (
          lines.map((l, i) => (
            <div key={i} className={COLORS[l.level] || 'text-app-text'}>
              <span className="text-app-text-muted">{l.ts.replace(/[TZ]/g, ' ').trim()}</span>{' '}
              <span className="font-bold">[{l.level.toUpperCase()}]</span>{' '}
              {l.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
