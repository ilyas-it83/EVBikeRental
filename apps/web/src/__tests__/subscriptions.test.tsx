import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/ui/Toast';
import Subscriptions from '../pages/Subscriptions';
import { subscriptionsApi } from '../lib/api';

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

const mockedSubsApi = vi.mocked(subscriptionsApi);

function renderSubscriptions() {
  return render(
    <MemoryRouter>
      <ToastProvider><Subscriptions /></ToastProvider>
    </MemoryRouter>,
  );
}

describe('Subscriptions Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner', () => {
    mockedSubsApi.getPlans.mockReturnValue(new Promise(() => {}));
    mockedSubsApi.getCurrent.mockReturnValue(new Promise(() => {}));
    renderSubscriptions();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders 3 plan cards with fallback data', async () => {
    mockedSubsApi.getPlans.mockRejectedValue(new Error('fail'));
    mockedSubsApi.getCurrent.mockRejectedValue(new Error('fail'));

    renderSubscriptions();
    await waitFor(() => expect(screen.getByText('Subscription Plans')).toBeInTheDocument());

    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('Monthly')).toBeInTheDocument();
    expect(screen.getByText('Annual')).toBeInTheDocument();
  });

  it('renders plans from API', async () => {
    mockedSubsApi.getPlans.mockResolvedValue({
      plans: [
        { plan: 'free', name: 'Free', price: 0, interval: 'month', discountPercent: 0 },
        { plan: 'monthly', name: 'Monthly', price: 9.99, interval: 'month', discountPercent: 20 },
        { plan: 'annual', name: 'Annual', price: 89.99, interval: 'year', discountPercent: 30 },
      ],
    });
    mockedSubsApi.getCurrent.mockResolvedValue({ subscription: null });

    renderSubscriptions();
    await waitFor(() => expect(screen.getByText('Subscription Plans')).toBeInTheDocument());

    expect(screen.getByText('$9.99')).toBeInTheDocument();
    expect(screen.getByText('$89.99')).toBeInTheDocument();
    expect(screen.getByText(/20% off all rides/)).toBeInTheDocument();
    expect(screen.getByText(/30% off all rides/)).toBeInTheDocument();
  });

  it('highlights current plan', async () => {
    mockedSubsApi.getPlans.mockResolvedValue({
      plans: [
        { plan: 'free', name: 'Free', price: 0, interval: 'month', discountPercent: 0 },
        { plan: 'monthly', name: 'Monthly', price: 9.99, interval: 'month', discountPercent: 20 },
        { plan: 'annual', name: 'Annual', price: 89.99, interval: 'year', discountPercent: 30 },
      ],
    });
    mockedSubsApi.getCurrent.mockResolvedValue({
      subscription: { id: 'sub1', plan: 'monthly', status: 'active' },
    });

    renderSubscriptions();
    await waitFor(() => expect(screen.getByText('Current')).toBeInTheDocument());
  });

  it('shows subscribe button for non-current plans', async () => {
    mockedSubsApi.getPlans.mockResolvedValue({
      plans: [
        { plan: 'free', name: 'Free', price: 0, interval: 'month', discountPercent: 0 },
        { plan: 'monthly', name: 'Monthly', price: 9.99, interval: 'month', discountPercent: 20 },
      ],
    });
    mockedSubsApi.getCurrent.mockResolvedValue({ subscription: null });

    renderSubscriptions();
    await waitFor(() => expect(screen.getByText('Subscription Plans')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /subscribe/i })).toBeInTheDocument();
  });

  it('subscribes on button click', async () => {
    mockedSubsApi.getPlans.mockResolvedValue({
      plans: [
        { plan: 'free', name: 'Free', price: 0, interval: 'month', discountPercent: 0 },
        { plan: 'monthly', name: 'Monthly', price: 9.99, interval: 'month', discountPercent: 20 },
      ],
    });
    mockedSubsApi.getCurrent.mockResolvedValue({ subscription: null });
    mockedSubsApi.subscribe.mockResolvedValue({ subscription: { id: 'sub1', plan: 'monthly', status: 'active' } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const user = userEvent.setup();
    renderSubscriptions();
    await waitFor(() => expect(screen.getByRole('button', { name: /subscribe/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /subscribe/i }));
    await waitFor(() => {
      expect(mockedSubsApi.subscribe).toHaveBeenCalledWith('monthly');
    });
  });

  it('cancels subscription', async () => {
    mockedSubsApi.getPlans.mockResolvedValue({
      plans: [
        { plan: 'free', name: 'Free', price: 0, interval: 'month', discountPercent: 0 },
        { plan: 'monthly', name: 'Monthly', price: 9.99, interval: 'month', discountPercent: 20 },
      ],
    });
    mockedSubsApi.getCurrent.mockResolvedValue({
      subscription: { id: 'sub1', plan: 'monthly', status: 'active' },
    });
    mockedSubsApi.cancel.mockResolvedValue({});
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const user = userEvent.setup();
    renderSubscriptions();
    await waitFor(() => expect(screen.getByRole('button', { name: /cancel plan/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /cancel plan/i }));
    await waitFor(() => {
      expect(mockedSubsApi.cancel).toHaveBeenCalled();
    });
  });

  it('shows current plan button as disabled for free plan', async () => {
    mockedSubsApi.getPlans.mockResolvedValue({
      plans: [
        { plan: 'free', name: 'Free', price: 0, interval: 'month', discountPercent: 0 },
      ],
    });
    mockedSubsApi.getCurrent.mockResolvedValue({ subscription: null });

    renderSubscriptions();
    await waitFor(() => expect(screen.getByRole('button', { name: /current plan/i })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /current plan/i })).toBeDisabled();
  });

  it('shows Best Value badge on annual plan', async () => {
    mockedSubsApi.getPlans.mockResolvedValue({
      plans: [
        { plan: 'annual', name: 'Annual', price: 89.99, interval: 'year', discountPercent: 30 },
      ],
    });
    mockedSubsApi.getCurrent.mockResolvedValue({ subscription: null });

    renderSubscriptions();
    await waitFor(() => expect(screen.getByText('Best Value')).toBeInTheDocument());
  });

  it('shows current period end date', async () => {
    mockedSubsApi.getPlans.mockResolvedValue({
      plans: [{ plan: 'monthly', name: 'Monthly', price: 9.99, interval: 'month', discountPercent: 20 }],
    });
    mockedSubsApi.getCurrent.mockResolvedValue({
      subscription: { id: 'sub1', plan: 'monthly', status: 'active', currentPeriodEnd: '2025-12-31T00:00:00Z' },
    });

    renderSubscriptions();
    await waitFor(() => expect(screen.getByText(/current period ends/i)).toBeInTheDocument());
  });

  it('does not subscribe when confirm is cancelled', async () => {
    mockedSubsApi.getPlans.mockResolvedValue({
      plans: [{ plan: 'monthly', name: 'Monthly', price: 9.99, interval: 'month', discountPercent: 20 }],
    });
    mockedSubsApi.getCurrent.mockResolvedValue({ subscription: null });
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    const user = userEvent.setup();
    renderSubscriptions();
    await waitFor(() => expect(screen.getByRole('button', { name: /subscribe/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /subscribe/i }));
    expect(mockedSubsApi.subscribe).not.toHaveBeenCalled();
  });

  it('shows error toast on subscribe failure', async () => {
    mockedSubsApi.getPlans.mockResolvedValue({
      plans: [{ plan: 'monthly', name: 'Monthly', price: 9.99, interval: 'month', discountPercent: 20 }],
    });
    mockedSubsApi.getCurrent.mockResolvedValue({ subscription: null });
    mockedSubsApi.subscribe.mockRejectedValue(new Error('fail'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const user = userEvent.setup();
    renderSubscriptions();
    await waitFor(() => expect(screen.getByRole('button', { name: /subscribe/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /subscribe/i }));
    await waitFor(() => expect(screen.getByText(/failed to subscribe/i)).toBeInTheDocument());
  });

  it('shows error toast on cancel failure', async () => {
    mockedSubsApi.getPlans.mockResolvedValue({
      plans: [{ plan: 'monthly', name: 'Monthly', price: 9.99, interval: 'month', discountPercent: 20 }],
    });
    mockedSubsApi.getCurrent.mockResolvedValue({
      subscription: { id: 'sub1', plan: 'monthly', status: 'active' },
    });
    mockedSubsApi.cancel.mockRejectedValue(new Error('fail'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const user = userEvent.setup();
    renderSubscriptions();
    await waitFor(() => expect(screen.getByRole('button', { name: /cancel plan/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /cancel plan/i }));
    await waitFor(() => expect(screen.getByText(/failed to cancel/i)).toBeInTheDocument());
  });

  it('shows free plan features', async () => {
    mockedSubsApi.getPlans.mockResolvedValue({
      plans: [{ plan: 'free', name: 'Free', price: 0, interval: 'month', discountPercent: 0 }],
    });
    mockedSubsApi.getCurrent.mockResolvedValue({ subscription: null });

    renderSubscriptions();
    await waitFor(() => expect(screen.getByText(/pay-per-ride/i)).toBeInTheDocument());
    expect(screen.getByText(/basic access/i)).toBeInTheDocument();
    expect(screen.getByText(/standard support/i)).toBeInTheDocument();
  });

  it('shows paid plan features', async () => {
    mockedSubsApi.getPlans.mockResolvedValue({
      plans: [{ plan: 'monthly', name: 'Monthly', price: 9.99, interval: 'month', discountPercent: 20 }],
    });
    mockedSubsApi.getCurrent.mockResolvedValue({ subscription: null });

    renderSubscriptions();
    await waitFor(() => expect(screen.getByText(/20% off all rides/i)).toBeInTheDocument());
    expect(screen.getByText(/priority bike access/i)).toBeInTheDocument();
    expect(screen.getByText(/extended reservations/i)).toBeInTheDocument();
  });
});
