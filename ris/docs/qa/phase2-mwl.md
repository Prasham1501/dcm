# Phase 2 — DICOM Modality Worklist: manual QA

Automated tests cover the worklist field mapping, the DICOM `.wl` writer (round-tripped
through `dicom-parser`), the `.wl` file service, and the study matcher. The items below
require a **running Orthanc** (not available in CI/sandbox) and a modality (or DCMTK
simulator), so verify them on a real install.

## Prerequisites
- The bundled Orthanc must include the **Worklists plugin** (`libModalityWorklists` /
  `OrthancWorklists`) in its plugins folder. It ships with Orthanc — confirm the binary is
  present alongside the other Orthanc plugins.
- `main.js` now writes `Worklists: { Enable: true, Database: <OCZ_WORKLIST_DIR or C:/Orthanc/Worklists> }`
  into the generated `orthanc.json`, and PHP resolves the same folder via
  `ris_worklist_dir()` (env `OCZ_WORKLIST_DIR` → `hospital_settings.worklist_dir` → default).
  **Keep these in sync.**

## 1. Worklist is generated on registration
1. Register a visit with one obstetric USG service (Reception).
2. Confirm a `<ACCESSION>.wl` file appears in the worklist folder, and `ris_orders.mwl_path`
   is set for that order.

## 2. Machine can query the worklist (C-FIND)
Using DCMTK from any LAN PC (server AE = `ONECLICKZ`, DICOM port = `3458`):
```
findscu -v -W -k "ScheduledProcedureStepSequence[0].Modality=US" \
        -aec ONECLICKZ <SERVER_IP> 3458
```
Expect the scheduled patient (name, ID, accession) in the response. On the ultrasound/X-ray
machine, "Query Worklist" should list the patient and auto-fill demographics when selected.

## 3. Acquired images auto-link back (C-STORE → matcher)
1. From the modality (or `storescu`), send the study to `ONECLICKZ@<SERVER_IP>:3458`.
   It must carry the **same AccessionNumber** (and/or the pre-generated StudyInstanceUID)
   the machine pulled from the worklist.
2. After the Orthanc→`cached_studies` sync runs, call
   `POST /api/worklist/match-studies.php` (the doctor console polls this).
3. Expect: the order flips to `status='acquired'`, `linked_study_uid` is set, and the
   `<ACCESSION>.wl` file is removed.

## 4. Fallback (machine without MWL support)
- Demographics still reach the doctor console; print a worklist slip and have the tech enter
  the AccessionNumber on the machine so step 3 still links the study.

## Notes
- `POST /api/worklist/generate.php` re-creates `.wl` files for all pending orders (recovery).
- Simulate C-STORE without a modality by uploading a DICOM with a matching AccessionNumber to
  Orthanc (`POST /instances`), letting the sync populate `cached_studies`, then running the matcher.
