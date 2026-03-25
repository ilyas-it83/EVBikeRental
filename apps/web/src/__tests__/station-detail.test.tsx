import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../components/ui/Toast';
import { StationDetailPanel } from '../components/StationDetailPanel';
import { stationsApi, reservationsApi } from '../lib/api';

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

const mockedStationsApi = vi.mocked(stationsApi);
const mockedReservationsApi = vi.mocked(reservationsApi);

const baseStation = {
  id: 's1', name: 'Central Park', address: '100 CP West', lat: 40.7, lng: -73.9,
  availableBikes: 5, emptyDocks: 10, distance: 0.8,
};

function renderPanel(props?: Partial<React.ComponentProps<typeof StationDetailPanel>>) {
  const onClose = vi.fn();
  return render(
    <MemoryRouter>
      <ToastProvider>
        <Routes>
          <Route path="*" element={
            <StationDetailPanel
              station={baseStation}
              userLat={40.7}
              userLng={-73.9}
              onClose={onClose}
              {...props}
            />
          } />
          <Route path="/unlock/:bikeId" element={<div>Unlock Page</div>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('StationDetailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedReservationsApi.getActive.mockResolvedValue({ reservation: null });
  });

  it('shows loading spinner while fetching station detail', () => {
    mockedStationsApi.getById.mockReturnValue(new Promise(() => {}));
    renderPanel();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows station name and address', async () => {
    mockedStationsApi.getById.mockResolvedValue({
      station: {
        id: 's1', name: 'Central Park', address: '100 CP West',
        lat: 40.7, lng: -73.9, dockCapacity: 20,
        bikes: [{ id: 'b1', model: 'EV-Pro', batteryLevel: 90, status: 'available' }],
      },
    });

    renderPanel();
    await waitFor(() => expect(screen.getByText('Central Park')).toBeInTheDocument());
    expect(screen.getByText('100 CP West')).toBeInTheDocument();
  });

  it('shows available bikes and empty docks counts', () => {
    mockedStationsApi.getById.mockReturnValue(new Promise(() => {}));
    renderPanel();
    expect(screen.getByText('5')).toBeInTheDocument(); // available bikes
    expect(screen.getByText('10')).toBeInTheDocument(); // empty docks
    expect(screen.getByText('Available bikes')).toBeInTheDocument();
    expect(screen.getByText('Empty docks')).toBeInTheDocument();
  });

  it('shows distance and walking time', () => {
    mockedStationsApi.getById.mockReturnValue(new Promise(() => {}));
    renderPanel();
    expect(screen.getByText('📍 800 m')).toBeInTheDocument();
    expect(screen.getByText('🚶 10 min walk')).toBeInTheDocument();
  });

  it('shows distance in km for >= 1km', () => {
    mockedStationsApi.getById.mockReturnValue(new Promise(() => {}));
    renderPanel({ station: { ...baseStation, distance: 2.5 } });
    expect(screen.getByText('📍 2.5 km')).toBeInTheDocument();
  });

  it('hides distance when no user location', () => {
    mockedStationsApi.getById.mockReturnValue(new Promise(() => {}));
    renderPanel({ userLat: undefined, userLng: undefined });
    expect(screen.queryByText(/📍/)).not.toBeInTheDocument();
  });

  it('shows bike list with unlock buttons', async () => {
    mockedStationsApi.getById.mockResolvedValue({
      station: {
        id: 's1', name: 'CP', address: 'A', lat: 40.7, lng: -73.9, dockCapacity: 20,
        bikes: [
          { id: 'b1', model: 'EV-Pro', batteryLevel: 90, status: 'available' },
          { id: 'b2', model: 'EV-Std', batteryLevel: 45, status: 'available' },
        ],
      },
    });

    renderPanel();
    await waitFor(() => expect(screen.getByText('EV-Pro')).toBeInTheDocument());
    expect(screen.getByText('EV-Std')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
    expect(screen.getAllByText('🔓 Unlock').length).toBe(2);
    expect(screen.getAllByText('📌 Reserve').length).toBe(2);
  });

  it('shows no bikes message when empty', async () => {
    mockedStationsApi.getById.mockResolvedValue({
      station: {
        id: 's1', name: 'CP', address: 'A', lat: 40.7, lng: -73.9, dockCapacity: 20,
        bikes: [],
      },
    });

    renderPanel();
    await waitFor(() => expect(screen.getByText(/no bikes available/i)).toBeInTheDocument());
  });

  it('shows error message when fetch fails', async () => {
    mockedStationsApi.getById.mockRejectedValue(new Error('fail'));

    renderPanel();
    await waitFor(() => expect(screen.getByText(/failed to load station details/i)).toBeInTheDocument());
  });

  it('close button calls onClose', async () => {
    mockedStationsApi.getById.mockReturnValue(new Promise(() => {}));
    const onClose = vi.fn();

    render(
      <MemoryRouter>
        <ToastProvider>
          <StationDetailPanel station={baseStation} onClose={onClose} />
        </ToastProvider>
      </MemoryRouter>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Close panel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('reserve button calls reservationsApi', async () => {
    mockedStationsApi.getById.mockResolvedValue({
      station: {
        id: 's1', name: 'CP', address: 'A', lat: 40.7, lng: -73.9, dockCapacity: 20,
        bikes: [{ id: 'b1', model: 'EV-Pro', batteryLevel: 90, status: 'available' }],
      },
    });
    mockedReservationsApi.create.mockResolvedValue({
      reservation: { id: 'res1', bikeId: 'b1', stationId: 's1', expiresAt: new Date(Date.now() + 900000).toISOString(), status: 'active' },
    });

    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByText('📌 Reserve')).toBeInTheDocument());

    await user.click(screen.getByText('📌 Reserve'));
    await waitFor(() => expect(mockedReservationsApi.create).toHaveBeenCalledWith('b1', 's1'));
  });

  it('shows reservation banner when bike is reserved', async () => {
    mockedStationsApi.getById.mockResolvedValue({
      station: {
        id: 's1', name: 'CP', address: 'A', lat: 40.7, lng: -73.9, dockCapacity: 20,
        bikes: [{ id: 'b1', model: 'EV-Pro', batteryLevel: 90, status: 'available' }],
      },
    });
    mockedReservationsApi.getActive.mockResolvedValue({
      reservation: { id: 'res1', bikeId: 'b1', stationId: 's1', expiresAt: new Date(Date.now() + 600000).toISOString(), status: 'active' },
    });

    renderPanel();
    await waitFor(() => expect(screen.getByText(/bike reserved/i)).toBeInTheDocument());
    expect(screen.getByText(/expires in/i)).toBeInTheDocument();
  });

  it('shows less than 1 min walk for very close stations', () => {
    mockedStationsApi.getById.mockReturnValue(new Promise(() => {}));
    renderPanel({ station: { ...baseStation, distance: 0.01 } });
    expect(screen.getByText(/< 1 min walk/)).toBeInTheDocument();
  });

  it('filters to only available bikes', async () => {
    mockedStationsApi.getById.mockResolvedValue({
      station: {
        id: 's1', name: 'CP', address: 'A', lat: 40.7, lng: -73.9, dockCapacity: 20,
        bikes: [
          { id: 'b1', model: 'EV-Pro', batteryLevel: 90, status: 'available' },
          { id: 'b2', model: 'EV-Rented', batteryLevel: 50, status: 'rented' },
        ],
      },
    });

    renderPanel();
    await waitFor(() => expect(screen.getByText('EV-Pro')).toBeInTheDocument());
    expect(screen.queryByText('EV-Rented')).not.toBeInTheDocument();
  });

  it('shows red battery bar for low battery bikes', async () => {
    mockedStationsApi.getById.mockResolvedValue({
      station: {
        id: 's1', name: 'CP', address: 'A', lat: 40.7, lng: -73.9, dockCapacity: 20,
        bikes: [
          { id: 'b1', model: 'Low-Bat', batteryLevel: 15, status: 'available' },
        ],
      },
    });

    renderPanel();
    await waitFor(() => expect(screen.getByText('Low-Bat')).toBeInTheDocument());
    expect(screen.getByText('15%')).toBeInTheDocument();
  });

  it('shows yellow battery for medium battery bikes', async () => {
    mockedStationsApi.getById.mockResolvedValue({
      station: {
        id: 's1', name: 'CP', address: 'A', lat: 40.7, lng: -73.9, dockCapacity: 20,
        bikes: [{ id: 'b1', model: 'Med-Bat', batteryLevel: 45, status: 'available' }],
      },
    });

    renderPanel();
    await waitFor(() => expect(screen.getByText('Med-Bat')).toBeInTheDocument());
  });

  it('shows error toast when reserve fails', async () => {
    mockedStationsApi.getById.mockResolvedValue({
      station: {
        id: 's1', name: 'CP', address: 'A', lat: 40.7, lng: -73.9, dockCapacity: 20,
        bikes: [{ id: 'b1', model: 'EV-Pro', batteryLevel: 90, status: 'available' }],
      },
    });
    mockedReservationsApi.create.mockRejectedValue(new Error('fail'));

    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByText('EV-Pro')).toBeInTheDocument());

    await user.click(screen.getByText(/reserve/i));
    await waitFor(() => expect(screen.getByText(/failed to reserve/i)).toBeInTheDocument());
  });

  it('handles cancel reservation error', async () => {
    mockedReservationsApi.getActive.mockResolvedValue({
      reservation: { id: 'res1', bikeId: 'b1', stationId: 's1', expiresAt: new Date(Date.now() + 600000).toISOString(), status: 'active' },
    });
    mockedReservationsApi.cancel.mockRejectedValue(new Error('fail'));
    mockedStationsApi.getById.mockResolvedValue({
      station: {
        id: 's1', name: 'CP', address: 'A', lat: 40.7, lng: -73.9, dockCapacity: 20,
        bikes: [{ id: 'b1', model: 'EV-Pro', batteryLevel: 90, status: 'available' }],
      },
    });

    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByText(/bike reserved/i)).toBeInTheDocument());

    await user.click(screen.getByText(/cancel/i));
    await waitFor(() => expect(screen.getByText(/failed to cancel/i)).toBeInTheDocument());
  });

  it('navigates to unlock page when unlock button is clicked', async () => {
    mockedStationsApi.getById.mockResolvedValue({
      station: {
        id: 's1', name: 'CP', address: 'A', lat: 40.7, lng: -73.9, dockCapacity: 20,
        bikes: [{ id: 'b1', model: 'EV-Pro', batteryLevel: 90, status: 'available' }],
      },
    });

    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByText('EV-Pro')).toBeInTheDocument());

    await user.click(screen.getByText(/unlock/i));
    await waitFor(() => expect(screen.getByText('Unlock Page')).toBeInTheDocument());
  });
});
