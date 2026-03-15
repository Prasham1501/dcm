import { api } from '@/services/api';
import type { User } from '@/types/user';

interface LoginResponse {
  user: User;
  token?: string;
}

interface SessionResponse {
  user: User;
}

export const authService = {
  login(username: string, password: string) {
    return api.post<LoginResponse>('/api/auth/login.php', { username, password });
  },

  logout() {
    return api.post<void>('/api/auth/logout.php');
  },

  checkSession() {
    return api.get<SessionResponse>('/api/auth/check-session.php');
  },

  autoLogin(token: string) {
    return api.post<LoginResponse>('/api/auth/auto-login.php', { token });
  },
};
