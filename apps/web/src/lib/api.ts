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

// --- Ride types & API ---

export interface RideResponse {
  id: string;
  bikeId: string;
  startStationId: string;
  endStationId: string | null;
  startTime: string;
  endTime: string | null;
  durationMinutes: number | null;
  distanceKm: number | null;
  cost: number | null;
  status: string;
  startStationName?: string;
  endStationName?: string;
  bike?: { model: string; batteryLevel: number };
  payment?: { id: string; amount: number; status: string; createdAt: string } | null;
}

export const ridesApi = {
  unlock: (bikeId: string, stationId: string) =>
    api.post<{ ride: RideResponse }>('/api/rides/unlock', { bikeId, stationId }).then((r) => r.data),

  getActive: () =>
    api.get<{ ride: RideResponse | null }>('/api/rides/active').then((r) => r.data),

  endRide: (rideId: string, endStationId: string) =>
    api
      .post<{ ride: RideResponse; payment: { id: string; amount: number; status: string } }>(
        `/api/rides/${rideId}/end`,
        { endStationId },
      )
      .then((r) => r.data),

  list: (page = 1, limit = 20) =>
    api
      .get<{ rides: RideResponse[]; pagination: { page: number; limit: number; total: number; pages: number } }>(
        '/api/rides',
        { params: { page, limit } },
      )
      .then((r) => r.data),

  getById: (id: string) =>
    api.get<{ ride: RideResponse }>(`/api/rides/${id}`).then((r) => r.data),
};

// --- Payment method types & API ---

export interface PaymentMethodResponse {
  id: string;
  type: string;
  last4: string;
  brand: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
}

export const paymentMethodsApi = {
  list: () =>
    api.get<{ paymentMethods: PaymentMethodResponse[] }>('/api/payment-methods').then((r) => r.data),

  add: (data: { last4: string; brand: string; expiryMonth: number; expiryYear: number }) =>
    api.post<{ paymentMethod: PaymentMethodResponse }>('/api/payment-methods', data).then((r) => r.data),

  remove: (id: string) => api.delete(`/api/payment-methods/${id}`).then((r) => r.data),

  setDefault: (id: string) =>
    api.put<{ paymentMethod: PaymentMethodResponse }>(`/api/payment-methods/${id}/default`).then((r) => r.data),
};

// --- Admin API ---

export const adminApi = {
  getFleetOverview: () => api.get('/api/admin/fleet/overview').then((r) => r.data),
  getFleetStations: () => api.get('/api/admin/fleet/stations').then((r) => r.data),

  listStations: () => api.get('/api/admin/stations').then((r) => r.data),
  createStation: (data: { name: string; address: string; lat: number; lng: number; dockCapacity: number }) =>
    api.post('/api/admin/stations', data).then((r) => r.data),
  updateStation: (id: string, data: Partial<{ name: string; address: string; lat: number; lng: number; dockCapacity: number; isActive: boolean }>) =>
    api.put(`/api/admin/stations/${id}`, data).then((r) => r.data),
  deleteStation: (id: string) => api.delete(`/api/admin/stations/${id}`).then((r) => r.data),

  listBikes: (params?: { stationId?: string; status?: string; lowBattery?: boolean }) =>
    api.get('/api/admin/bikes', { params }).then((r) => r.data),
  createBike: (data: { serialNumber: string; model: string; stationId: string; batteryLevel: number }) =>
    api.post('/api/admin/bikes', data).then((r) => r.data),
  updateBike: (id: string, data: Partial<{ serialNumber: string; model: string; stationId: string; batteryLevel: number; status: string }>) =>
    api.put(`/api/admin/bikes/${id}`, data).then((r) => r.data),
  deleteBike: (id: string) => api.delete(`/api/admin/bikes/${id}`).then((r) => r.data),

  listUsers: (page = 1, limit = 20) =>
    api.get('/api/admin/users', { params: { page, limit } }).then((r) => r.data),
  updateUserRole: (id: string, role: string) =>
    api.put(`/api/admin/users/${id}/role`, { role }).then((r) => r.data),
  suspendUser: (id: string) =>
    api.put(`/api/admin/users/${id}/suspend`).then((r) => r.data),
};

// --- Subscriptions API ---

export const subscriptionsApi = {
  getPlans: () => api.get('/api/subscriptions/plans').then((r) => r.data),
  getCurrent: () => api.get('/api/subscriptions/current').then((r) => r.data),
  subscribe: (plan: string) => api.post('/api/subscriptions/subscribe', { plan }).then((r) => r.data),
  cancel: () => api.delete('/api/subscriptions/cancel').then((r) => r.data),
};

// --- Reservations API ---

export const reservationsApi = {
  create: (bikeId: string, stationId: string) =>
    api.post('/api/reservations', { bikeId, stationId }).then((r) => r.data),
  cancel: (id: string) => api.delete(`/api/reservations/${id}`).then((r) => r.data),
  getActive: () => api.get('/api/reservations/active').then((r) => r.data),
};

export default api;
