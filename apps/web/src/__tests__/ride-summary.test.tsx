import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../components/ui/Toast';
import RideSummary from '../pages/RideSummary';
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

function renderRideSummary(rideId = 'ride-001') {
  return render(
    <MemoryRouter initialEntries={[`/ride/${rideId}/summary`]}>
      <ToastProvider>
        <Routes>
          <Route path="/ride/:rideId/summary" element={<RideSummary />} />
          <Route path="/" element={<div>Home Page</div>} />
          <Route path="/rides" element={<div>Ride History</div>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('RideSummary Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner', () => {
    mockedRidesApi.getById.mockReturnValue(new Promise(() => {}));
    renderRideSummary();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows ride not found when ride is null', async () => {
    mockedRidesApi.getById.mockRejectedValue(new Error('Not found'));
    renderRideSummary();
    await waitFor(() => {
      expect(screen.getByText(/ride not found/i)).toBeInTheDocument();
    });
  });

  it('renders ride summary with all details', async () => {
    mockedRidesApi.getById.mockResolvedValue({
      ride: {
        id: 'ride-001', bikeId: 'b1', startStationId: 's1', endStationId: 's2',
        startTime: '2024-01-01T10:00:00Z', endTime: '2024-01-01T10:30:00Z',
        durationMinutes: 30, distanceKm: 5.2, cost: 5.50, status: 'completed',
        startStationName: 'Central Park', endStationName: 'Times Square',
        bike: { model: 'EV-Pro', batteryLevel: 70 },
        payment: { id: 'p1', amount: 5.50, status: 'captured', createdAt: '2024-01-01T10:30:00Z' },
      },
    });

    renderRideSummary();
    await waitFor(() => expect(screen.getByText('Ride Summary')).toBeInTheDocument());

    expect(screen.getByText('Central Park')).toBeInTheDocument();
    expect(screen.getByText('Times Square')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText(/💳 Paid/)).toBeInTheDocument();
    expect(screen.getAllByText(/30 min/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/5\.2 km/)).toBeInTheDocument();
    expect(screen.getByText(/EV-Pro/)).toBeInTheDocument();
  });

  it('shows cost breakdown', async () => {
    mockedRidesApi.getById.mockResolvedValue({
      ride: {
        id: 'ride-001', bikeId: 'b1', startStationId: 's1', endStationId: 's2',
        startTime: '2024-01-01T10:00:00Z', endTime: '2024-01-01T10:30:00Z',
        durationMinutes: 30, distanceKm: 5.2, cost: 5.50, status: 'completed',
        startStationName: 'CP', endStationName: 'TS',
      },
    });

    renderRideSummary();
    await waitFor(() => expect(screen.getByText('Cost Breakdown')).toBeInTheDocument());
    expect(screen.getByText('$1.00')).toBeInTheDocument();
    expect(screen.getByText('$4.50')).toBeInTheDocument(); // 30 * 0.15
    expect(screen.getByText('$5.50')).toBeInTheDocument();
  });

  it('navigates to map on "Back to Map" click', async () => {
    mockedRidesApi.getById.mockResolvedValue({
      ride: {
        id: 'ride-001', bikeId: 'b1', startStationId: 's1', endStationId: 's2',
        startTime: '2024-01-01T10:00:00Z', endTime: '2024-01-01T10:30:00Z',
        durationMinutes: 10, distanceKm: 2, cost: 2.50, status: 'completed',
        startStationName: 'CP', endStationName: 'TS',
      },
    });

    const user = userEvent.setup();
    renderRideSummary();
    await waitFor(() => expect(screen.getByText('Ride Summary')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /back to map/i }));
    await waitFor(() => {
      expect(screen.getByText('Home Page')).toBeInTheDocument();
    });
  });

  it('navigates to history on "View History" click', async () => {
    mockedRidesApi.getById.mockResolvedValue({
      ride: {
        id: 'ride-001', bikeId: 'b1', startStationId: 's1', endStationId: 's2',
        startTime: '2024-01-01T10:00:00Z', endTime: '2024-01-01T10:30:00Z',
        durationMinutes: 10, distanceKm: 2, cost: 2.50, status: 'completed',
        startStationName: 'CP', endStationName: 'TS',
      },
    });

    const user = userEvent.setup();
    renderRideSummary();
    await waitFor(() => expect(screen.getByText('Ride Summary')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /view history/i }));
    await waitFor(() => {
      expect(screen.getByText('Ride History')).toBeInTheDocument();
    });
  });

  it('shows active status badge', async () => {
    mockedRidesApi.getById.mockResolvedValue({
      ride: {
        id: 'r1', bikeId: 'b1', startStationId: 's1', endStationId: null,
        startTime: '2024-01-01T10:00:00Z', endTime: null,
        durationMinutes: null, distanceKm: null, cost: null, status: 'active',
        startStationName: 'CP',
      },
    });

    renderRideSummary('r1');
    await waitFor(() => expect(screen.getByText('Active')).toBeInTheDocument());
  });

  it('shows fallback duration display for null minutes', async () => {
    mockedRidesApi.getById.mockResolvedValue({
      ride: {
        id: 'r1', bikeId: 'b1', startStationId: 's1', endStationId: null,
        startTime: '2024-01-01T10:00:00Z', endTime: null,
        durationMinutes: null, distanceKm: null, cost: null, status: 'active',
        startStationName: 'CP', endStationName: null,
      },
    });

    renderRideSummary('r1');
    await waitFor(() => expect(screen.getByText('—')).toBeInTheDocument());
  });

  it('renders back to map from not-found state', async () => {
    mockedRidesApi.getById.mockRejectedValue(new Error('fail'));

    const user = userEvent.setup();
    renderRideSummary();
    await waitFor(() => expect(screen.getByText(/ride not found/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /back to map/i }));
    await waitFor(() => expect(screen.getByText('Home Page')).toBeInTheDocument());
  });

  it('formats hours correctly', async () => {
    mockedRidesApi.getById.mockResolvedValue({
      ride: {
        id: 'r1', bikeId: 'b1', startStationId: 's1', endStationId: 's2',
        startTime: '2024-01-01T10:00:00Z', endTime: '2024-01-01T12:00:00Z',
        durationMinutes: 120, distanceKm: 10, cost: 19.00, status: 'completed',
        startStationName: 'CP', endStationName: 'TS',
      },
    });

    renderRideSummary('r1');
    await waitFor(() => expect(screen.getByText(/2h/)).toBeInTheDocument());
  });
});
