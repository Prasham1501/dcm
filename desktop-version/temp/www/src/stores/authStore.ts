import { create } from 'zustand';
import { authService } from '@/services/authService';
import {
  isElectron,
  getCredentials,
  clearCredentials,
  saveCredentials,
} from '@/utils/electronBridge';
import type { User } from '@/types/user';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  autoLogin: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (username: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await authService.login(username, password);
      if (response.success && response.data) {
        const { user, token } = response.data;
        set({ user, isAuthenticated: true, isLoading: false });

        // Save credentials for auto-login in Electron
        if (isElectron() && token) {
          await saveCredentials({ username, token, userId: user.id });
        }
      } else {
        set({ isLoading: false });
        throw new Error(response.error || response.message || 'Login failed');
      }
    } catch (error) {
      set({ user: null, isAuthenticated: false, isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await authService.logout();
    } catch {
      // Proceed with local logout even if API call fails
    }

    if (isElectron()) {
      await clearCredentials();
    }

    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  checkSession: async () => {
    set({ isLoading: true });
    try {
      const response = await authService.checkSession();
      if (response.success && response.data) {
        set({
          user: response.data.user,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  autoLogin: async () => {
    if (!isElectron()) {
      set({ isLoading: false });
      return;
    }

    set({ isLoading: true });
    try {
      const credentials = await getCredentials();
      if (!credentials?.token) {
        set({ isLoading: false });
        return;
      }

      const response = await authService.autoLogin(credentials.token);
      if (response.success && response.data) {
        set({
          user: response.data.user,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        // Invalid token - clear stored credentials
        await clearCredentials();
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
