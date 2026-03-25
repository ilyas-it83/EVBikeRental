import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../components/ui/Toast';
import ActiveRide from '../pages/ActiveRide';
import { ridesApi, stationsApi } from '../lib/api';

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
const mockedStationsApi = vi.mocked(stationsApi);

function renderActiveRide() {
  return render(
    <MemoryRouter initialEntries={['/ride/active']}>
      <ToastProvider>
        <Routes>
          <Route path="/ride/active" element={<ActiveRide />} />
          <Route path="/ride/:rideId/summary" element={<div>Ride Summary</div>} />
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('ActiveRide Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner initially', () => {
    mockedRidesApi.getActive.mockReturnValue(new Promise(() => {}));
    renderActiveRide();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('redirects home when no active ride', async () => {
    mockedRidesApi.getActive.mockResolvedValue({ ride: null });
    renderActiveRide();
    await waitFor(() => {
      expect(screen.getByText('Home Page')).toBeInTheDocument();
    });
  });

  it('redirects home on fetch error', async () => {
    mockedRidesApi.getActive.mockRejectedValue(new Error('fail'));
    renderActiveRide();
    await waitFor(() => {
      expect(screen.getByText('Home Page')).toBeInTheDocument();
    });
  });

  it('shows active ride info', async () => {
    mockedRidesApi.getActive.mockResolvedValue({
      ride: {
        id: 'r1', bikeId: 'b1', startStationId: 's1', endStationId: null,
        startTime: new Date(Date.now() - 300000).toISOString(), endTime: null,
        durationMinutes: null, distanceKm: null, cost: null, status: 'active',
        startStationName: 'Central Park', bike: { model: 'EV-Pro', batteryLevel: 80 },
      },
    });

    renderActiveRide();
    await waitFor(() => {
      expect(screen.getByText('Active Ride')).toBeInTheDocument();
    });
    expect(screen.getByText('EV-Pro')).toBeInTheDocument();
    expect(screen.getByText(/central park/i)).toBeInTheDocument();
    expect(screen.getByText('🔋 80%')).toBeInTheDocument();
    expect(screen.getByText(/duration/i)).toBeInTheDocument();
    expect(screen.getByText(/est\. cost/i)).toBeInTheDocument();
  });

  it('shows end ride button', async () => {
    mockedRidesApi.getActive.mockResolvedValue({
      ride: {
        id: 'r1', bikeId: 'b1', startStationId: 's1', endStationId: null,
        startTime: new Date().toISOString(), endTime: null,
        durationMinutes: null, distanceKm: null, cost: null, status: 'active',
        startStationName: 'Central Park', bike: { model: 'EV-Pro', batteryLevel: 80 },
      },
    });

    renderActiveRide();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /end ride/i })).toBeInTheDocument();
    });
  });

  it('shows station selector when ending ride', async () => {
    mockedRidesApi.getActive.mockResolvedValue({
      ride: {
        id: 'r1', bikeId: 'b1', startStationId: 's1', endStationId: null,
        startTime: new Date().toISOString(), endTime: null,
        durationMinutes: null, distanceKm: null, cost: null, status: 'active',
        startStationName: 'Central Park',
      },
    });
    mockedStationsApi.list.mockResolvedValue({
      stations: [
        { id: 's1', name: 'Central Park', address: '100 CP', lat: 40.7, lng: -73.9, availableBikes: 5, emptyDocks: 10, distance: 0.5 },
        { id: 's2', name: 'Times Square', address: 'TS', lat: 40.7, lng: -73.9, availableBikes: 3, emptyDocks: 7, distance: 1.0 },
      ],
    });

    const user = userEvent.setup();
    renderActiveRide();
    await waitFor(() => expect(screen.getByRole('button', { name: /end ride/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /end ride/i }));
    await waitFor(() => {
      expect(screen.getByText(/select return station/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('ends ride and navigates to summary', async () => {
    mockedRidesApi.getActive.mockResolvedValue({
      ride: {
        id: 'ride-123', bikeId: 'b1', startStationId: 's1', endStationId: null,
        startTime: new Date().toISOString(), endTime: null,
        durationMinutes: null, distanceKm: null, cost: null, status: 'active',
        startStationName: 'Central Park',
      },
    });
    mockedStationsApi.list.mockResolvedValue({
      stations: [
        { id: 's1', name: 'Central Park', address: '100 CP', lat: 40.7, lng: -73.9, availableBikes: 5, emptyDocks: 10, distance: 0.5 },
      ],
    });
    mockedRidesApi.endRide.mockResolvedValue({
      ride: { id: 'ride-123', status: 'completed' } as any,
      payment: { id: 'p1', amount: 5.5, status: 'captured' },
    });

    const user = userEvent.setup();
    renderActiveRide();
    await waitFor(() => expect(screen.getByRole('button', { name: /end ride/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /end ride/i }));
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /confirm end ride/i }));
    await waitFor(() => {
      expect(mockedRidesApi.endRide).toHaveBeenCalledWith('ride-123', 's1');
    });
    await waitFor(() => {
      expect(screen.getByText('Ride Summary')).toBeInTheDocument();
    });
  });

  it('shows error toast when end ride fails', async () => {
    mockedRidesApi.getActive.mockResolvedValue({
      ride: {
        id: 'r1', bikeId: 'b1', startStationId: 's1', endStationId: null,
        startTime: new Date().toISOString(), endTime: null,
        durationMinutes: null, distanceKm: null, cost: null, status: 'active',
        startStationName: 'CP',
      },
    });
    mockedStationsApi.list.mockResolvedValue({
      stations: [{ id: 's1', name: 'CP', address: 'A', lat: 40, lng: -73, availableBikes: 5, emptyDocks: 10, distance: 0.5 }],
    });
    mockedRidesApi.endRide.mockRejectedValue(new Error('fail'));

    const user = userEvent.setup();
    renderActiveRide();
    await waitFor(() => expect(screen.getByRole('button', { name: /end ride/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /end ride/i }));
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /confirm end ride/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to end ride/i)).toBeInTheDocument();
    });
  });

  it('cancel button hides end ride form', async () => {
    mockedRidesApi.getActive.mockResolvedValue({
      ride: {
        id: 'r1', bikeId: 'b1', startStationId: 's1', endStationId: null,
        startTime: new Date().toISOString(), endTime: null,
        durationMinutes: null, distanceKm: null, cost: null, status: 'active',
        startStationName: 'CP',
      },
    });
    mockedStationsApi.list.mockResolvedValue({
      stations: [{ id: 's1', name: 'CP', address: 'A', lat: 40, lng: -73, availableBikes: 5, emptyDocks: 10, distance: 0.5 }],
    });

    const user = userEvent.setup();
    renderActiveRide();
    await waitFor(() => expect(screen.getByRole('button', { name: /end ride/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /end ride/i }));
    await waitFor(() => expect(screen.getByText(/select return station/i)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText(/select return station/i)).not.toBeInTheDocument();
  });

  it('shows pricing info', async () => {
    mockedRidesApi.getActive.mockResolvedValue({
      ride: {
        id: 'r1', bikeId: 'b1', startStationId: 's1', endStationId: null,
        startTime: new Date().toISOString(), endTime: null,
        durationMinutes: null, distanceKm: null, cost: null, status: 'active',
        startStationName: 'CP',
      },
    });

    renderActiveRide();
    await waitFor(() => expect(screen.getByText('Active Ride')).toBeInTheDocument());
    expect(screen.getByText(/\$1\.00 unlock/)).toBeInTheDocument();
    expect(screen.getByText(/\$0\.15\/min/)).toBeInTheDocument();
  });

  it('shows fallback text when bike info missing', async () => {
    mockedRidesApi.getActive.mockResolvedValue({
      ride: {
        id: 'r1', bikeId: 'b1', startStationId: 's1', endStationId: null,
        startTime: new Date().toISOString(), endTime: null,
        durationMinutes: null, distanceKm: null, cost: null, status: 'active',
      },
    });

    renderActiveRide();
    await waitFor(() => expect(screen.getByText('Bike')).toBeInTheDocument());
    expect(screen.getByText(/started at station/i)).toBeInTheDocument();
  });

  it('shows loading stations when fetching', async () => {
    mockedRidesApi.getActive.mockResolvedValue({
      ride: {
        id: 'r1', bikeId: 'b1', startStationId: 's1', endStationId: null,
        startTime: new Date().toISOString(), endTime: null,
        durationMinutes: null, distanceKm: null, cost: null, status: 'active',
        startStationName: 'CP',
      },
    });
    mockedStationsApi.list.mockReturnValue(new Promise(() => {}));

    const user = userEvent.setup();
    renderActiveRide();
    await waitFor(() => expect(screen.getByRole('button', { name: /end ride/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /end ride/i }));
    await waitFor(() => expect(screen.getByText(/select return station/i)).toBeInTheDocument());
    // Should show a spinner while loading stations
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
  });
});
