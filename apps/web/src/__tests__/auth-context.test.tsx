import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { authApi } from '../lib/api';

vi.mock('../lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: { response: { use: vi.fn() } },
    create: vi.fn(),
    defaults: { baseURL: '' },
  },
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    me: vi.fn(),
  },
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

const mockedAuthApi = vi.mocked(authApi);

function AuthConsumer() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(auth.isLoading)}</span>
      <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="user">{auth.user ? auth.user.email : 'null'}</span>
      <button data-testid="login-btn" onClick={() => auth.login({ email: 'a@b.com', password: 'pass' })}>Login</button>
      <button data-testid="register-btn" onClick={() => auth.register({ name: 'A', email: 'a@b.com', password: 'pass' })}>Register</button>
      <button data-testid="logout-btn" onClick={() => auth.logout()}>Logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws if useAuth is used outside AuthProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<AuthConsumer />)).toThrow('useAuth must be used within AuthProvider');
    spy.mockRestore();
  });

  it('checks auth on mount via authApi.me', async () => {
    mockedAuthApi.me.mockResolvedValue({ user: { id: '1', email: 'u@t.com', name: 'User' } });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('user')).toHaveTextContent('u@t.com');
  });

  it('sets user to null when me() fails', async () => {
    mockedAuthApi.me.mockRejectedValue(new Error('Unauthorized'));

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('user')).toHaveTextContent('null');
  });

  it('login calls authApi.login and sets user', async () => {
    mockedAuthApi.me.mockRejectedValue(new Error('No session'));
    mockedAuthApi.login.mockResolvedValue({ user: { id: '1', email: 'a@b.com', name: 'A' } });

    const { getByTestId } = render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(getByTestId('loading')).toHaveTextContent('false'));

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    await user.click(getByTestId('login-btn'));

    await waitFor(() => {
      expect(getByTestId('user')).toHaveTextContent('a@b.com');
    });
    expect(mockedAuthApi.login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pass' });
  });

  it('register calls authApi.register and sets user', async () => {
    mockedAuthApi.me.mockRejectedValue(new Error('No session'));
    mockedAuthApi.register.mockResolvedValue({ user: { id: '2', email: 'a@b.com', name: 'A' } });

    const { getByTestId } = render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(getByTestId('loading')).toHaveTextContent('false'));

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    await user.click(getByTestId('register-btn'));

    await waitFor(() => {
      expect(getByTestId('user')).toHaveTextContent('a@b.com');
    });
  });

  it('logout calls authApi.logout and clears user', async () => {
    mockedAuthApi.me.mockResolvedValue({ user: { id: '1', email: 'u@t.com', name: 'User' } });
    mockedAuthApi.logout.mockResolvedValue({});

    const { getByTestId } = render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(getByTestId('authenticated')).toHaveTextContent('true'));

    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    await user.click(getByTestId('logout-btn'));

    await waitFor(() => {
      expect(getByTestId('authenticated')).toHaveTextContent('false');
      expect(getByTestId('user')).toHaveTextContent('null');
    });
  });

  it('does not update state after unmount (cancelled branch)', async () => {
    let resolve: (v: any) => void;
    mockedAuthApi.me.mockReturnValue(new Promise((r) => { resolve = r; }));

    const { unmount } = render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    // Unmount before me() resolves - triggers cancelled=true branches
    unmount();
    resolve!({ user: { id: '1', email: 'u@t.com', name: 'User' } });
    await new Promise((r) => setTimeout(r, 50));
  });
});
