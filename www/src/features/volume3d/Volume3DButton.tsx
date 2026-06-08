/**
 * Volume3DButton — CT-gated "3D" button shown in the viewer toolbars.
 *
 * Drops in next to the Print / Form F buttons. Disables itself (with a
 * descriptive tooltip) when the study is non-CT, has too few slices, or
 * the GPU lacks WebGL2.
 *
 * On click (in Electron) it offers a choice: open the 3D viewer in a
 * dedicated app window, or in the system default browser. Both work fully
 * offline; the browser option uses the OS browser's GPU pipeline, which on
 * some machines renders the volume more cleanly than bundled Electron.
 */
import { useState, useRef, useEffect } from 'react';
import { Box, AppWindow, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { openVolume3D, openVolume3DInBrowser } from './openVolume3D';
import {
  checkVolume3DEligibility,
  describeIneligibility,
  isWebGL2Supported,
} from './lib/eligibility';

export interface Volume3DButtonProps {
  patientName?: string;
  patientId?: string;
  studyDate?: string;
  studyDescription?: string;
  modality?: string;
  filePaths: string[];
  compact?: boolean;
  className?: string;
}

export function Volume3DButton(props: Volume3DButtonProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const eligibility = checkVolume3DEligibility({
    modality: props.modality,
    imageCount: props.filePaths.length,
    webgl2Supported: isWebGL2Supported(),
  });

  // Close the choice menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  // Hide the button entirely for non-CT/MR — keeps the toolbar uncluttered
  // for US/CR studies where 3D never applies. Show the disabled state only
  // when the modality is right but something else (slice count, GPU) blocks.
  if (eligibility.reason === 'wrong_modality' || eligibility.reason === 'missing_data') {
    return null;
  }

  const disabled = !eligibility.eligible;
  const title = disabled ? describeIneligibility(eligibility.reason) : 'Open 3D Volume Viewer';

  const base = props.compact
    ? 'flex items-center gap-1 px-2.5 py-1 text-xs font-semibold border-2 rounded transition-colors'
    : 'flex items-center gap-1 2xl:gap-1.5 px-2.5 2xl:px-3.5 py-1 2xl:py-1.5 text-xs 2xl:text-sm font-semibold border-2 rounded transition-colors';

  const stateClasses = disabled
    ? 'border-app-border text-app-text-muted bg-app-bg opacity-50 cursor-not-allowed'
    : 'border-app-accent text-app-accent bg-app-bg hover:bg-app-accent hover:text-white';

  const input = {
    patientName: props.patientName,
    patientId: props.patientId,
    studyDate: props.studyDate,
    studyDescription: props.studyDescription,
    modality: props.modality,
    filePaths: props.filePaths,
  };

  const isElectron = !!(window as any).electronAPI?.isElectron;

  const handleClick = () => {
    if (disabled) return;
    // In Electron, let the user choose window vs browser. Outside Electron
    // (already in a browser), just open it directly.
    if (isElectron) { setMenuOpen((o) => !o); return; }
    openVolume3D(input, (path: string) => navigate(path));
  };

  return (
    <div className="relative inline-flex" ref={wrapRef}>
      <button
        type="button"
        title={title}
        disabled={disabled}
        onClick={handleClick}
        className={props.className ?? `${base} ${stateClasses}`}
      >
        <Box className="w-3.5 h-3.5 2xl:w-4.5 2xl:h-4.5" />
        3D
      </button>

      {menuOpen && !disabled && (
        <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-md border border-app-border bg-app-surface shadow-lg overflow-hidden">
          <button
            type="button"
            onClick={() => { setMenuOpen(false); openVolume3D(input, (p: string) => navigate(p)); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-app-text hover:bg-app-hover text-left"
          >
            <AppWindow className="w-4 h-4 text-app-accent shrink-0" />
            <span>
              <span className="block font-semibold">Open in app window</span>
              <span className="block text-[10px] text-app-text-muted">Dedicated 3D viewer window</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => { setMenuOpen(false); openVolume3DInBrowser(input); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-app-text hover:bg-app-hover text-left border-t border-app-border"
          >
            <Globe className="w-4 h-4 text-app-accent shrink-0" />
            <span>
              <span className="block font-semibold">Open in browser</span>
              <span className="block text-[10px] text-app-text-muted">Best quality · works offline</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
