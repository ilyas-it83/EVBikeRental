import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../components/ui/Toast';
import RideHistory from '../pages/RideHistory';
import { ridesApi } from '../lib/api';

vi.mock('../lib/api', () => ({
  default: {
    get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(),
    interceptors: { response: { use: vi.fn() } }, defaults: { baseURL: '' },
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

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'test@test.com', name: 'Test', role: 'rider' },
    isAuthenticated: true, isLoading: false,
    login: vi.fn(), register: vi.fn(), logout: vi.fn(),
  }),
}));

vi.mock('../hooks/useActiveRide', () => ({
  useActiveRide: () => ({ activeRide: null, isLoading: false }),
}));

const mockedRidesApi = vi.mocked(ridesApi);

function renderRideHistory() {
  return render(
    <MemoryRouter initialEntries={['/rides']}>
      <ToastProvider>
        <Routes>
          <Route path="/rides" element={<RideHistory />} />
          <Route path="/ride/:rideId/summary" element={<div>Ride Summary</div>} />
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('RideHistory Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner', () => {
    mockedRidesApi.list.mockReturnValue(new Promise(() => {}));
    renderRideHistory();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows empty state when no rides', async () => {
    mockedRidesApi.list.mockResolvedValue({
      rides: [],
      pagination: { page: 1, limit: 20, total: 0, pages: 0 },
    });

    renderRideHistory();
    await waitFor(() => {
      expect(screen.getByText(/no rides yet/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /find a station/i })).toBeInTheDocument();
  });

  it('renders list of rides', async () => {
    mockedRidesApi.list.mockResolvedValue({
      rides: [
        {
          id: 'r1', bikeId: 'b1', startStationId: 's1', endStationId: 's2',
          startTime: '2024-01-15T10:00:00Z', endTime: '2024-01-15T10:30:00Z',
          durationMinutes: 30, distanceKm: 5, cost: 5.50, status: 'completed',
          startStationName: 'Central Park', endStationName: 'Times Square',
          bike: { model: 'EV-Pro', batteryLevel: 70 },
        },
        {
          id: 'r2', bikeId: 'b2', startStationId: 's2', endStationId: 's3',
          startTime: '2024-01-14T14:00:00Z', endTime: '2024-01-14T14:15:00Z',
          durationMinutes: 15, distanceKm: 3, cost: 3.25, status: 'completed',
          startStationName: 'Times Square', endStationName: 'Brooklyn',
        },
      ],
      pagination: { page: 1, limit: 20, total: 2, pages: 1 },
    });

    renderRideHistory();
    await waitFor(() => {
      expect(screen.getByText('Ride History')).toBeInTheDocument();
    });
    expect(screen.getByText(/central park → times square/i)).toBeInTheDocument();
    expect(screen.getByText(/times square → brooklyn/i)).toBeInTheDocument();
    expect(screen.getByText('$5.50')).toBeInTheDocument();
    expect(screen.getByText('$3.25')).toBeInTheDocument();
  });

  it('shows Load More button when there are more pages', async () => {
    mockedRidesApi.list.mockResolvedValue({
      rides: [
        {
          id: 'r1', bikeId: 'b1', startStationId: 's1', endStationId: 's2',
          startTime: '2024-01-15T10:00:00Z', endTime: '2024-01-15T10:30:00Z',
          durationMinutes: 30, distanceKm: 5, cost: 5.50, status: 'completed',
          startStationName: 'CP', endStationName: 'TS',
        },
      ],
      pagination: { page: 1, limit: 20, total: 40, pages: 2 },
    });

    renderRideHistory();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
    });
  });

  it('loads more rides on clicking Load More', async () => {
    mockedRidesApi.list
      .mockResolvedValueOnce({
        rides: [
          { id: 'r1', bikeId: 'b1', startStationId: 's1', endStationId: 's2', startTime: '2024-01-15T10:00:00Z', endTime: '2024-01-15T10:30:00Z', durationMinutes: 30, distanceKm: 5, cost: 5.50, status: 'completed', startStationName: 'CP', endStationName: 'TS' },
        ],
        pagination: { page: 1, limit: 20, total: 40, pages: 2 },
      })
      .mockResolvedValueOnce({
        rides: [
          { id: 'r2', bikeId: 'b2', startStationId: 's2', endStationId: 's3', startTime: '2024-01-14T14:00:00Z', endTime: '2024-01-14T14:15:00Z', durationMinutes: 15, distanceKm: 3, cost: 3.25, status: 'completed', startStationName: 'TS', endStationName: 'BB' },
        ],
        pagination: { page: 2, limit: 20, total: 40, pages: 2 },
      });

    const user = userEvent.setup();
    renderRideHistory();
    await waitFor(() => expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /load more/i }));
    await waitFor(() => {
      expect(mockedRidesApi.list).toHaveBeenCalledWith(2, 20);
    });
  });

  it('expands ride card on click', async () => {
    mockedRidesApi.list.mockResolvedValue({
      rides: [
        {
          id: 'r1', bikeId: 'b1', startStationId: 's1', endStationId: 's2',
          startTime: '2024-01-15T10:00:00Z', endTime: '2024-01-15T10:30:00Z',
          durationMinutes: 30, distanceKm: 5, cost: 5.50, status: 'completed',
          startStationName: 'CP', endStationName: 'TS',
          bike: { model: 'EV-Pro', batteryLevel: 70 },
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    });

    const user = userEvent.setup();
    renderRideHistory();
    await waitFor(() => expect(screen.getByText(/cp → ts/i)).toBeInTheDocument());

    // Click to expand
    await user.click(screen.getByText(/cp → ts/i));
    await waitFor(() => {
      expect(screen.getByText(/duration/i)).toBeInTheDocument();
      expect(screen.getByText('30 min')).toBeInTheDocument();
      expect(screen.getByText('5.0 km')).toBeInTheDocument();
      expect(screen.getByText('EV-Pro')).toBeInTheDocument();
    });
  });

  it('shows cancelled status badge', async () => {
    mockedRidesApi.list.mockResolvedValue({
      rides: [
        {
          id: 'r1', bikeId: 'b1', startStationId: 's1', endStationId: null,
          startTime: '2024-01-15T10:00:00Z', endTime: null,
          durationMinutes: null, distanceKm: null, cost: null, status: 'cancelled',
          startStationName: 'CP', endStationName: 'End',
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    });

    renderRideHistory();
    await waitFor(() => {
      expect(screen.getByText('Cancelled')).toBeInTheDocument();
    });
  });

  it('navigates to ride details via View Details button', async () => {
    mockedRidesApi.list.mockResolvedValue({
      rides: [
        {
          id: 'r1', bikeId: 'b1', startStationId: 's1', endStationId: 's2',
          startTime: '2024-01-15T10:00:00Z', endTime: '2024-01-15T10:30:00Z',
          durationMinutes: 30, distanceKm: 5, cost: 5.50, status: 'completed',
          startStationName: 'CP', endStationName: 'TS',
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    });

    const user = userEvent.setup();
    renderRideHistory();
    await waitFor(() => expect(screen.getByText(/cp → ts/i)).toBeInTheDocument());

    // Expand first
    await user.click(screen.getByText(/cp → ts/i));
    await waitFor(() => expect(screen.getByRole('button', { name: /view details/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /view details/i }));
    await waitFor(() => expect(screen.getByText('Ride Summary')).toBeInTheDocument());
  });

  it('navigates to map from empty state', async () => {
    mockedRidesApi.list.mockResolvedValue({
      rides: [],
      pagination: { page: 1, limit: 20, total: 0, pages: 0 },
    });

    const user = userEvent.setup();
    renderRideHistory();
    await waitFor(() => expect(screen.getByText(/no rides yet/i)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /find a station/i }));
    await waitFor(() => expect(screen.getByText('Home Page')).toBeInTheDocument());
  });

  it('shows error toast on fetch failure', async () => {
    mockedRidesApi.list.mockRejectedValue(new Error('fail'));
    renderRideHistory();
    await waitFor(() => {
      expect(screen.getByText(/failed to load ride history/i)).toBeInTheDocument();
    });
  });

  it('formats hours in duration', async () => {
    mockedRidesApi.list.mockResolvedValue({
      rides: [
        {
          id: 'r1', bikeId: 'b1', startStationId: 's1', endStationId: 's2',
          startTime: '2024-01-15T10:00:00Z', endTime: '2024-01-15T12:00:00Z',
          durationMinutes: 120, distanceKm: 15, cost: 19.00, status: 'completed',
          startStationName: 'CP', endStationName: 'TS',
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    });

    const user = userEvent.setup();
    renderRideHistory();
    await waitFor(() => expect(screen.getByText(/cp → ts/i)).toBeInTheDocument());
    await user.click(screen.getByText(/cp → ts/i));
    await waitFor(() => expect(screen.getByText('2h')).toBeInTheDocument());
  });
});
