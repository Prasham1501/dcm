import { useViewerStore } from '@/stores/viewerStore';
import { Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function CineControls({ onClose }: Props) {
  const { isPlaying, cineFps, cineFrame, images, startCine, stopCine, setCineFps, stepCine } = useViewerStore();

  const totalFrames = images.length;
  const hasImages = totalFrames > 0;

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-900 border-t border-gray-700 text-white">
      {/* Frame counter */}
      <span className="text-xs font-mono text-yellow-400 flex-shrink-0">
        {hasImages ? `${cineFrame + 1} / ${totalFrames}` : '0 / 0'}
      </span>

      {/* Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => stepCine(-10)}
          disabled={!hasImages}
          className="p-1 rounded hover:bg-gray-700 disabled:opacity-30 text-gray-300"
          title="Back 10 frames"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => stepCine(-1)}
          disabled={!hasImages}
          className="p-1 rounded hover:bg-gray-700 disabled:opacity-30 text-gray-300"
          title="Previous frame"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => isPlaying ? stopCine() : startCine()}
          disabled={!hasImages}
          className="px-3 py-1 rounded bg-app-accent hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 text-xs font-semibold"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button
          onClick={() => stepCine(1)}
          disabled={!hasImages}
          className="p-1 rounded hover:bg-gray-700 disabled:opacity-30 text-gray-300"
          title="Next frame"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => stepCine(10)}
          disabled={!hasImages}
          className="p-1 rounded hover:bg-gray-700 disabled:opacity-30 text-gray-300"
          title="Forward 10 frames"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* FPS control */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-gray-400">FPS:</span>
        <input
          type="range"
          min={1}
          max={30}
          value={cineFps}
          onChange={(e) => setCineFps(Number(e.target.value))}
          className="w-20 h-1 accent-red-600 cursor-pointer"
        />
        <span className="text-xs font-mono text-yellow-400 w-6">{cineFps}</span>
      </div>

      {/* Frame scrubber */}
      {hasImages && (
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs text-gray-400 flex-shrink-0">Frame:</span>
          <input
            type="range"
            min={0}
            max={totalFrames - 1}
            value={cineFrame}
            onChange={(e) => {
              const frame = Number(e.target.value);
              const { currentLayout } = useViewerStore.getState();
              const nextPage = Math.floor(frame / currentLayout.spots) + 1;
              useViewerStore.setState({ cineFrame: frame, currentPage: nextPage });
            }}
            className="flex-1 h-1 accent-red-600 cursor-pointer"
          />
        </div>
      )}

      {/* Close button */}
      <button
        onClick={() => { stopCine(); onClose(); }}
        className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white flex-shrink-0"
        title="Close cine controls"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
