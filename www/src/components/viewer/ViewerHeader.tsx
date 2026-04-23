import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useViewerStore } from '@/stores/viewerStore';
import { usePrintStore } from '@/stores/printStore';
import { useThemeStore } from '@/stores/themeStore';
import { Sun, Moon, Palette, ChevronLeft, ChevronRight, Printer, X, Copy, Check } from 'lucide-react';
import { DARK_THEME_COLORS } from '@/stores/themeStore';

export function ViewerHeader() {
  const navigate = useNavigate();
  const {
    currentPage, totalPages, totalImages,
    patientName, patientId, studyDate,
    nextPage, prevPage,
  } = useViewerStore();
  const { setShowPrintPreview, printCountRemaining } = usePrintStore();
  const { mode, toggleTheme, darkColorId, setDarkColor } = useThemeStore();
  const [copied, setCopied] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const handleCopyHeader = () => {
    const parts = [patientName, patientId ? `ID: ${patientId}` : '', studyDate].filter(Boolean);
    const text = parts.join('  ');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  // Detect if we're in a popup window
  const isPopup = typeof window !== 'undefined' && (window.opener != null || window.history.length <= 1);

  return (
    <div className="flex items-center justify-between px-2 2xl:px-3 py-1 2xl:py-1.5 bg-app-header-bg border-b border-app-border">
      {/* Left: Back to patients / Close + page navigation */}
      <div className="flex items-center gap-3">
        {isPopup ? (
          <button
            onClick={() => window.close()}
            className="px-2 py-1 2xl:px-3 2xl:py-1.5 text-xs 2xl:text-sm font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors flex items-center gap-1"
            title="Close CR viewer"
          >
            <X className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" />
            Close
          </button>
        ) : (
          <button
            onClick={() => navigate('/')}
            className="px-2 py-1 2xl:px-3 2xl:py-1.5 text-xs 2xl:text-sm font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors flex items-center gap-1"
            title="Back to patient list"
          >
            <ChevronLeft className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" />
            Patients
          </button>
        )}
        <span className="text-xs 2xl:text-sm font-bold text-app-accent uppercase tracking-wide">CR Viewer</span>

        <button
          onClick={prevPage}
          disabled={currentPage <= 1}
          className="p-1 text-app-accent hover:bg-app-hover rounded disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs 2xl:text-sm text-app-text select-none whitespace-nowrap">
          Page {currentPage} of {totalPages}
          <span className="text-app-accent font-bold ml-1">({totalImages})</span>
        </span>
        <button
          onClick={nextPage}
          disabled={currentPage >= totalPages}
          className="p-1 text-app-accent hover:bg-app-hover rounded disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Center: Patient details */}
      <div className="hidden sm:flex items-center gap-4 min-w-0">
        {patientName && (
          <div className="flex items-center gap-1.5 2xl:gap-4 text-xs 2xl:text-sm min-w-0 overflow-hidden">
            <span className="font-bold text-app-accent truncate max-w-[120px] md:max-w-[200px] 2xl:max-w-[350px]" title={patientName}>
              {patientName}
            </span>
            {patientId && (
              <span className="text-app-text font-semibold flex-shrink-0">ID: {patientId}</span>
            )}
            {studyDate && (
              <span className="hidden md:inline text-app-text font-semibold flex-shrink-0">{studyDate}</span>
            )}
            <button
              onClick={handleCopyHeader}
              className="p-1 rounded hover:bg-app-hover transition-colors text-app-text-secondary flex-shrink-0"
              title="Copy patient info to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 2xl:w-4 2xl:h-4 text-green-500" /> : <Copy className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" />}
            </button>
          </div>
        )}
      </div>

      {/* Right: Print count + Print button + Theme toggle */}
      <div className="flex items-center gap-1.5 2xl:gap-3 flex-shrink-0">
        <span className="hidden lg:inline text-[10px] 2xl:text-sm text-app-text-secondary whitespace-nowrap">
          Prints:{' '}
          <span className={`font-bold ${printCountRemaining < 50 ? 'text-red-500' : 'text-green-500'}`}>
            {printCountRemaining}
          </span>
        </span>

        <button
          onClick={() => setShowPrintPreview(true)}
          className="px-2 py-1 2xl:px-3.5 2xl:py-1.5 text-[10px] 2xl:text-sm font-semibold border-2 border-app-accent text-white bg-app-accent rounded hover:opacity-90 transition-colors flex items-center gap-1"
          title="Open print preview"
        >
          <Printer className="w-3 h-3 2xl:w-3.5 2xl:h-3.5" />
          Print
        </button>

        <button
          onClick={toggleTheme}
          className="p-1 2xl:p-1.5 rounded hover:bg-app-hover transition-colors text-app-text-secondary"
          title={mode === 'light' ? 'Dark mode' : 'Light mode'}
        >
          {mode === 'light' ? <Moon className="w-4 h-4 2xl:w-4.5 2xl:h-4.5" /> : <Sun className="w-4 h-4 2xl:w-4.5 2xl:h-4.5" />}
        </button>
        {mode === 'dark' && (
          <div className="relative">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="p-1 rounded hover:bg-app-hover transition-colors text-app-text-secondary"
              title="Choose dark theme color"
            >
              <Palette className="w-3.5 h-3.5" />
            </button>
            {showColorPicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowColorPicker(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 bg-app-surface border border-app-border rounded-lg shadow-xl p-3 min-w-[220px]">
                  <div className="text-[10px] font-bold text-app-text-muted uppercase tracking-wider mb-2">Theme Color</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {DARK_THEME_COLORS.map((color) => (
                      <button
                        key={color.id}
                        onClick={() => { setDarkColor(color.id); setShowColorPicker(false); }}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                          darkColorId === color.id
                            ? 'ring-2 ring-offset-1 ring-offset-transparent'
                            : 'hover:bg-app-hover'
                        }`}
                        style={darkColorId === color.id ? { outline: `2px solid ${color.accent}` } : undefined}
                      >
                        <div
                          className="w-4 h-4 rounded-full border border-gray-600 flex-shrink-0"
                          style={{ backgroundColor: color.accent }}
                        />
                        <span className="text-app-text truncate">{color.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
