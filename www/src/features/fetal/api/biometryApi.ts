import { api } from '@/services/api';
import type { BiometryField, GrowthChartAuthor, GrowthChartPoint } from '@/features/fetal/types';

function unwrap<T>(resp: { success: boolean; data?: T; error?: string }): T {
  if (!resp.success || resp.data === undefined) {
    throw new Error(resp.error || 'Biometry API error');
  }
  return resp.data;
}

export const biometryApi = {
  async load(examinationId: number): Promise<Record<string, BiometryField>> {
    const resp = await api.get<Record<string, BiometryField>>(
      `fetal/biometry.php?examination_id=${examinationId}`,
    );
    return unwrap(resp);
  },

  async save(examinationId: number, fields: (BiometryField & { field_key: string })[]): Promise<void> {
    const resp = await api.post<null>('fetal/biometry.php', {
      examination_id: examinationId,
      fields,
    });
    if (!resp.success) throw new Error(resp.error || 'Save failed');
  },

  async listAuthors(): Promise<GrowthChartAuthor[]> {
    const resp = await api.get<GrowthChartAuthor[]>('fetal/growth-charts.php?authors=1');
    return unwrap(resp);
  },

  async getChartData(parameter: string, authorId?: number): Promise<GrowthChartPoint[]> {
    const qs = authorId
      ? `fetal/growth-charts.php?parameter=${parameter}&author_id=${authorId}`
      : `fetal/growth-charts.php?parameter=${parameter}`;
    const resp = await api.get<GrowthChartPoint[]>(qs);
    return unwrap(resp);
  },
};
