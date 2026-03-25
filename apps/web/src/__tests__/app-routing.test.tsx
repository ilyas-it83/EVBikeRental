import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../components/ui/Toast';
import App from '../App';

const mockUseAuth = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../hooks/useActiveRide', () => ({
  useActiveRide: () => ({ activeRide: null, isLoading: false }),
}));

vi.mock('../hooks/useReservation', () => ({
  useReservation: () => ({
    reservation: null, remainingSeconds: 0, isLoading: false,
    reserve: vi.fn(), cancel: vi.fn(),
  }),
}));

vi.mock('../hooks/useWebSocket', () => ({
  useWebSocket: () => ({ isConnected: false, status: 'disconnected', lastMessage: null, lastUpdated: null }),
}));

// Mock react-leaflet
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  useMap: () => ({
    flyTo: vi.fn(), removeLayer: vi.fn(), addLayer: vi.fn(),
  }),
}));

vi.mock('leaflet', () => {
  const icon = { options: {} };
  return {
    default: {
      divIcon: vi.fn(() => icon),
      marker: vi.fn(() => ({
        bindTooltip: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
      })),
      markerClusterGroup: vi.fn(() => ({
        addLayer: vi.fn(),
      })),
      Icon: {
        Default: {
          prototype: {},
          mergeOptions: vi.fn(),
        },
      },
    },
    divIcon: vi.fn(() => icon),
    marker: vi.fn(() => ({
      bindTooltip: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
    })),
    markerClusterGroup: vi.fn(() => ({
      addLayer: vi.fn(),
    })),
    Icon: {
      Default: {
        prototype: {},
        mergeOptions: vi.fn(),
      },
    },
  };
});

vi.mock('leaflet.markercluster', () => ({}));

vi.mock('../lib/api', () => ({
  default: {
    get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(),
    interceptors: { response: { use: vi.fn() } }, defaults: { baseURL: '' },
  },
  authApi: { login: vi.fn(), register: vi.fn(), logout: vi.fn(), refresh: vi.fn(), me: vi.fn() },
  stationsApi: { list: vi.fn().mockResolvedValue({ stations: [] }), getById: vi.fn() },
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

function renderApp(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('App Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login page at /login', () => {
    mockUseAuth.mockReturnValue({
      user: null, isAuthenticated: false, isLoading: false,
      login: vi.fn(), register: vi.fn(), logout: vi.fn(),
    });
    renderApp('/login');
    expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();
  });

  it('renders register page at /register', () => {
    mockUseAuth.mockReturnValue({
      user: null, isAuthenticated: false, isLoading: false,
      login: vi.fn(), register: vi.fn(), logout: vi.fn(),
    });
    renderApp('/register');
    expect(screen.getByText(/create your account/i)).toBeInTheDocument();
  });

  it('redirects authenticated user from /login to /', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', name: 'Test', email: 'test@test.com', role: 'rider' },
      isAuthenticated: true, isLoading: false,
      login: vi.fn(), register: vi.fn(), logout: vi.fn(),
    });
    renderApp('/login');
    // Should NOT be on login page
    expect(screen.queryByText(/sign in to your account/i)).not.toBeInTheDocument();
  });

  it('redirects unauthenticated user from / to /login', () => {
    mockUseAuth.mockReturnValue({
      user: null, isAuthenticated: false, isLoading: false,
      login: vi.fn(), register: vi.fn(), logout: vi.fn(),
    });
    renderApp('/');
    expect(screen.queryByText('⚡ EV Bike')).not.toBeInTheDocument();
  });

  it('renders home page for authenticated user', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', name: 'Test', email: 'test@test.com', role: 'rider' },
      isAuthenticated: true, isLoading: false,
      login: vi.fn(), register: vi.fn(), logout: vi.fn(),
    });
    renderApp('/');
    expect(screen.getByText('⚡ EV Bike')).toBeInTheDocument();
  });

  it('shows loading state for PublicOnly when auth loading', () => {
    mockUseAuth.mockReturnValue({
      user: null, isAuthenticated: false, isLoading: true,
      login: vi.fn(), register: vi.fn(), logout: vi.fn(),
    });
    renderApp('/login');
    // PublicOnly returns null when loading
    expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
  });
});
