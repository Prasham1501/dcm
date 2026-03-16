import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [showSendTo, setShowSendTo] = useState(false);

  const handleAction = (action: string) => {
    switch (action) {
      case 'open':
        navigate('/viewer');
        break;
      case 'open-dual':
        navigate('/viewer?layout=2x1');
        break;
      case 'open-cr':
        navigate('/viewer?layout=1x1');
        break;
      case 'export': {
        const blob = new Blob([JSON.stringify(patient, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `patient-${patient.patientId}-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
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
