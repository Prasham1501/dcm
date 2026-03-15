export interface User {
  id: number;
  username: string;
  role: 'admin' | 'doctor' | 'technician' | 'receptionist';
  hospitalName: string;
  displayName?: string;
  email?: string;
  createdAt?: string;
  lastLogin?: string;
}
