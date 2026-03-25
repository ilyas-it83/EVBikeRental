import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { LoginRequest, RegisterRequest, UserRole } from '@ev-bike-rental/shared';

// API response types aligned with backend contracts
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role?: UserRole;
}

export interface StationSummary {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  availableBikes: number;
  emptyDocks: number;
  distance: number;
}

export interface StationBike {
  id: string;
  model: string;
  batteryLevel: number;
  status: string;
}

export interface StationDetail {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  dockCapacity: number;
  bikes: StationBike[];
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// 401 interceptor: attempt token refresh, retry original, redirect on failure
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  config: InternalAxiosRequestConfig;
}> = [];

const processQueue = (error: AxiosError | null) => {
  failedQueue.forEach(({ resolve, reject, config }) => {
    if (error) {
      reject(error);
    } else {
      resolve(api(config));
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;

    if (!originalRequest || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    // Never retry refresh or login endpoints
    if (
      originalRequest.url?.includes('/auth/refresh') ||
      originalRequest.url?.includes('/auth/login')
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject, config: originalRequest });
      });
    }

    isRefreshing = true;

    try {
      await axios.post(
        `${api.defaults.baseURL}/api/auth/refresh`,
        {},
        { withCredentials: true },
      );
      processQueue(null);
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError as AxiosError);
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export const authApi = {
  register: (data: RegisterRequest) =>
    api.post<{ user: AuthUser }>('/api/auth/register', data).then((r) => r.data),

  login: (data: LoginRequest) =>
    api.post<{ user: AuthUser }>('/api/auth/login', data).then((r) => r.data),

  logout: () => api.post('/api/auth/logout').then((r) => r.data),

  refresh: () => api.post('/api/auth/refresh').then((r) => r.data),

  me: () => api.get<{ user: AuthUser }>('/api/auth/me').then((r) => r.data),
};

export const stationsApi = {
  list: (lat: number, lng: number, radius?: number) =>
    api
      .get<{ stations: StationSummary[] }>('/api/stations', {
        params: { lat, lng, radius },
      })
      .then((r) => r.data),

  getById: (id: string) =>
    api.get<{ station: StationDetail }>(`/api/stations/${id}`).then((r) => r.data),
};

export default api;
