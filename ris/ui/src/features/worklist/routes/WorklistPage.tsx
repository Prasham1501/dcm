import { useEffect } from 'react';
import { PackageCheck, RefreshCw, SearchCheck } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Banner, Button, EmptyState, ModalityTag, SectionHeader, StatusChip } from '@/components/RisUi';
import { useWorklistStore } from '../stores/worklistStore';
import type { WorklistOrder } from '../api/worklistApi';
import { useBillingStore } from '@/features/billing/stores/billingStore';

const WORKLIST_ROLES = ['receptionist'];

export function WorklistPage() {
  const role = (useAuthStore((state) => state.user)?.role as string) || '';
  const { orders, error, lastMatch, load, deliver, runMatch } = useWorklistStore();
  const { takePayment } = useBillingStore();

  const refresh = (silent = false) => {
    load('scheduled,sent_to_viewer,acquired,reported,delivered', undefined, silent);
  };

  useEffect(() => {
    if (!WORKLIST_ROLES.includes(role)) return;
    runMatch();
    refresh();
    const id = window.setInterval(async () => {
      await runMatch(true);
      refresh(true);
    }, 15000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  if (!WORKLIST_ROLES.includes(role)) {
    return <EmptyState title="No worklist access" sub="RIS is configured for reception access only." />;
  }

  const waiting = orders.filter((order) => ['scheduled', 'arrived'].includes(order.status));
  const sent = orders.filter((order) => order.status === 'sent_to_viewer');
  const received = orders.filter((order) => ['acquired', 'reported'].includes(order.status));
  const delivered = orders.filter((order) => order.status === 'delivered');
  const onMatch = async () => { await runMatch(); refresh(true); };
  const collectBalance = async (order: WorklistOrder) => {
    const due = Number(order.visit_balance || 0);
    if (due <= 0) return true;
    const value = window.prompt(`Balance due for ${order.patient_name || order.accession_number}: Rs ${due.toFixed(2)}. Enter amount collected now.`, due.toFixed(2));
    if (value === null) return false;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return false;
    const paid = await takePayment(order.visit_id, amount, 'cash');
    if (!paid) return false;
    refresh(true);
    return Number(paid.balance || 0) <= 0;
  };
  const onDeliver = async (order: WorklistOrder) => {
    if (Number(order.visit_balance || 0) > 0) {
      const cleared = await collectBalance(order);
      if (!cleared) return;
    }
    if (await deliver(order.id)) refresh();
  };

  return (
    <div className="content-narrow">
      <div className="actions" style={{ justifyContent: 'space-between' }}>
        <div className="actions">
          <Button variant="secondary" icon={SearchCheck} onClick={onMatch}>Check returned studies</Button>
          <Button variant="secondary" icon={RefreshCw} onClick={() => refresh()}>Refresh</Button>
        </div>
        {lastMatch && (
          <span className="field-hint">
            Synced {lastMatch.synced?.studies_added ?? 0} new / {lastMatch.synced?.studies_updated ?? 0} updated study(s). Matched {lastMatch.matched}.
          </span>
        )}
      </div>

      {error && <div className="banner banner-warning mt-4">{error}</div>}

      <div className="grid-2 mt-4">
        <Column title="Waiting for machine" rows={waiting} render={(order) => (
          <OrderCard key={order.id} order={order}>
            <span className="field-hint">Patient details are ready for console worklist. Waiting for the machine scan.</span>
          </OrderCard>
        )} />

        <Column title="Sent to Viewer" rows={sent} render={(order) => (
          <OrderCard key={order.id} order={order}>
            <span className="field-hint">Images were sent to the doctor Viewer. Waiting for the study/report to come back.</span>
          </OrderCard>
        )} />
      </div>

      <div className="grid-2 mt-4">
        <Column title="Received from Viewer" rows={received} render={(order) => (
          <OrderCard key={order.id} order={order}>
            <span className="field-hint">{order.report_id ? 'Report available.' : 'Images received. Report not linked yet.'}</span>
            {Number(order.visit_balance || 0) > 0 ? <BalanceDue order={order} collect={() => collectBalance(order)} /> : null}
            <Button size="sm" variant="success" icon={PackageCheck} onClick={() => onDeliver(order)}>Delivered to patient</Button>
          </OrderCard>
        )} />

        <Column title="Delivered to patient" rows={delivered} render={(order) => (
          <OrderCard key={order.id} order={order}>
            <span className="field-hint">{order.report_id ? 'Report available.' : 'Delivered without a linked report.'}</span>
          </OrderCard>
        )} />
      </div>

      <div className="mt-4">
        <Banner kind="info">Final route: Reception creates visit, console sends images to Viewer, Viewer sends completed study back to RIS, then reception marks it delivered to patient.</Banner>
      </div>
    </div>
  );
}

function Column({ title, rows, render }: { title: string; rows: WorklistOrder[]; render: (order: WorklistOrder) => JSX.Element }) {
  return (
    <div className="card card-pad worklist-column">
      <SectionHeader title={`${title} (${rows.length})`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.length === 0 ? <EmptyState title="Empty" /> : rows.map(render)}
      </div>
    </div>
  );
}

function OrderCard({ order, children }: { order: WorklistOrder; children: React.ReactNode }) {
  return (
    <div className="card card-surface card-pad worklist-order">
      <div className="between">
        <div>
          <div className="strong">{order.patient_name || 'Unnamed patient'} <span className="muted">{order.sex || ''} {order.age_years ? `${order.age_years}y` : ''}</span></div>
          <div className="mono field-hint">{order.accession_number}{order.token_no ? ` | ${order.token_no}` : ''}</div>
          {order.room_title ? <div className="field-hint">Room: {order.room_title}</div> : null}
        </div>
        <StatusChip status={order.status} label={statusLabel(order.status)} />
      </div>
      <div className="actions mt-3">
        <ModalityTag modality={order.modality} />
        <span className="field-hint">{order.service_name || '-'}</span>
      </div>
      <div className="actions mt-3">{children}</div>
    </div>
  );
}

function BalanceDue({ order, collect }: { order: WorklistOrder; collect: () => void }) {
  return (
    <div className="balance-due">
      <span>Balance due Rs {Number(order.visit_balance || 0).toFixed(2)}</span>
      <Button size="sm" variant="danger" onClick={collect}>Collect balance</Button>
    </div>
  );
}

function statusLabel(status: string) {
  if (status === 'scheduled' || status === 'arrived') return 'Waiting';
  if (status === 'sent_to_viewer') return 'Sent';
  if (status === 'acquired') return 'Received';
  if (status === 'reported') return 'Report available';
  if (status === 'delivered') return 'Delivered';
  return status;
}
