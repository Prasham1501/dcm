export interface Study {
  id: string;
  patientId: string;
  patientName: string;
  studyDate: string;
  studyDescription: string;
  modality: string;
  accessionNumber: string;
  referringPhysician: string;
  seriesCount: number;
  instanceCount: number;
  status: 'completed' | 'pending' | 'in-progress';
  hasReport: boolean;
  bodyPart: string;
}

export interface Report {
  id: string;
  studyId: string;
  title: string;
  date: string;
  doctor: string;
  findings: string;
  impression: string;
  recommendation: string;
  status: 'draft' | 'final' | 'amended';
}
