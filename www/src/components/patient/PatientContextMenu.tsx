import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { openViewerPopup } from '@/stores/viewerStore';
import { openCRViewerPopup } from '@/stores/crViewerStore';
import { openDualViewerPopup } from '@/stores/dualViewerStore';
import { usePatientStore } from '@/stores/patientStore';
import { localFileToImageId } from '@/lib/dicomLoader';
import { useSendToStore, type SendDestination } from '@/stores/sendToStore';
import type { Patient } from '@/types/patient';

interface Props {
  x: number;
  y: number;
  patient: Patient;
  onClose: () => void;
}

/** Render a DICOM imageId to a JPEG Blob using the Cornerstone canvas. */
async function dicomToJpeg(imageId: string): Promise<Blob | null> {
  const cs = (window as any).__cornerstone;
  if (!cs) return null;
  try {
    const image = await cs.loadAndCacheImage(imageId);
    const div = document.createElement('div');
    div.style.cssText = `width:${image.width}px;height:${image.height}px;position:fixed;left:-99999px;top:0;visibility:hidden;`;
    document.body.appendChild(div);
    try {
      cs.enable(div);
      cs.displayImage(div, image);
      const el = cs.getEnabledElement(div);
      return await new Promise<Blob>((resolve, reject) => {
        el.canvas.toBlob(
          (b: Blob | null) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
          'image/jpeg',
          0.92
        );
      });
    } finally {
      try { cs.disable(div); } catch { /* ignore */ }
      document.body.removeChild(div);
    }
  } catch {
    return null;
  }
}

export function PatientContextMenu({ x, y, patient, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [showSendTo, setShowSendTo] = useState(false);
  const [showAddDest, setShowAddDest] = useState(false);
  const [sending, setSending] = useState(false);
  const { destinations, addDestination, removeDestination } = useSendToStore();
  const [newDest, setNewDest] = useState({ name: '', host: '', port: 104, aeTitle: 'ORTHANC' });

  const openInViewer = (layoutParam?: string) => {
    if (patient.filePaths && patient.filePaths.length > 0) {
      openViewerPopup({
        patientName: patient.patientName,
        patientId: patient.patientId,
        studyDate: patient.studyDate,
        filePaths: patient.filePaths,
        layoutParam,
      }, navigate);
    }
  };

  const openInCRViewer = () => {
    if (patient.filePaths && patient.filePaths.length > 0) {
      openCRViewerPopup({
        patientName: patient.patientName,
        patientId: patient.patientId,
        studyDate: patient.studyDate,
        filePaths: patient.filePaths,
      }, navigate);
    }
  };

  const handleAction = (action: string) => {
    switch (action) {
      case 'open':
        openInCRViewer();
        break;
      case 'open-dual': {
        const patientStore = usePatientStore.getState();
        const selectedIds = Array.from(patientStore.selectedPatients);
        const allPatients = patientStore.filteredPatients;
        const selected = selectedIds
          .map(id => allPatients.find(p => p.id === id))
          .filter(p => p?.filePaths?.length);

        if (selected.length >= 2) {
          openDualViewerPopup({
            leftStudy: {
              patientName: selected[0]!.patientName,
              patientId: selected[0]!.patientId,
              studyDate: selected[0]!.studyDate,
              filePaths: selected[0]!.filePaths!,
            },
            rightStudy: {
              patientName: selected[1]!.patientName,
              patientId: selected[1]!.patientId,
              studyDate: selected[1]!.studyDate,
              filePaths: selected[1]!.filePaths!,
            },
          }, navigate);
        } else {
          // Same study in both panels (self-comparison)
          openDualViewerPopup({
            leftStudy: {
              patientName: patient.patientName,
              patientId: patient.patientId,
              studyDate: patient.studyDate,
              filePaths: patient.filePaths || [],
            },
            rightStudy: {
              patientName: patient.patientName,
              patientId: patient.patientId,
              studyDate: patient.studyDate,
              filePaths: patient.filePaths || [],
            },
          }, navigate);
        }
        break;
      }
      case 'open-cr':
        openInViewer();
        break;
      case 'export': {
        const safeName = (s: string) =>
          s.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        const zipName = `${safeName(patient.patientName)}_${patient.modality || 'DICOM'}.zip`;

        (async () => {
          try {
            if (patient.filePaths && patient.filePaths.length > 0) {
              const zip = new JSZip();

              for (let i = 0; i < patient.filePaths.length; i++) {
                const fp = patient.filePaths[i];
                const imageId = localFileToImageId(fp);
                const jpegBlob = await dicomToJpeg(imageId);
                if (!jpegBlob) continue;
                const baseName = (fp.split(/[\\/]/).pop() || `image_${i + 1}`).replace(/\.[^.]+$/, '');
                zip.file(`${baseName}.jpg`, jpegBlob);
              }

              const content = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 1 },
              });
              const link = document.createElement('a');
              link.href = URL.createObjectURL(content);
              link.download = zipName;
              link.click();
              URL.revokeObjectURL(link.href);
            } else {
              // Fallback: Orthanc-based export via PHP API
              const studyIds = patient.orthancId ? [patient.orthancId] : [];
              if (studyIds.length === 0) throw new Error('No DICOM data found for this patient');
              const response = await fetch('/api/patient/backup-studies.php?action=prepare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ study_ids: studyIds }),
              });
              const result = await response.json();
              if (!result.success) throw new Error(result.error);
              window.location.href = `/api/patient/backup-studies.php?action=download&job_id=${result.job_id}&filename=${encodeURIComponent(zipName)}`;
            }
          } catch (err: any) {
            alert('Export failed: ' + err.message);
          }
        })();
        break;
      }
      default:
        console.log('Context action:', action);
    }
    onClose();
  };

  const handleSendTo = async (dest: SendDestination) => {
    if (!patient.filePaths || patient.filePaths.length === 0) {
      alert('No DICOM files to send');
      return;
    }
    setSending(true);
    try {
      // Send DICOM files to the destination via the local API server
      const response = await fetch('http://localhost:3457/api/send-dicom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePaths: patient.filePaths,
          destination: {
            host: dest.host,
            port: dest.port,
            aeTitle: dest.aeTitle,
          },
          patientName: patient.patientName,
          patientId: patient.patientId,
        }),
      });
      const result = await response.json();
      if (result.success) {
        alert(`Successfully sent ${patient.filePaths.length} file(s) to ${dest.name}`);
      } else {
        alert(`Send failed: ${result.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Send failed: ${err.message}`);
    } finally {
      setSending(false);
      onClose();
    }
  };

  const handleAddDestination = () => {
    if (!newDest.name.trim() || !newDest.host.trim()) return;
    addDestination({
      name: newDest.name.trim(),
      host: newDest.host.trim(),
      port: newDest.port,
      aeTitle: newDest.aeTitle.trim() || 'ORTHANC',
      protocol: 'dicom',
    });
    setNewDest({ name: '', host: '', port: 104, aeTitle: 'ORTHANC' });
    setShowAddDest(false);
  };

  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      el.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      el.style.top = `${y - rect.height}px`;
    }
  }, [x, y]);

  const items: Array<{ label?: string; action?: string; hasSubmenu?: boolean; disabled?: boolean; divider?: boolean }> = [
    { label: 'Open', action: 'open' },
    { label: 'Open in dual format', action: 'open-dual' },
    { label: 'Open in CR format', action: 'open-cr' },
    { label: 'Send To', action: 'send-to', hasSubmenu: true },
    { label: 'Export', action: 'export' },
    { divider: true },
    { label: 'Recall last print job', action: 'recall-print', disabled: true },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-app-bg border border-app-border rounded shadow-lg py-1 min-w-[200px]"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) => {
        if (item.divider) {
          return <div key={i} className="border-t border-app-border my-1" />;
        }
        return (
          <button
            key={i}
            disabled={item.disabled}
            className={`w-full text-left px-4 py-1.5 text-sm hover:bg-app-hover transition-colors flex items-center justify-between ${
              item.disabled ? 'text-app-text-muted cursor-not-allowed' : 'text-app-text'
            }`}
            onClick={() => {
              if (item.hasSubmenu) {
                setShowSendTo(!showSendTo);
                return;
              }
              handleAction(item.action!);
            }}
            onMouseEnter={() => {
              if (item.hasSubmenu) setShowSendTo(true);
            }}
          >
            <span>{item.label}</span>
            {item.hasSubmenu && <span className="text-xs ml-2">&gt;</span>}
          </button>
        );
      })}

      {showSendTo && (
        <div
          className="absolute left-full top-16 bg-app-bg border border-app-border rounded shadow-lg py-1 min-w-[200px]"
          onClick={(e) => e.stopPropagation()}
        >
          {destinations.length === 0 && !showAddDest && (
            <div className="px-4 py-1.5 text-sm text-app-text-muted">No destinations configured</div>
          )}
          {destinations.map((dest) => (
            <div key={dest.id} className="flex items-center justify-between px-4 py-1.5 hover:bg-app-hover group">
              <button
                className="text-sm text-app-text flex-1 text-left"
                disabled={sending}
                onClick={() => handleSendTo(dest)}
              >
                {sending ? 'Sending...' : dest.name}
                <span className="text-[10px] text-app-text-muted ml-1">({dest.host}:{dest.port})</span>
              </button>
              <button
                className="text-red-500 text-xs opacity-0 group-hover:opacity-100 ml-2"
                onClick={(e) => { e.stopPropagation(); removeDestination(dest.id); }}
                title="Remove"
              >
                &times;
              </button>
            </div>
          ))}
          <div className="border-t border-app-border mt-1 pt-1">
            {showAddDest ? (
              <div className="px-3 py-2 space-y-1.5">
                <input
                  type="text"
                  placeholder="Name (e.g. Workstation 1)"
                  value={newDest.name}
                  onChange={(e) => setNewDest({ ...newDest, name: e.target.value })}
                  className="w-full h-6 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded"
                />
                <input
                  type="text"
                  placeholder="Host / IP (e.g. 192.168.1.100)"
                  value={newDest.host}
                  onChange={(e) => setNewDest({ ...newDest, host: e.target.value })}
                  className="w-full h-6 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded"
                />
                <div className="flex gap-1">
                  <input
                    type="number"
                    placeholder="Port"
                    value={newDest.port}
                    onChange={(e) => setNewDest({ ...newDest, port: Number(e.target.value) })}
                    className="w-16 h-6 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded"
                  />
                  <input
                    type="text"
                    placeholder="AE Title"
                    value={newDest.aeTitle}
                    onChange={(e) => setNewDest({ ...newDest, aeTitle: e.target.value })}
                    className="flex-1 h-6 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded"
                  />
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={handleAddDestination}
                    disabled={!newDest.name.trim() || !newDest.host.trim()}
                    className="flex-1 h-6 text-xs font-semibold bg-app-accent text-white rounded hover:opacity-90 disabled:opacity-40"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setShowAddDest(false)}
                    className="h-6 px-2 text-xs border border-app-border text-app-text-secondary rounded hover:bg-app-hover"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="w-full text-left px-4 py-1.5 text-sm text-app-accent hover:bg-app-hover"
                onClick={() => setShowAddDest(true)}
              >
                + Configure destination
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
