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
      // login.php returns a FLAT shape ({ success, user, auto_login_token }),
      // not { data: { user, token } }. Accept both to be safe.
      const response = await authService.login(username, password) as any;
      const user = response?.data?.user ?? response?.user;
      const token = response?.data?.token ?? response?.auto_login_token ?? response?.token;
      if (response?.success && user) {
        set({ user, isAuthenticated: true, isLoading: false });

        // Save credentials for auto-login in Electron
        if (isElectron() && token) {
          await saveCredentials({ username, token, userId: user.id });
        }
      } else {
        set({ isLoading: false });
        throw new Error(response?.error || response?.message || 'Login failed');
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
      // check-session.php returns { logged_in, user } (flat). Accept data-wrapped too.
      const response = await authService.checkSession() as any;
      let user = response?.data?.user ?? response?.user;
      let ok = (response?.logged_in ?? response?.success) && !!user;

      // The desktop viewer has no login screen — if there's no session, try the
      // opt-in desktop auto-login (no-op/403 on the networked RIS).
      if (!ok) {
        try {
          const dl = await authService.desktopLogin() as any;
          const du = dl?.data?.user ?? dl?.user;
          if (dl?.success && du) { user = du; ok = true; }
        } catch { /* disabled — remain logged out */ }
      }

      if (ok) {
        set({ user, isAuthenticated: true, isLoading: false });
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

      const response = await authService.autoLogin(credentials.token) as any;
      const user = response?.data?.user ?? response?.user;
      if (response?.success && user) {
        set({ user, isAuthenticated: true, isLoading: false });
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
