# DICOM Viewer Pro

## Project Overview
A professional DICOM medical image viewer built as a desktop-style web application. Designed to replicate and improve upon the Accurate DICOM Viewer software with modern web technologies.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite 5
- **State Management**: Zustand (10 stores)
- **Styling**: Tailwind CSS with CSS custom properties (dark/light themes)
- **Medical Imaging**: Cornerstone.js v2 (DICOM rendering, WADO image loader, dicom-parser)
- **Icons**: Lucide React
- **Backend**: PHP API on localhost:8080, Orthanc PACS server
- **Database**: MySQL

## Architecture

### Directory Structure
```
www/src/
├── components/
│   ├── viewer/        # DICOM viewer (ViewportGrid, DicomViewport, ThumbnailSidebar, ToolsPanel, etc.)
│   ├── patient/       # Patient list (PatientTable, PatientSearchBar, PatientContextMenu)
│   ├── layout/        # App shell (Header, Sidebar, StatusBar)
│   ├── print/         # Print preview and management (PrintPreview, PrinterModal)
│   ├── study/         # Study modals (DoctorModal, RemarksModal)
│   ├── report/        # Report editor
│   ├── config/        # Configuration tabs
│   ├── crViewer/      # CR format viewer (independent from main viewer)
│   └── shared/        # Shared (ConfirmDialog, Toast)
├── stores/
│   ├── viewerStore.ts           # Main DICOM viewer state (layout, images, arrange, cine)
│   ├── patientStore.ts          # Patient list, filtering, selection
│   ├── printStore.ts            # Print queue and settings
│   ├── customAnnotationStore.ts # Text/stamp/draw annotations
│   ├── annotationStore.ts       # Annotation persistence
│   ├── hospitalConfigStore.ts   # Hospital/system config
│   ├── crViewerStore.ts         # CR viewer state (independent)
│   ├── authStore.ts             # Authentication
│   ├── reportStore.ts           # Report data
│   ├── themeStore.ts            # Dark/light mode
│   └── uiStore.ts               # General UI state
├── pages/             # Route pages
├── services/          # API services (patient, study, DICOM, print)
├── lib/               # Core (cornerstoneSetup, dicomLoader, viewerTools)
├── hooks/             # React hooks
├── types/             # TypeScript definitions
├── utils/             # Utilities
└── styles/            # globals.css (theme variables)
```

### Routing
```
/                → PatientListPage
/patients        → PatientListPage
/viewer          → ViewerPage (main DICOM viewer)
/cr-viewer       → CRViewerPage (CR format viewer - independent)
/studies         → StudiesPage
/print           → PrintManagementPage
/config          → ConfigPage (nested modal)
```

### Key Patterns
- **Double-click patient row** → loads study files → navigates to viewer
- **CR modality double-click** → navigates to `/cr-viewer` (independent viewer)
- **Layout system**: 60+ predefined layouts, CSS Grid with grid-template-areas for asymmetric
- **Arrange mode**: Click viewports to select order, then images fill in that order
- **Cornerstone.js**: Each viewport is a div with `cornerstone.enable()`, images loaded via WADO URI
- **Annotations**: HTML overlays for text/stamp, canvas overlay for drawing paths
- **Theme**: CSS custom properties (`--app-*`), toggled via `.dark` class on `<html>`

### Theme Colors
- Light: `--app-accent: #B22222` (crimson red)
- Dark: `--app-accent: #e94560` (bright red/pink)
- Surface, border, text all use `--app-*` variables

### Conventions
- Components use function declarations, not arrow functions for exports
- Zustand stores use `create<StateType>((set, get) => ({...}))`
- Tailwind utility classes, no CSS modules or styled-components
- `text-app-*`, `bg-app-*`, `border-app-*` for theme-aware styling
- Button pattern: `border border-app-border text-app-text-secondary hover:bg-{color}/20`
- Modal pattern: fixed inset-0 z-50 with `bg-black/60` backdrop

## Development
```bash
cd www
npm install
npm run dev    # Vite dev server on localhost:5173
npm run build  # Production build to dist/
```

## Important Notes
- CR Viewer is completely independent from the main viewer (separate store, route, components)
- The main viewer uses `viewerStore.ts`, CR viewer uses `crViewerStore.ts`
- Never mix CR viewer state with main viewer state
- Image loading uses `localFileToImageId()` for file-path-based loading
- Cornerstone setup is shared (`lib/cornerstoneSetup.ts`)
