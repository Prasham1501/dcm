import { useEffect, useState } from 'react';

export function AboutPage() {
  const [startup, setStartup] = useState<{ openAtLogin: boolean } | null>(null);

  useEffect(() => { window.bridgeAPI.getStartupStatus().then(setStartup); }, []);

  return (
    <div className="space-y-6 p-6">
      <section className="rounded border-2 border-app-accent bg-app-surface p-6">
        <h1 className="text-2xl font-bold tracking-wide text-app-accent">MEDIVIEW BRIDGE</h1>
        <p className="text-sm text-app-text-secondary">DICOM print bridge for paper printers</p>
        <p className="mt-2 text-xs text-app-text-muted">Version 1.0.0</p>
      </section>

      <section className="rounded border border-app-border bg-app-surface p-4 text-xs">
        <h2 className="mb-2 text-sm font-bold text-app-accent">How it works</h2>
        <ol className="list-decimal space-y-1 pl-5 text-app-text">
          <li>Add a printer slot on the <strong>Printer Slots</strong> tab.</li>
          <li>Configure the modality (MRI / CT / USG) to send images via DICOM C-STORE to the slot's AE title and TCP port.</li>
          <li>The bridge collects the study, renders it onto the configured layout, and prints it on the mapped Windows printer.</li>
          <li>You'll get a desktop notification when a study is received and when each job is sent to the printer.</li>
        </ol>
      </section>

      <section className="rounded border border-app-border bg-app-surface p-4 text-xs">
        <h2 className="mb-2 text-sm font-bold text-app-accent">System</h2>
        <dl className="grid grid-cols-[150px_1fr] gap-y-1 text-app-text">
          <dt className="text-app-text-muted">Auto-start at login</dt>
          <dd>{startup?.openAtLogin ? '✓ Enabled' : 'Disabled'}</dd>
          <dt className="text-app-text-muted">Runs in background</dt>
          <dd>Mediview Bridge lives in the system tray. Click the tray icon (bottom-right) to open this window again.</dd>
        </dl>
      </section>
    </div>
  );
}
