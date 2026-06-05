# Phase 3 — Doctor console & ready-to-collect: manual QA

Automated tests cover all status transitions (`RisOrderWorkflow`), the worklist/collection
queries, and the worklist store. The items below need a running app + Orthanc.

## Gate (automated, green)
- acquired → claim → in_progress → report → reported → deliver → delivered, with timestamps.
- Invalid transitions (e.g. deliver an un-reported order) are rejected (HTTP 409).
- Doctor list + "Ready to collect" list return joined patient/service data; actions are audited.

## Manual checks (real install)
1. Acquire a study (Phase 2 flow) → it appears in the worklist **Pending** column within ~20s
   (the page polls `match-studies`).
2. Doctor clicks **Open & start** → order moves to **In progress**.
3. Write & finalize the report (existing editor), then **Mark reported** → moves to **Reported**.
4. Reception sees it under **Ready to collect** → **Collected** marks it delivered.

## Known integration point (wire on-site)
The worklist **Open** button navigates to `/viewer?study=<StudyInstanceUID>`. The existing
`ViewerPage` loads a study from a `viewer-launch` payload that contains resolved **file
paths/URLs**, normally produced by the patient table via `patientStore`. To make Open-by-UID
seamless, add a resolver that, given a StudyInstanceUID, fetches the study's instances from
Orthanc (reuse `api/dicomweb/*` / `load_study_fast.php`) and writes the `viewer-launch`
payload before navigating. This needs a running Orthanc to verify, so it is intentionally not
implemented in the sandbox. Until then, doctors can open the study from the patient list as today.
