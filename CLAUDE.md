# DICOM Viewer Pro

## Project Overview
A professional DICOM medical image viewer built as a desktop-style web application. Designed to replicate and improve upon the Accurate DICOM Viewer software with modern web technologies. Runs as an Electron desktop app with a Vite/React frontend.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite 5
- **State Management**: Zustand (13 stores)
- **Styling**: Tailwind CSS with CSS custom properties (dark/light themes)
- **Medical Imaging**: Cornerstone.js v2 (DICOM rendering, WADO image loader, dicom-parser)
- **Icons**: Lucide React
- **Desktop**: Electron (main.js, preload.js)
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
│   ├── crViewer/      # CR format viewer (INDEPENDENT from main viewer — separate store, route, components)
│   └── shared/        # Shared (ConfirmDialog, Toast)
├── stores/
│   ├── viewerStore.ts           # Main DICOM viewer state (layout, images, arrange, cine, viewport selection)
│   ├── patientStore.ts          # Patient list, filtering, selection
│   ├── printStore.ts            # Print queue and settings
│   ├── customAnnotationStore.ts # Text/stamp/draw annotations (per-image keyed)
│   ├── annotationStore.ts       # Annotation persistence (localStorage)
│   ├── hospitalConfigStore.ts   # Hospital/system config
│   ├── crViewerStore.ts         # CR viewer state (INDEPENDENT — never mix with viewerStore)
│   ├── authStore.ts             # Authentication
│   ├── reportStore.ts           # Report data
│   ├── studyMetaStore.ts        # Study metadata
│   ├── sendToStore.ts           # DICOM send functionality
│   ├── themeStore.ts            # Dark/light mode with accent color picker
│   └── uiStore.ts               # General UI state
├── pages/             # Route pages (ViewerPage, CRViewerPage, PatientListPage, StudiesPage, etc.)
├── services/          # API services (patient, study, DICOM, print)
├── lib/               # Core (cornerstoneSetup, dicomLoader, viewerTools)
├── hooks/             # React hooks (useAnnotationPersistence)
├── types/             # TypeScript definitions (viewer layouts, patient, study)
├── utils/             # Utilities (electronBridge, cn)
└── styles/            # globals.css (theme variables)
```

### Page Naming Convention (use these names when requesting changes)
| User-facing name | Page component | Route | Key components |
|---|---|---|---|
| **CR Viewer** | `CRViewerPage` | `/cr-viewer` | `CRSidebar` (tools: draw, ellipse, length, angle…), `CRToolbar`, `CRViewportGrid`, `CRThumbnailSidebar` |
| **Viewer** | `ViewerPage` | `/viewer` | `ToolsPanel`, `ViewportGrid`, `DicomViewport`, `ThumbnailSidebar` |
| **Dual Viewer** | `DualViewerPage` | `/dual-viewer` | shares viewer components |

> **"CR Viewer"** = the page opened via right-click → "Open in CR format". It has the full measurement/drawing tools sidebar (ellipse, draw, length, angle, etc.) in `components/crViewer/CRSidebar.tsx`.

### Routing
```
/                → PatientListPage
/patients        → PatientListPage
/viewer          → ViewerPage (main DICOM viewer)
/cr-viewer       → CRViewerPage (CR Viewer — has draw/ellipse/measurement tools in CRSidebar)
/dual-viewer     → DualViewerPage
/studies         → StudiesPage
/print           → PrintManagementPage
/config          → ConfigPage (nested modal)
/reports/:id     → ReportEditorPage
/login           → LoginPage
```

### Key Patterns

#### Patient → Viewer Flow
- **Double-click patient row** → loads study files → navigates to viewer
- **CR modality double-click** → navigates to `/cr-viewer` (independent viewer)
- Study data stored in `localStorage('viewer-launch')` for popup windows

#### Layout System
- 60+ predefined layouts in `types/viewer.ts` (`LAYOUT_CATEGORIES`)
- CSS Grid with `grid-template-areas` for asymmetric layouts
- Auto-select layout based on image count (`autoSelectLayout()`)
- Orientation support (portrait/landscape) with dynamic window resizing

#### Multi-Viewport Selection & Sync
- **Ctrl+click** → toggle viewport in multi-selection (`selectedViewportIndices`)
- **Ctrl+A** or toolbar button → select all viewports (`selectAllViewports()`)
- **Sync mechanism**: `dicom-viewport-sync` CustomEvent broadcast from active viewport
  - Each DicomViewport listens for sync events and applies changes to its own cornerstone element
  - `handleImageRendered` fires on every cornerstone render → broadcasts full sync (voi + scale + translation)
  - Custom mouse controls also broadcast: scroll-wheel=zoom, right-drag=W/L, left-drag=pan
  - Sync types: `'scale'`, `'voi'`, `'translation'`, `'scale+translation'`, `'full'`
- **Important**: Source viewport is excluded from receiving its own events via `sourceIndex` check

#### Viewport Image Overrides
- `viewportImageOverrides: Record<number, string>` — slot → imageUrl (for swap/arrange/drag-drop)
- `viewportIndexOverrides: Record<number, number>` — slot → original image index (for number labels)
- Bottom-left label shows `(actualIndex + 1) / total` using overrides when available

#### Arrange Mode
- Toggle via toolbar → click viewports in desired order → apply
- `arrangeClickOrder` tracks click sequence
- On apply: auto-selects best layout, builds overrides for new arrangement

#### Cornerstone.js Integration
- Each viewport div has `cornerstone.enable()` on mount, `cornerstone.disable()` on unmount
- `data-viewport-index` attribute on each cornerstone element for DOM queries
- Tools activated globally via `cornerstoneTools.setToolActive()` (Pan, Zoom, Wwwc, Length, etc.)
- Custom tools (stamp, text, draw, polyline) use capture-phase event handlers in DicomViewport
- Tool map in `lib/viewerTools.ts`: `TOOL_MAP` maps UI tool IDs to cornerstone tool names or custom actions

#### Annotations
- **Cornerstone tools**: Length, Angle, Arrow, Rectangle/Ellipse ROI (managed by cornerstoneTools)
- **Custom annotations**: Text/stamp overlays (HTML), draw paths (SVG/Canvas) — stored in `customAnnotationStore`
- Per-image keyed (imageId → annotations), persisted to localStorage via `annotationStore`
- Multi-viewport placement: annotations placed on one viewport are replicated onto other selected viewports

#### Theme System
- CSS custom properties (`--app-*`), toggled via `.dark` class on `<html>`
- Light: `--app-accent: #B22222` (crimson red)
- Dark: `--app-accent: #e94560` (bright red/pink) with accent color picker (6 presets)
- Surface, border, text all use `--app-*` variables

### Conventions
- Components use function declarations, not arrow functions for exports
- Zustand stores use `create<StateType>((set, get) => ({...}))`
- Tailwind utility classes, no CSS modules or styled-components
- `text-app-*`, `bg-app-*`, `border-app-*` for theme-aware styling
- Button pattern: `border border-app-border text-app-text-secondary hover:bg-{color}/20`
- Modal pattern: fixed inset-0 z-50 with `bg-black/60` backdrop
- Viewport identification: `data-viewport-index` attribute on cornerstone-enabled divs

## Development
```bash
cd www
npm install
npm run dev    # Vite dev server on localhost:5173
npm run build  # Production build to dist/
```

## Important Rules
- **CR Viewer is INDEPENDENT**: Separate store (`crViewerStore.ts`), route (`/cr-viewer`), components (`crViewer/`). Never mix CR viewer state with main viewer state.
- **viewerStore.ts** = main viewer. **crViewerStore.ts** = CR viewer. Never cross-reference.
- Image loading uses `localFileToImageId()` for file-path-based loading
- Cornerstone setup is shared (`lib/cornerstoneSetup.ts`) — globally initialized once
- Multi-viewport sync uses CustomEvents, not direct DOM manipulation across components
- Viewport index overrides must be updated alongside image overrides (swap, arrange, drag-drop)
