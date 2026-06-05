import { useCallback, useEffect, useState } from 'react';
import { MonitorUp, RefreshCw, Upload } from 'lucide-react';
import { Banner, Button, EmptyState, ModalityTag, SectionHeader, SelectInput, StatusChip, TextInput } from '@/components/RisUi';

interface ConsoleOrder {
  id: number;
  accession_number: string;
  token_no: string | null;
  study_instance_uid: string | null;
  modality: string | null;
  status: string;
  room_title: string | null;
  scheduled_station_ae: string | null;
  mwl_written_at: string | null;
  mrn: string | null;
  dicom_patient_id: string | null;
  patient_name: string | null;
  age_years: number | null;
  sex: string | null;
  service_name: string | null;
}

async function readJson(res: Response): Promise<any> {
  const json = await res.json();
  if (!json || json.success === false) throw new Error(json?.error || json?.message || 'Request failed');
  return json.data;
}

export function ConsoleSimulatorPage() {
  const [orders, setOrders] = useState<ConsoleOrder[]>([]);
  const [selected, setSelected] = useState<ConsoleOrder | null>(null);
  const [files, setFiles] = useState<FileList | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [returnTarget, setReturnTarget] = useState<'ris' | 'viewer'>('ris');
  const [destinationHost, setDestinationHost] = useState('192.168.29.187');
  const [destinationAe, setDestinationAe] = useState('ONECLICKZ');
  const [destinationPort, setDestinationPort] = useState('3458');
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState('');
  const [simAccession, setSimAccession] = useState('');
  const [simPatientName, setSimPatientName] = useState('');
  const [simPatientId, setSimPatientId] = useState('');
  const [simModality, setSimModality] = useState('');
  const [simStudy, setSimStudy] = useState('');

  const load = useCallback(async (manual = false, silent = false) => {
    if (manual) setRefreshing(true);
    if (!silent) setError('');
    try {
      const rows = await readJson(await fetch('/api/console/orders.php', { credentials: 'include' })) as ConsoleOrder[];
      setOrders(rows);
      setSelected((current) => current && !rows.some((row) => row.id === current.id) ? null : current);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (err: any) {
      if (!silent) setError(err?.message || 'Could not load console worklist');
    } finally {
      if (manual) setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!busy) load(false, true);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [busy, load]);

  const selectOrder = (order: ConsoleOrder) => {
    setSelected(order);
    setSimAccession(order.accession_number || '');
    setSimPatientName(order.patient_name || '');
    setSimPatientId(order.dicom_patient_id || order.mrn || '');
    setSimModality(order.modality || '');
    setSimStudy(order.service_name || '');
  };

  const simulateScan = async () => {
    if (!selected || !files || files.length === 0) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const form = new FormData();
      form.set('order_id', String(selected.id));
      form.set('accession_number', simAccession.trim());
      form.set('patient_name', simPatientName.trim());
      form.set('patient_id', simPatientId.trim());
      form.set('modality', simModality.trim());
      form.set('study_description', simStudy.trim());
      form.set('return_target', returnTarget);
      if (returnTarget === 'viewer') {
        form.set('destination_host', destinationHost.trim());
        form.set('destination_ae', destinationAe.trim());
        form.set('destination_port', destinationPort.trim());
      }
      Array.from(files).forEach((file) => form.append('images[]', file));
      const result = await readJson(await fetch('/api/console/simulate-scan.php', {
        method: 'POST',
        credentials: 'include',
        body: form,
      }));
      if (returnTarget === 'viewer') {
        setMessage(`Simulator sent ${result.created} DICOM file(s) to ${destinationHost}:${destinationPort}. RIS matching is skipped until that device sends the study back to RIS.`);
      } else {
        setMessage(`Simulator sent ${result.created} DICOM file(s). Matched ${result.matched} RIS order(s).`);
      }
      setFiles(null);
      await load(false, true);
    } catch (err: any) {
      setError(err?.message || 'Simulator upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="content-narrow">
      <div className="card card-pad">
        <SectionHeader icon={MonitorUp} title="Console Simulator" sub="Laptop test tool for RIS -> console -> RIS or Viewer">
          <Button size="sm" variant="secondary" icon={RefreshCw} disabled={refreshing} onClick={() => load(true)}>
            {refreshing ? 'Refreshing...' : 'Reload worklist'}
          </Button>
        </SectionHeader>
        <Banner kind="info">Use this only for testing. Real machines should pull the same order through DICOM Modality Worklist and then send images to whichever destination the client chooses.</Banner>
        <div className="field-hint mt-3">Auto-refreshes every 10 seconds without clearing this page.{lastRefresh ? ` Last refreshed ${lastRefresh}.` : ''}</div>
        {message && <div className="banner banner-success mt-3">{message}</div>}
        {error && <div className="banner banner-warning mt-3">{error}</div>}
      </div>

      <div className="grid-2 mt-4">
        <div className="card card-pad">
          <SectionHeader title={`Machine worklist (${orders.length})`} />
          {orders.length === 0 ? <EmptyState title="No pending accessions" sub="Create a visit in Reception and click Send to console." /> : (
            <div className="table-wrap">
              <table className="dt">
                <thead><tr><th>Accession / token</th><th>Patient</th><th>Study</th><th /></tr></thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className={selected?.id === order.id ? 'selected' : ''}>
                      <td className="mono">
                        <div>{order.accession_number}</div>
                        {order.token_no ? <div className="field-hint">{order.token_no}</div> : null}
                        {order.mwl_written_at ? <div className="field-hint">Sent {order.mwl_written_at}</div> : null}
                      </td>
                      <td>
                        <div className="strong">{order.patient_name || '-'}</div>
                        <div className="field-hint">{order.dicom_patient_id || order.mrn || '-'}</div>
                      </td>
                      <td>
                        <div>{order.service_name || '-'}</div>
                        {order.room_title ? <div className="field-hint">Room: {order.room_title}</div> : null}
                        <div className="actions mt-1"><ModalityTag modality={order.modality} /><StatusChip status={order.status} /></div>
                      </td>
                      <td><Button size="sm" variant={selected?.id === order.id ? 'primary' : 'secondary'} onClick={() => selectOrder(order)}>Select</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card card-pad">
          <SectionHeader title="Simulate scan and return images" />
          {selected ? (
            <>
              <div className="card card-surface card-pad">
                <div className="grid-2">
                  <TextInput label="Accession number" value={simAccession} onChange={(event) => setSimAccession(event.target.value)} />
                  <TextInput label="Patient ID" value={simPatientId} onChange={(event) => setSimPatientId(event.target.value)} />
                  <TextInput label="Patient name" value={simPatientName} onChange={(event) => setSimPatientName(event.target.value)} />
                  <TextInput label="Modality" value={simModality} onChange={(event) => setSimModality(event.target.value.toUpperCase())} />
                </div>
                <div className="mt-3">
                  <TextInput label="Study description" value={simStudy} onChange={(event) => setSimStudy(event.target.value)} />
                </div>
                <div className="field-hint mt-3">These editable values are written into uploaded DICOM tags for this simulator test.</div>
              </div>
              <div className="mt-4">
                <SelectInput label="Where should this simulated machine send images?" value={returnTarget} onChange={(event) => setReturnTarget(event.target.value as 'ris' | 'viewer')}>
                  <option value="ris">Back to this RIS reception/worklist</option>
                  <option value="viewer">To another DICOM destination by IP/AE/port</option>
                </SelectInput>
              </div>
              {returnTarget === 'viewer' ? (
                <div className="grid-2 mt-3">
                  <TextInput label="Destination IP / host" value={destinationHost} onChange={(event) => setDestinationHost(event.target.value)} hint="Viewer laptop: 192.168.29.187. RIS laptop: use this PC LAN IP." />
                  <TextInput label="Destination AE title" value={destinationAe} onChange={(event) => setDestinationAe(event.target.value)} />
                  <TextInput label="Destination DICOM port" value={destinationPort} onChange={(event) => setDestinationPort(event.target.value)} />
                </div>
              ) : null}
              <div className="mt-4">
                <input
                  className="input"
                  type="file"
                  multiple
                  accept=".dcm,.dicom,application/dicom,image/png,image/jpeg,image/bmp"
                  onChange={(event) => setFiles(event.target.files)}
                />
                <div className="field-hint mt-2">Upload DICOM files for realistic testing. JPG/PNG/BMP are still allowed only as fallback samples and are converted to DICOM.</div>
              </div>
              <Button className="mt-4" variant="primary" icon={Upload} disabled={busy || !files?.length} onClick={simulateScan}>
                {busy ? 'Sending...' : returnTarget === 'viewer' ? 'Send simulated scan to destination' : 'Send simulated scan to RIS'}
              </Button>
              {returnTarget === 'viewer' ? (
                <div className="mt-3">
                  <Banner kind="warning">For this route, RIS is used only as a temporary DICOM sender. Use Viewer IP 192.168.29.187 to test doctor-first flow, or this RIS laptop IP to test console-to-RIS over C-STORE.</Banner>
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState title="Select an accession" sub="Pick a pending worklist order from the left." />
          )}
        </div>
      </div>
    </div>
  );
}
