import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useViewerStore } from '@/stores/viewerStore';
import type { Patient } from '@/types/patient';

interface Props {
  x: number;
  y: number;
  patient: Patient;
  onClose: () => void;
}

export function PatientContextMenu({ x, y, patient, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const loadStudyFiles = useViewerStore((s) => s.loadStudyFiles);
  const [showSendTo, setShowSendTo] = useState(false);

  const openInViewer = (layoutParam?: string) => {
    // If patient has real file paths from folder sync, load them
    if (patient.filePaths && patient.filePaths.length > 0) {
      loadStudyFiles({
        patientName: patient.patientName,
        patientId: patient.patientId,
        studyDate: patient.studyDate,
        filePaths: patient.filePaths,
      });
    }
    navigate(layoutParam ? `/viewer?layout=${layoutParam}` : '/viewer');
  };

  const handleAction = (action: string) => {
    switch (action) {
      case 'open':
        openInViewer();
        break;
      case 'open-dual':
        openInViewer('2x1');
        break;
      case 'open-cr':
        openInViewer('1x1');
        break;
      case 'export': {
        const firstName = patient.patientName.replace(/[^a-z0-9]/gi, '_');
        const downloadName = `${firstName}.zip`;
        
        // Use a self-invoking async function to handle the fetch
        (async () => {
          try {
            // 1. Prepare
            const studyIds = patient.orthancId ? [patient.orthancId] : [];
            const response = await fetch('/api/patient/backup-studies.php?action=prepare', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                study_ids: studyIds,
                patient_id: studyIds.length === 0 ? patient.patientId : undefined,
                months: 999 // Ensure all studies are caught if using patient_id
              })
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.error);

            // 2. Download
            const downloadUrl = `/api/patient/backup-studies.php?action=download&job_id=${result.job_id}&filename=${encodeURIComponent(downloadName)}`;
            window.location.href = downloadUrl;
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
    { label: 'Open in duel format', action: 'open-dual' },
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
        <div className="absolute left-full top-16 bg-app-bg border border-app-border rounded shadow-lg py-1 min-w-[150px]">
          <button className="w-full text-left px-4 py-1.5 text-sm text-app-text-muted cursor-not-allowed">
            No destinations configured
          </button>
        </div>
      )}
    </div>
  );
}
