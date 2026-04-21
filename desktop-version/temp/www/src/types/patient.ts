export interface Patient {
  id: string;
  patientId: string;
  patientName: string;
  age: string;
  sex: 'M' | 'F' | 'O' | '';
  studyDate: string;
  studyDescription: string;
  images: number;
  modality: string;
  accessionNumber: string;
  referringPhysician: string;
  printed: boolean;
  orthancId?: string;
  studyInstanceUID?: string;
  filePaths?: string[];
}

export interface PatientFilters {
  patientId: string;
  patientName: string;
  referringPhysician: string;
  studyDescription: string;
  accessionNumber: string;
  modality: string;
  dateRange: DateRangePreset;
  fromDate: string;
  toDate: string;
  month: string;
  year: string;
}

export type DateRangePreset = 'today' | 'yesterdayAndToday' | 'yesterday' | 'last7days' | 'all' | 'custom';

export interface PatientContextAction {
  label: string;
  icon?: string;
  action: string;
  disabled?: boolean;
  children?: PatientContextAction[];
}
