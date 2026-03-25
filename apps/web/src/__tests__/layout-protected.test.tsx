import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../components/ui/Toast';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { Layout } from '../components/Layout';

const mockUseAuth = vi.fn();
const mockUseActiveRide = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../hooks/useActiveRide', () => ({
  useActiveRide: () => mockUseActiveRide(),
}));

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

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows spinner while loading', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: true, user: null, login: vi.fn(), logout: vi.fn(), register: vi.fn() });

    render(
      <MemoryRouter>
        <ProtectedRoute><div>Protected</div></ProtectedRoute>
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('status').length).toBeGreaterThanOrEqual(1);
  });

  it('redirects to /login when not authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, user: null, login: vi.fn(), logout: vi.fn(), register: vi.fn() });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={<ProtectedRoute><div>Protected</div></ProtectedRoute>} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected')).not.toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true, isLoading: false,
      user: { id: 'u1', name: 'Test', email: 'test@test.com', role: 'rider' },
      login: vi.fn(), logout: vi.fn(), register: vi.fn(),
    });

    render(
      <MemoryRouter>
        <ProtectedRoute><div>Protected Content</div></ProtectedRoute>
      </MemoryRouter>,
    );
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nav links and user name', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', name: 'Test User', email: 'test@test.com', role: 'rider' },
      isAuthenticated: true, isLoading: false,
      login: vi.fn(), logout: vi.fn(), register: vi.fn(),
    });
    mockUseActiveRide.mockReturnValue({ activeRide: null, isLoading: false });

    render(
      <MemoryRouter>
        <ToastProvider>
          <Layout><div>Content</div></Layout>
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('⚡ EV Bike')).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getAllByText(/map/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/rides/i).length).toBeGreaterThan(0);
  });

  it('shows admin link for admin users', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'a1', name: 'Admin', email: 'admin@test.com', role: 'admin' },
      isAuthenticated: true, isLoading: false,
      login: vi.fn(), logout: vi.fn(), register: vi.fn(),
    });
    mockUseActiveRide.mockReturnValue({ activeRide: null, isLoading: false });

    render(
      <MemoryRouter>
        <ToastProvider>
          <Layout><div>Admin Content</div></Layout>
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(screen.getAllByText(/admin/i).length).toBeGreaterThan(0);
  });

  it('does not show admin link for rider users', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', name: 'Rider', email: 'rider@test.com', role: 'rider' },
      isAuthenticated: true, isLoading: false,
      login: vi.fn(), logout: vi.fn(), register: vi.fn(),
    });
    mockUseActiveRide.mockReturnValue({ activeRide: null, isLoading: false });

    render(
      <MemoryRouter>
        <ToastProvider>
          <Layout><div>Content</div></Layout>
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(screen.queryByText('⚙️ Admin')).not.toBeInTheDocument();
  });

  it('shows active ride indicator when ride is active', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', name: 'Test', email: 'test@test.com', role: 'rider' },
      isAuthenticated: true, isLoading: false,
      login: vi.fn(), logout: vi.fn(), register: vi.fn(),
    });
    mockUseActiveRide.mockReturnValue({
      activeRide: { id: 'r1', status: 'active' },
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <ToastProvider>
          <Layout><div>Content</div></Layout>
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(screen.getAllByText(/active ride/i).length).toBeGreaterThan(0);
  });

  it('handles logout', async () => {
    const mockLogout = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', name: 'Test', email: 'test@test.com', role: 'rider' },
      isAuthenticated: true, isLoading: false,
      login: vi.fn(), logout: mockLogout, register: vi.fn(),
    });
    mockUseActiveRide.mockReturnValue({ activeRide: null, isLoading: false });

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<Layout><div>Home</div></Layout>} />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByText('Log out'));
    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
  });

  it('shows error toast when logout fails', async () => {
    const mockLogout = vi.fn().mockRejectedValue(new Error('fail'));
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', name: 'Test', email: 'test@test.com', role: 'rider' },
      isAuthenticated: true, isLoading: false,
      login: vi.fn(), logout: mockLogout, register: vi.fn(),
    });
    mockUseActiveRide.mockReturnValue({ activeRide: null, isLoading: false });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ToastProvider>
          <Layout><div>Content</div></Layout>
        </ToastProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByText('Log out'));
    await waitFor(() => expect(screen.getByText(/failed to log out/i)).toBeInTheDocument());
  });
});
