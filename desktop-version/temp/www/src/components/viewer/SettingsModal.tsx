/**
 * SettingsModal - Viewer settings dialog with tabbed interface.
 * Tabs: Display, Controls, Performance, Export, Advanced.
 * Settings persist to localStorage.
 */
import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

const SETTINGS_KEY = 'dicom-viewer-settings';

interface ViewerSettings {
  // Display
  showOverlay: boolean;
  showMeasurements: boolean;
  interpolation: number; // 0=Nearest, 1=Linear, 2=Cubic

  // Controls
  zoomSensitivity: number;
  panSensitivity: number;
  wlSensitivity: number;
  invertMouseWheel: boolean;

  // Performance
  cacheSize: number; // MB
  maxConcurrentLoads: number;
  imageQuality: string;

  // Export
  exportFormat: string;
  exportQuality: number;
  includeOverlays: boolean;

  // Advanced
  debugMode: boolean;
  showFPS: boolean;
  logErrors: boolean;
}

const DEFAULT_SETTINGS: ViewerSettings = {
  showOverlay: true,
  showMeasurements: true,
  interpolation: 1,
  zoomSensitivity: 1.0,
  panSensitivity: 1.0,
  wlSensitivity: 1.0,
  invertMouseWheel: false,
  cacheSize: 500,
  maxConcurrentLoads: 3,
  imageQuality: 'high',
  exportFormat: 'png',
  exportQuality: 0.95,
  includeOverlays: true,
  debugMode: false,
  showFPS: false,
  logErrors: true,
};

function loadSettings(): ViewerSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: ViewerSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

const TABS = ['Display', 'Controls', 'Performance', 'Export', 'Advanced'] as const;
type TabName = typeof TABS[number];

export function SettingsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabName>('Display');
  const [settings, setSettings] = useState<ViewerSettings>(loadSettings);

  // Listen for open event
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('dicom-open-settings-modal', handleOpen);
    return () => window.removeEventListener('dicom-open-settings-modal', handleOpen);
  }, []);

  const updateSetting = useCallback(<K extends keyof ViewerSettings>(key: K, value: ViewerSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      saveSettings(next);
      return next;
    });
  }, []);

  const handleResetDefaults = useCallback(() => {
    setSettings({ ...DEFAULT_SETTINGS });
    saveSettings(DEFAULT_SETTINGS);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-[600px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <span>⚙</span> Settings
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-semibold transition-colors ${
                activeTab === tab
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'Display' && (
            <>
              <SettingToggle label="Show Overlay Text" value={settings.showOverlay}
                onChange={(v) => updateSetting('showOverlay', v)} />
              <SettingToggle label="Show Measurements" value={settings.showMeasurements}
                onChange={(v) => updateSetting('showMeasurements', v)} />
              <SettingSelect label="Interpolation" value={String(settings.interpolation)}
                options={[{ value: '0', label: 'Nearest Neighbor' }, { value: '1', label: 'Linear' }, { value: '2', label: 'Cubic' }]}
                onChange={(v) => updateSetting('interpolation', Number(v))} />
            </>
          )}

          {activeTab === 'Controls' && (
            <>
              <SettingSlider label="Zoom Sensitivity" value={settings.zoomSensitivity}
                min={0.1} max={3.0} step={0.1}
                onChange={(v) => updateSetting('zoomSensitivity', v)} />
              <SettingSlider label="Pan Sensitivity" value={settings.panSensitivity}
                min={0.1} max={3.0} step={0.1}
                onChange={(v) => updateSetting('panSensitivity', v)} />
              <SettingSlider label="W/L Sensitivity" value={settings.wlSensitivity}
                min={0.1} max={5.0} step={0.1}
                onChange={(v) => updateSetting('wlSensitivity', v)} />
              <SettingToggle label="Invert Mouse Wheel" value={settings.invertMouseWheel}
                onChange={(v) => updateSetting('invertMouseWheel', v)} />
              <div className="mt-3 p-3 bg-gray-800 rounded border border-gray-700">
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">Mouse Controls</div>
                <div className="text-xs text-gray-300 space-y-1">
                  <div><span className="text-blue-400 font-semibold">Scroll wheel</span> — Zoom in/out</div>
                  <div><span className="text-blue-400 font-semibold">Right-click drag</span> — Window/Level</div>
                  <div><span className="text-blue-400 font-semibold">Left-click</span> — Active tool / Select</div>
                  <div><span className="text-blue-400 font-semibold">Ctrl+Click</span> — Multi-select viewports</div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'Performance' && (
            <>
              <SettingSlider label="Cache Size (MB)" value={settings.cacheSize}
                min={100} max={2000} step={50}
                onChange={(v) => updateSetting('cacheSize', v)} />
              <SettingSlider label="Max Concurrent Loads" value={settings.maxConcurrentLoads}
                min={1} max={10} step={1}
                onChange={(v) => updateSetting('maxConcurrentLoads', v)} />
              <SettingSelect label="Image Quality" value={settings.imageQuality}
                options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]}
                onChange={(v) => updateSetting('imageQuality', v)} />
            </>
          )}

          {activeTab === 'Export' && (
            <>
              <SettingSelect label="Export Format" value={settings.exportFormat}
                options={[{ value: 'png', label: 'PNG' }, { value: 'jpg', label: 'JPEG' }]}
                onChange={(v) => updateSetting('exportFormat', v)} />
              <SettingSlider label="Export Quality" value={settings.exportQuality}
                min={0.1} max={1.0} step={0.05}
                onChange={(v) => updateSetting('exportQuality', v)} />
              <SettingToggle label="Include Overlays in Export" value={settings.includeOverlays}
                onChange={(v) => updateSetting('includeOverlays', v)} />
            </>
          )}

          {activeTab === 'Advanced' && (
            <>
              <SettingToggle label="Debug Mode" value={settings.debugMode}
                onChange={(v) => updateSetting('debugMode', v)} />
              <SettingToggle label="Show FPS Counter" value={settings.showFPS}
                onChange={(v) => updateSetting('showFPS', v)} />
              <SettingToggle label="Log Errors to Console" value={settings.logErrors}
                onChange={(v) => updateSetting('logErrors', v)} />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700">
          <button
            onClick={handleResetDefaults}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-gray-600 rounded hover:border-gray-500 transition-colors"
          >
            Reset Defaults
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Setting UI Components ----

function SettingToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-300">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`w-10 h-5 rounded-full transition-colors relative ${value ? 'bg-blue-600' : 'bg-gray-600'}`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            value ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

function SettingSlider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-300">{label}</span>
        <span className="text-xs text-blue-400 font-mono">{value.toFixed(step < 1 ? 2 : 0)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
      />
    </div>
  );
}

function SettingSelect({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-300">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1 text-xs bg-gray-800 text-white border border-gray-600 rounded focus:outline-none focus:border-blue-500"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
