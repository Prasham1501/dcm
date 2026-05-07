/**
 * useReportRouter — orchestrates Create-Report and Open-Report flows.
 *
 *   const router = useReportRouter();
 *   router.createReport(patient);   // auto-detects & opens, or shows picker
 *   router.openReport(patient);     // looks up existing reports & shows picker if >1
 */
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Patient } from '@/types/patient';
import { useReportStore } from '@/stores/reportStore';
import { REPORT_TYPES } from './registry';
import { detectReportTypes, routeFor } from './detector';
import { useReportRouterStore } from './reportRouterStore';
import { enrichPatientFromDicom } from './dicomEnrich';
import type { ReportRouterCtx, ReportTypeDef } from './types';

export function useReportRouter() {
  const navigate = useNavigate();
  const openLegacyReportEditor = useReportStore((s) => s.openReportEditor);
  const showPicker = useReportRouterStore((s) => s.show);

  const ctx: ReportRouterCtx = {
    navigate,
    openLegacyReportEditor,
  };

  const createReport = useCallback(
    async (patient: Patient) => {
      // Step 1: peek at the DICOM file's tags so we have BodyPart / ProtocolName /
      //         SeriesDescription on top of whatever's in the cached patient row.
      //         Cheap (single file, header only) and runs in parallel with React
      //         render, so the UX delay is imperceptible (~50–100 ms).
      const enriched = await enrichPatientFromDicom(patient);

      const decision = routeFor(enriched);

      if (decision.mode === 'auto' && decision.preselected) {
        const def = REPORT_TYPES.find((t) => t.id === decision.preselected);
        if (def) {
          def.openCreate(ctx, enriched);
          return;
        }
      }

      // Ambiguous → show picker
      showPicker({
        mode: 'create',
        patient: enriched,
        candidates: decision.candidates,
        preselectedId: decision.preselected,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate, openLegacyReportEditor, showPicker],
  );

  const openReport = useCallback(
    async (patient: Patient) => {
      // Enrich first so the picker's confidence badges and preselection
      // reflect the *actual* study, not just the cached metadata.
      const enriched = await enrichPatientFromDicom(patient);

      // Build counts for every type
      const counts: Record<string, number> = {};
      await Promise.all(
        REPORT_TYPES.map(async (t) => {
          const n = t.countExistingReports
            ? await t.countExistingReports(enriched)
            : (await t.hasExistingReports(enriched)) ? 1 : 0;
          counts[t.id] = n;
        }),
      );

      const typesWithReports = REPORT_TYPES.filter((t) => (counts[t.id] ?? 0) > 0);

      if (typesWithReports.length === 0) {
        // Fallback: nothing exists – show picker anyway so the user sees this clearly
        showPicker({
          mode: 'open',
          patient: enriched,
          candidates: [],
          existingCounts: counts,
        });
        return;
      }

      if (typesWithReports.length === 1) {
        typesWithReports[0].openExisting(ctx, enriched);
        return;
      }

      // Multiple types have reports → ask which one to open
      const detections = detectReportTypes(enriched);
      showPicker({
        mode: 'open',
        patient: enriched,
        candidates: detections,
        preselectedId: detections[0]?.typeId,
        existingCounts: counts,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate, openLegacyReportEditor, showPicker],
  );

  /** Called by the picker modal once the user selects a type */
  const handlePick = useCallback(
    (type: ReportTypeDef, patient: Patient, mode: 'create' | 'open') => {
      if (mode === 'create') type.openCreate(ctx, patient);
      else type.openExisting(ctx, patient);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate, openLegacyReportEditor],
  );

  return { createReport, openReport, handlePick };
}
