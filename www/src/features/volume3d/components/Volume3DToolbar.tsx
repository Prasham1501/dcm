/**
 * Volume3DToolbar — top bar controls for the 3D viewer: preset selector,
 * window/level (single combined slider pair), opacity, layout toggle,
 * reset, and capture/print button.
 */
import { useState } from 'react';
import { Camera, RotateCcw, Play, Pause } from 'lucide-react';
import { useVolume3DStore } from '../stores/volume3DStore';
import { VOLUME_3D_PRESETS } from '../lib/presets';

export interface Volume3DToolbarProps {
  onReset: () => void;
  onCapture: () => void;
}

export function Volume3DToolbar({ onReset, onCapture }: Volume3DToolbarProps) {
  const presetId = useVolume3DStore((s) => s.presetId);
  const setPreset = useVolume3DStore((s) => s.setPreset);
  const opacity = useVolume3DStore((s) => s.opacity);
  const setOpacity = useVolume3DStore((s) => s.setOpacity);
  const voi = useVolume3DStore((s) => s.voiOverride);
  const setVoi = useVolume3DStore((s) => s.setVoi);
  const cineRotating = useVolume3DStore((s) => s.cineRotating);
  const setCineRotating = useVolume3DStore((s) => s.setCineRotating);
  const status = useVolume3DStore((s) => s.status);

  // Display defaults match the default Bone preset (WC 400 / WW 2000).
  const [windowCenter, setWindowCenter] = useState(voi?.center ?? 400);
  const [windowWidth, setWindowWidth] = useState(voi?.width ?? 2000);

  const disabled = status !== 'loaded';

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-app-surface border-b border-app-border text-xs">
      {/* Preset */}
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-app-accent uppercase tracking-wider text-[10px]">Preset</span>
        <select
          value={presetId}
          onChange={(e) => setPreset(e.target.value as any)}
          disabled={disabled}
          className="px-2 py-1 bg-app-bg border border-app-border rounded text-app-text disabled:opacity-50"
        >
          {VOLUME_3D_PRESETS.map((p) => (
            <option key={p.id} value={p.id} title={p.description}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* W/L */}
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-app-text-secondary uppercase tracking-wider text-[10px]">W/L</span>
        <input
          type="number"
          value={windowCenter}
          onChange={(e) => {
            const n = Number(e.target.value);
            setWindowCenter(n);
            setVoi({ center: n, width: windowWidth });
          }}
          disabled={disabled}
          className="w-16 px-1 py-1 bg-app-bg border border-app-border rounded text-app-text disabled:opacity-50"
          step={10}
          title="Window Center (HU)"
        />
        <span className="text-app-text-muted">/</span>
        <input
          type="number"
          value={windowWidth}
          onChange={(e) => {
            const n = Number(e.target.value);
            setWindowWidth(n);
            setVoi({ center: windowCenter, width: n });
          }}
          disabled={disabled}
          className="w-16 px-1 py-1 bg-app-bg border border-app-border rounded text-app-text disabled:opacity-50"
          step={50}
          min={1}
          title="Window Width (HU)"
        />
      </div>

      {/* Opacity */}
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-app-text-secondary uppercase tracking-wider text-[10px]">Opacity</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity}
          disabled={disabled}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className="w-24"
        />
        <span className="text-app-text-muted w-8">{Math.round(opacity * 100)}%</span>
      </div>

      <div className="flex-1" />

      {/* Cine orbit toggle */}
      <button
        type="button"
        onClick={() => setCineRotating(!cineRotating)}
        disabled={disabled}
        className={`flex items-center gap-1 px-2 py-1 border rounded disabled:opacity-50 ${cineRotating ? 'border-app-accent text-app-accent bg-app-accent/10' : 'border-app-border text-app-text-secondary hover:bg-app-hover'}`}
        title={cineRotating ? 'Stop auto-rotate' : 'Auto-rotate VR camera'}
      >
        {cineRotating ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
        Orbit
      </button>

      {/* Reset */}
      <button
        type="button"
        onClick={onReset}
        disabled={disabled}
        className="flex items-center gap-1 px-2 py-1 border border-app-border text-app-text-secondary rounded hover:bg-app-hover disabled:opacity-50"
        title="Reset camera + default preset (R)"
      >
        <RotateCcw className="w-3 h-3" /> Reset
      </button>

      {/* Capture */}
      <button
        type="button"
        onClick={onCapture}
        disabled={disabled}
        className="flex items-center gap-1 px-2 py-1 border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white disabled:opacity-50"
        title="Capture current view as PNG for the print/report pipeline"
      >
        <Camera className="w-3 h-3" /> Capture
      </button>
    </div>
  );
}
