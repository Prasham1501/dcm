# Accurate Bridge

A DICOM print bridge that sits in the Windows system tray, listens for DICOM
images sent from MRI / CT / USG / CR modalities, and automatically prints
them on configured Windows paper printers (A3 / A4 / A5 / Letter / Legal).

Companion app to **Accurate** (the DICOM viewer at `..` / project root). Uses
the same theme tokens and the same multi-image layout system as the viewer.

---

## Features

- **Multiple printer slots** — each slot has its own AE title + TCP port, and
  is mapped to one Windows printer + paper size + layout.
- **Auto-print on receive** — files are grouped by `StudyInstanceUID`, debounced
  for a configurable window (default 30 s), then rendered and printed.
- **DCM-parity layouts** — the same `LAYOUT_CATEGORIES` from the DCM viewer
  (60+ layouts including 1+3-left, 2+3, 1+2+1, mamo, etc.).
- **Auto-start at Windows login** — installer registers the app with Windows
  startup; launches minimized to tray.
- **Tray-only by default** — config window opens on demand from the tray menu
  or a tray double-click; closing it returns to tray.
- **Live log viewer** — see slot listeners, incoming files, and print results
  in real time.

---

## Installation (end users)

1. Double-click `AccurateBridge-Setup-1.0.0.exe`.
2. Approve the UAC prompt (needed to add Windows firewall rules for the
   listener ports).
3. Pick install directory → install.
4. Bridge launches automatically and adds itself to Windows startup.
5. Right-click the tray icon → **Open Config…** → add a printer slot.

From then on, every Windows login launches the bridge silently in the tray.

---

## Build (developers)

### One-time setup

```powershell
cd bridge
npm install                 # also installs ui/ deps via postinstall
```

### Run in dev mode

In two terminals:

```powershell
# Terminal 1 — Vite dev server (port 5174)
cd bridge\ui
npm run dev
```

```powershell
# Terminal 2 — Electron pointed at Vite
cd bridge
npm start -- --dev
```

Or use the combined dev script (runs both via `concurrently`):

```powershell
cd bridge
npm run dev
```

### Build production installer

```powershell
cd bridge
npm run build:win
```

Output: `bridge\installer-output\AccurateBridge-Setup-1.0.0.exe`.

---

## Architecture

```
bridge/
├── main.js                 Electron main: tray, IPC, lifecycle, auto-start
├── preload.js              contextBridge API (window.bridgeAPI)
├── package.json            electron-builder config (NSIS, perMachine)
├── icon.ico                Shared with Accurate viewer
├── src/
│   ├── log/logger.js       Rotating file logger (%APPDATA%/AccurateBridge/logs)
│   ├── config/
│   │   ├── schema.js       PrinterSlot defaults + validation
│   │   └── store.js        JSON config (%APPDATA%/AccurateBridge/config.json)
│   ├── firewall/           Multi-port netsh firewall rule (UAC if needed)
│   ├── autostart/          Electron setLoginItemSettings wrapper
│   ├── scp/
│   │   ├── pduCodec.js     DICOM Upper Layer PDU codec (extracted from DCM)
│   │   ├── dicomScp.js     Single-slot Storage SCP (TCP server)
│   │   └── slotManager.js  Owns one DicomScp per enabled slot
│   ├── render/
│   │   ├── layouts.js      LAYOUT_CATEGORIES (copy of DCM)
│   │   ├── layoutUtils.js  autoSelectLayoutForImageCount + resolveLayoutForJob
│   │   ├── dicomRender.js  dicom-parser + pngjs render with W/L windowing
│   │   └── layoutBuilder.js Build N-up print HTML using DCM grid templates
│   └── print/
│       ├── jobQueue.js     Per-slot debounced FIFO grouped by Study UID
│       └── printWorker.js  Hidden BrowserWindow + webContents.print
└── ui/                     React + Vite + Tailwind config window
    └── src/
        ├── pages/          SlotsPage, LogsPage, AboutPage
        ├── components/     SlotCard, LayoutPicker (DCM-style), PrinterPicker, StatusBar
        ├── stores/         configStore (Zustand)
        ├── lib/            layouts.ts (TS copy of LAYOUT_CATEGORIES)
        └── styles/         globals.css (DCM theme tokens, light + dark)
```

---

## DICOM workflow

This bridge implements **DICOM Storage SCP** (C-ECHO + C-STORE) — the modern
"send-to-print" path. It is **not** the legacy DICOM Print Service Class
(N-CREATE/N-SET/N-ACTION used with film printers). Modalities should be
configured to "Send to" the bridge slot's AE title and port via Storage.

Per-connection lifecycle:

1. Modality opens TCP, sends `A-ASSOCIATE-RQ` (Called AE = slot AET).
2. Bridge replies `A-ASSOCIATE-AC`, accepting all offered presentation
   contexts and preferring Explicit VR Little Endian.
3. Modality sends one or more `C-STORE-RQ` operations; each `.dcm` is saved
   to `%APPDATA%/AccurateBridge/incoming/<slotId>/`.
4. Modality sends `A-RELEASE-RQ`; bridge replies `A-RELEASE-RP`.
5. After `studyDebounceSeconds` of silence per Study UID, the job queue
   renders all images and prints to the configured Windows printer.
6. On success → files moved to `printed/YYYY-MM-DD/`.
   On failure → files moved to `failed/YYYY-MM-DD/`.

---

## Testing

End-to-end test using DCMTK:

```powershell
# Verify association handshake
echoscu -aet TESTER -aec BRIDGE_P1 localhost 7001

# Send a sample DICOM file
storescu -aet TESTER -aec BRIDGE_P1 +sd +r localhost 7001 sample.dcm
```

For safe printing during testing, set the slot's Windows printer to
**"Microsoft Print to PDF"** — the output PDF will appear in your Documents.

---

## Configuration files

- Config:    `%APPDATA%\AccurateBridge\config.json`
- Logs:      `%APPDATA%\AccurateBridge\logs\bridge-YYYY-MM-DD.log`
- Incoming:  `%APPDATA%\AccurateBridge\incoming\<slotId>\`
- Printed:   `%APPDATA%\AccurateBridge\printed\YYYY-MM-DD\`
- Failed:    `%APPDATA%\AccurateBridge\failed\YYYY-MM-DD\`

---

## Limitations (v1)

- Compressed transfer syntaxes (JPEG, JPEG2000) are not rendered. Modalities
  should negotiate Implicit or Explicit VR Little Endian (the bridge prefers
  these in the association response).
- No DICOM Print Service Class (N-CREATE/N-SET) — Storage only.
- No re-print or queue pause UI in v1; logs are read-only.
