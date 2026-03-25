import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so these are available when vi.mock factory runs (hoisted to top)
const { mockInstance, mockCallable } = vi.hoisted(() => {
  const mockCallable = vi.fn();
  const mockInstance: Record<string, any> = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      response: { use: vi.fn() },
    },
    defaults: { baseURL: 'http://localhost:3000' },
  };
  return { mockInstance, mockCallable };
});

vi.mock('axios', () => {
  const callable = (...args: any[]) => mockCallable(...args);
  Object.assign(callable, mockInstance);
  return {
    default: {
      create: vi.fn(() => {
        Object.assign(callable, mockInstance);
        return callable;
      }),
      post: vi.fn(),
    },
  };
});

// Import AFTER mock setup (the module calls axios.create at top level)
import {
  authApi,
  stationsApi,
  ridesApi,
  paymentMethodsApi,
  adminApi,
  subscriptionsApi,
  reservationsApi,
} from '../lib/api';
import axios from 'axios';

// Capture interceptor handlers that were registered at module load (before clearAllMocks wipes them)
const [interceptorOnFulfilled, interceptorOnRejected] = mockInstance.interceptors.response.use.mock.calls[0] || [];

describe('API module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authApi', () => {
    it('login calls POST /api/auth/login', async () => {
      mockInstance.post.mockResolvedValue({ data: { user: { id: '1' } } });
      const result = await authApi.login({ email: 'a@b.com', password: 'pass' });
      expect(mockInstance.post).toHaveBeenCalledWith('/api/auth/login', { email: 'a@b.com', password: 'pass' });
      expect(result).toEqual({ user: { id: '1' } });
    });

    it('register calls POST /api/auth/register', async () => {
      mockInstance.post.mockResolvedValue({ data: { user: { id: '1' } } });
      await authApi.register({ email: 'a@b.com', password: 'pass', name: 'Test' });
      expect(mockInstance.post).toHaveBeenCalledWith('/api/auth/register', { email: 'a@b.com', password: 'pass', name: 'Test' });
    });

    it('logout calls POST /api/auth/logout', async () => {
      mockInstance.post.mockResolvedValue({ data: {} });
      await authApi.logout();
      expect(mockInstance.post).toHaveBeenCalledWith('/api/auth/logout');
    });

    it('refresh calls POST /api/auth/refresh', async () => {
      mockInstance.post.mockResolvedValue({ data: {} });
      await authApi.refresh();
      expect(mockInstance.post).toHaveBeenCalledWith('/api/auth/refresh');
    });

    it('me calls GET /api/auth/me', async () => {
      mockInstance.get.mockResolvedValue({ data: { user: { id: '1' } } });
      const result = await authApi.me();
      expect(mockInstance.get).toHaveBeenCalledWith('/api/auth/me');
      expect(result).toEqual({ user: { id: '1' } });
    });
  });

  describe('stationsApi', () => {
    it('list calls GET /api/stations with params', async () => {
      mockInstance.get.mockResolvedValue({ data: { stations: [] } });
      const result = await stationsApi.list(37.7, -122.4, 10);
      expect(mockInstance.get).toHaveBeenCalledWith('/api/stations', { params: { lat: 37.7, lng: -122.4, radius: 10 } });
      expect(result).toEqual({ stations: [] });
    });

    it('getById calls GET /api/stations/:id', async () => {
      mockInstance.get.mockResolvedValue({ data: { station: { id: 's1' } } });
      await stationsApi.getById('s1');
      expect(mockInstance.get).toHaveBeenCalledWith('/api/stations/s1');
    });
  });

  describe('ridesApi', () => {
    it('unlock calls POST /api/rides/unlock', async () => {
      mockInstance.post.mockResolvedValue({ data: { ride: { id: 'r1' } } });
      await ridesApi.unlock('b1', 's1');
      expect(mockInstance.post).toHaveBeenCalledWith('/api/rides/unlock', { bikeId: 'b1', stationId: 's1' });
    });

    it('getActive calls GET /api/rides/active', async () => {
      mockInstance.get.mockResolvedValue({ data: { ride: null } });
      await ridesApi.getActive();
      expect(mockInstance.get).toHaveBeenCalledWith('/api/rides/active');
    });

    it('endRide calls POST /api/rides/:id/end', async () => {
      mockInstance.post.mockResolvedValue({ data: { ride: { id: 'r1' }, payment: { id: 'p1' } } });
      await ridesApi.endRide('r1', 's2');
      expect(mockInstance.post).toHaveBeenCalledWith('/api/rides/r1/end', { endStationId: 's2' });
    });

    it('list calls GET /api/rides with pagination', async () => {
      mockInstance.get.mockResolvedValue({ data: { rides: [], pagination: {} } });
      await ridesApi.list(2, 10);
      expect(mockInstance.get).toHaveBeenCalledWith('/api/rides', { params: { page: 2, limit: 10 } });
    });

    it('list uses defaults for page and limit', async () => {
      mockInstance.get.mockResolvedValue({ data: { rides: [], pagination: {} } });
      await ridesApi.list();
      expect(mockInstance.get).toHaveBeenCalledWith('/api/rides', { params: { page: 1, limit: 20 } });
    });

    it('getById calls GET /api/rides/:id', async () => {
      mockInstance.get.mockResolvedValue({ data: { ride: { id: 'r1' } } });
      await ridesApi.getById('r1');
      expect(mockInstance.get).toHaveBeenCalledWith('/api/rides/r1');
    });
  });

  describe('paymentMethodsApi', () => {
    it('list calls GET /api/payment-methods', async () => {
      mockInstance.get.mockResolvedValue({ data: { paymentMethods: [] } });
      await paymentMethodsApi.list();
      expect(mockInstance.get).toHaveBeenCalledWith('/api/payment-methods');
    });

    it('add calls POST /api/payment-methods', async () => {
      mockInstance.post.mockResolvedValue({ data: { paymentMethod: { id: 'pm1' } } });
      await paymentMethodsApi.add({ last4: '1234', brand: 'Visa', expiryMonth: 12, expiryYear: 2026 });
      expect(mockInstance.post).toHaveBeenCalledWith('/api/payment-methods', { last4: '1234', brand: 'Visa', expiryMonth: 12, expiryYear: 2026 });
    });

    it('remove calls DELETE /api/payment-methods/:id', async () => {
      mockInstance.delete.mockResolvedValue({ data: {} });
      await paymentMethodsApi.remove('pm1');
      expect(mockInstance.delete).toHaveBeenCalledWith('/api/payment-methods/pm1');
    });

    it('setDefault calls PUT /api/payment-methods/:id/default', async () => {
      mockInstance.put.mockResolvedValue({ data: { paymentMethod: { id: 'pm1' } } });
      await paymentMethodsApi.setDefault('pm1');
      expect(mockInstance.put).toHaveBeenCalledWith('/api/payment-methods/pm1/default');
    });
  });

  describe('adminApi', () => {
    it('getFleetOverview calls GET /api/admin/fleet/overview', async () => {
      mockInstance.get.mockResolvedValue({ data: { overview: {} } });
      await adminApi.getFleetOverview();
      expect(mockInstance.get).toHaveBeenCalledWith('/api/admin/fleet/overview');
    });

    it('getFleetStations calls GET /api/admin/fleet/stations', async () => {
      mockInstance.get.mockResolvedValue({ data: { stations: [] } });
      await adminApi.getFleetStations();
      expect(mockInstance.get).toHaveBeenCalledWith('/api/admin/fleet/stations');
    });

    it('listStations calls GET /api/admin/stations', async () => {
      mockInstance.get.mockResolvedValue({ data: { stations: [] } });
      await adminApi.listStations();
      expect(mockInstance.get).toHaveBeenCalledWith('/api/admin/stations');
    });

    it('createStation calls POST /api/admin/stations', async () => {
      const data = { name: 'S', address: 'A', lat: 40, lng: -73, dockCapacity: 20 };
      mockInstance.post.mockResolvedValue({ data: { station: { id: 's1' } } });
      await adminApi.createStation(data);
      expect(mockInstance.post).toHaveBeenCalledWith('/api/admin/stations', data);
    });

    it('updateStation calls PUT /api/admin/stations/:id', async () => {
      mockInstance.put.mockResolvedValue({ data: { station: { id: 's1' } } });
      await adminApi.updateStation('s1', { name: 'Updated' });
      expect(mockInstance.put).toHaveBeenCalledWith('/api/admin/stations/s1', { name: 'Updated' });
    });

    it('deleteStation calls DELETE /api/admin/stations/:id', async () => {
      mockInstance.delete.mockResolvedValue({ data: {} });
      await adminApi.deleteStation('s1');
      expect(mockInstance.delete).toHaveBeenCalledWith('/api/admin/stations/s1');
    });

    it('listBikes calls GET /api/admin/bikes', async () => {
      mockInstance.get.mockResolvedValue({ data: { bikes: [] } });
      await adminApi.listBikes({ stationId: 's1', status: 'available' });
      expect(mockInstance.get).toHaveBeenCalledWith('/api/admin/bikes', { params: { stationId: 's1', status: 'available' } });
    });

    it('createBike calls POST /api/admin/bikes', async () => {
      const data = { serialNumber: 'SN', model: 'M', stationId: 's1', batteryLevel: 100 };
      mockInstance.post.mockResolvedValue({ data: { bike: { id: 'b1' } } });
      await adminApi.createBike(data);
      expect(mockInstance.post).toHaveBeenCalledWith('/api/admin/bikes', data);
    });

    it('updateBike calls PUT /api/admin/bikes/:id', async () => {
      mockInstance.put.mockResolvedValue({ data: { bike: { id: 'b1' } } });
      await adminApi.updateBike('b1', { model: 'Updated' });
      expect(mockInstance.put).toHaveBeenCalledWith('/api/admin/bikes/b1', { model: 'Updated' });
    });

    it('deleteBike calls DELETE /api/admin/bikes/:id', async () => {
      mockInstance.delete.mockResolvedValue({ data: {} });
      await adminApi.deleteBike('b1');
      expect(mockInstance.delete).toHaveBeenCalledWith('/api/admin/bikes/b1');
    });

    it('listUsers calls GET /api/admin/users', async () => {
      mockInstance.get.mockResolvedValue({ data: { users: [] } });
      await adminApi.listUsers(2, 10);
      expect(mockInstance.get).toHaveBeenCalledWith('/api/admin/users', { params: { page: 2, limit: 10 } });
    });

    it('listUsers uses defaults', async () => {
      mockInstance.get.mockResolvedValue({ data: { users: [] } });
      await adminApi.listUsers();
      expect(mockInstance.get).toHaveBeenCalledWith('/api/admin/users', { params: { page: 1, limit: 20 } });
    });

    it('updateUserRole calls PUT /api/admin/users/:id/role', async () => {
      mockInstance.put.mockResolvedValue({ data: { user: { id: 'u1' } } });
      await adminApi.updateUserRole('u1', 'admin');
      expect(mockInstance.put).toHaveBeenCalledWith('/api/admin/users/u1/role', { role: 'admin' });
    });

    it('suspendUser calls PUT /api/admin/users/:id/suspend', async () => {
      mockInstance.put.mockResolvedValue({ data: { user: { id: 'u1' } } });
      await adminApi.suspendUser('u1');
      expect(mockInstance.put).toHaveBeenCalledWith('/api/admin/users/u1/suspend');
    });
  });

  describe('subscriptionsApi', () => {
    it('getPlans calls GET /api/subscriptions/plans', async () => {
      mockInstance.get.mockResolvedValue({ data: { plans: [] } });
      await subscriptionsApi.getPlans();
      expect(mockInstance.get).toHaveBeenCalledWith('/api/subscriptions/plans');
    });

    it('getCurrent calls GET /api/subscriptions/current', async () => {
      mockInstance.get.mockResolvedValue({ data: { subscription: null } });
      await subscriptionsApi.getCurrent();
      expect(mockInstance.get).toHaveBeenCalledWith('/api/subscriptions/current');
    });

    it('subscribe calls POST /api/subscriptions/subscribe', async () => {
      mockInstance.post.mockResolvedValue({ data: { subscription: { id: 'sub1' } } });
      await subscriptionsApi.subscribe('pro');
      expect(mockInstance.post).toHaveBeenCalledWith('/api/subscriptions/subscribe', { plan: 'pro' });
    });

    it('cancel calls DELETE /api/subscriptions/cancel', async () => {
      mockInstance.delete.mockResolvedValue({ data: {} });
      await subscriptionsApi.cancel();
      expect(mockInstance.delete).toHaveBeenCalledWith('/api/subscriptions/cancel');
    });
  });

  describe('reservationsApi', () => {
    it('create calls POST /api/reservations', async () => {
      mockInstance.post.mockResolvedValue({ data: { reservation: { id: 'r1' } } });
      await reservationsApi.create('b1', 's1');
      expect(mockInstance.post).toHaveBeenCalledWith('/api/reservations', { bikeId: 'b1', stationId: 's1' });
    });

    it('cancel calls DELETE /api/reservations/:id', async () => {
      mockInstance.delete.mockResolvedValue({ data: {} });
      await reservationsApi.cancel('r1');
      expect(mockInstance.delete).toHaveBeenCalledWith('/api/reservations/r1');
    });

    it('getActive calls GET /api/reservations/active', async () => {
      mockInstance.get.mockResolvedValue({ data: { reservation: null } });
      await reservationsApi.getActive();
      expect(mockInstance.get).toHaveBeenCalledWith('/api/reservations/active');
    });
  });

  describe('interceptor', () => {
    it('registers a response interceptor', () => {
      expect(interceptorOnFulfilled).toBeTypeOf('function');
      expect(interceptorOnRejected).toBeTypeOf('function');
    });

    it('passes through successful responses', () => {
      const response = { data: 'ok', status: 200 };
      expect(interceptorOnFulfilled(response)).toBe(response);
    });

    it('rejects non-401 errors', async () => {
      const error = { response: { status: 500 }, config: { url: '/api/test' } };
      await expect(interceptorOnRejected(error)).rejects.toBe(error);
    });

    it('rejects 401 on refresh endpoint', async () => {
      const error = { response: { status: 401 }, config: { url: '/api/auth/refresh' } };
      await expect(interceptorOnRejected(error)).rejects.toBe(error);
    });

    it('rejects 401 on login endpoint', async () => {
      const error = { response: { status: 401 }, config: { url: '/api/auth/login' } };
      await expect(interceptorOnRejected(error)).rejects.toBe(error);
    });

    it('rejects errors without config', async () => {
      const error = { response: { status: 401 } };
      await expect(interceptorOnRejected(error)).rejects.toBe(error);
    });

    it('refreshes token and retries on 401', async () => {
      const originalConfig = { url: '/api/rides/active', headers: {} };
      const error = { response: { status: 401 }, config: originalConfig };

      vi.mocked(axios.post).mockResolvedValueOnce({ data: {} });
      mockCallable.mockResolvedValueOnce({ data: { ride: null } });

      const result = await interceptorOnRejected(error);
      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:3000/api/auth/refresh',
        {},
        { withCredentials: true },
      );
      expect(mockCallable).toHaveBeenCalledWith(originalConfig);
      expect(result).toEqual({ data: { ride: null } });
    });

    it('redirects to /login when refresh fails', async () => {
      const originalConfig = { url: '/api/rides/active', headers: {} };
      const error = { response: { status: 401 }, config: originalConfig };
      const refreshError = new Error('Refresh failed');

      vi.mocked(axios.post).mockRejectedValueOnce(refreshError);

      const originalHref = window.location.href;
      Object.defineProperty(window, 'location', {
        value: { href: originalHref },
        writable: true,
      });

      await expect(interceptorOnRejected(error)).rejects.toBe(refreshError);
      expect(window.location.href).toBe('/login');
    });

    it('queues concurrent 401 requests and processes after refresh', async () => {
      // Simulate concurrent 401s: first request triggers refresh, second gets queued
      let resolveRefresh: (v: any) => void;
      const refreshPromise = new Promise((r) => { resolveRefresh = r; });
      vi.mocked(axios.post).mockReturnValueOnce(refreshPromise as any);

      const config1 = { url: '/api/rides/active', headers: {} };
      const config2 = { url: '/api/stations', headers: {} };
      const error1 = { response: { status: 401 }, config: config1 };
      const error2 = { response: { status: 401 }, config: config2 };

      // First 401 triggers refresh
      const promise1 = interceptorOnRejected(error1);
      // Second 401 should be queued (isRefreshing = true)
      const promise2 = interceptorOnRejected(error2);

      // Resolve the refresh - processQueue runs first, then original request
      mockCallable.mockResolvedValueOnce({ data: { stations: [] } }); // queue: config2
      mockCallable.mockResolvedValueOnce({ data: { ride: null } }); // original: config1
      resolveRefresh!({ data: {} });

      const result1 = await promise1;
      const result2 = await promise2;
      expect(result1).toEqual({ data: { ride: null } });
      expect(result2).toEqual({ data: { stations: [] } });
    });

    it('rejects queued requests when refresh fails', async () => {
      let rejectRefresh: (e: any) => void;
      const refreshPromise = new Promise((_, rej) => { rejectRefresh = rej; });
      vi.mocked(axios.post).mockReturnValueOnce(refreshPromise as any);

      const config1 = { url: '/api/rides/active', headers: {} };
      const config2 = { url: '/api/stations', headers: {} };
      const error1 = { response: { status: 401 }, config: config1 };
      const error2 = { response: { status: 401 }, config: config2 };

      const originalHref = window.location.href;
      Object.defineProperty(window, 'location', {
        value: { href: originalHref },
        writable: true,
      });

      const promise1 = interceptorOnRejected(error1);
      const promise2 = interceptorOnRejected(error2);

      const refreshError = new Error('Refresh failed');
      rejectRefresh!(refreshError);

      await expect(promise1).rejects.toBe(refreshError);
      await expect(promise2).rejects.toBe(refreshError);
    });
  });
});
