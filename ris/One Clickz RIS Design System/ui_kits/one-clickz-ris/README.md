# One Clickz RIS — UI Kit

A high-fidelity, interactive recreation of the **One Clickz RIS** desktop/web UI, restyled to the red/white One Clickz identity. It is a click-through prototype, not production code — the components are simple, mostly-cosmetic versions of the real ones, wired to mock data so you can walk the full clinic workflow.

Open **`index.html`** and sign in (pick a demo role) to explore.

## What's inside

| File | Screen / role |
|---|---|
| `index.html` | App entry — auth gate, role-based routing, theme toggle, shell |
| `Shell.jsx` | Fixed sidebar nav (role-filtered) + topbar |
| `Login.jsx` | Login — wordmark, credentials, demo-role picker |
| `Dashboard.jsx` | KPI stat tiles, recent collections, quick actions, MIS CSV exports |
| `Reception.jsx` | Guided 3-step flow: find/register patient → build visit (services, referring doctor, discount, accession) → payment & receipt; admin network-setup modal |
| `Worklist.jsx` | Doctor console — acquired / in-progress / reported board, open & start, mark reported, mark delivered, "check for new studies", ready-to-collect table |
| `Billing.jsx` | Day Book — date range, totals, by-mode (cash/UPI/card/other), refunds, payment list |
| `Commission.jsx` | Admin — enable/disable, doctor-wise table, statement modal, create/pay payout |
| `Settings.jsx` | Proposed Settings & Network — LAN URLs, DICOM/modality settings, machines & consoles, viewer integration & study transfer |
| `ui.jsx` | Shared primitives (see below) |
| `mock.js` | Mock clinic data shaped like the real TypeScript interfaces |
| `theme.css` | Color/type/spacing tokens (copy of the root `colors_and_type.css`) |
| `kit.css` | Component styles |

## Shared components (`ui.jsx`)

`Button` · `IconButton` · `Input` · `Select` · `Textarea` · `Field` · `DateRange` · `Toggle` · `StatTile` · `StatusChip` · `ModalityTag` · `SectionHeader` · `DataTable` · `EmptyState` · `Modal` · `Banner` · `Tabs` · `ToastProvider`/`useToast` · `Icon` (Lucide wrapper).

All take the same red/white identity from `theme.css`. Status semantics live in one `STATUS_MAP` so chips stay consistent (acquired/in-progress/reported/delivered/paid/refund).

## Roles

The login role picker changes which sidebar areas appear, matching the brief:

- **Receptionist** — Dashboard, Reception, Worklist (collection), Day Book
- **Doctor** — Dashboard, Reception, Worklist (open/report)
- **Admin / super-admin** — everything incl. Commission and Settings & Network

## Fidelity notes

- This is a **redesign of the existing UI**, not a new product. Layout, workflow steps, and terminology are preserved from the live `ris/ui/src` screens; only the visual layer changes (the legacy slate/blue dark styling → red/white).
- Interactions are faked in React state. No real network calls. See `INTEGRATION.md` for which API module/store each screen should call when wired up.
- Icons are Lucide (loaded from CDN), matching `lucide-react` in the app.
- Dark mode is included (topbar toggle) but light is the primary identity.
