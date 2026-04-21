// Application constants and configurations
window.DICOM_VIEWER = window.DICOM_VIEWER || {};

window.DICOM_VIEWER.CONSTANTS = {
    // Window/Level Presets
    WINDOW_LEVEL_PRESETS: {
        'default': { window: 400, level: 40 },
        'lung': { window: 1500, level: -600 },
        'abdomen': { window: 400, level: 50 },
        'brain': { window: 80, level: 40 },
        'bone': { window: 1000, level: 400 }
    },

    // Tool name mappings
    TOOL_NAME_MAP: {
        'Pan': 'Pan',
        'Zoom': 'Zoom',
        'Wwwc': 'Wwwc',
        'Length': 'Length',
        'Angle': 'Angle',
        'FreehandRoi': 'FreehandRoi',
        'EllipticalRoi': 'EllipticalRoi',
        'RectangleRoi': 'RectangleRoi',
        'Probe': 'Probe'
    },

    // Layout configurations
    LAYOUTS: {
        '1x1': { rows: 1, cols: 1, viewports: ['main'] },
        '2x1': { rows: 1, cols: 2, viewports: ['left', 'right'] },
        '1x2': { rows: 2, cols: 1, viewports: ['top', 'bottom'] },
        '2x2': { rows: 2, cols: 2, viewports: ['axial', 'sagittal', 'coronal', 'original'] }
    },

    // MPR orientations
    MPR_ORIENTATIONS: ['axial', 'sagittal', 'coronal'],

    // Default slice positions
    DEFAULT_SLICE_POSITIONS: { axial: 0.5, sagittal: 0.5, coronal: 0.5 }
};

// Global state variables
window.DICOM_VIEWER.STATE = {
    currentFileId: null,
    uploadQueue: [],
    uploadInProgress: false,
    currentImageIndex: 0,
    totalImages: 0,
    cineInterval: null,
    isPlaying: false,
    currentFPS: 10,
    activeViewport: null,
    viewportLayout: '2x2',
    measurements: [],
    imageStack: [],
    currentSeriesImages: [],
    mprEnabled: true,
    volumeData: null,
    currentSlicePositions: { axial: 0.5, sagittal: 0.5, coronal: 0.5 },
    mprViewports: {},
    synchronizedViewports: new Set(),
    crosshairPosition: { x: 0.5, y: 0.5 }
};