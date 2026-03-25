/**
 * Admin & Subscription Frontend Component Tests
 *
 * Tests:
 * - FleetOverview stat cards
 * - StationManagement table
 * - BikeManagement table with filters
 * - Subscription plan cards
 * - Admin pages redirect non-admin users
 *
 * References: Sprint 3, PRD §4.1, §4.2
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  createMockAuthContext,
  createAuthenticatedContext,
  type MockAuthContextValue,
  type MockAuthUser,
} from '../test/setup.js';

// ─── Mock Auth Context ──────────────────────────────

const AuthContext = createContext<MockAuthContextValue>(createMockAuthContext());

function AuthProvider({ value, children }: { value: MockAuthContextValue; children: React.ReactNode }) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  return useContext(AuthContext);
}

// ─── Types ──────────────────────────────────────────

interface FleetOverviewData {
  totalBikes: number;
  activeBikes: number;
  inUseBikes: number;
  maintenanceBikes: number;
  revenueToday: number;
}

interface Station {
  id: string;
  name: string;
  address: string;
  capacity: number;
  status: string;
}

interface Bike {
  id: string;
  stationId: string | null;
  status: string;
  batteryLevel: number;
  model: string;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  interval: string | null;
  discount: number;
}

// ─── Mock APIs ──────────────────────────────────────

const adminApi = {
  getFleetOverview: vi.fn(),
  listStations: vi.fn(),
  listBikes: vi.fn(),
  listUsers: vi.fn(),
  createStation: vi.fn(),
  updateStation: vi.fn(),
  deleteStation: vi.fn(),
  createBike: vi.fn(),
  updateBike: vi.fn(),
  deleteBike: vi.fn(),
};

const subscriptionsApi = {
  getPlans: vi.fn(),
  getCurrent: vi.fn(),
  subscribe: vi.fn(),
  cancel: vi.fn(),
};

const reservationsApi = {
  create: vi.fn(),
  cancel: vi.fn(),
  getActive: vi.fn(),
};

// ─── Component Stubs ────────────────────────────────

function FleetOverviewPage({
  fetchOverview,
}: {
  fetchOverview: () => Promise<FleetOverviewData>;
}) {
  const [data, setData] = useState<FleetOverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOverview()
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [fetchOverview]);

  if (loading) return <div data-testid="loading">Loading...</div>;
  if (!data) return <div data-testid="error">Failed to load</div>;

  return (
    <div data-testid="fleet-overview">
      <h2>Fleet Overview</h2>
      <div data-testid="stat-total-bikes">
        <span data-testid="stat-label">Total Bikes</span>
        <span data-testid="stat-value">{data.totalBikes}</span>
      </div>
      <div data-testid="stat-active-bikes">
        <span data-testid="stat-label">Available</span>
        <span data-testid="stat-value">{data.activeBikes}</span>
      </div>
      <div data-testid="stat-in-use">
        <span data-testid="stat-label">In Use</span>
        <span data-testid="stat-value">{data.inUseBikes}</span>
      </div>
      <div data-testid="stat-maintenance">
        <span data-testid="stat-label">Maintenance</span>
        <span data-testid="stat-value">{data.maintenanceBikes}</span>
      </div>
      <div data-testid="stat-revenue">
        <span data-testid="stat-label">Revenue Today</span>
        <span data-testid="stat-value">${data.revenueToday.toFixed(2)}</span>
      </div>
    </div>
  );
}

function StationManagementPage({
  fetchStations,
}: {
  fetchStations: () => Promise<Station[]>;
}) {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStations()
      .then((s) => { setStations(s); setLoading(false); })
      .catch(() => setLoading(false));
  }, [fetchStations]);

  if (loading) return <div data-testid="loading">Loading...</div>;

  return (
    <div data-testid="station-management">
      <h2>Stations</h2>
      <table data-testid="station-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Address</th>
            <th>Capacity</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {stations.map((s) => (
            <tr key={s.id} data-testid={`station-row-${s.id}`}>
              <td data-testid="station-name">{s.name}</td>
              <td data-testid="station-address">{s.address}</td>
              <td data-testid="station-capacity">{s.capacity}</td>
              <td data-testid="station-status">{s.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BikeManagementPage({
  fetchBikes,
}: {
  fetchBikes: (filters?: { status?: string }) => Promise<Bike[]>;
}) {
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    const filters = statusFilter ? { status: statusFilter } : undefined;
    fetchBikes(filters)
      .then((b) => { setBikes(b); setLoading(false); })
      .catch(() => setLoading(false));
  }, [fetchBikes, statusFilter]);

  if (loading) return <div data-testid="loading">Loading...</div>;

  return (
    <div data-testid="bike-management">
      <h2>Bikes</h2>
      <select
        data-testid="status-filter"
        value={statusFilter}
        onChange={(e) => { setLoading(true); setStatusFilter(e.target.value); }}
      >
        <option value="">All</option>
        <option value="available">Available</option>
        <option value="in_use">In Use</option>
        <option value="maintenance">Maintenance</option>
      </select>
      <table data-testid="bike-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Model</th>
            <th>Status</th>
            <th>Battery</th>
          </tr>
        </thead>
        <tbody>
          {bikes.map((b) => (
            <tr key={b.id} data-testid={`bike-row-${b.id}`}>
              <td data-testid="bike-id">{b.id}</td>
              <td data-testid="bike-model">{b.model}</td>
              <td data-testid="bike-status">{b.status}</td>
              <td data-testid="bike-battery">{b.batteryLevel}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubscriptionPage({
  fetchPlans,
  onSubscribe,
}: {
  fetchPlans: () => Promise<SubscriptionPlan[]>;
  onSubscribe: (planId: string) => Promise<void>;
}) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlans()
      .then((p) => { setPlans(p); setLoading(false); })
      .catch(() => setLoading(false));
  }, [fetchPlans]);

  if (loading) return <div data-testid="loading">Loading...</div>;

  return (
    <div data-testid="subscription-page">
      <h2>Subscription Plans</h2>
      <div data-testid="plan-cards">
        {plans.map((plan) => (
          <div key={plan.id} data-testid={`plan-${plan.id}`}>
            <h3 data-testid="plan-name">{plan.name}</h3>
            <p data-testid="plan-price">
              {plan.price === 0 ? 'Free' : `$${plan.price.toFixed(2)}/${plan.interval}`}
            </p>
            <p data-testid="plan-discount">
              {plan.discount > 0 ? `${(plan.discount * 100).toFixed(0)}% off rides` : 'No discount'}
            </p>
            <button
              data-testid="plan-subscribe-btn"
              onClick={() => onSubscribe(plan.id)}
            >
              {plan.price === 0 ? 'Current Plan' : 'Subscribe'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <div data-testid="redirect-login">Redirecting to login...</div>;
  }

  if (user.role !== 'admin') {
    return <div data-testid="access-denied">Access denied. Admin only.</div>;
  }

  return <>{children}</>;
}

// ─── Test Helpers ───────────────────────────────────

function renderWithProviders(
  ui: React.ReactElement,
  authOverrides: Partial<MockAuthContextValue> = {},
) {
  const authValue = createAuthenticatedContext(authOverrides);
  return render(
    <MemoryRouter>
      <AuthProvider value={authValue}>
        {ui}
      </AuthProvider>
    </MemoryRouter>,
  );
}

function renderWithAdminAuth(ui: React.ReactElement) {
  const adminUser: MockAuthUser = { id: 'admin-001', email: 'admin@test.com', name: 'Admin', role: 'admin' };
  return renderWithProviders(ui, { user: adminUser });
}

// ─── Tests ──────────────────────────────────────────

describe('FleetOverview', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should show stat cards with correct data', async () => {
    const mockData: FleetOverviewData = {
      totalBikes: 50,
      activeBikes: 35,
      inUseBikes: 10,
      maintenanceBikes: 5,
      revenueToday: 245.50,
    };
    const fetchOverview = vi.fn().mockResolvedValue(mockData);

    renderWithAdminAuth(<FleetOverviewPage fetchOverview={fetchOverview} />);

    await waitFor(() => {
      expect(screen.getByTestId('fleet-overview')).toBeInTheDocument();
    });

    const totalCard = within(screen.getByTestId('stat-total-bikes'));
    expect(totalCard.getByTestId('stat-value')).toHaveTextContent('50');

    const activeCard = within(screen.getByTestId('stat-active-bikes'));
    expect(activeCard.getByTestId('stat-value')).toHaveTextContent('35');

    const inUseCard = within(screen.getByTestId('stat-in-use'));
    expect(inUseCard.getByTestId('stat-value')).toHaveTextContent('10');

    const maintenanceCard = within(screen.getByTestId('stat-maintenance'));
    expect(maintenanceCard.getByTestId('stat-value')).toHaveTextContent('5');

    const revenueCard = within(screen.getByTestId('stat-revenue'));
    expect(revenueCard.getByTestId('stat-value')).toHaveTextContent('$245.50');
  });

  it('should display loading state initially', () => {
    const fetchOverview = vi.fn().mockReturnValue(new Promise(() => {}));
    renderWithAdminAuth(<FleetOverviewPage fetchOverview={fetchOverview} />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });
});

describe('StationManagement', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should render station table', async () => {
    const mockStations: Station[] = [
      { id: 'station-001', name: 'Central Park', address: '100 CP West', capacity: 20, status: 'active' },
      { id: 'station-002', name: 'Times Square', address: 'Times Sq', capacity: 15, status: 'active' },
      { id: 'station-003', name: 'Brooklyn Bridge', address: 'BB, NYC', capacity: 10, status: 'inactive' },
    ];
    const fetchStations = vi.fn().mockResolvedValue(mockStations);

    renderWithAdminAuth(<StationManagementPage fetchStations={fetchStations} />);

    await waitFor(() => {
      expect(screen.getByTestId('station-management')).toBeInTheDocument();
    });

    expect(screen.getByTestId('station-table')).toBeInTheDocument();

    const row1 = within(screen.getByTestId('station-row-station-001'));
    expect(row1.getByTestId('station-name')).toHaveTextContent('Central Park');
    expect(row1.getByTestId('station-capacity')).toHaveTextContent('20');

    const row3 = within(screen.getByTestId('station-row-station-003'));
    expect(row3.getByTestId('station-status')).toHaveTextContent('inactive');

    // All 3 stations rendered
    expect(screen.getAllByTestId(/^station-row-/)).toHaveLength(3);
  });
});

describe('BikeManagement', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should render bike table with filters', async () => {
    const mockBikes: Bike[] = [
      { id: 'bike-001', stationId: 'station-001', status: 'available', batteryLevel: 95, model: 'EV-Pro' },
      { id: 'bike-002', stationId: 'station-001', status: 'in_use', batteryLevel: 60, model: 'EV-Standard' },
      { id: 'bike-003', stationId: 'station-002', status: 'maintenance', batteryLevel: 10, model: 'EV-Standard' },
    ];
    const fetchBikes = vi.fn().mockResolvedValue(mockBikes);

    renderWithAdminAuth(<BikeManagementPage fetchBikes={fetchBikes} />);

    await waitFor(() => {
      expect(screen.getByTestId('bike-management')).toBeInTheDocument();
    });

    expect(screen.getByTestId('bike-table')).toBeInTheDocument();
    expect(screen.getByTestId('status-filter')).toBeInTheDocument();

    const row1 = within(screen.getByTestId('bike-row-bike-001'));
    expect(row1.getByTestId('bike-model')).toHaveTextContent('EV-Pro');
    expect(row1.getByTestId('bike-status')).toHaveTextContent('available');
    expect(row1.getByTestId('bike-battery')).toHaveTextContent('95%');

    expect(screen.getAllByTestId(/^bike-row-/)).toHaveLength(3);
  });

  it('should call fetchBikes with filter when status filter changes', async () => {
    const user = userEvent.setup();
    const allBikes: Bike[] = [
      { id: 'bike-001', stationId: 'station-001', status: 'available', batteryLevel: 95, model: 'EV-Pro' },
    ];
    const filteredBikes: Bike[] = [
      { id: 'bike-001', stationId: 'station-001', status: 'available', batteryLevel: 95, model: 'EV-Pro' },
    ];
    const fetchBikes = vi.fn()
      .mockResolvedValueOnce(allBikes)
      .mockResolvedValueOnce(filteredBikes);

    renderWithAdminAuth(<BikeManagementPage fetchBikes={fetchBikes} />);

    await waitFor(() => {
      expect(screen.getByTestId('bike-management')).toBeInTheDocument();
    });

    // Change filter
    await user.selectOptions(screen.getByTestId('status-filter'), 'available');

    await waitFor(() => {
      expect(fetchBikes).toHaveBeenCalledWith({ status: 'available' });
    });
  });
});

describe('SubscriptionPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should show plan cards with correct data', async () => {
    const mockPlans: SubscriptionPlan[] = [
      { id: 'free', name: 'Free', price: 0, interval: null, discount: 0 },
      { id: 'monthly', name: 'Monthly', price: 14.99, interval: 'month', discount: 0.20 },
      { id: 'annual', name: 'Annual', price: 119.99, interval: 'year', discount: 0.30 },
    ];
    const fetchPlans = vi.fn().mockResolvedValue(mockPlans);
    const onSubscribe = vi.fn();

    renderWithProviders(
      <SubscriptionPage fetchPlans={fetchPlans} onSubscribe={onSubscribe} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('subscription-page')).toBeInTheDocument();
    });

    // Free plan
    const freePlan = within(screen.getByTestId('plan-free'));
    expect(freePlan.getByTestId('plan-name')).toHaveTextContent('Free');
    expect(freePlan.getByTestId('plan-price')).toHaveTextContent('Free');
    expect(freePlan.getByTestId('plan-discount')).toHaveTextContent('No discount');

    // Monthly plan
    const monthlyPlan = within(screen.getByTestId('plan-monthly'));
    expect(monthlyPlan.getByTestId('plan-name')).toHaveTextContent('Monthly');
    expect(monthlyPlan.getByTestId('plan-price')).toHaveTextContent('$14.99/month');
    expect(monthlyPlan.getByTestId('plan-discount')).toHaveTextContent('20% off rides');

    // Annual plan
    const annualPlan = within(screen.getByTestId('plan-annual'));
    expect(annualPlan.getByTestId('plan-name')).toHaveTextContent('Annual');
    expect(annualPlan.getByTestId('plan-price')).toHaveTextContent('$119.99/year');
    expect(annualPlan.getByTestId('plan-discount')).toHaveTextContent('30% off rides');
  });

  it('should call onSubscribe when plan button clicked', async () => {
    const user = userEvent.setup();
    const mockPlans: SubscriptionPlan[] = [
      { id: 'monthly', name: 'Monthly', price: 14.99, interval: 'month', discount: 0.20 },
    ];
    const fetchPlans = vi.fn().mockResolvedValue(mockPlans);
    const onSubscribe = vi.fn().mockResolvedValue(undefined);

    renderWithProviders(
      <SubscriptionPage fetchPlans={fetchPlans} onSubscribe={onSubscribe} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('plan-monthly')).toBeInTheDocument();
    });

    await user.click(within(screen.getByTestId('plan-monthly')).getByTestId('plan-subscribe-btn'));
    expect(onSubscribe).toHaveBeenCalledWith('monthly');
  });
});

describe('Admin page access control', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should show access denied for non-admin (rider) user', () => {
    const riderContext = createAuthenticatedContext();

    render(
      <MemoryRouter>
        <AuthProvider value={riderContext}>
          <AdminGuard>
            <div data-testid="admin-content">Admin Content</div>
          </AdminGuard>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('access-denied')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
  });

  it('should redirect to login for unauthenticated user', () => {
    const unauthContext = createMockAuthContext();

    render(
      <MemoryRouter>
        <AuthProvider value={unauthContext}>
          <AdminGuard>
            <div data-testid="admin-content">Admin Content</div>
          </AdminGuard>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('redirect-login')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
  });

  it('should show content for admin user', () => {
    const adminUser: MockAuthUser = { id: 'admin-001', email: 'admin@test.com', name: 'Admin', role: 'admin' };
    const adminContext = createAuthenticatedContext({ user: adminUser });

    render(
      <MemoryRouter>
        <AuthProvider value={adminContext}>
          <AdminGuard>
            <div data-testid="admin-content">Admin Content</div>
          </AdminGuard>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('admin-content')).toBeInTheDocument();
    expect(screen.queryByTestId('access-denied')).not.toBeInTheDocument();
  });
});
