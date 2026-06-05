import { create } from 'zustand';

const RECEPTION_USER: RisUser = {
  id: 1,
  username: 'ris_reception',
  email: 'reception@oneclickz.local',
  name: 'Reception',
  full_name: 'Reception',
  role: 'receptionist',
};

export interface RisUser {
  id: number;
  username?: string;
  email?: string;
  name?: string;
  role?: string;
  [k: string]: any;
}

interface AuthState {
  user: RisUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: RECEPTION_USER,
  isAuthenticated: true,
  isLoading: false,

  login: async () => {
    set({ user: RECEPTION_USER, isAuthenticated: true, isLoading: false });
  },

  logout: async () => {
    set({ user: RECEPTION_USER, isAuthenticated: true, isLoading: false });
  },

  checkSession: async () => {
    set({ user: RECEPTION_USER, isAuthenticated: true, isLoading: false });
  },
}));
