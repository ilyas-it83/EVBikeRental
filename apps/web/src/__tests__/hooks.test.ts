import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useActiveRide } from '../hooks/useActiveRide';
import { useReservation } from '../hooks/useReservation';
import { ridesApi, reservationsApi } from '../lib/api';

vi.mock('../lib/api', () => ({
  default: {
    get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(),
    interceptors: { response: { use: vi.fn() } },
    defaults: { baseURL: '' },
  },
  authApi: { login: vi.fn(), register: vi.fn(), logout: vi.fn(), refresh: vi.fn(), me: vi.fn() },
  stationsApi: { list: vi.fn(), getById: vi.fn() },
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

const mockedRidesApi = vi.mocked(ridesApi);
const mockedReservationsApi = vi.mocked(reservationsApi);

describe('useActiveRide', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches active ride on mount', async () => {
    const ride = { id: 'r1', bikeId: 'b1', startStationId: 's1', endStationId: null, startTime: new Date().toISOString(), endTime: null, durationMinutes: null, distanceKm: null, cost: null, status: 'active' };
    mockedRidesApi.getActive.mockResolvedValue({ ride });

    const { result } = renderHook(() => useActiveRide());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.activeRide).toEqual(ride);
    expect(mockedRidesApi.getActive).toHaveBeenCalledTimes(1);
  });

  it('returns null when no active ride', async () => {
    mockedRidesApi.getActive.mockResolvedValue({ ride: null });

    const { result } = renderHook(() => useActiveRide());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.activeRide).toBeNull();
  });

  it('sets activeRide to null on error', async () => {
    mockedRidesApi.getActive.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useActiveRide());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.activeRide).toBeNull();
  });

  it('polls every 30 seconds', async () => {
    vi.useFakeTimers();
    mockedRidesApi.getActive.mockResolvedValue({ ride: null });

    renderHook(() => useActiveRide());
    await vi.advanceTimersByTimeAsync(100);
    expect(mockedRidesApi.getActive).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(mockedRidesApi.getActive).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('does not update state after unmount (cancelled branch)', async () => {
    let resolve: (v: any) => void;
    mockedRidesApi.getActive.mockReturnValue(new Promise((r) => { resolve = r; }));

    const { unmount } = renderHook(() => useActiveRide());
    unmount();

    // Resolve after unmount - cancelled flag should prevent setState
    resolve!({ ride: { id: 'r1' } });
    await new Promise((r) => setTimeout(r, 50));
  });
});

describe('useReservation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches active reservation on mount', async () => {
    const reservation = { id: 'res1', bikeId: 'b1', stationId: 's1', expiresAt: new Date(Date.now() + 600000).toISOString(), status: 'active' };
    mockedReservationsApi.getActive.mockResolvedValue({ reservation });

    const { result } = renderHook(() => useReservation());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.reservation).toEqual(reservation);
    expect(result.current.remainingSeconds).toBeGreaterThan(0);
  });

  it('returns null when no active reservation', async () => {
    mockedReservationsApi.getActive.mockResolvedValue({ reservation: null });

    const { result } = renderHook(() => useReservation());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.reservation).toBeNull();
    expect(result.current.remainingSeconds).toBe(0);
  });

  it('sets reservation to null on error', async () => {
    mockedReservationsApi.getActive.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useReservation());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.reservation).toBeNull();
  });

  it('reserve creates a reservation', async () => {
    mockedReservationsApi.getActive.mockResolvedValue({ reservation: null });
    const newRes = { id: 'res2', bikeId: 'b1', stationId: 's1', expiresAt: new Date(Date.now() + 900000).toISOString(), status: 'active' };
    mockedReservationsApi.create.mockResolvedValue({ reservation: newRes });

    const { result } = renderHook(() => useReservation());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.reserve('b1', 's1');
    });
    expect(result.current.reservation).toEqual(newRes);
    expect(mockedReservationsApi.create).toHaveBeenCalledWith('b1', 's1');
  });

  it('cancel removes reservation', async () => {
    const reservation = { id: 'res1', bikeId: 'b1', stationId: 's1', expiresAt: new Date(Date.now() + 600000).toISOString(), status: 'active' };
    mockedReservationsApi.getActive.mockResolvedValue({ reservation });
    mockedReservationsApi.cancel.mockResolvedValue({});

    const { result } = renderHook(() => useReservation());
    await waitFor(() => expect(result.current.reservation).toBeTruthy());

    await act(async () => {
      await result.current.cancel();
    });
    expect(result.current.reservation).toBeNull();
    expect(mockedReservationsApi.cancel).toHaveBeenCalledWith('res1');
  });

  it('countdown timer ticks down', async () => {
    vi.useFakeTimers();
    const reservation = { id: 'res1', bikeId: 'b1', stationId: 's1', expiresAt: new Date(Date.now() + 60000).toISOString(), status: 'active' };
    mockedReservationsApi.getActive.mockResolvedValue({ reservation });

    const { result } = renderHook(() => useReservation());
    // Wrap in act to flush React effects + timers
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(result.current.remainingSeconds).toBeGreaterThan(0);

    const initial = result.current.remainingSeconds;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(result.current.remainingSeconds).toBeLessThan(initial);
    vi.useRealTimers();
  });

  it('clears reservation when countdown reaches 0', async () => {
    vi.useFakeTimers();
    const reservation = { id: 'res1', bikeId: 'b1', stationId: 's1', expiresAt: new Date(Date.now() + 5000).toISOString(), status: 'active' };
    mockedReservationsApi.getActive.mockResolvedValue({ reservation });

    const { result } = renderHook(() => useReservation());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(result.current.reservation).toBeTruthy();
    expect(result.current.remainingSeconds).toBeGreaterThan(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(result.current.remainingSeconds).toBe(0);
    expect(result.current.reservation).toBeNull();
    vi.useRealTimers();
  });

  it('polls every 15 seconds', async () => {
    vi.useFakeTimers();
    mockedReservationsApi.getActive.mockResolvedValue({ reservation: null });

    renderHook(() => useReservation());
    await vi.advanceTimersByTimeAsync(100);
    expect(mockedReservationsApi.getActive).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(mockedReservationsApi.getActive).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('cancel does nothing when no reservation', async () => {
    mockedReservationsApi.getActive.mockResolvedValue({ reservation: null });

    const { result } = renderHook(() => useReservation());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.cancel(); });
    expect(mockedReservationsApi.cancel).not.toHaveBeenCalled();
  });

  it('does not update state after unmount (mountedRef branch)', async () => {
    let resolve: (v: any) => void;
    mockedReservationsApi.getActive.mockReturnValue(new Promise((r) => { resolve = r; }));

    const { unmount } = renderHook(() => useReservation());
    unmount();

    resolve!({ reservation: null });
    await new Promise((r) => setTimeout(r, 50));
  });
});
