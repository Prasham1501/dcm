/**
 * Cornerstone.js initialization - sets up core, tools, and WADO image loader.
 * Must be called once at app startup before any DICOM rendering.
 */
import * as cornerstone from 'cornerstone-core';
import * as cornerstoneMath from 'cornerstone-math';
import * as cornerstoneTools from 'cornerstone-tools';
import * as cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import * as dicomParser from 'dicom-parser';
import Hammer from 'hammerjs';

let isInitialized = false;

export function initCornerstone(): void {
  if (isInitialized) return;

  // Wire up external dependencies
  cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
  cornerstoneWADOImageLoader.external.dicomParser = dicomParser;
  cornerstoneTools.external.cornerstone = cornerstone;
  cornerstoneTools.external.cornerstoneMath = cornerstoneMath;
  cornerstoneTools.external.Hammer = Hammer;

  // Configure web worker for image decoding
  const maxWorkers = Math.max(navigator.hardwareConcurrency || 4, 2);
  const config = {
    maxWebWorkers: maxWorkers,
    startWebWorkersOnDemand: true,
    taskConfiguration: {
      decodeTask: {
        initializeCodecsOnStartup: false,
        usePDFJS: false,
        strict: false,
      },
    },
  };
  cornerstoneWADOImageLoader.webWorkerManager.initialize(config);

  // Initialize cornerstone tools
  cornerstoneTools.init({
    globalToolSyncEnabled: true,
    showSVGCursors: true,
  });

  // Register all tools
  const tools = [
    cornerstoneTools.PanTool,
    cornerstoneTools.ZoomTool,
    cornerstoneTools.WwwcTool,
    cornerstoneTools.LengthTool,
    cornerstoneTools.AngleTool,
    cornerstoneTools.ProbeTool,
    cornerstoneTools.EllipticalRoiTool,
    cornerstoneTools.RectangleRoiTool,
    cornerstoneTools.FreehandRoiTool,
    cornerstoneTools.ArrowAnnotateTool,
    cornerstoneTools.TextMarkerTool,
    cornerstoneTools.MagnifyTool,
    cornerstoneTools.RotateTool,
    cornerstoneTools.StackScrollTool,
    cornerstoneTools.StackScrollMouseWheelTool,
    cornerstoneTools.DragProbeTool,
    cornerstoneTools.ZoomMouseWheelTool,
    cornerstoneTools.ScaleOverlayTool,
    cornerstoneTools.OrientationMarkersTool,
  ];

  tools.forEach((ToolClass) => {
    if (ToolClass) {
      try {
        cornerstoneTools.addTool(ToolClass);
      } catch {
        // Tool may already be registered
      }
    }
  });

  // NOTE: StackScrollMouseWheel is NOT activated here.
  // Mouse wheel = ZOOM (custom handler in DicomViewport).
  // Right-click drag = Window/Level (custom handler in DicomViewport).
  // Left-click = active tool interaction.

  // Expose cornerstone on window for cine playback access
  (window as any).__cornerstone = cornerstone;

  isInitialized = true;
  console.log('[Cornerstone] Initialized with', maxWorkers, 'workers');
}

// Re-export for convenience
export { cornerstone, cornerstoneTools, cornerstoneWADOImageLoader, dicomParser };
