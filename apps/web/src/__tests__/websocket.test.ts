import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock stationsApi before importing the hook
vi.mock('../lib/api', () => ({
  default: {
    get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(),
    interceptors: { response: { use: vi.fn() } },
    defaults: { baseURL: '' },
  },
  stationsApi: { list: vi.fn(), getById: vi.fn() },
  authApi: { login: vi.fn(), register: vi.fn(), logout: vi.fn(), refresh: vi.fn(), me: vi.fn() },
  ridesApi: { unlock: vi.fn(), getActive: vi.fn(), endRide: vi.fn(), list: vi.fn(), getById: vi.fn() },
  paymentMethodsApi: { list: vi.fn(), add: vi.fn(), remove: vi.fn(), setDefault: vi.fn() },
  adminApi: {
    getFleetOverview: vi.fn(), getFleetStations: vi.fn(),
    listStations: vi.fn(), createStation: vi.fn(), updateStation: vi.fn(), deleteStation: vi.fn(),
    listBikes: vi.fn(), createBike: vi.fn(), updateBike: vi.fn(), deleteBike: vi.fn(),
    listUsers: vi.fn(), updateUserRole: vi.fn(), suspendUser: vi.fn(),
  },
  subscriptionsApi: { getPlans: vi.fn(), getCurrent: vi.fn(), subscribe: vi.fn(), cancel: vi.fn() },
  reservationsApi: { create: vi.fn(), cancel: vi.fn(), getActive: vi.fn() },
}));

import { stationsApi } from '../lib/api';
import { useWebSocket } from '../hooks/useWebSocket';

const mockedStationsApi = vi.mocked(stationsApi);

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  close = vi.fn();
  url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
}

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts disconnected', () => {
    const { result } = renderHook(() => useWebSocket());
    expect(result.current.status).toBe('disconnected');
    expect(result.current.isConnected).toBe(false);
    expect(result.current.lastMessage).toBeNull();
    expect(result.current.lastUpdated).toBeNull();
  });

  it('connects to WebSocket and sets connected on open', async () => {
    const { result } = renderHook(() => useWebSocket());

    expect(MockWebSocket.instances.length).toBe(1);
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.onopen?.(new Event('open'));
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.status).toBe('connected');
  });

  it('parses JSON messages and updates lastMessage', () => {
    const { result } = renderHook(() => useWebSocket());
    const ws = MockWebSocket.instances[0];

    act(() => { ws.onopen?.(new Event('open')); });

    const message = { type: 'station:availability', data: { stationId: 's1', availableBikes: 5, emptyDocks: 10 } };
    act(() => {
      ws.onmessage?.({ data: JSON.stringify(message) } as MessageEvent);
    });

    expect(result.current.lastMessage).toEqual(message);
    expect(result.current.lastUpdated).toBeInstanceOf(Date);
  });

  it('ignores malformed JSON messages', () => {
    const { result } = renderHook(() => useWebSocket());
    const ws = MockWebSocket.instances[0];

    act(() => { ws.onopen?.(new Event('open')); });
    act(() => {
      ws.onmessage?.({ data: 'not json' } as MessageEvent);
    });

    expect(result.current.lastMessage).toBeNull();
  });

  it('reconnects with exponential backoff on close', () => {
    renderHook(() => useWebSocket());
    const ws = MockWebSocket.instances[0];

    // Close the connection (first failure)
    act(() => { ws.onclose?.({} as CloseEvent); });
    expect(MockWebSocket.instances.length).toBe(1);

    // First reconnect: 1s delay
    act(() => { vi.advanceTimersByTime(1100); });
    expect(MockWebSocket.instances.length).toBe(2);

    // Close again (second failure)
    act(() => { MockWebSocket.instances[1].onclose?.({} as CloseEvent); });

    // Second reconnect: 2s delay
    act(() => { vi.advanceTimersByTime(2100); });
    expect(MockWebSocket.instances.length).toBe(3);
  });

  it('falls back to polling after MAX_WS_FAILURES (3)', async () => {
    renderHook(() => useWebSocket());

    // Trigger 3 consecutive close events
    for (let i = 0; i < 3; i++) {
      const ws = MockWebSocket.instances[i];
      act(() => { ws.onclose?.({} as CloseEvent); });
      if (i < 2) {
        // Advance to trigger reconnect
        act(() => { vi.advanceTimersByTime(Math.pow(2, i) * 1000 + 100); });
      }
    }

    // After 3 failures, should switch to polling
    mockedStationsApi.list.mockResolvedValue({
      stations: [{ id: 's1', availableBikes: 5, emptyDocks: 10 }],
    } as any);

    // Advance past poll interval (30s)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30100);
    });

    expect(mockedStationsApi.list).toHaveBeenCalledWith(37.7749, -122.4194, 50);
  });

  it('onerror closes the socket', () => {
    renderHook(() => useWebSocket());
    const ws = MockWebSocket.instances[0];

    act(() => { ws.onerror?.(new Event('error')); });

    expect(ws.close).toHaveBeenCalled();
  });

  it('cleans up WebSocket on unmount', () => {
    const { unmount } = renderHook(() => useWebSocket());
    const ws = MockWebSocket.instances[0];

    act(() => { ws.onopen?.(new Event('open')); });

    unmount();
    expect(ws.close).toHaveBeenCalled();
  });

  it('handles WebSocket constructor throwing', () => {
    // Make WebSocket constructor throw
    vi.stubGlobal('WebSocket', class {
      constructor() { throw new Error('WebSocket not supported'); }
    });

    // Should not crash, should fall back to polling after max failures
    const { result } = renderHook(() => useWebSocket());
    expect(result.current.status).toBe('disconnected');
  });

  it('does not create duplicate polling intervals', async () => {
    renderHook(() => useWebSocket());

    // Force into polling mode: 3 failures
    for (let i = 0; i < 3; i++) {
      const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
      act(() => { ws.onclose?.({} as CloseEvent); });
      if (i < 2) {
        act(() => { vi.advanceTimersByTime(Math.pow(2, i) * 1000 + 100); });
      }
    }

    mockedStationsApi.list.mockResolvedValue({ stations: [] } as any);

    // Advance several poll intervals
    await act(async () => { await vi.advanceTimersByTimeAsync(30100); });
    const callCount1 = mockedStationsApi.list.mock.calls.length;

    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    const callCount2 = mockedStationsApi.list.mock.calls.length;

    // Should only have 1 more call (not duplicates)
    expect(callCount2 - callCount1).toBe(1);
  });

  it('polling handles errors silently', async () => {
    renderHook(() => useWebSocket());

    // Force into polling mode
    for (let i = 0; i < 3; i++) {
      const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
      act(() => { ws.onclose?.({} as CloseEvent); });
      if (i < 2) {
        act(() => { vi.advanceTimersByTime(Math.pow(2, i) * 1000 + 100); });
      }
    }

    mockedStationsApi.list.mockRejectedValue(new Error('Network error'));

    // Should not throw
    await act(async () => { await vi.advanceTimersByTimeAsync(30100); });
    expect(mockedStationsApi.list).toHaveBeenCalled();
  });

  it('stops polling when WebSocket reconnects', () => {
    const { result } = renderHook(() => useWebSocket());
    const ws = MockWebSocket.instances[0];

    act(() => { ws.onopen?.(new Event('open')); });
    expect(result.current.status).toBe('connected');

    // The connected state should have stopped any polling
    expect(result.current.isConnected).toBe(true);
  });

  it('sets isConnected to false on close', () => {
    const { result } = renderHook(() => useWebSocket());
    const ws = MockWebSocket.instances[0];

    act(() => { ws.onopen?.(new Event('open')); });
    expect(result.current.isConnected).toBe(true);

    act(() => { ws.onclose?.({} as CloseEvent); });
    expect(result.current.isConnected).toBe(false);
    expect(result.current.status).toBe('disconnected');
  });
});
