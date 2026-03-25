/**
 * Frontend test setup & utilities
 *
 * Provides:
 * - jest-dom matchers
 * - Custom render with providers (Router, AuthContext)
 * - API mock utilities for axios
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// ─── Mock AuthContext ───────────────────────────────

export interface MockAuthUser {
  id: string;
  email: string;
  name: string;
  role: 'rider' | 'admin';
}

export interface MockAuthContextValue {
  user: MockAuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
  register: ReturnType<typeof vi.fn>;
}

export const TEST_USER: MockAuthUser = {
  id: 'user-001',
  email: 'test@example.com',
  name: 'Test User',
  role: 'rider',
};

export function createMockAuthContext(
  overrides: Partial<MockAuthContextValue> = {},
): MockAuthContextValue {
  return {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    ...overrides,
  };
}

export function createAuthenticatedContext(
  overrides: Partial<MockAuthContextValue> = {},
): MockAuthContextValue {
  return createMockAuthContext({
    user: TEST_USER,
    isAuthenticated: true,
    ...overrides,
  });
}

// ─── API Mock Utilities ─────────────────────────────

export function createAxiosMock() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() },
    },
    defaults: { baseURL: '' },
  };
}

export function mockApiResponse<T>(data: T, status = 200) {
  return Promise.resolve({ data, status, statusText: 'OK', headers: {}, config: {} });
}

export function mockApiError(status: number, message: string, code?: string) {
  const error = {
    response: {
      status,
      data: {
        success: false,
        error: { code: code ?? `ERR_${status}`, message },
      },
    },
    isAxiosError: true,
    message,
  };
  return Promise.reject(error);
}

// ─── Station Test Data ──────────────────────────────

export const TEST_STATIONS = [
  {
    id: 'station-001',
    name: 'Central Park Station',
    latitude: 40.785091,
    longitude: -73.968285,
    address: '100 Central Park West, New York',
    capacity: 20,
    availableBikes: 2,
  },
  {
    id: 'station-002',
    name: 'Times Square Station',
    latitude: 40.758896,
    longitude: -73.98513,
    address: 'Times Square, New York',
    capacity: 15,
    availableBikes: 1,
  },
  {
    id: 'station-003',
    name: 'Brooklyn Bridge Station',
    latitude: 40.706086,
    longitude: -73.996864,
    address: 'Brooklyn Bridge, New York',
    capacity: 10,
    availableBikes: 0,
  },
];
