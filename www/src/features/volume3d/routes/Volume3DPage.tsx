/**
 * Volume3DPage — full 3D volume + MPR workspace.
 *
 * Flow:
 *   1. Read `volume-3d-launch` from localStorage (mirrors viewer-launch).
 *   2. Init cs3d (idempotent), build the volume via `buildVolume`.
 *   3. Set up one RenderingEngine with up to 4 viewports (VR + 3 MPR)
 *      and a shared ToolGroup carrying TrackballRotate / Pan / Zoom /
 *      WindowLevel.
 *   4. Toolbar drives preset / W/L / opacity / layout / reset / capture.
 *
 * The page is React.lazy-loaded from App.tsx so the cs3d + vtk.js bundle
 * never runs in the 2D viewer windows.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { initCornerstone3D, cornerstone3D, cornerstone3DTools } from '../lib/cs3dInit';
import { buildVolume, makeVolumeId, classifyVolumeSize, estimateVolumeBytes, disposeVolume } from '../lib/buildVolume';
import { getPresetById } from '../lib/presets';
import { useVolume3DStore } from '../stores/volume3DStore';
import { checkVolume3DEligibility, isWebGL2Supported, describeIneligibility } from '../lib/eligibility';
import { VolumeViewport3D } from '../components/VolumeViewport3D';
import { MprViewports, MPR_VIEWPORT_IDS } from '../components/MprViewports';
import { Volume3DToolbar } from '../components/Volume3DToolbar';
import { dicomBaseUrl } from '@/lib/dicomLoader';

const RENDERING_ENGINE_ID = 'cs3d-volume-engine';
const VR_VIEWPORT_ID = 'cs3d-volume-vr';
const TOOL_GROUP_ID = 'cs3d-volume-toolgroup';

export default function Volume3DPage() {
  const store = useVolume3DStore();
  const launchConsumed = useRef(false);
  const [volumeId, setVolumeId] = useState<string | null>(null);
  const volumeIdRef = useRef<string | null>(null);
  const [enginesReady, setEnginesReady] = useState(false);
  const renderingEngineRef = useRef<any>(null);

  // ── 1. Consume launch payload ─────────────────────────────
  useEffect(() => {
    const consume = async () => {
      if (launchConsumed.current) return;
      launchConsumed.current = true;

      // When opened in the system browser, the study payload is handed off
      // via a temp JSON file referenced by ?launchFile=… (see
      // openVolume3DInBrowser / main.js). Fetch it over localhost (offline-OK)
      // through the same serve-file endpoint the DICOM images use.
      let ok = false;
      try {
        const launchFile = new URLSearchParams(window.location.search).get('launchFile');
        if (launchFile) {
          const url = `${dicomBaseUrl()}/dicom/serve-file.php?path=${encodeURIComponent(launchFile)}`;
          const resp = await fetch(url);
          if (resp.ok) {
            const data = JSON.parse(await resp.text());
            ok = useVolume3DStore.getState().applyLaunchPayload(data);
          }
        }
      } catch { /* fall through to localStorage */ }

      if (!ok) ok = useVolume3DStore.getState().loadFromLaunch();
      if (!ok && useVolume3DStore.getState().filePaths.length === 0) {
        useVolume3DStore.getState().setStatus('idle');
      }
    };
    consume();

    const api = (window as any).electronAPI;
    const unsub = api?.on?.('volume-viewer:reload-launch', () => {
      launchConsumed.current = false;
      consume();
    });
    return () => { if (typeof unsub === 'function') unsub(); };
  }, []);

  // ── 2. Init cs3d engine + tool group (once) ──────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initCornerstone3D();
        if (cancelled) return;

        // Reuse the existing engine across Suspense / Strict-Mode remounts.
        // Destroying it on every mount tore down the WebGL2 context and
        // produced a blank canvas when React re-rendered the page before
        // the viewport had time to attach the volume.
        let engine: any = cornerstone3D.getRenderingEngine(RENDERING_ENGINE_ID);
        if (!engine) {
          engine = new cornerstone3D.RenderingEngine(RENDERING_ENGINE_ID);
        }
        renderingEngineRef.current = engine;

        // Tool group — created lazily and shared by VR + MPR viewports.
        ensureToolGroup();

        setEnginesReady(true);
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.error('[Volume3DPage] engine init failed', e);
        useVolume3DStore.getState().setStatus('error', `Failed to initialize 3D engine: ${e?.message || e}`);
      }
    })();
    return () => {
      cancelled = true;
      // Only fully destroy the engine when the WINDOW unloads — not on
      // every effect cleanup (Suspense + StrictMode triggered destroys
      // mid-load which produced the blank screen). The pagehide listener
      // below handles real teardown when the user closes the 3D window.
    };
  }, []);

  // Real teardown — fires only when the page is actually being unloaded,
  // not on a transient React re-render.
  useEffect(() => {
    const teardown = () => {
      try { renderingEngineRef.current?.destroy?.(); } catch { /* ignore */ }
      renderingEngineRef.current = null;
      try { cornerstone3DTools.ToolGroupManager.destroyToolGroup(TOOL_GROUP_ID); } catch { /* ignore */ }
      if (volumeIdRef.current) disposeVolume(volumeIdRef.current);
    };
    window.addEventListener('pagehide', teardown);
    return () => window.removeEventListener('pagehide', teardown);
  }, []);

  // ── 3. Load volume whenever filePaths change ─────────────
  useEffect(() => {
    if (!enginesReady) return;
    if (!store.filePaths || store.filePaths.length === 0) return;

    // Eligibility guard — refuse non-CT/MR or oversize datasets.
    const elig = checkVolume3DEligibility({
      modality: store.modality,
      imageCount: store.filePaths.length,
      webgl2Supported: isWebGL2Supported(),
    });
    if (!elig.eligible) {
      useVolume3DStore.getState().setStatus('unsupported', describeIneligibility(elig.reason));
      return;
    }

    const estimated = estimateVolumeBytes(store.filePaths.length);
    const sizeClass = classifyVolumeSize(store.filePaths.length);
    if (sizeClass === 'too_large') {
      useVolume3DStore.getState().setStatus(
        'error',
        `Volume too large (~${Math.round(estimated / 1024 / 1024)} MB). Reduce series size or use a smaller study.`,
      );
      return;
    }

    const id = makeVolumeId(store.filePaths);
    let cancelled = false;
    useVolume3DStore.getState().setStatus('loading');
    useVolume3DStore.getState().setProgress(0, store.filePaths.length);
    useVolume3DStore.getState().setFailedSlices(0);

    (async () => {
      try {
        const { failedSlices } = await buildVolume({
          volumeId: id,
          filePaths: store.filePaths,
          onProgress: (loaded, total) => useVolume3DStore.getState().setProgress(loaded, total),
        });
        if (cancelled) return;
        useVolume3DStore.getState().setFailedSlices(failedSlices);
        setVolumeId(id);
        volumeIdRef.current = id;
        // Slices are decoded — now hand off to the GPU. The viewport flips
        // this to 'loaded' once the first frame is actually drawn, so the
        // progress UI stays up until the volume is truly ready to use.
        useVolume3DStore.getState().setStatus('rendering');
      } catch (e: any) {
        if (!cancelled) {
          useVolume3DStore.getState().setStatus('error', e?.message || 'Failed to load volume');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [enginesReady, store.filePaths, store.modality]);

  // ── 4. Apply preset / W/L / opacity to ALL viewports on change ─
  useEffect(() => {
    if (!enginesReady || !volumeId) return;
    const engine = renderingEngineRef.current;
    if (!engine) return;
    const preset = getPresetById(store.presetId);
    const allIds = [VR_VIEWPORT_ID, ...MPR_VIEWPORT_IDS];

    for (const vpId of allIds) {
      const vp = engine.getViewport(vpId) as any;
      if (!vp) continue;
      try {
        // VOI from preset or user override.
        const voi = store.voiOverride
          ? { lower: store.voiOverride.center - store.voiOverride.width / 2, upper: store.voiOverride.center + store.voiOverride.width / 2 }
          : preset.voi
            ? { lower: preset.voi.windowCenter - preset.voi.windowWidth / 2, upper: preset.voi.windowCenter + preset.voi.windowWidth / 2 }
            : undefined;
        if (voi) vp.setProperties({ voiRange: voi });

        // Opacity multiplier on the volume actor — shorter unit distance
        // → more opaque. Defaults to 1.0 (full opacity).
        const actorEntry = vp.getActor?.(volumeId);
        const property = actorEntry?.actor?.getProperty?.();
        if (property?.setScalarOpacityUnitDistance) {
          const unit = 0.5 + (1 - store.opacity) * 50;
          property.setScalarOpacityUnitDistance(0, unit);
        }
        vp.render();
      } catch { /* ignore per-viewport setProperties failures */ }
    }
  }, [enginesReady, volumeId, store.presetId, store.voiOverride, store.opacity]);

  // ── Reset / Capture handlers ─────────────────────────────
  const handleReset = useCallback(() => {
    const engine = renderingEngineRef.current;
    if (!engine) return;
    const allIds = [VR_VIEWPORT_ID, ...MPR_VIEWPORT_IDS];
    for (const vpId of allIds) {
      const vp = engine.getViewport(vpId) as any;
      try { vp?.resetCamera(); vp?.render(); } catch { /* ignore */ }
    }
    useVolume3DStore.getState().setVoi(null);
    useVolume3DStore.getState().setOpacity(1);
  }, []);

  const handleCapture = useCallback(() => {
    const engine = renderingEngineRef.current;
    if (!engine) return;
    const vp = engine.getViewport(VR_VIEWPORT_ID) as any;
    const canvas = vp?.getCanvas?.();
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      // Download the screenshot with a patient-named filename so the
      // radiologist can drag it directly into the report editor. The
      // browser download flow works identically in Electron + dev.
      const s = useVolume3DStore.getState();
      const safe = (v: string) => (v || '').replace(/[^a-z0-9_-]+/gi, '_').slice(0, 40);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `volume3d_${safe(s.patientId) || 'study'}_${safe(s.patientName)}_${stamp}.png`;
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Volume3DPage] capture failed', err);
    }
  }, []);

  // Cine orbit — rotate the VR camera around the view-up axis at ~24fps.
  // Disabled while loading / on non-VR layouts. Stops cleanly on unmount.
  useEffect(() => {
    if (!enginesReady || !volumeId) return;
    if (!store.cineRotating) return;
    const engine = renderingEngineRef.current;
    if (!engine) return;
    let raf = 0;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = (now - last) / 1000; // seconds
      last = now;
      const vp = engine.getViewport(VR_VIEWPORT_ID) as any;
      try {
        // 30°/sec orbit — slow enough to inspect detail, fast enough to
        // demo to a referring clinician.
        if (vp?.getCamera && vp?.setCamera) {
          const cam = vp.getCamera();
          const angleRad = (30 * Math.PI / 180) * dt;
          const focal = cam.focalPoint as [number, number, number];
          const pos = cam.position as [number, number, number];
          const up = cam.viewUp as [number, number, number];
          // Rotate position around focal point about the view-up axis.
          const dx = pos[0] - focal[0];
          const dy = pos[1] - focal[1];
          const dz = pos[2] - focal[2];
          // Rodrigues' rotation around `up`.
          const [ux, uy, uz] = up;
          const c = Math.cos(angleRad), s = Math.sin(angleRad), k = 1 - c;
          const nx = dx * (c + ux*ux*k)      + dy * (ux*uy*k - uz*s) + dz * (ux*uz*k + uy*s);
          const ny = dx * (uy*ux*k + uz*s)   + dy * (c + uy*uy*k)    + dz * (uy*uz*k - ux*s);
          const nz = dx * (uz*ux*k - uy*s)   + dy * (uz*uy*k + ux*s) + dz * (c + uz*uz*k);
          vp.setCamera({ ...cam, position: [focal[0]+nx, focal[1]+ny, focal[2]+nz] });
          vp.render();
        }
      } catch { /* ignore frame failures — keeps loop alive */ }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enginesReady, volumeId, store.cineRotating]);

  // Keyboard shortcuts: R = reset, 1-5 = presets.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'r' || e.key === 'R') { e.preventDefault(); handleReset(); }
      const presetKeys: Record<string, any> = { '1': 'ct-bone', '2': 'ct-soft-tissue', '3': 'ct-lung', '4': 'ct-angio', '5': 'mip' };
      if (presetKeys[e.key]) { e.preventDefault(); useVolume3DStore.getState().setPreset(presetKeys[e.key]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleReset]);

  // ── Render ───────────────────────────────────────────────
  const preset = getPresetById(store.presetId);
  const layout = store.layout;
  return (
    <div className="flex flex-col h-screen bg-app-bg text-app-text select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-app-header-bg border-b border-app-border">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-app-accent uppercase tracking-wide">3D Volume Viewer</span>
          {store.patientName && (
            <span className="text-xs text-app-text">
              <span className="font-bold text-app-accent">{store.patientName}</span>
              {store.patientId && <span className="ml-2">ID: {store.patientId}</span>}
              {store.studyDate && <span className="ml-2">{store.studyDate}</span>}
              {store.modality && <span className="ml-2 px-1.5 py-0.5 bg-app-accent/20 rounded text-app-accent">{store.modality}</span>}
            </span>
          )}
        </div>
        <button
          onClick={() => window.close()}
          className="px-2 py-1 text-xs font-semibold border border-app-border text-app-text-secondary rounded hover:bg-app-hover"
          title="Close"
        >Close</button>
      </div>

      <Volume3DToolbar onReset={handleReset} onCapture={handleCapture} />

      {/* Viewport area */}
      <div className="flex-1 relative bg-black">
        <StatusOverlay />
        {enginesReady && (
          <div
            className={
              layout === 'quad'
                ? 'absolute inset-0 grid grid-cols-2 grid-rows-2 gap-px bg-app-border'
                : 'absolute inset-0 flex items-center justify-center'
            }
          >
            {/* VR viewport. In VR-only mode we center it in a width-capped
                box (~3:2 of the available height) instead of letting it span
                the full window. Two wins: the volume no longer looks
                "spread out" across an ultra-wide window, AND we render far
                fewer pixels — a big smoothness gain on integrated GPUs. */}
            <div
              className={
                layout === 'quad'
                  ? 'bg-black w-full h-full'
                  : 'bg-black h-full max-w-full aspect-[3/2]'
              }
            >
              <VolumeViewport3D
                renderingEngineId={RENDERING_ENGINE_ID}
                viewportId={VR_VIEWPORT_ID}
                volumeId={volumeId}
                toolGroupId={TOOL_GROUP_ID}
                presetName={preset.cs3dPresetName}
                mip={preset.mip}
              />
            </div>
            {layout === 'quad' && (
              <MprViewports
                renderingEngineId={RENDERING_ENGINE_ID}
                volumeId={volumeId}
                toolGroupId={TOOL_GROUP_ID}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Build (or reuse) the shared tool group with all 3D + MPR tools.
 *  Idempotent — safe to call after the engine is recreated. */
function ensureToolGroup() {
  const tools = cornerstone3DTools as any;
  const { ToolGroupManager, TrackballRotateTool, PanTool, ZoomTool, WindowLevelTool, Enums } = tools;

  // Register tools globally once.
  for (const T of [TrackballRotateTool, PanTool, ZoomTool, WindowLevelTool]) {
    if (!T) continue;
    try { tools.addTool(T); } catch { /* already added */ }
  }

  try { ToolGroupManager.destroyToolGroup(TOOL_GROUP_ID); } catch { /* ignore */ }
  const tg = ToolGroupManager.createToolGroup(TOOL_GROUP_ID);
  if (!tg) return;

  if (TrackballRotateTool) tg.addTool(TrackballRotateTool.toolName);
  if (PanTool)             tg.addTool(PanTool.toolName);
  if (ZoomTool)            tg.addTool(ZoomTool.toolName);
  if (WindowLevelTool)     tg.addTool(WindowLevelTool.toolName);

  const Primary = Enums?.MouseBindings?.Primary ?? 1;
  const Secondary = Enums?.MouseBindings?.Secondary ?? 2;
  const Auxiliary = Enums?.MouseBindings?.Auxiliary ?? 4;

  // Bindings: left = rotate (VR), middle = pan, right = zoom (drag).
  // The mouse WHEEL is handled directly in VolumeViewport3D as a camera
  // dolly (scroll = zoom) — we deliberately do NOT bind StackScroll to the
  // wheel here, so the wheel zooms the 3D volume instead of scrolling slices.
  try { tg.setToolActive(TrackballRotateTool.toolName, { bindings: [{ mouseButton: Primary }] }); } catch { /* ignore */ }
  try { tg.setToolActive(PanTool.toolName, { bindings: [{ mouseButton: Auxiliary }] }); } catch { /* ignore */ }
  try { tg.setToolActive(ZoomTool.toolName, { bindings: [{ mouseButton: Secondary }] }); } catch { /* ignore */ }
}

function StatusOverlay() {
  const status = useVolume3DStore((s) => s.status);
  const error = useVolume3DStore((s) => s.error);
  const loaded = useVolume3DStore((s) => s.loadedSlices);
  const total = useVolume3DStore((s) => s.totalSlices);
  const failed = useVolume3DStore((s) => s.failedSlices);

  if (status === 'loaded') {
    // Loaded successfully — only surface a non-blocking warning if some
    // slices failed to decode. Volume still renders without them.
    if (failed > 0) {
      return (
        <div className="absolute top-2 right-2 px-2 py-1 bg-amber-500/80 text-black text-xs font-semibold rounded shadow pointer-events-none">
          {failed} slice{failed === 1 ? '' : 's'} failed to load
        </div>
      );
    }
    return null;
  }
  if (status === 'idle') {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-app-text-muted text-sm pointer-events-none">
        Open a CT study from the Viewer to load a 3D volume.
      </div>
    );
  }
  if (status === 'loading' || status === 'rendering') {
    // During 'loading' we show real slice progress; during 'rendering' the
    // GPU is uploading + drawing the first frame (indeterminate), so we peg
    // the bar near-full and switch the label. A full-screen scrim blocks
    // interaction until the volume is genuinely ready.
    const pct = status === 'rendering'
      ? 100
      : (total ? Math.round((loaded / total) * 100) : 0);
    const label = status === 'rendering'
      ? 'Building 3D model…'
      : `Loading slices… ${pct}%`;
    const sub = status === 'rendering'
      ? 'Preparing GPU volume — almost ready'
      : `${loaded} / ${total} images`;
    return (
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/70 text-app-text text-sm cursor-wait">
        <div className="w-8 h-8 border-2 border-app-accent border-t-transparent rounded-full animate-spin" />
        <div className="font-semibold">{label}</div>
        {/* Determinate progress bar */}
        <div className="w-72 h-2 bg-app-border/60 rounded-full overflow-hidden">
          <div
            className={`h-full bg-app-accent transition-all duration-200 ${status === 'rendering' ? 'animate-pulse' : ''}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-xs text-app-text-muted">{sub}</div>
      </div>
    );
  }
  if (status === 'unsupported') {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-amber-400 text-sm px-4 text-center pointer-events-none">
        {error ?? '3D viewer not available for this study.'}
      </div>
    );
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm px-4 text-center pointer-events-none">
      {error ?? 'Failed to render volume.'}
    </div>
  );
}
