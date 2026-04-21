import type { ApiResponse, PaginatedResponse } from '@/types/api';

// API base URL - configurable for dev vs production
// In Electron, the PHP server runs on localhost via XAMPP
const getBaseUrl = (): string => {
  // Check if running in Electron with a configured API URL
  if (typeof window !== 'undefined' && (window as any).__DICOM_API_URL__) {
    return (window as any).__DICOM_API_URL__;
  }
  // Default: same origin (works when served from XAMPP)
  return '/api';
};

export const API_BASE = getBaseUrl();

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
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}/${url.startsWith('/') ? url.slice(1) : url}`;

  const config: RequestInit = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    },
    ...options,
  };

  const response = await fetch(fullUrl, config);

  if (response.status === 401) {
    // Session expired - handle without full window redirect in desktop version
    // if (!window.location.pathname.includes('/login')) {
    //   window.location.href = '/login';
    // }
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

// Raw request that returns the full response (for non-standard API responses)
async function rawRequest<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}/${url.startsWith('/') ? url.slice(1) : url}`;

  const config: RequestInit = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    },
    ...options,
  };

  const response = await fetch(fullUrl, config);

  if (response.status === 401) {
    throw new ApiError('Unauthorized', 401);
  }

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(
      data.error || data.message || `Request failed with status ${response.status}`,
      response.status,
      data
    );
  }

  return data as T;
}

// Blob request for binary data (DICOM files, images)
async function blobRequest(url: string): Promise<Blob> {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}/${url.startsWith('/') ? url.slice(1) : url}`;

  const response = await fetch(fullUrl, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new ApiError(`Failed to fetch blob: ${response.statusText}`, response.status);
  }

  return response.blob();
}

// Upload request with FormData
async function uploadRequest<T>(
  url: string,
  formData: FormData
): Promise<ApiResponse<T>> {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}/${url.startsWith('/') ? url.slice(1) : url}`;

  const response = await fetch(fullUrl, {
    method: 'POST',
    credentials: 'include',
    body: formData,
    // Don't set Content-Type - browser sets it with boundary for multipart
  });

  if (response.status === 401) {
    throw new ApiError('Unauthorized', 401);
  }

  const data: ApiResponse<T> = await response.json();

  if (!response.ok) {
    throw new ApiError(
      data.error || data.message || `Upload failed with status ${response.status}`,
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

  del<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    return request<T>(url, {
      method: 'DELETE',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  },

  raw: rawRequest,
  blob: blobRequest,
  upload: uploadRequest,
};

export { ApiError };
export type { PaginatedResponse };
