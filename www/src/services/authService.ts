import { api } from '@/services/api';
import type { User } from '@/types/user';

interface LoginResponse {
  user: User;
  token?: string;
}

interface SessionResponse {
  user: User;
}

// NOTE: paths are RELATIVE to API_BASE ('/api'), matching every other service
// (e.g. api.post('reports/create.php')). Passing '/api/auth/login.php' here
// produced '/api/api/auth/login.php' → 404 → login silently failed → no PHP
// session → every session-gated endpoint returned 401.
export const authService = {
  login(username: string, password: string) {
    return api.post<LoginResponse>('auth/login.php', { username, password });
  },

  logout() {
    return api.post<void>('auth/logout.php');
  },

  checkSession() {
    return api.get<SessionResponse>('auth/check-session.php');
  },

  autoLogin(token: string) {
    return api.post<LoginResponse>('auth/auto-login.php', { token });
  },

  // Opt-in desktop session for the single-user viewer (no login screen).
  desktopLogin() {
    return api.post<LoginResponse>('auth/desktop-login.php');
  },
};
