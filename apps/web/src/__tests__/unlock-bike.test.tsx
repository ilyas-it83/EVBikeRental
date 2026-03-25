import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../components/ui/Toast';
import UnlockBike from '../pages/UnlockBike';
import { stationsApi, ridesApi } from '../lib/api';

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

const mockedStationsApi = vi.mocked(stationsApi);
const mockedRidesApi = vi.mocked(ridesApi);

function renderUnlockBike(bikeId = 'bike-001', stationId = 'station-001') {
  return render(
    <MemoryRouter initialEntries={[`/unlock/${bikeId}?stationId=${stationId}`]}>
      <ToastProvider>
        <Routes>
          <Route path="/unlock/:bikeId" element={<UnlockBike />} />
          <Route path="/ride/active" element={<div>Active Ride Page</div>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('UnlockBike Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner while fetching station', () => {
    mockedStationsApi.getById.mockReturnValue(new Promise(() => {}));
    renderUnlockBike();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders bike info and pricing after loading', async () => {
    mockedStationsApi.getById.mockResolvedValue({
      station: {
        id: 'station-001', name: 'Central Park', address: '100 CP', lat: 40.7, lng: -73.9, dockCapacity: 20,
        bikes: [{ id: 'bike-001', model: 'EV-Pro', batteryLevel: 85, status: 'available' }],
      },
    });

    renderUnlockBike();
    await waitFor(() => {
      expect(screen.getByText('EV-Pro')).toBeInTheDocument();
    });
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('📍 Central Park')).toBeInTheDocument();
    expect(screen.getByText('$1.00')).toBeInTheDocument();
    expect(screen.getByText('$0.15')).toBeInTheDocument();
  });

  it('shows unlock button and confirm dialog', async () => {
    mockedStationsApi.getById.mockResolvedValue({
      station: {
        id: 'station-001', name: 'Central Park', address: '100 CP', lat: 40.7, lng: -73.9, dockCapacity: 20,
        bikes: [{ id: 'bike-001', model: 'EV-Pro', batteryLevel: 85, status: 'available' }],
      },
    });

    const user = userEvent.setup();
    renderUnlockBike();

    await waitFor(() => expect(screen.getByText('EV-Pro')).toBeInTheDocument());

    // Click unlock to show confirm dialog
    await user.click(screen.getByRole('button', { name: /unlock bike/i }));
    expect(screen.getByText(/confirm to unlock/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm unlock/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('calls ridesApi.unlock on confirm and navigates', async () => {
    mockedStationsApi.getById.mockResolvedValue({
      station: {
        id: 'station-001', name: 'Central Park', address: '100 CP', lat: 40.7, lng: -73.9, dockCapacity: 20,
        bikes: [{ id: 'bike-001', model: 'EV-Pro', batteryLevel: 85, status: 'available' }],
      },
    });
    mockedRidesApi.unlock.mockResolvedValue({ ride: { id: 'r1' } as any });

    const user = userEvent.setup();
    renderUnlockBike();

    await waitFor(() => expect(screen.getByText('EV-Pro')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /unlock bike/i }));
    await user.click(screen.getByRole('button', { name: /confirm unlock/i }));

    await waitFor(() => {
      expect(mockedRidesApi.unlock).toHaveBeenCalledWith('bike-001', 'station-001');
    });
    await waitFor(() => {
      expect(screen.getByText('Active Ride Page')).toBeInTheDocument();
    });
  });

  it('shows error toast on unlock failure', async () => {
    mockedStationsApi.getById.mockResolvedValue({
      station: {
        id: 'station-001', name: 'Central Park', address: '100 CP', lat: 40.7, lng: -73.9, dockCapacity: 20,
        bikes: [{ id: 'bike-001', model: 'EV-Pro', batteryLevel: 85, status: 'available' }],
      },
    });
    mockedRidesApi.unlock.mockRejectedValue({ response: { data: { error: { message: 'Bike unavailable' } } } });

    const user = userEvent.setup();
    renderUnlockBike();

    await waitFor(() => expect(screen.getByText('EV-Pro')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /unlock bike/i }));
    await user.click(screen.getByRole('button', { name: /confirm unlock/i }));

    await waitFor(() => {
      expect(screen.getByText('Bike unavailable')).toBeInTheDocument();
    });
  });

  it('cancel button hides confirm dialog', async () => {
    mockedStationsApi.getById.mockResolvedValue({
      station: {
        id: 'station-001', name: 'Central Park', address: '100 CP', lat: 40.7, lng: -73.9, dockCapacity: 20,
        bikes: [{ id: 'bike-001', model: 'EV-Pro', batteryLevel: 85, status: 'available' }],
      },
    });

    const user = userEvent.setup();
    renderUnlockBike();

    await waitFor(() => expect(screen.getByText('EV-Pro')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /unlock bike/i }));
    expect(screen.getByText(/confirm to unlock/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText(/confirm to unlock/i)).not.toBeInTheDocument();
  });

  it('shows error toast when station fetch fails', async () => {
    mockedStationsApi.getById.mockRejectedValue(new Error('Network error'));
    renderUnlockBike();

    await waitFor(() => {
      expect(screen.getByText(/failed to load station info/i)).toBeInTheDocument();
    });
  });

  it('shows generic unlock failure message for non-response errors', async () => {
    mockedStationsApi.getById.mockResolvedValue({
      station: {
        id: 'station-001', name: 'Central Park', address: '100 CP', lat: 40.7, lng: -73.9, dockCapacity: 20,
        bikes: [{ id: 'bike-001', model: 'EV-Pro', batteryLevel: 85, status: 'available' }],
      },
    });
    mockedRidesApi.unlock.mockRejectedValue(new Error('Network error'));

    const user = userEvent.setup();
    renderUnlockBike();

    await waitFor(() => expect(screen.getByText('EV-Pro')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /unlock bike/i }));
    await user.click(screen.getByRole('button', { name: /confirm unlock/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to unlock bike/i)).toBeInTheDocument();
    });
  });

  it('displays Bike fallback when bike not found in station', async () => {
    mockedStationsApi.getById.mockResolvedValue({
      station: {
        id: 'station-001', name: 'Central Park', address: '100 CP', lat: 40.7, lng: -73.9, dockCapacity: 20,
        bikes: [],
      },
    });
    renderUnlockBike();
    await waitFor(() => expect(screen.getByText('Bike')).toBeInTheDocument());
  });
});
