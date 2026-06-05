/* Settings & Network — proposed admin area. LAN setup, modality/DICOM
   settings, viewer integration, remote client URLs, console connectivity.
   Mirrors /api/system/network-info.php + ecosystem features. */
const { useState: useStateSet } = React;

function Settings({ role }) {
  const push = useToast();
  const [tab, setTab] = useStateSet('network');
  const n = MOCK.network;

  const tabs = [
    { value:'network', label:'Network & LAN' },
    { value:'dicom', label:'DICOM / modality' },
    { value:'consoles', label:'Machines & consoles' },
    { value:'viewer', label:'Viewer integration' },
  ];

  const copy = (t) => push(`Copied: ${t}`);

  return (
    <div className="content-narrow">
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'network' && (
        <div className="grid mt-5" style={{ gridTemplateColumns:'1fr 1fr', alignItems:'start' }}>
          <div className="card card-pad">
            <SectionHeader icon="network" title="Client access URLs" sub="Open on other PCs / consoles" />
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {n.client_urls.map((u) => (
                <div key={u} className="between card card-surface" style={{ padding:'9px 12px' }}>
                  <span className="mono" style={{ color:'var(--success)', fontSize:13 }}>{u}</span>
                  <IconButton sm icon="copy" onClick={() => copy(u)} title="Copy" />
                </div>
              ))}
            </div>
            <div className="divider" />
            <div style={{ fontSize:13, lineHeight:2 }}>
              <div className="between"><span className="muted">Server LAN IPs</span><span className="mono">{n.lan_ips.join(' · ')}</span></div>
              <div className="between"><span className="muted">App port</span><span className="mono">{n.php_port}</span></div>
            </div>
          </div>
          <div className="card card-pad">
            <SectionHeader icon="shield-check" title="Server status" />
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[['PHP API','online'],['MySQL / MariaDB','online'],['Orthanc PACS','online'],['DICOM listener :104','online'],['Windows firewall rule','online']].map(([s, st]) => (
                <div key={s} className="between" style={{ fontSize:13 }}>
                  <span>{s}</span><StatusChip status="paid" label="Online" />
                </div>
              ))}
            </div>
            <Button className="btn-block mt-4" variant="secondary" icon="refresh-cw" onClick={() => push('Re-checked services — all online')}>Re-check services</Button>
          </div>
        </div>
      )}

      {tab === 'dicom' && (
        <div className="card card-pad mt-5" style={{ maxWidth:620 }}>
          <SectionHeader icon="scan-line" title="DICOM modality settings" sub="Enter into each ultrasound / X-ray / CT machine" />
          <div className="grid" style={{ gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <Input label="Server IP" defaultValue={n.modality.server_ip} />
            <Input label="AE Title" defaultValue={n.modality.ae_title} />
            <Input label="DICOM port" defaultValue={n.modality.dicom_port} />
            <Input label="REST / DICOMweb port" defaultValue={n.modality.rest_port} />
          </div>
          <Banner kind="info" icon="info" >Modality worklist (MWL) is served from these settings — machines query the RIS for scheduled studies.</Banner>
          <div className="flex gap-2 mt-4"><Button variant="primary" icon="save" onClick={() => push('DICOM settings saved')}>Save settings</Button><Button variant="secondary" icon="plug" onClick={() => push('C-ECHO test succeeded')}>Test connection</Button></div>
        </div>
      )}

      {tab === 'consoles' && (
        <div className="card mt-5">
          <div className="card-head">
            <span className="ch-title">Machines & consoles on the LAN</span>
            <div className="ch-actions"><Button size="sm" variant="secondary" icon="refresh-cw" onClick={() => push('Re-scanned LAN')}>Re-scan</Button></div>
          </div>
          <DataTable
            columns={[
              { key:'name', header:'Machine / console', render:(r)=> <span className="strong">{r.name}</span> },
              { key:'modality', header:'Modality', render:(r)=> r.modality === '—' ? <span className="muted">—</span> : <ModalityTag modality={r.modality} /> },
              { key:'ae_title', header:'AE Title', render:(r)=> <span className="mono">{r.ae_title}</span> },
              { key:'ip', header:'IP', render:(r)=> <span className="mono">{r.ip}</span> },
              { key:'last_seen', header:'Last seen', render:(r)=> <span className="muted">{r.last_seen}</span> },
              { key:'status', header:'Status', render:(r)=> <StatusChip status={r.status === 'online' ? 'paid' : 'unpaid'} label={r.status === 'online' ? 'Online' : 'Offline'} /> },
              { key:'act', header:'', width:120, render:(r)=> <Button size="sm" variant="secondary" icon="send" disabled={r.status==='offline'} onClick={() => push(`Transfer queued to ${r.name}`)}>Transfer</Button> },
            ]}
            rows={MOCK.consoles}
          />
        </div>
      )}

      {tab === 'viewer' && (
        <div className="grid mt-5" style={{ gridTemplateColumns:'1fr 1fr', alignItems:'start' }}>
          <div className="card card-pad">
            <SectionHeader icon="scan-eye" title="One Clickz Viewer integration" />
            <div style={{ fontSize:13, lineHeight:2 }}>
              <div className="between"><span className="muted">Viewer build</span><span>One Clickz DICOM Viewer 2.4</span></div>
              <div className="between"><span className="muted">Link</span><StatusChip status="paid" label="Connected" /></div>
              <div className="between"><span className="muted">Open study via</span><span className="mono">/viewer?study=&lt;uid&gt;</span></div>
            </div>
            <Banner kind="success" icon="check-circle">Studies open in the viewer from the worklist, linked by study UID / accession.</Banner>
            <div className="flex gap-2 mt-4"><Button variant="primary" icon="external-link" onClick={() => push('Launching One Clickz Viewer…')}>Open viewer</Button><Button variant="secondary" icon="link" onClick={() => push('Re-paired with viewer')}>Re-pair</Button></div>
          </div>
          <div className="card card-pad">
            <SectionHeader icon="send" title="Transfer / route studies" />
            <Select label="Destination console" options={MOCK.consoles.filter(c=>c.modality!=='—').map(c=>({value:c.id,label:`${c.name} (${c.ae_title})`}))} />
            <Input label="Accession / study UID" className="mt-3" placeholder="ACC-2026-…" />
            <Button className="btn-block mt-4" variant="primary" icon="send" onClick={() => push('C-STORE transfer queued')}>Transfer study</Button>
            <div className="field-hint mt-3">Routes images to another machine or console over DICOM on the LAN.</div>
          </div>
        </div>
      )}
      <div className="field-hint mt-4"><span className="mono">/api/system/network-info.php</span> · ecosystem connectivity</div>
    </div>
  );
}
window.Settings = Settings;
