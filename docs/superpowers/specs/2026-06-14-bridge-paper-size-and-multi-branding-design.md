# Print Bridge — Per-slot Film→Paper Mapping + Multi-Branding (Workstream A)

Date: 2026-06-14
Scope: `bridge/` (One Clickz Print Bridge — Electron tray app). No other module is touched.
Status: Approved (design), implementing.

This is Workstream **A** of a 3-part effort agreed with the user:
- **A** (this doc) — per-slot paper-size conversion + multi-branding.
- **B** — offline recharge (remove PIN, signed voucher).
- **C** — security audit + DevTools lockdown.

## Feature 1 — Per-slot film → paper mapping

### Behaviour
- Each slot keeps a **default paper** (`slot.paperSize`). Used for image-only jobs
  (Storage SCP, which carry no film size) and for any film size with no mapping.
- Each slot gains a **film→paper map** (`slot.filmSizeMap`). Used by true DICOM
  Print (Film Box) jobs, keyed on the DICOM Film Size ID tag `(2010,0050)`
  (uppercased), e.g. `{ "14INX17IN": "A4", "11INX14IN": "A5" }`.
- A mapping value of `"SAME"` means "keep original film size" (current behaviour).
- Images are scaled to fit the target page (`object-fit: contain`) — never cropped.

### Selectable paper sizes (exactly these 8, per user)
| id | label | mm (w×h) | Windows DMPAPER |
|----|-------|----------|-----------------|
| A4 | A4 | 210 × 297 | 9 |
| A5 | A5 | 148 × 210 | 11 |
| B4JIS | B4 (JIS) | 257 × 364 | 12 |
| B5JIS | B5 (JIS) | 182 × 257 | 13 |
| ENV9 | Envelope #9 | 98.4 × 225.4 | 19 |
| ENV10 | Envelope #10 | 104.8 × 241.3 | 20 |
| CSHEET | C Sheet | 431.8 × 558.8 (17 × 22 in) | 24 |
| DSHEET | D Sheet | 558.8 × 863.6 (22 × 34 in) | 25 |

Dropdown labels mirror the reference UI exactly: `"<w> x <h> inch <name> | <win code>"`
(e.g. `8.27 x 11.69 inch A4 | 9`). The per-slot film→paper map is shown as visible
labeled rows ("Print 14 × 17 film size print job on this paper size" + a paper
dropdown), one per standard film size, plus an "Add another film size ID" row.

A3/Letter/Legal are removed from the options. Migration rewrites any slot still
set to a dropped size → `A4`. Only `A4`/`A5` are Electron-named page sizes; the
rest are emitted as explicit `mm`/micron dimensions (the existing custom-size path).

### DICOM film-size presets prefilled in the mapping UI
`8INX10IN, 10INX12IN, 10INX14IN, 11INX14IN, 11INX17IN, 14INX14IN, 14INX17IN,
24CMX24CM, 24CMX30CM, A4, A3` + an "Add custom film size ID" row.

## Feature 2 — Multiple brandings, one assigned per slot

### Data model
- `config.branding` (single) → `config.brandings: [{ id, name, ...HospitalBranding }]`
  plus `config.defaultBrandingId`.
- Each slot gains `slot.brandingId` (`null` → use default).
- Migration (v6→v7) wraps the existing single branding as **"Default"** and points
  every existing slot at it.

### Resolution at print time
`branding = brandings.find(b => b.id === slot.brandingId) || default`. One branding
= header + footer as a unit (not independently mixed).

### UI
- `BrandingPage.tsx` — unobtrusive selector bar at the top (dropdown + New /
  Duplicate / Rename / Delete); the existing editor edits the selected branding.
- `SlotCard.tsx` — a "Branding" dropdown listing brandings by name.

## File touch list
- NEW `bridge/src/render/paperSizes.js` — single source of dims + Win codes +
  `electronPageSize` / `isNamedSize` helpers (de-dupes the two copies).
- NEW `bridge/src/print/printResolve.js` — pure `resolveTargetPaper(slot, filmSizeId)`
  + `resolveBranding(config, slot)` (no electron import → unit-testable).
- `bridge/src/print/printWorker.js` — use the two new modules.
- `bridge/src/render/layoutBuilder.js` — import dims/named-size from paperSizes.
- `bridge/src/config/schema.js` — selectable list, slot defaults (`filmSizeMap`,
  `brandingId`), `brandings[]`/`defaultBrandingId`, migration v6→v7.
- `bridge/main.js` — branding CRUD IPC (save/create/delete).
- `bridge/preload.js` + `bridge/ui/src/types/bridge.d.ts` — new IPC + types.
- `bridge/ui/src/stores/configStore.ts` — branding CRUD actions.
- NEW `bridge/ui/src/lib/paperSizes.ts` — UI mirror of options + film presets.
- `bridge/ui/src/components/SlotCard.tsx` — default-paper + film→paper table +
  branding dropdown.
- `bridge/ui/src/pages/BrandingPage.tsx` — multi-branding manager.

## Testing (runnable here via `node --test`, no Electron/printer needed)
- `paperSizes.test.js` — dims, win codes, named-size + electronPageSize behaviour.
- `schema.test.js` — migration v6→v7 (single→brandings[], slot fields, dropped
  paper → A4), defaultConfig validity, validateSlot.
- `printResolve.test.js` — mapped→paper, `SAME`→film, unmapped→default; branding
  by id / default fallback.
- `layoutBuilder.test.js` — `buildPrintHtml` emits the right `@page` size for
  A4 vs B4JIS vs ENV10, and includes the resolved branding header/footer.
- Manual/Electron: `BRIDGE_TEST_DUMP=<dir>` + `scripts/test-print-scp.js` to
  send `14INX17IN` to an A4-mapped slot and confirm the dumped PDF is A4.
- `cd bridge/ui && npm run build` typecheck.
