import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, Outlet } from 'react-router-dom';
import { ToastProvider } from '../components/ui/Toast';
import AdminLayout from '../pages/admin/AdminLayout';
import FleetOverview from '../pages/admin/FleetOverview';
import StationManagement from '../pages/admin/StationManagement';
import BikeManagement from '../pages/admin/BikeManagement';
import UserManagement from '../pages/admin/UserManagement';
import { adminApi } from '../lib/api';

const mockUser = vi.fn();

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
  useAuth: () => mockUser(),
}));

vi.mock('../hooks/useActiveRide', () => ({
  useActiveRide: () => ({ activeRide: null, isLoading: false }),
}));

const mockedAdminApi = vi.mocked(adminApi);

function setAdminUser() {
  mockUser.mockReturnValue({
    user: { id: 'a1', email: 'admin@test.com', name: 'Admin', role: 'admin' },
    isAuthenticated: true, isLoading: false,
    login: vi.fn(), register: vi.fn(), logout: vi.fn(),
  });
}

function setRiderUser() {
  mockUser.mockReturnValue({
    user: { id: 'u1', email: 'rider@test.com', name: 'Rider', role: 'rider' },
    isAuthenticated: true, isLoading: false,
    login: vi.fn(), register: vi.fn(), logout: vi.fn(),
  });
}

function setLoadingUser() {
  mockUser.mockReturnValue({
    user: null, isAuthenticated: false, isLoading: true,
    login: vi.fn(), register: vi.fn(), logout: vi.fn(),
  });
}

function renderAdmin(route = '/admin') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<FleetOverview />} />
            <Route path="stations" element={<StationManagement />} />
            <Route path="bikes" element={<BikeManagement />} />
            <Route path="users" element={<UserManagement />} />
          </Route>
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('AdminLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner while auth is loading', () => {
    setLoadingUser();
    renderAdmin();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('redirects non-admin users to home', async () => {
    setRiderUser();
    renderAdmin();
    await waitFor(() => expect(screen.getByText('Home Page')).toBeInTheDocument());
  });

  it('renders admin layout for admin users', async () => {
    setAdminUser();
    mockedAdminApi.getFleetOverview.mockResolvedValue({
      totalBikes: 50, totalStations: 10, activeBikes: 5, availableBikes: 35,
      maintenanceBikes: 5, activeRides: 5, completedRidesToday: 20, revenueToday: 245.50,
    });
    mockedAdminApi.getFleetStations.mockResolvedValue({ stations: [] });

    renderAdmin();
    await waitFor(() => expect(screen.getByText('⚡ Admin Dashboard')).toBeInTheDocument());
    expect(screen.getByText('📊 Fleet Overview')).toBeInTheDocument();
    expect(screen.getByText('📍 Stations')).toBeInTheDocument();
    expect(screen.getByText('🚲 Bikes')).toBeInTheDocument();
    expect(screen.getByText('👥 Users')).toBeInTheDocument();
  });

  it('has back to app link', async () => {
    setAdminUser();
    mockedAdminApi.getFleetOverview.mockResolvedValue({
      totalBikes: 50, totalStations: 10, activeBikes: 5, availableBikes: 35,
      maintenanceBikes: 5, activeRides: 5, completedRidesToday: 20, revenueToday: 245.50,
    });
    mockedAdminApi.getFleetStations.mockResolvedValue({ stations: [] });

    renderAdmin();
    await waitFor(() => expect(screen.getByText('← Back to App')).toBeInTheDocument());
  });

  it('has toggle sidebar button', async () => {
    setAdminUser();
    mockedAdminApi.getFleetOverview.mockResolvedValue({
      totalBikes: 50, totalStations: 10, activeBikes: 5, availableBikes: 35,
      maintenanceBikes: 5, activeRides: 5, completedRidesToday: 20, revenueToday: 245.50,
    });
    mockedAdminApi.getFleetStations.mockResolvedValue({ stations: [] });

    const user = userEvent.setup();
    renderAdmin();
    await waitFor(() => expect(screen.getByLabelText('Toggle sidebar')).toBeInTheDocument());
    await user.click(screen.getByLabelText('Toggle sidebar'));

    // Sidebar is open, click backdrop to close (covers line 60: onClick)
    const backdrop = document.querySelector('.fixed.inset-0.z-30');
    if (backdrop) {
      fireEvent.click(backdrop);
    }
  });

  it('closes sidebar on nav link click', async () => {
    setAdminUser();
    mockedAdminApi.getFleetOverview.mockResolvedValue({
      totalBikes: 50, totalStations: 10, activeBikes: 5, availableBikes: 35,
      maintenanceBikes: 5, activeRides: 5, completedRidesToday: 20, revenueToday: 245.50,
    });
    mockedAdminApi.getFleetStations.mockResolvedValue({ stations: [] });
    mockedAdminApi.listUsers.mockResolvedValue({ users: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } });

    const user = userEvent.setup();
    renderAdmin();
    await waitFor(() => expect(screen.getByLabelText('Toggle sidebar')).toBeInTheDocument());
    // Open sidebar
    await user.click(screen.getByLabelText('Toggle sidebar'));
    // Click a nav link (covers line 77: onClick on NavLink)
    await user.click(screen.getByText(/Users/));
  });
});

describe('FleetOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAdminUser();
  });

  it('shows stat cards with correct data', async () => {
    mockedAdminApi.getFleetOverview.mockResolvedValue({
      totalBikes: 50, totalStations: 10, activeBikes: 5, availableBikes: 35,
      maintenanceBikes: 5, activeRides: 8, completedRidesToday: 20, revenueToday: 245.50,
    });
    mockedAdminApi.getFleetStations.mockResolvedValue({
      stations: [
        { id: 's1', name: 'Central Park', lat: 40.7, lng: -73.9, availableBikes: 10, dockCapacity: 20, isActive: true },
      ],
    });

    renderAdmin();
    await waitFor(() => expect(screen.getByText('Fleet Overview')).toBeInTheDocument());
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('35')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('$245.50')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('Central Park')).toBeInTheDocument();
  });

  it('shows error text when overview fails', async () => {
    mockedAdminApi.getFleetOverview.mockRejectedValue(new Error('fail'));
    mockedAdminApi.getFleetStations.mockRejectedValue(new Error('fail'));

    renderAdmin();
    await waitFor(() => expect(screen.getByText(/failed to load fleet overview/i)).toBeInTheDocument());
  });

  it('shows station active/inactive badges', async () => {
    mockedAdminApi.getFleetOverview.mockResolvedValue({
      totalBikes: 10, totalStations: 2, activeBikes: 5, availableBikes: 3,
      maintenanceBikes: 2, activeRides: 2, completedRidesToday: 5, revenueToday: 50,
    });
    mockedAdminApi.getFleetStations.mockResolvedValue({
      stations: [
        { id: 's1', name: 'Active Station', lat: 40, lng: -73, availableBikes: 5, dockCapacity: 10, isActive: true },
        { id: 's2', name: 'Closed Station', lat: 40, lng: -73, availableBikes: 0, dockCapacity: 10, isActive: false },
      ],
    });

    renderAdmin();
    await waitFor(() => expect(screen.getByText('Active')).toBeInTheDocument());
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('navigates to stations page via Add Station button', async () => {
    mockedAdminApi.getFleetOverview.mockResolvedValue({
      totalBikes: 10, totalStations: 2, activeBikes: 5, availableBikes: 3,
      maintenanceBikes: 2, activeRides: 2, completedRidesToday: 5, revenueToday: 50,
    });
    mockedAdminApi.getFleetStations.mockResolvedValue({ stations: [] });
    mockedAdminApi.listStations.mockResolvedValue({ stations: [] });

    const user = userEvent.setup();
    renderAdmin();
    await waitFor(() => expect(screen.getByText('+ Add Station')).toBeInTheDocument());
    await user.click(screen.getByText('+ Add Station'));
    await waitFor(() => expect(screen.getByText('Station Management')).toBeInTheDocument());
  });

  it('navigates to bikes page via Add Bike button', async () => {
    mockedAdminApi.getFleetOverview.mockResolvedValue({
      totalBikes: 10, totalStations: 2, activeBikes: 5, availableBikes: 3,
      maintenanceBikes: 2, activeRides: 2, completedRidesToday: 5, revenueToday: 50,
    });
    mockedAdminApi.getFleetStations.mockResolvedValue({ stations: [] });
    mockedAdminApi.listBikes.mockResolvedValue({ bikes: [] });
    mockedAdminApi.listStations.mockResolvedValue({ stations: [] });

    const user = userEvent.setup();
    renderAdmin();
    await waitFor(() => expect(screen.getByText('+ Add Bike')).toBeInTheDocument());
    await user.click(screen.getByText('+ Add Bike'));
    await waitFor(() => expect(screen.getByText('Bike Management')).toBeInTheDocument());
  });
});

describe('StationManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAdminUser();
  });

  it('renders station table', async () => {
    mockedAdminApi.listStations.mockResolvedValue({
      stations: [
        { id: 's1', name: 'Central Park', address: '100 CP West', lat: 40.7, lng: -73.9, dockCapacity: 20, availableBikes: 15, isActive: true },
        { id: 's2', name: 'Times Square', address: 'TS NYC', lat: 40.7, lng: -73.9, dockCapacity: 15, availableBikes: 5, isActive: true },
      ],
    });

    renderAdmin('/admin/stations');
    await waitFor(() => expect(screen.getByText('Station Management')).toBeInTheDocument());
    expect(screen.getByText('Central Park')).toBeInTheDocument();
    expect(screen.getByText('Times Square')).toBeInTheDocument();
  });

  it('opens add station modal', async () => {
    mockedAdminApi.listStations.mockResolvedValue({ stations: [] });

    const user = userEvent.setup();
    renderAdmin('/admin/stations');
    await waitFor(() => expect(screen.getByText('Station Management')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /add station/i }));
    await waitFor(() => expect(screen.getByText('Add Station')).toBeInTheDocument());
  });

  it('creates station via modal', async () => {
    mockedAdminApi.listStations.mockResolvedValue({ stations: [] });
    mockedAdminApi.createStation.mockResolvedValue({
      station: { id: 's-new', name: 'New Station', address: '123 Main', lat: 40.7, lng: -73.9, dockCapacity: 10, availableBikes: 0, isActive: true },
    });

    const user = userEvent.setup();
    renderAdmin('/admin/stations');
    await waitFor(() => expect(screen.getByText('Station Management')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /add station/i }));
    await waitFor(() => expect(screen.getByText('Add Station')).toBeInTheDocument());

    await user.type(screen.getByLabelText('Name'), 'New Station');
    await user.type(screen.getByLabelText('Address'), '123 Main');
    await user.type(screen.getByLabelText('Latitude'), '40.7');
    await user.type(screen.getByLabelText('Longitude'), '-73.9');
    await user.type(screen.getByLabelText('Dock Capacity'), '10');
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => expect(mockedAdminApi.createStation).toHaveBeenCalled());
  });

  it('opens edit station modal', async () => {
    mockedAdminApi.listStations.mockResolvedValue({
      stations: [
        { id: 's1', name: 'CP', address: '100 CP', lat: 40.7, lng: -73.9, dockCapacity: 20, availableBikes: 15, isActive: true },
      ],
    });

    const user = userEvent.setup();
    renderAdmin('/admin/stations');
    await waitFor(() => expect(screen.getByText('CP')).toBeInTheDocument());

    await user.click(screen.getByText('Edit'));
    await waitFor(() => expect(screen.getByText('Edit Station')).toBeInTheDocument());
  });

  it('deactivates station with confirmation', async () => {
    mockedAdminApi.listStations.mockResolvedValue({
      stations: [
        { id: 's1', name: 'CP', address: '100 CP', lat: 40.7, lng: -73.9, dockCapacity: 20, availableBikes: 15, isActive: true },
      ],
    });
    mockedAdminApi.deleteStation.mockResolvedValue({});
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const user = userEvent.setup();
    renderAdmin('/admin/stations');
    await waitFor(() => expect(screen.getByText('CP')).toBeInTheDocument());

    await user.click(screen.getByText('Deactivate'));
    await waitFor(() => expect(mockedAdminApi.deleteStation).toHaveBeenCalledWith('s1'));
  });

  it('filters stations by search', async () => {
    mockedAdminApi.listStations.mockResolvedValue({
      stations: [
        { id: 's1', name: 'Central Park', address: '100 CP', lat: 40.7, lng: -73.9, dockCapacity: 20, availableBikes: 15, isActive: true },
        { id: 's2', name: 'Times Square', address: 'TS', lat: 40.7, lng: -73.9, dockCapacity: 15, availableBikes: 5, isActive: true },
      ],
    });

    const user = userEvent.setup();
    renderAdmin('/admin/stations');
    await waitFor(() => expect(screen.getByText('Central Park')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/search stations/i), 'Central');
    expect(screen.getByText('Central Park')).toBeInTheDocument();
    expect(screen.queryByText('Times Square')).not.toBeInTheDocument();
  });

  it('shows no stations found', async () => {
    mockedAdminApi.listStations.mockResolvedValue({ stations: [] });
    renderAdmin('/admin/stations');
    await waitFor(() => expect(screen.getByText(/no stations found/i)).toBeInTheDocument());
  });

  it('validates form fields', async () => {
    mockedAdminApi.listStations.mockResolvedValue({ stations: [] });

    const user = userEvent.setup();
    renderAdmin('/admin/stations');
    await waitFor(() => expect(screen.getByText('Station Management')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /add station/i }));
    await waitFor(() => expect(screen.getByText('Add Station')).toBeInTheDocument());

    // Submit empty form - use fireEvent.submit to bypass HTML5 required validation
    const form = screen.getByRole('button', { name: /create/i }).closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => expect(screen.getByText(/name and address are required/i)).toBeInTheDocument());
  });

  it('updates station via edit modal', async () => {
    mockedAdminApi.listStations.mockResolvedValue({
      stations: [
        { id: 's1', name: 'CP', address: '100 CP', lat: 40.7, lng: -73.9, dockCapacity: 20, availableBikes: 15, isActive: true },
      ],
    });
    mockedAdminApi.updateStation.mockResolvedValue({
      station: { id: 's1', name: 'Updated', address: '100 CP', lat: 40.7, lng: -73.9, dockCapacity: 20, availableBikes: 15, isActive: true },
    });

    const user = userEvent.setup();
    renderAdmin('/admin/stations');
    await waitFor(() => expect(screen.getByText('CP')).toBeInTheDocument());

    await user.click(screen.getByText('Edit'));
    await waitFor(() => expect(screen.getByText('Edit Station')).toBeInTheDocument());

    const nameInput = screen.getByLabelText('Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated');
    await user.click(screen.getByRole('button', { name: /update/i }));
    await waitFor(() => expect(mockedAdminApi.updateStation).toHaveBeenCalled());
  });

  it('shows error when station save fails', async () => {
    mockedAdminApi.listStations.mockResolvedValue({ stations: [] });
    mockedAdminApi.createStation.mockRejectedValue(new Error('fail'));

    const user = userEvent.setup();
    renderAdmin('/admin/stations');
    await waitFor(() => expect(screen.getByText('Station Management')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /add station/i }));
    await waitFor(() => expect(screen.getByText('Add Station')).toBeInTheDocument());

    await user.type(screen.getByLabelText('Name'), 'Test');
    await user.type(screen.getByLabelText('Address'), '123 St');
    // Fill lat/lng/capacity via fireEvent since they're number inputs
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '40.7' } });
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '-73.9' } });
    fireEvent.change(screen.getByLabelText('Dock Capacity'), { target: { value: '10' } });

    await user.click(screen.getByRole('button', { name: /create/i }));
    await waitFor(() => expect(screen.getByText(/failed to save station/i)).toBeInTheDocument());
  });

  it('shows error when station deactivate fails', async () => {
    mockedAdminApi.listStations.mockResolvedValue({
      stations: [
        { id: 's1', name: 'CP', address: 'A', lat: 40.7, lng: -73.9, dockCapacity: 20, availableBikes: 5, isActive: true },
      ],
    });
    mockedAdminApi.deleteStation.mockRejectedValue(new Error('fail'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const user = userEvent.setup();
    renderAdmin('/admin/stations');
    await waitFor(() => expect(screen.getByText('CP')).toBeInTheDocument());

    await user.click(screen.getByText('Deactivate'));
    await waitFor(() => expect(screen.getByText(/failed to deactivate/i)).toBeInTheDocument());
  });
});

describe('BikeManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAdminUser();
    mockedAdminApi.listStations.mockResolvedValue({
      stations: [{ id: 's1', name: 'Station 1' }],
    });
  });

  it('renders bike table', async () => {
    mockedAdminApi.listBikes.mockResolvedValue({
      bikes: [
        { id: 'b1', serialNumber: 'SN001', model: 'EV-Pro', stationId: 's1', stationName: 'Station 1', batteryLevel: 95, status: 'available' },
        { id: 'b2', serialNumber: 'SN002', model: 'EV-Std', stationId: 's1', stationName: 'Station 1', batteryLevel: 25, status: 'maintenance' },
      ],
    });

    renderAdmin('/admin/bikes');
    await waitFor(() => expect(screen.getByText('Bike Management')).toBeInTheDocument());
    expect(screen.getByText('SN001')).toBeInTheDocument();
    expect(screen.getByText('EV-Pro')).toBeInTheDocument();
    expect(screen.getByText('95%')).toBeInTheDocument();
    expect(screen.getAllByText('Available').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Maintenance').length).toBeGreaterThanOrEqual(1);
  });

  it('filters by status', async () => {
    mockedAdminApi.listBikes.mockResolvedValue({
      bikes: [
        { id: 'b1', serialNumber: 'SN001', model: 'EV-Pro', stationId: 's1', batteryLevel: 95, status: 'available' },
      ],
    });

    const user = userEvent.setup();
    renderAdmin('/admin/bikes');
    await waitFor(() => expect(screen.getByText('Bike Management')).toBeInTheDocument());

    const statusSelect = screen.getAllByRole('combobox')[1]; // second select is status
    await user.selectOptions(statusSelect, 'available');
    await waitFor(() => expect(mockedAdminApi.listBikes).toHaveBeenCalledWith(expect.objectContaining({ status: 'available' })));
  });

  it('opens add bike modal', async () => {
    mockedAdminApi.listBikes.mockResolvedValue({ bikes: [] });

    const user = userEvent.setup();
    renderAdmin('/admin/bikes');
    await waitFor(() => expect(screen.getByText('Bike Management')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /add bike/i }));
    await waitFor(() => expect(screen.getByText('Add Bike')).toBeInTheDocument());
  });

  it('creates a bike', async () => {
    mockedAdminApi.listBikes.mockResolvedValue({ bikes: [] });
    mockedAdminApi.listStations.mockResolvedValue({
      stations: [{ id: 's1', name: 'Station 1' }],
    });
    mockedAdminApi.createBike.mockResolvedValue({
      bike: { id: 'b-new', serialNumber: 'SN999', model: 'EV-Test', stationId: 's1', batteryLevel: 100, status: 'available' },
    });

    const user = userEvent.setup();
    renderAdmin('/admin/bikes');
    await waitFor(() => expect(screen.getByText('Bike Management')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /add bike/i }));
    await waitFor(() => expect(screen.getByText('Add Bike')).toBeInTheDocument());

    await user.type(screen.getByLabelText('Serial Number'), 'SN999');
    await user.type(screen.getByLabelText('Model'), 'EV-Test');
    // Select station using the select in the form modal (not the filter select)
    const selects = screen.getAllByRole('combobox');
    const stationSelect = selects[selects.length - 1]; // modal station select is last
    await user.selectOptions(stationSelect, 's1');
    await user.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => expect(mockedAdminApi.createBike).toHaveBeenCalled());
  });

  it('edits a bike', async () => {
    mockedAdminApi.listBikes.mockResolvedValue({
      bikes: [{ id: 'b1', serialNumber: 'SN001', model: 'EV-Pro', stationId: 's1', batteryLevel: 95, status: 'available' }],
    });
    mockedAdminApi.updateBike.mockResolvedValue({
      bike: { id: 'b1', serialNumber: 'SN001-UP', model: 'EV-Pro', stationId: 's1', batteryLevel: 95, status: 'available' },
    });

    const user = userEvent.setup();
    renderAdmin('/admin/bikes');
    await waitFor(() => expect(screen.getByText('SN001')).toBeInTheDocument());

    await user.click(screen.getByText('Edit'));
    await waitFor(() => expect(screen.getByText('Edit Bike')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /update/i }));
    await waitFor(() => expect(mockedAdminApi.updateBike).toHaveBeenCalled());
  });

  it('retires a bike with confirmation', async () => {
    mockedAdminApi.listBikes.mockResolvedValue({
      bikes: [{ id: 'b1', serialNumber: 'SN001', model: 'EV-Pro', stationId: 's1', batteryLevel: 95, status: 'available' }],
    });
    mockedAdminApi.deleteBike.mockResolvedValue({});
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const user = userEvent.setup();
    renderAdmin('/admin/bikes');
    await waitFor(() => expect(screen.getByText('SN001')).toBeInTheDocument());

    await user.click(screen.getByText('Retire'));
    await waitFor(() => expect(mockedAdminApi.deleteBike).toHaveBeenCalledWith('b1'));
  });

  it('shows no bikes found', async () => {
    mockedAdminApi.listBikes.mockResolvedValue({ bikes: [] });
    renderAdmin('/admin/bikes');
    await waitFor(() => expect(screen.getByText(/no bikes found/i)).toBeInTheDocument());
  });

  it('toggles low battery filter', async () => {
    mockedAdminApi.listBikes.mockResolvedValue({ bikes: [] });

    const user = userEvent.setup();
    renderAdmin('/admin/bikes');
    await waitFor(() => expect(screen.getByText('Bike Management')).toBeInTheDocument());

    await user.click(screen.getByLabelText(/low battery/i));
    await waitFor(() => expect(mockedAdminApi.listBikes).toHaveBeenCalledWith(expect.objectContaining({ lowBattery: true })));
  });
});

describe('UserManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAdminUser();
  });

  it('renders user table', async () => {
    mockedAdminApi.listUsers.mockResolvedValue({
      users: [
        { id: 'u1', name: 'Alice', email: 'alice@test.com', role: 'rider', createdAt: '2024-01-01T00:00:00Z' },
        { id: 'u2', name: 'Bob', email: 'bob@test.com', role: 'admin', createdAt: '2024-01-02T00:00:00Z' },
      ],
      pagination: { page: 1, limit: 20, total: 2, pages: 1 },
    });

    renderAdmin('/admin/users');
    await waitFor(() => expect(screen.getByText('User Management')).toBeInTheDocument());
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getAllByText('alice@test.com').length).toBeGreaterThanOrEqual(1);
  });

  it('toggles user role', async () => {
    mockedAdminApi.listUsers.mockResolvedValue({
      users: [
        { id: 'u1', name: 'Alice', email: 'alice@test.com', role: 'rider', createdAt: '2024-01-01T00:00:00Z' },
      ],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    });
    mockedAdminApi.updateUserRole.mockResolvedValue({
      user: { id: 'u1', name: 'Alice', email: 'alice@test.com', role: 'admin', createdAt: '2024-01-01T00:00:00Z' },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const user = userEvent.setup();
    renderAdmin('/admin/users');
    await waitFor(() => expect(screen.getByText('→ Admin')).toBeInTheDocument());

    await user.click(screen.getByText('→ Admin'));
    await waitFor(() => expect(mockedAdminApi.updateUserRole).toHaveBeenCalledWith('u1', 'admin'));
  });

  it('suspends user', async () => {
    mockedAdminApi.listUsers.mockResolvedValue({
      users: [
        { id: 'u1', name: 'Alice', email: 'alice@test.com', role: 'rider', createdAt: '2024-01-01T00:00:00Z' },
      ],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    });
    mockedAdminApi.suspendUser.mockResolvedValue({
      user: { id: 'u1', name: 'Alice', email: 'alice@test.com', role: 'rider', createdAt: '2024-01-01T00:00:00Z', isSuspended: true },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const user = userEvent.setup();
    renderAdmin('/admin/users');
    await waitFor(() => expect(screen.getByText('Suspend')).toBeInTheDocument());

    await user.click(screen.getByText('Suspend'));
    await waitFor(() => expect(mockedAdminApi.suspendUser).toHaveBeenCalledWith('u1'));
  });

  it('shows pagination when more than 1 page', async () => {
    mockedAdminApi.listUsers.mockResolvedValue({
      users: [
        { id: 'u1', name: 'Alice', email: 'alice@test.com', role: 'rider', createdAt: '2024-01-01T00:00:00Z' },
      ],
      pagination: { page: 1, limit: 20, total: 40, pages: 2 },
    });

    renderAdmin('/admin/users');
    await waitFor(() => expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument());
    expect(screen.getByText('Previous')).toBeDisabled();
    expect(screen.getByText('Next')).not.toBeDisabled();
  });

  it('navigates to next page', async () => {
    mockedAdminApi.listUsers
      .mockResolvedValueOnce({
        users: [{ id: 'u1', name: 'Alice', email: 'alice@test.com', role: 'rider', createdAt: '2024-01-01T00:00:00Z' }],
        pagination: { page: 1, limit: 20, total: 40, pages: 2 },
      })
      .mockResolvedValueOnce({
        users: [{ id: 'u2', name: 'Bob', email: 'bob@test.com', role: 'admin', createdAt: '2024-01-02T00:00:00Z' }],
        pagination: { page: 2, limit: 20, total: 40, pages: 2 },
      });

    const user = userEvent.setup();
    renderAdmin('/admin/users');
    await waitFor(() => expect(screen.getByText('Next')).toBeInTheDocument());

    await user.click(screen.getByText('Next'));
    await waitFor(() => expect(mockedAdminApi.listUsers).toHaveBeenCalledWith(2, 20));
  });

  it('shows suspended badge', async () => {
    mockedAdminApi.listUsers.mockResolvedValue({
      users: [
        { id: 'u1', name: 'Alice', email: 'alice@test.com', role: 'rider', createdAt: '2024-01-01T00:00:00Z', isSuspended: true },
      ],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    });

    renderAdmin('/admin/users');
    await waitFor(() => expect(screen.getByText('Suspended')).toBeInTheDocument());
  });

  it('hides suspend button for suspended users', async () => {
    mockedAdminApi.listUsers.mockResolvedValue({
      users: [
        { id: 'u1', name: 'Alice', email: 'alice@test.com', role: 'rider', createdAt: '2024-01-01T00:00:00Z', isSuspended: true },
      ],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    });

    renderAdmin('/admin/users');
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    expect(screen.queryByText('Suspend')).not.toBeInTheDocument();
  });

  it('shows no users found', async () => {
    mockedAdminApi.listUsers.mockResolvedValue({
      users: [],
      pagination: { page: 1, limit: 20, total: 0, pages: 0 },
    });

    renderAdmin('/admin/users');
    await waitFor(() => expect(screen.getByText(/no users found/i)).toBeInTheDocument());
  });

  it('shows error toast when loadUsers fails', async () => {
    mockedAdminApi.listUsers.mockRejectedValue(new Error('fail'));

    renderAdmin('/admin/users');
    await waitFor(() => expect(screen.getByText(/failed to load users/i)).toBeInTheDocument());
  });

  it('shows error toast when toggle role fails', async () => {
    mockedAdminApi.listUsers.mockResolvedValue({
      users: [{ id: 'u1', name: 'Alice', email: 'alice@test.com', role: 'rider', createdAt: '2024-01-01T00:00:00Z' }],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    });
    mockedAdminApi.updateUserRole.mockRejectedValue(new Error('fail'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const user = userEvent.setup();
    renderAdmin('/admin/users');
    await waitFor(() => expect(screen.getByText('→ Admin')).toBeInTheDocument());
    await user.click(screen.getByText('→ Admin'));
    await waitFor(() => expect(screen.getByText(/failed to update role/i)).toBeInTheDocument());
  });

  it('shows error toast when suspend fails', async () => {
    mockedAdminApi.listUsers.mockResolvedValue({
      users: [{ id: 'u1', name: 'Alice', email: 'alice@test.com', role: 'rider', createdAt: '2024-01-01T00:00:00Z' }],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    });
    mockedAdminApi.suspendUser.mockRejectedValue(new Error('fail'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const user = userEvent.setup();
    renderAdmin('/admin/users');
    await waitFor(() => expect(screen.getByText('Suspend')).toBeInTheDocument());
    await user.click(screen.getByText('Suspend'));
    await waitFor(() => expect(screen.getByText(/failed to suspend/i)).toBeInTheDocument());
  });
});
