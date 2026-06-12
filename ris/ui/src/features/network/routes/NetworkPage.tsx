import { useEffect, useState } from 'react';
import { Copy, Network, Pencil, Plug, Plus, RefreshCw, Save, Send, Server, Trash2 } from 'lucide-react';
import { Banner, Button, EmptyState, SectionHeader, SelectInput, StatusChip, TextInput } from '@/components/RisUi';
import type { NetworkInfo } from '@/features/reception/api/receptionApi';
import {
  apiDeleteDicomNode,
  apiDicomNodes,
  apiEchoNode,
  apiNetworkInfo,
  apiSaveDicomNode,
  apiSendStudy,
  type DicomNode,
} from '@/features/settings/api/settingsApi';

const EMPTY_NODE = { name: '', ae_title: '', host_name: '', port: 104, is_default: 0 };

export function NetworkPage() {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [nodes, setNodes] = useState<DicomNode[]>([]);
  const [nodeForm, setNodeForm] = useState<Partial<DicomNode>>(EMPTY_NODE);
  const [nodeId, setNodeId] = useState('');
  const [study, setStudy] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setError(null);
    try {
      const [net, dicomNodes] = await Promise.all([apiNetworkInfo(), apiDicomNodes()]);
      setNetworkInfo(net);
      setNodes(dicomNodes);
      if (!nodeId && dicomNodes.length > 0) setNodeId(String(dicomNodes[0].id));
    } catch (err: any) {
      setError(err?.message || 'Failed to load network details');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedNode = nodes.find((node) => String(node.id) === nodeId) || null;

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`Copied ${value}`);
    } catch {
      setMessage(value);
    }
  };

  const saveNode = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiSaveDicomNode({ ...nodeForm, port: Number(nodeForm.port || 0), is_default: nodeForm.is_default ? 1 : 0 });
      setNodeForm(EMPTY_NODE);
      setMessage('DICOM node saved');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not save DICOM node');
    } finally {
      setBusy(false);
    }
  };

  const editNode = (node: DicomNode) => {
    setNodeForm({ ...node });
    setMessage('Loaded node details for editing');
  };

  const deleteNode = async (node: DicomNode) => {
    if (!window.confirm(`Delete ${node.name}?`)) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiDeleteDicomNode(node.id);
      setMessage('DICOM node deleted');
      if (nodeId === String(node.id)) setNodeId('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not delete DICOM node');
    } finally {
      setBusy(false);
    }
  };

  const echo = async (node: DicomNode) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiEchoNode(node);
      setMessage(`C-ECHO succeeded for ${node.name}${result.time ? ` in ${result.time} ms` : ''}`);
    } catch (err: any) {
      setError(err?.message || 'C-ECHO failed');
    } finally {
      setBusy(false);
    }
  };

  const sendStudy = async () => {
    if (!selectedNode || !study.trim()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiSendStudy(selectedNode.id, study.trim());
      setMessage(`${result.message} to ${selectedNode.name} (${result.node})`);
    } catch (err: any) {
      setError(err?.message || 'DICOM transfer failed');
    } finally {
      setBusy(false);
    }
  };

  const firewallCmd = 'netsh advfirewall firewall add rule name="One Clickz RIS 8090" dir=in action=allow protocol=TCP localport=8090';

  return (
    <div className="content-narrow">
      {error && <div className="banner banner-warning">{error}</div>}
      {message && <div className="banner banner-success mt-3">{message}</div>}

      <div className="card card-pad mt-4" style={{ borderColor: 'var(--app-accent)' }}>
        <SectionHeader icon={Server} title="Branch & multi-shop access" sub="Open the same RIS from reception/reporting PCs at other shops. They share this PC's live data — no separate database.">
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={load}>Refresh</Button>
        </SectionHeader>
        <div className="field-label mt-3">1. On any other PC in this shop, open one of these in a browser:</div>
        {networkInfo && networkInfo.client_urls.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} className="mt-3">
            {networkInfo.client_urls.filter((u) => !u.includes('127.0.0.1')).map((url) => (
              <div key={url} className="between card card-surface" style={{ padding: '9px 12px' }}>
                <span className="mono" style={{ color: 'var(--success)', fontSize: 14 }}>{url}</span>
                <Button variant="ghost" size="sm" icon={Copy} onClick={() => copy(url)}>Copy</Button>
              </div>
            ))}
          </div>
        ) : <div className="field-hint mt-3">No LAN address detected yet — click Refresh.</div>}

        <div className="field-label mt-4">2. First time only — allow the port through Windows Firewall on THIS PC:</div>
        <div className="between card card-surface mt-3" style={{ padding: '9px 12px' }}>
          <span className="mono" style={{ fontSize: 12, wordBreak: 'break-all' }}>{firewallCmd}</span>
          <Button variant="ghost" size="sm" icon={Copy} onClick={() => copy(firewallCmd)}>Copy</Button>
        </div>
        <div className="field-hint mt-1">Run it once in an Administrator Command Prompt on this main PC.</div>

        <div className="mt-4">
          <Banner kind="info">
            <b>Shops in different locations?</b> Install <b>Tailscale</b> (free) on this PC and each other PC — they all get a private IP that works across cities. Then open <span className="mono">http://&lt;this-PC-Tailscale-IP&gt;:8090</span> from any shop. Everything (reports, statuses) stays in sync because it's one shared database.
          </Banner>
        </div>
      </div>

      <div className="card card-pad mt-4">
        <SectionHeader icon={Network} title="Machine connection" sub="Use this for real USG, X-ray, CT, MR, and CR consoles">
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={load}>Refresh</Button>
        </SectionHeader>
        {networkInfo ? (
          <div className="grid-2">
            <div className="card card-surface card-pad">
              <div className="strong">Add this receiver in the machine console</div>
              <div className="field-hint mt-3">This is where the console sends completed DICOM images back to RIS/Orthanc.</div>
              <div className="divider" />
              <CopyRow label="Server IP" value={networkInfo.modality.server_ip} copy={copy} />
              <CopyRow label="AE title" value={networkInfo.modality.ae_title} copy={copy} />
              <CopyRow label="DICOM port" value={String(networkInfo.modality.dicom_port)} copy={copy} />
            </div>
            <div className="card card-surface card-pad">
              <div className="strong">Use this for Modality Worklist</div>
              <div className="field-hint mt-3">If the console supports Worklist/Patient Query, use the same server details so it can pull RIS patient details by accession.</div>
              <div className="divider" />
              <CopyRow label="Worklist server IP" value={networkInfo.modality.server_ip} copy={copy} />
              <CopyRow label="Worklist AE title" value={networkInfo.modality.ae_title} copy={copy} />
              <CopyRow label="Worklist port" value={String(networkInfo.modality.dicom_port)} copy={copy} />
            </div>
          </div>
        ) : <EmptyState title="Network details not loaded" />}
        <div className="mt-4">
          <Banner kind="info">Normal flow: Reception creates accession, console pulls patient details from Worklist, console sends images back to this receiver, Viewer opens the same Orthanc study with the patient details already attached.</Banner>
        </div>
      </div>

      <div className="grid-2 mt-4">
        <div className="card card-pad">
          <SectionHeader icon={Server} title="Client access URLs" sub="Only for opening the RIS screen from another PC on the same LAN" />
          {networkInfo ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {networkInfo.client_urls.map((url) => (
                  <div key={url} className="between card card-surface" style={{ padding: '9px 12px' }}>
                    <span className="mono" style={{ color: 'var(--success)', fontSize: 13 }}>{url}</span>
                    <Button variant="ghost" size="sm" icon={Copy} onClick={() => copy(url)}>Copy</Button>
                  </div>
                ))}
              </div>
              <div className="divider" />
              <div className="field-hint">These URLs are not for DICOM transfer. They are browser/app access links for RIS screens on other PCs.</div>
            </>
          ) : <EmptyState title="Network details not loaded" />}
        </div>

        <div className="card card-pad">
          <SectionHeader icon={Plus} title="Add destination DICOM node" sub="Optional: use when RIS must send a study to another DICOM receiver" />
          <div className="grid-2">
            <TextInput label="Room / title" value={nodeForm.name || ''} onChange={(event) => setNodeForm({ ...nodeForm, name: event.target.value })} placeholder="USG Room 1, X-Ray Room, Doctor Viewer" />
            <TextInput label="AE title" value={nodeForm.ae_title || ''} onChange={(event) => setNodeForm({ ...nodeForm, ae_title: event.target.value })} />
            <TextInput label="Host / IP" value={nodeForm.host_name || ''} onChange={(event) => setNodeForm({ ...nodeForm, host_name: event.target.value })} />
            <TextInput label="Port" type="number" value={String(nodeForm.port || '')} onChange={(event) => setNodeForm({ ...nodeForm, port: Number(event.target.value) })} />
          </div>
          <label className="checkrow mt-3">
            <input type="checkbox" checked={!!nodeForm.is_default} onChange={(event) => setNodeForm({ ...nodeForm, is_default: event.target.checked ? 1 : 0 })} />
            <span>Default destination</span>
          </label>
          <div className="actions mt-4">
            <Button variant="primary" icon={Save} disabled={busy} onClick={saveNode}>{nodeForm.id ? 'Update node' : 'Save node'}</Button>
            {nodeForm.id ? <Button variant="secondary" onClick={() => setNodeForm(EMPTY_NODE)}>Cancel edit</Button> : null}
          </div>
        </div>
      </div>

      <div className="card mt-4">
        <div className="card-head">
          <span className="ch-title">Configured destination nodes</span>
          <div className="ch-actions"><Button size="sm" variant="secondary" icon={RefreshCw} onClick={load}>Reload</Button></div>
        </div>
        {nodes.length === 0 ? (
          <EmptyState title="No destination nodes configured" sub="This is fine for normal RIS to machine workflow. Add a node only when another device has a DICOM receiver." />
        ) : (
          <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
            <table className="dt">
              <thead><tr><th>Room / title</th><th>AE Title</th><th>Host</th><th>Port</th><th>Status</th><th /></tr></thead>
              <tbody>
                {nodes.map((node) => (
                  <tr key={node.id}>
                    <td className="strong">{node.name}</td>
                    <td className="mono">{node.ae_title}</td>
                    <td className="mono">{node.host_name}</td>
                    <td className="mono">{node.port}</td>
                    <td>{node.is_default ? <StatusChip status="online" label="Default" /> : <StatusChip status="pending" label="Configured" />}</td>
                    <td>
                      <div className="actions">
                        <Button size="sm" variant="secondary" icon={Plug} disabled={busy} onClick={() => echo(node)}>C-ECHO</Button>
                        <Button size="sm" variant="secondary" icon={Pencil} disabled={busy} onClick={() => editNode(node)}>Edit</Button>
                        <Button size="sm" variant="danger" icon={Trash2} disabled={busy} onClick={() => deleteNode(node)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card card-pad mt-4">
        <SectionHeader icon={Send} title="Send study to a destination node" sub="Optional C-STORE transfer after images already exist in RIS/Orthanc" />
        <div className="grid-2">
          <SelectInput label="Destination node" value={nodeId} onChange={(event) => setNodeId(event.target.value)}>
            <option value="">Select node</option>
            {nodes.map((node) => <option key={node.id} value={node.id}>{node.name} ({node.ae_title})</option>)}
          </SelectInput>
          <TextInput
            label="StudyInstanceUID or Orthanc Study ID"
            value={study}
            onChange={(event) => setStudy(event.target.value)}
            placeholder="Paste linked study UID from Worklist"
          />
        </div>
        <Button variant="primary" icon={Send} disabled={!selectedNode || !study.trim() || busy} onClick={sendStudy} className="mt-4">
          Send study
        </Button>
      </div>
    </div>
  );
}

function CopyRow({ label, value, copy }: { label: string; value: string; copy: (value: string) => void }) {
  return (
    <div className="between mt-3">
      <span className="muted">{label}</span>
      <button className="mono linklike" onClick={() => copy(value)} type="button">{value}</button>
    </div>
  );
}
