# Integration notes — wiring the UI to the existing backend

This kit is designed to drop into `ris/ui/src` **without changing any PHP API or backend contract**. Below, each redesigned screen maps to the existing frontend API module, Zustand store, and endpoints it should call. All endpoints use relative `/api/...` paths with `credentials: 'include'` (already the convention in the codebase).

> The kit's components are cosmetic. To integrate, keep the markup/classNames and replace the mock-data state with the existing store hooks and API calls listed here.

## Auth & shell

| Kit piece | Existing code | Endpoints |
|---|---|---|
| `Login.jsx` | `stores/authStore.ts` → `useAuthStore().login()` | `POST /api/auth/login.php` |
| `index.html` route guard | `useAuthStore().checkSession()` / `isAuthenticated` | `GET /api/auth/check-session.php` |
| Topbar "Sign out" | `useAuthStore().logout()` | `POST /api/auth/logout.php` |
| `Shell.jsx` role filtering | `useAuthStore().user.role` (`super_admin`/`admin`/`doctor`/`receptionist`) | — |

Replaces `App.tsx`, `AppShell.tsx`, `LoginGate.tsx`. Theme via `useThemeStore` (`.dark` class on `<html>`).

## Dashboard

| Kit piece | Existing code | Endpoints |
|---|---|---|
| Stat tiles | `features/dashboard/api/dashboardApi.ts` → `apiDashboardSummary()` → `DashboardSummary` | `GET /api/dashboard/summary.php` |
| MIS CSV exports | `misExportUrl(type, from, to)` | `GET /api/reports/export.php?type=visits\|payments\|commission&from&to` |

Stat fields map 1:1: `registrations_today`, `pending_worklist`, `ready_to_collect`, `collections_today`, `mtd_commission`. Export buttons gated to `admin`/`super_admin`/`receptionist`.

## Reception

| Kit piece | Existing code | Endpoints |
|---|---|---|
| Find patient | `features/reception/api/receptionApi.ts` → `apiSearchPatients(q)` | `GET /api/reception/patients.php?action=search&q=` |
| Register patient modal | `apiCreatePatient(payload)` | `POST /api/reception/patients.php` |
| Service checklist | `apiListServices()` → `Service[]` | `GET /api/reception/services.php?active=1` |
| Referring doctor select | `apiListReferringDoctors(q)` / `apiCreateReferringDoctor()` | `GET\|POST /api/reception/referring-doctors.php` |
| Register visit (accession gen) | `apiRegisterVisit(visitForm)` → `RegisterResult {visit, orders[]}` | `POST /api/reception/register.php` |
| Payment pane | `features/billing/.../billingApi.ts` → `apiTakePayment()` / `apiGenerateReceipt()` | `POST /api/billing/take-payment.php`, `POST /api/billing/receipt.php` |
| Admin network modal | `apiGetNetworkInfo()` → `NetworkInfo` | `GET /api/system/network-info.php` |

Use `useReceptionStore` (search/register/loadServices/loadReferringDoctors/registerVisit) + `useBillingStore` (takePayment/generateReceipt), exactly as `ReceptionPage.tsx` does today. The kit's 3-step indicator is presentational over the same `selectedPatient → register → pay` state.

## Worklist

| Kit piece | Existing code | Endpoints |
|---|---|---|
| Board columns | `features/worklist/api/worklistApi.ts` → `apiDoctorList('acquired,in_progress,reported', modality)` → `WorklistOrder[]` | `GET /api/worklist/doctor-list.php?status=&modality=` |
| Ready to collect | `apiCollectionList()` | `GET /api/worklist/doctor-list.php?collection=1` |
| Open & start / Mark reported / Mark delivered | `apiTransition(orderId, 'claim'\|'report'\|'deliver', reportId?)` | `POST /api/worklist/transition.php` |
| Check for new studies | `apiRunMatch()` → `{matched}` | `POST /api/worklist/match-studies.php` |
| Open study button | navigate `/viewer?study=<linked_study_uid\|study_instance_uid>` | One Clickz Viewer |

Use `useWorklistStore` (load/loadCollection/claim/report/deliver/runMatch) and keep the 20s poll from `WorklistPage.tsx`. Doctor actions gated to `admin`/`super_admin`/`doctor`.

## Billing — Day Book

| Kit piece | Existing code | Endpoints |
|---|---|---|
| Totals / by-mode / refunds | `features/billing/api/billingApi.ts` → `apiGetDaybook(from, to)` → `DayBook {total, count, by_mode, refunds}` | `GET /api/billing/daybook.php?from&to` |
| Receipt buttons | `apiGenerateReceipt(visitId)` | `POST /api/billing/receipt.php` |

The payments table is illustrative — the real day book returns aggregates (`by_mode` map). Receipt PDF/HTML generation stays backend-owned.

## Commission (admin only)

| Kit piece | Existing code | Endpoints |
|---|---|---|
| Enable/disable toggle | `features/commission/api/commissionApi.ts` → `apiGetCommissionEnabled()` / `apiSetCommissionEnabled()` | `GET\|POST /api/commission/settings.php` |
| Doctor-wise table | `apiCommissionReport(from, to)` → `{rows: CommissionReportRow[]}` | `GET /api/commission/report.php?from&to` |
| Statement modal | `apiCommissionStatement(doctorId, period)` → `Statement {entries, total}` | `GET /api/commission/statement.php?doctor_id&period` |
| Create / pay payout | `apiCreatePayout(doctorId, from, to)` / `apiPayPayout(payoutId)` | `POST /api/commission/payouts.php` |

Gate the whole route to `admin`/`super_admin`.

## Settings & Network (proposed)

| Kit piece | Existing code | Endpoints |
|---|---|---|
| Client URLs, LAN IPs, DICOM settings | `receptionApi.ts` → `apiGetNetworkInfo()` → `NetworkInfo {lan_ips, php_port, client_urls, modality{server_ip, ae_title, dicom_port, rest_port}}` | `GET /api/system/network-info.php` |
| Machines & consoles, transfer, viewer integration | ecosystem features — connect to the same `network-info` + viewer launch (`/viewer?study=`); DICOM C-STORE/MWL handled by Orthanc backend | — |

Console list / transfer / save-DICOM-settings are forward-looking: keep read-only `network-info` for display, and add backend endpoints later if write operations are needed. Gate to `admin`/`super_admin`.

---

### Integration checklist
1. Copy `theme.css` tokens into the viewer's `globals.css` (or keep importing it) so `--app-*` vars resolve. They already map to the Tailwind theme in `tailwind.config.js`.
2. Port shared primitives from `ui.jsx` into `src/components/ui/*` as real TS components (swap the `Icon` wrapper for direct `lucide-react` imports).
3. Replace each screen's mock state with the store hooks above — markup and classNames carry over.
4. Keep all role gating, the 20s worklist poll, and accession/study-UID linking unchanged.
