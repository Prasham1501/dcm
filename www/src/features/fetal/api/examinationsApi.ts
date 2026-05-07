import { api } from '@/services/api';
import type {
  CreateExaminationInput,
  Examination,
  UpdateExaminationInput,
} from '@/features/fetal/types';

function unwrap<T>(resp: { success: boolean; data?: T; error?: string }): T {
  if (!resp.success || resp.data === undefined) {
    throw new Error(resp.error || 'Examinations API returned no data');
  }
  return resp.data;
}

export const examinationsApi = {
  async listForPatient(patientId: string): Promise<Examination[]> {
    const resp = await api.get<Examination[]>(
      `fetal/examinations.php?patient_id=${encodeURIComponent(patientId)}`,
    );
    return unwrap(resp);
  },

  async getById(id: number): Promise<Examination> {
    const resp = await api.get<Examination>(`fetal/examinations.php?id=${id}`);
    return unwrap(resp);
  },

  async create(input: CreateExaminationInput): Promise<Examination> {
    const resp = await api.post<Examination>('fetal/examinations.php', input);
    return unwrap(resp);
  },

  async update(id: number, patch: UpdateExaminationInput): Promise<Examination> {
    const resp = await api.put<Examination>(`fetal/examinations.php?id=${id}`, patch);
    return unwrap(resp);
  },

  async remove(id: number): Promise<void> {
    await api.del(`fetal/examinations.php?id=${id}`);
  },
};
