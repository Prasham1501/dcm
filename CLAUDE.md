# One Clickz (DCM)

Professional DICOM medical-image viewer + print bridge + customer/admin website. Runs as Electron desktop apps backed by a PHP/MySQL site hosted at `mehrgrewal.com/mediview/`.

```
Patients ─► DICOM Receiver / Viewer (Electron, www/)           ─► PHP API (api/) ─► MySQL
                │                                                       │
                ├─► Bridge (Electron tray, bridge/)  ─────────► /api/license/quota
                │   prints from modalities to Windows printers           │
                ├─► Website (www.mehrgrewal.com/mediview, website/)     │
                │   dashboard / billing / super-admin                    │
                └─► Cloud sync (Dropbox / Google Drive) via api/cloud/  ◄┘
```

# Repository layout

```
C:\xampp\htdocs\dcm\
├── www/                       # React DICOM viewer app (Electron + Vite)
├── bridge/                    # Print Bridge — Electron tray app
├── website/                   # Customer-facing site + admin shell + PHP API root for SaaS
├── api/                       # PHP REST endpoints consumed by www/ and bridge/
├── desktop-version/           # Legacy desktop scaffolding (kept for archival)
├── auth/, includes/, admin/   # PHP framework (config, session, classes)
├── database/migrations/       # MySQL DDL for the local viewer DB
├── orthanc/, orthanc-config/  # Orthanc PACS configuration
├── main.js / preload.js       # Electron host for www/ (viewer app)
└── CLAUDE.md                  # this file
```

# www/ — DICOM viewer (React + TS + Vite + Electron)

**Entry**: `www/src/App.tsx`. **Build**: `cd www && npm run build`. **Dev**: `npm run dev`.

## Stack
- React 18 + TypeScript + Vite 5
- Zustand stores (in-memory, some persisted to localStorage via `persist` middleware)
- Tailwind with CSS custom properties (`--app-*`) for theming
- Cornerstone.js v2 for DICOM rendering (`wadouri`, `dicom-parser`)
- Lucide-react icons
- Hosted by `main.js` (Electron) — popup windows, native printers, license, license-quota IPC

## Pages & routes
| Route | Page | What user calls it |
|---|---|---|
| `/` `/patients` | `PatientListPage` | Patient list |
| `/viewer` | `ViewerPage` | **CR Viewer** (main DICOM viewer, no draw tools) |
| `/cr-viewer` | `CRViewerPage` | **Viewer** (right-click → "Open in CR format" — has draw/measure tools in `CRSidebar`) |
| `/dual-viewer` | `DualViewerPage` | **Dual Viewer** (two panels, sync or independent) |
| `/studies` | `StudiesPage` | Studies list |
| `/print` | `PrintManagementPage` | Print queue |
| `/config` | `ConfigPage` (modal) | Settings tabs |
| `/reports/:id` | `ReportEditorPage` | Legacy report editor (deprecated — `InlineReportPanel` is the real one) |
| `/login` | `LoginPage` | |

> Naming gotcha: "Viewer" = `/cr-viewer`, "CR Viewer" = `/viewer`. The CR/Dual viewers use `crViewerStore`/`dualViewerStore` (INDEPENDENT — never cross-reference with `viewerStore`).

## Zustand stores (`www/src/stores/`)
| Store | Purpose | Persisted? |
|---|---|---|
| `viewerStore.ts` | Main viewer state (`/viewer`) — images, layout, cine, viewport selection | no |
| `crViewerStore.ts` | CR viewer (`/cr-viewer`) — separate state space | no |
| `dualViewerStore.ts` | Dual viewer — `panels.left` + `panels.right` per-panel state | no |
| `patientStore.ts` | Patient list, filter, selection | no |
| `printStore.ts` | Print queue + central print-count balance | no |
| `customAnnotationStore.ts` | Text/stamp/draw annotations per imageId | no |
| `annotationStore.ts` | Cornerstone annotations persistence | localStorage |
| `hospitalConfigStore.ts` | Hospital branding / header / footer config | localStorage |
| `authStore.ts` | Authentication / user session | localStorage |
| `reportStore.ts` | Reports + templates + `pendingTemplateId` | localStorage |
| `studyMetaStore.ts` | Study metadata cache | no |
| `sendToStore.ts` | DICOM send config | no |
| `themeStore.ts` | Dark/light mode + accent picker | localStorage |
| `uiStore.ts` | Toasts and misc UI flags | no |
| **`cloudStore.ts`** | **Cloud backup config (provider, token, schedule, last sync)** | **localStorage** |

## Key components/features

- **Viewer toolbar Report buttons** (`viewer/ViewerHeader.tsx`, `crViewer/CRToolbar.tsx`, `dualViewer/DualToolbar.tsx`) — all three call `useReportRouter().createReport()` and TOGGLE `showInlineReport` so a second click hides the panel. CR/Dual now also pass `filePaths`.
- **Report router** (`www/src/features/report-router/`):
  - `useReportRouter.ts` — `createReport(patient)` ALWAYS shows the picker (no auto-routing).
  - `ReportRouterHost.tsx` — two-step modal: step 1 = report type (`ReportTypePickerModal`), step 2 = template (`TemplatePickerModal`).
  - `registry.ts` — `fetalMedicineType` (US fetal keywords) and `radiologyType` (CR/DX/CT/MR/MG fallback). Fetal `openCreate` navigates to `/cr-viewer` first since FetalInlinePanel only mounts there. Radiology `openCreate` just toggles `showInlineReport` inline (no longer opens new Electron windows).
  - `reportRouterStore.ts` — modal state with `step: 'type' | 'template'` + `selectedTypeId`.
- **Inline report panel** (`www/src/components/report/InlineReportPanel.tsx`) — the rich-text editor. Single contentEditable div, A4-sized visual (1123px min-height) with repeating-gradient page rule. Key behaviors:
  - On mount: loads latest saved report for the patient, or hydrates from `pendingTemplateId` if set, or sets blank title.
  - `insertHtmlIntoEditor()` uses `insertAdjacentHTML` (not `+=`) and wraps inserts with `<p><br></p>` bookends so the user can always click above/below tables to type.
  - `handleAddPage()` inserts a non-editable `<div class="report-page-break">` + empty `<p>`.
  - `handleSaveAsTemplate()` (bookmark-plus button) → modal asks name + type → `addRichTemplate({name, content, type})`.
  - Token substitution via `lib/templateTokens.ts` — `{{BPD}}`, `{{patient_name}}`, etc. Re-runs once when `readingSet` updates so late-arriving extractions still hydrate.
  - Header / footer rendered via `dangerouslySetInnerHTML={{__html: buildBrandHeaderHtml(hospitalConfig)}}` — same helpers Print uses, so changes in Print Settings tab show up identically.
  - Scan button calls `runOcrExtraction()` which pulls images from whichever store has them (CR → Dual active panel → Viewer).
- **Auto-extract on study load** — `CRViewerPage` and `DualViewerPage` both run `autoExtract()` once `images.length > 0` and `extractionStatus === 'idle'`, so OCR readings appear without manual Scan click.
- **Image stack scrolling** — when `totalPages === 1` and there's > 1 image, arrow keys in CR rotate the active viewport via `rotateActiveViewportImage` (uses `viewportImageOverrides`). Dual uses `panelRotateActiveImage` which swaps images in the panel array.
- **CRViewportGrid** keys each viewport by `cr-vp-${i}-${imageId}` so cornerstone re-displays cleanly on page nav.
- **License quota modal** (`components/LicenseQuotaModal.tsx`) — opens on global Ctrl+Shift+Q, asks for admin PIN, lets operator toggle sell-by-print mode and top up the counter. Backed by `/license/quota`.

## Cloud backup
- `components/config/CloudTab.tsx` — settings UI with collapsible step-by-step Dropbox + Google Drive setup guides (`SetupGuide`).
- `stores/cloudStore.ts` — provider, token, scopes, sync interval, last-run.
- `lib/loadedStudiesRegistry.ts` — **shared across Electron BrowserWindows via localStorage**. Each viewer's `loadStudy` calls `recordLoadedStudy({viewer, patient_name, patient_id, files})`. Stores the longest common parent directory as `folder`. `listLoadedStudies()` + `listLoadedStudyFolders()` consumed by Cloud tab + auto-sync.
- Auto-sync timer in `App.tsx` — checks every 60 s, fires when `Date.now() - lastSyncAt >= intervalMs(syncInterval)`.

## Conventions
- Function declarations for exported components (`export function Foo()` not arrow).
- Theme: `text-app-*`, `bg-app-*`, `border-app-*`.
- Modal pattern: `fixed inset-0 z-50 bg-black/60` backdrop, click outside to close, `e.stopPropagation()` on the inner card.
- Viewport identification: `data-viewport-index` attribute.
- Cross-viewport sync: `dicom-viewport-sync` CustomEvent broadcast from active viewport.
- **CR Viewer is INDEPENDENT** — never cross-reference `viewerStore`/`crViewerStore`/`dualViewerStore`.

# bridge/ — Print Bridge (Electron tray)

**Entry**: `bridge/main.js`. **UI**: `bridge/ui/` (Vite + React, builds into `bridge/ui/dist/`).
**Build installer**: `cd bridge && npm run build:win` → NSIS exe in `bridge/installer-output/`.

## What it does
DICOM Storage SCP receiver per "printer slot" — modalities send DICOMs to the slot's AE title + port, the bridge renders to PNG via cornerstone, then sends to a Windows printer.

## Key files
- `main.js` — Electron host, slot management, print worker, IPC, license + central quota. Talks to `https://mehrgrewal.com/mediview/api`.
- `preload.js` — exposes `bridgeAPI` to renderer (contextBridge).
- `src/scp/slotManager.js` — one DICOM Storage SCP per slot.
- `src/print/jobQueue.js` / `printWorker.js` — render & print pipeline.
- `src/config/store.js` — `%APPDATA%/OneClickzBridge/config.json`.
- `ui/src/App.tsx` — header (with logo + license/prints counter), tabs (Slots, Branding, License, About).
- `ui/src/components/BridgeLicenseQuotaModal.tsx` — central-quota modal opened on **global Ctrl+Shift+Q**, mirrors the viewer's. Writes to `/license/quota` with `admin_pin` (default `Prasham123$`, override via `Settings::get('admin.device_pin')` on server).
- `ui/src/components/SlotQuotaModal.tsx` — **legacy per-slot** quota; opened from each slot card's coin icon. Independent of central quota.

## License + quota (the central pieces)
- `getLicenseData()` reads `%APPDATA%/OneClickzBridge/.license` (JSON with `licenseKey, fingerprint, plan, expiresAt, quotaEnabled, quotaRemaining, quotaTotal`).
- `getCentralQuota()` POSTs `/license/quota` (no decrement). Refreshed by App.tsx every 5 s.
- `decrementCentralQuota(pages)` runs after every printed job.
- `setCentralQuota({enabled, remaining, adminPin})` from the Ctrl+Shift+Q modal.
- Hard-reject reasons (`not_found`, `revoked`, `deactivated`, `wrong_product`, `expired`) auto-purge the local `.license` cache so a deleted server-side key stops appearing to be active.
- Header switches between "X prints left" (when `quota.enabled`) and "License XXX · N days left" (default).

## Logo
- File served from `bridge/ui/public/mediview-logo.png` → copied to `bridge/ui/dist/mediview-logo.png` on `npm run build:ui`. `App.tsx` references `./mediview-logo.png`. (Old `oneclickz-logo.png` reference was the 1.0.0 bug.)

# website/ — Customer + admin SaaS

Lives at `mehrgrewal.com/mediview/`. PHP backend + React-via-JSX dashboard (no build step — runs straight from `app.jsx` etc.).

## Layout
```
website/
├── api/                  # PHP REST API (Slim-ish router in routes.php)
│   ├── routes.php
│   ├── controllers/      # AuthController, LicenseController, AdminController, WalletController, …
│   ├── middleware/
│   ├── lib/              # LicenseKey, Mailer, Response, Validator, …
│   ├── config/{db,env,settings}.php
│   ├── sql/{001_schema,002_seed}.sql
│   ├── scripts/reset_billing.php   # ← admin tool; secret=mediview2026
│   ├── issue_test_key.php          # ← seeds a test license; supports ?plan=trial&prints=N
│   └── cron.php                    # nightly trial-expiry warning emails
├── dashboard/            # signed-in user shell (wallet, devices, settings, AI recharge)
├── admin.html            # super-admin SPA → uses dashboard/admin-shell.jsx
├── index.html            # marketing landing
└── components/, screens/, pages/
```

## Key DB tables (from `api/sql/001_schema.sql` + lazy ALTERs in controllers)
- `accounts(id, name, plan, status, created_at)` — `acc_superadmin00` is the seeded super-admin.
- `users(id, account_id, name, email, password_hash, role, …)` — role `super_admin | admin | user`.
- `licenses(id, account_id, key_code, plan, product, seats, status, starts_at, expires_at, hmac_signature, quota_enabled, quota_remaining, quota_total)` — `plan='trial'` is what bridge/viewer treat as "free trial".
- `devices(id, license_id, fingerprint, machine_name, status, activated_at, last_heartbeat_at)`.
- `wallets(account_id, type, balance, threshold, auto_recharge)` — `type='print' | 'ai'`. **Separate** from `licenses.quota_remaining` — wallets are the older recharge system, license quota is the new sell-by-print model used by bridge/viewer headers.
- `transactions, payments, invoices, audit_logs, analytics_events, settings, …`.

## Key endpoints (relative to `mehrgrewal.com/mediview/api/`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/license/activate` | Activate key on a device |
| POST | `/license/validate` | Periodic re-validation |
| POST | `/license/heartbeat` | Liveness |
| POST | `/license/deactivate` | Remove device from license |
| POST | `/license/quota` | Get / set / decrement central print counter (used by bridge + viewer) |
| POST | `/wallet/topup` | (auth'd) Razorpay or manual print-wallet topup |
| POST | `/admin/licenses/:id/quota` | Super-admin set / add prints to a license (`QuotaCell` in admin-shell.jsx) |
| GET | `/admin/wallets` | List user wallets |

## Trial-prints seeding
`AdminController::issueLicense` and `issue_test_key.php` both auto-seed `quota_enabled=1, quota_remaining=100, quota_total=100` whenever `plan='trial'`. Defensive lazy-seed in `LicenseController::quota` upgrades any old trial row found with `0/0` on next read.

## Super-admin
- Email: `prashamk15@gmail.com` (per `002_seed.sql`). Password hash baked in.
- `reset_billing.php?secret=mediview2026&wipe_all=1` truncates everything and re-seeds the super-admin row + minimum settings.

# api/ — Local viewer's PHP API (`localhost/dcm/api/`)

Distinct from `website/api/` — this one runs on the user's XAMPP for the viewer Electron app.

```
api/
├── auth/                            # session check, login
├── backup/                          # legacy Google Drive admin backup (separate from cloud/)
├── cloud/                           # ← Cloud-backup endpoints (Dropbox + Google Drive)
│   ├── _lib.php                     # shared helpers: zip, snapshotters, provider uploads
│   ├── backup.php                   # POST → snapshot + zip + upload
│   ├── list.php                     # POST → list remote bundles
│   └── download.php                 # POST → stream a bundle back as .zip
├── dicom/, dicomweb/                # Orthanc proxies
├── fetal/                           # fetal medicine module API
├── reports/, prescriptions/, notes/ # report-related endpoints
├── studies/, study_list_api.php     # study listings (Orthanc-backed)
├── patient_list_api.php
├── settings/, hospital-config/      # branding + hospital config
└── sync/, sync_orthanc_api.php      # Orthanc → MySQL sync
```

## Cloud backup contract
- `POST /api/cloud/backup.php`
  ```json
  {
    "provider":      "dropbox" | "google",
    "access_token":  "...",
    "remote_folder": "/dcm-backups",
    "scopes":        { "reports": true, "dicom": true, "templates": true, "branding": false },
    "templates":     [ /* client-side localStorage payload */ ],
    "study_paths":   [ { "patient_name", "patient_id", "files": [...] } ],
    "study_folders": [ "C:/Users/…/Downloads/usg" ]
  }
  ```
- Builds zip in `sys_get_temp_dir()` then streams to provider via curl.
- Bundle layout:
  ```
  manifest.json
  reports/<patient>/<report_id>.html         # from saved_reports table
  dicom/<patient>/...                        # from patient_studies table (if present)
  studies/<patient>/...                      # from client-supplied study_paths
  studies/<folder_name>/<study_uid>/*.dcm    # from folder-scan, grouped by DICOM Study UID
  templates/<name>_<id>.json
  branding/settings.json
  ```
- `cloud_extract_study_uid($path)` — cheap DICOM UID parser (no full parser dep) — reads byte 132+ for tag `(0020,000D)` to group folder-scan files by Study UID.
- Dropbox token must have `files.content.write`, `files.content.read`, `files.metadata.read`. Old tokens don't carry newly-added scopes — must regenerate after permission change.

# Useful PHP helpers
- `includes/config.php` — defines `DB_*`, `ORTHANC_*`, `APP_*`. Loaded under `DICOM_VIEWER` guard.
- `includes/PrintTracker.php` — print logging + per-license cost calc.
- `auth/session.php` — `isLoggedIn()`, `isAdmin()`.
- `includes/classes/SyncManager.php`, `GoogleDriveBackup.php` — admin-only sync + legacy Drive backup.

# Common dev commands

```bash
# Viewer app
cd www
npm install
npm run dev      # Vite + HMR + Electron
npm run build    # production build → www/dist/

# Bridge
cd bridge
npm run setup    # one-time
npm run dev      # Vite + electron --dev
npm run build:win  # produces installer-output/One Clickz Bridge Setup *.exe (NSIS, ~77 MB)

# Backend (uses XAMPP)
# Just hit http://localhost/dcm/api/... — no separate process to start.

# Reset billing DB (local or GoDaddy)
# https://mehrgrewal.com/mediview/api/scripts/reset_billing.php?secret=mediview2026&dry_run=1
# Add &wipe_all=1 to also nuke users/accounts and re-seed super-admin.
```

# Important rules / gotchas
1. **CR Viewer ≡ /cr-viewer = `CRViewerPage`** (has draw tools, uses `crViewerStore`).  
   **CR Viewer the *user* calls "Viewer"**. Don't confuse them.
2. **The legacy `ReportEditor` modal is dead.** Don't mount `<ReportEditor>` on any page. The real editor is `InlineReportPanel`, mounted inline by `ViewerPage`/`CRViewerPage`/`DualViewerPage` when `showInlineReport===true`.
3. **Always show the report picker** — `createReport` no longer auto-routes. Don't reintroduce the auto-open branch.
4. **Bridge has two quota systems** — central server-side `/license/quota` (shared with viewer + website, the canonical one) AND legacy per-printer-slot quotas in `config.json`. Per-slot is back-compat only.
5. **Tokens stay in localStorage** — Cloud tab tokens go to `/api/cloud/*.php` per request, never persisted server-side.
6. **Dropbox-API-Arg header must be ASCII-only** — `_lib.php` JSON-encodes with `JSON_HEX_*` flags. Don't loosen.
7. **Electron BrowserWindow state isolation** — Zustand stores don't share across windows. Use `lib/loadedStudiesRegistry.ts` (localStorage-backed) when you need cross-window visibility.
8. **Trial license = 100 prints by default** — `AdminController::issueLicense` + `issue_test_key.php` seed it; `LicenseController::quota` lazy-seeds old trial rows.
9. **Image stack scroll** uses `viewportImageOverrides` (CR — clean) vs `panelSwapImages` (Dual — swaps in-place). Other Dual viewports may shuffle as a side-effect; live with it until Dual gets its own override system.
10. **Cornerstone re-display on page nav** depends on viewport key including `imageId` — don't simplify the key in `CRViewportGrid` back to just slot index.

# User context
- **Email**: `prasham1501@gmail.com`
- **Today**: `2026-05-26`
- **Website domain**: `mehrgrewal.com/mediview/`
- **Local dev**: `localhost/dcm/` on XAMPP, files at `C:\xampp\htdocs\dcm\`
- **Admin PIN**: `Prasham123$` (default, overridable via `settings.admin.device_pin`)
- **Reset-billing secret**: `mediview2026`
