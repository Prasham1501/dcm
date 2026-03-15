import type { ApiResponse } from '@/types/api';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: ApiResponse
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const config: RequestInit = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    },
    ...options,
  };

  const response = await fetch(url, config);

  if (response.status === 401) {
    // Session expired or not authenticated - redirect to login
    // Avoid redirect loop if already on login page
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
    throw new ApiError('Unauthorized', 401);
  }

  const data: ApiResponse<T> = await response.json();

  if (!response.ok) {
    throw new ApiError(
      data.error || data.message || `Request failed with status ${response.status}`,
      response.status,
      data
    );
  }

  return data;
}

export const api = {
  get<T>(url: string): Promise<ApiResponse<T>> {
    return request<T>(url, { method: 'GET' });
  },

  post<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    return request<T>(url, {
      method: 'POST',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  },

  put<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    return request<T>(url, {
      method: 'PUT',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  },

  del<T>(url: string): Promise<ApiResponse<T>> {
    return request<T>(url, { method: 'DELETE' });
  },
};

export { ApiError };
