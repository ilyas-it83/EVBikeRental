import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/ui/Toast';
import PaymentMethods from '../pages/PaymentMethods';
import { paymentMethodsApi } from '../lib/api';

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

const mockedPM = vi.mocked(paymentMethodsApi);

function renderPaymentMethods() {
  return render(
    <MemoryRouter>
      <ToastProvider><PaymentMethods /></ToastProvider>
    </MemoryRouter>,
  );
}

describe('PaymentMethods Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner', () => {
    mockedPM.list.mockReturnValue(new Promise(() => {}));
    renderPaymentMethods();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows empty state when no methods', async () => {
    mockedPM.list.mockResolvedValue({ paymentMethods: [] });
    renderPaymentMethods();
    await waitFor(() => {
      expect(screen.getByText(/no payment methods yet/i)).toBeInTheDocument();
    });
  });

  it('renders payment methods with brand/last4', async () => {
    mockedPM.list.mockResolvedValue({
      paymentMethods: [
        { id: 'pm1', type: 'card', last4: '4242', brand: 'Visa', expiryMonth: 12, expiryYear: 2026, isDefault: true },
        { id: 'pm2', type: 'card', last4: '5555', brand: 'Mastercard', expiryMonth: 6, expiryYear: 2027, isDefault: false },
      ],
    });

    renderPaymentMethods();
    await waitFor(() => {
      expect(screen.getByText(/Visa.*4242/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Mastercard.*5555/)).toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(screen.getByText(/12\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/06\/2027/)).toBeInTheDocument();
  });

  it('shows Set Default button for non-default cards', async () => {
    mockedPM.list.mockResolvedValue({
      paymentMethods: [
        { id: 'pm1', type: 'card', last4: '4242', brand: 'Visa', expiryMonth: 12, expiryYear: 2026, isDefault: true },
        { id: 'pm2', type: 'card', last4: '5555', brand: 'Mastercard', expiryMonth: 6, expiryYear: 2027, isDefault: false },
      ],
    });

    renderPaymentMethods();
    await waitFor(() => expect(screen.getByText(/visa/i)).toBeInTheDocument());
    expect(screen.getByText('Set Default')).toBeInTheDocument();
  });

  it('sets default on button click', async () => {
    mockedPM.list.mockResolvedValue({
      paymentMethods: [
        { id: 'pm1', type: 'card', last4: '4242', brand: 'Visa', expiryMonth: 12, expiryYear: 2026, isDefault: false },
      ],
    });
    mockedPM.setDefault.mockResolvedValue({ paymentMethod: { id: 'pm1', isDefault: true } as any });

    const user = userEvent.setup();
    renderPaymentMethods();
    await waitFor(() => expect(screen.getByText('Set Default')).toBeInTheDocument());

    await user.click(screen.getByText('Set Default'));
    await waitFor(() => {
      expect(mockedPM.setDefault).toHaveBeenCalledWith('pm1');
    });
  });

  it('removes card with confirmation', async () => {
    mockedPM.list.mockResolvedValue({
      paymentMethods: [
        { id: 'pm1', type: 'card', last4: '4242', brand: 'Visa', expiryMonth: 12, expiryYear: 2026, isDefault: true },
      ],
    });
    mockedPM.remove.mockResolvedValue({});
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const user = userEvent.setup();
    renderPaymentMethods();
    await waitFor(() => expect(screen.getByText('Remove')).toBeInTheDocument());

    await user.click(screen.getByText('Remove'));
    await waitFor(() => {
      expect(mockedPM.remove).toHaveBeenCalledWith('pm1');
    });
  });

  it('does not remove card when confirmation cancelled', async () => {
    mockedPM.list.mockResolvedValue({
      paymentMethods: [
        { id: 'pm1', type: 'card', last4: '4242', brand: 'Visa', expiryMonth: 12, expiryYear: 2026, isDefault: true },
      ],
    });
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    const user = userEvent.setup();
    renderPaymentMethods();
    await waitFor(() => expect(screen.getByText('Remove')).toBeInTheDocument());

    await user.click(screen.getByText('Remove'));
    expect(mockedPM.remove).not.toHaveBeenCalled();
  });

  it('opens and submits add payment form', async () => {
    mockedPM.list.mockResolvedValue({ paymentMethods: [] });
    mockedPM.add.mockResolvedValue({
      paymentMethod: { id: 'pm-new', type: 'card', last4: '1234', brand: 'Visa', expiryMonth: 3, expiryYear: 2028, isDefault: false },
    });

    const user = userEvent.setup();
    renderPaymentMethods();
    await waitFor(() => expect(screen.getByRole('button', { name: /add payment method/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /add payment method/i }));
    expect(screen.getByText(/add payment method/i)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('1234'), '9876');
    await user.clear(screen.getByPlaceholderText('MM'));
    await user.type(screen.getByPlaceholderText('MM'), '3');
    await user.clear(screen.getByPlaceholderText('YYYY'));
    await user.type(screen.getByPlaceholderText('YYYY'), '2028');
    await user.click(screen.getByRole('button', { name: /add card/i }));

    await waitFor(() => {
      expect(mockedPM.add).toHaveBeenCalledWith({ last4: '9876', brand: 'Visa', expiryMonth: 3, expiryYear: 2028 });
    });
  });

  it('validates last 4 digits', async () => {
    mockedPM.list.mockResolvedValue({ paymentMethods: [] });

    const user = userEvent.setup();
    renderPaymentMethods();
    await waitFor(() => expect(screen.getByRole('button', { name: /add payment method/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /add payment method/i }));
    await user.type(screen.getByPlaceholderText('1234'), '12');
    await user.clear(screen.getByPlaceholderText('MM'));
    await user.type(screen.getByPlaceholderText('MM'), '3');
    await user.clear(screen.getByPlaceholderText('YYYY'));
    await user.type(screen.getByPlaceholderText('YYYY'), '2028');
    await user.click(screen.getByRole('button', { name: /add card/i }));

    await waitFor(() => {
      expect(screen.getByText(/enter exactly 4 digits/i)).toBeInTheDocument();
    });
  });

  it('validates month range', async () => {
    mockedPM.list.mockResolvedValue({ paymentMethods: [] });

    const user = userEvent.setup();
    renderPaymentMethods();
    await waitFor(() => expect(screen.getByRole('button', { name: /add payment method/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /add payment method/i }));
    await user.type(screen.getByPlaceholderText('1234'), '1234');
    // Use fireEvent for number inputs to avoid jsdom constraints
    const monthInput = screen.getByPlaceholderText('MM') as HTMLInputElement;
    fireEvent.change(monthInput, { target: { value: '13' } });
    fireEvent.input(monthInput, { target: { value: '13' } });
    const yearInput = screen.getByPlaceholderText('YYYY') as HTMLInputElement;
    fireEvent.change(yearInput, { target: { value: '2028' } });
    fireEvent.input(yearInput, { target: { value: '2028' } });
    // Submit the form directly to bypass HTML5 validation
    const form = screen.getByRole('button', { name: /add card/i }).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/valid month/i)).toBeInTheDocument();
    });
  });

  it('validates year is in the future', async () => {
    mockedPM.list.mockResolvedValue({ paymentMethods: [] });

    const user = userEvent.setup();
    renderPaymentMethods();
    await waitFor(() => expect(screen.getByRole('button', { name: /add payment method/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /add payment method/i }));
    await user.type(screen.getByPlaceholderText('1234'), '1234');
    const monthInput = screen.getByPlaceholderText('MM') as HTMLInputElement;
    fireEvent.change(monthInput, { target: { value: '3' } });
    fireEvent.input(monthInput, { target: { value: '3' } });
    const yearInput = screen.getByPlaceholderText('YYYY') as HTMLInputElement;
    fireEvent.change(yearInput, { target: { value: '2020' } });
    fireEvent.input(yearInput, { target: { value: '2020' } });
    const form = screen.getByRole('button', { name: /add card/i }).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/valid future year/i)).toBeInTheDocument();
    });
  });

  it('cancel button hides add form', async () => {
    mockedPM.list.mockResolvedValue({ paymentMethods: [] });

    const user = userEvent.setup();
    renderPaymentMethods();
    await waitFor(() => expect(screen.getByRole('button', { name: /add payment method/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /add payment method/i }));
    expect(screen.getByText(/add payment method/i)).toBeInTheDocument();

    const cancelButtons = screen.getAllByRole('button', { name: /cancel/i });
    await user.click(cancelButtons[0]);
    expect(screen.queryByPlaceholderText('1234')).not.toBeInTheDocument();
  });

  it('shows error toast when add fails', async () => {
    mockedPM.list.mockResolvedValue({ paymentMethods: [] });
    mockedPM.add.mockRejectedValue(new Error('fail'));

    const user = userEvent.setup();
    renderPaymentMethods();
    await waitFor(() => expect(screen.getByRole('button', { name: /add payment method/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /add payment method/i }));
    await user.type(screen.getByPlaceholderText('1234'), '9876');
    await user.clear(screen.getByPlaceholderText('MM'));
    await user.type(screen.getByPlaceholderText('MM'), '3');
    await user.clear(screen.getByPlaceholderText('YYYY'));
    await user.type(screen.getByPlaceholderText('YYYY'), '2028');
    await user.click(screen.getByRole('button', { name: /add card/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to add payment method/i)).toBeInTheDocument();
    });
  });

  it('shows error toast on set default failure', async () => {
    mockedPM.list.mockResolvedValue({
      paymentMethods: [
        { id: 'pm1', type: 'card', last4: '4242', brand: 'Visa', expiryMonth: 12, expiryYear: 2026, isDefault: false },
      ],
    });
    mockedPM.setDefault.mockRejectedValue(new Error('fail'));

    const user = userEvent.setup();
    renderPaymentMethods();
    await waitFor(() => expect(screen.getByText('Set Default')).toBeInTheDocument());
    await user.click(screen.getByText('Set Default'));
    await waitFor(() => expect(screen.getByText(/failed to update default/i)).toBeInTheDocument());
  });

  it('shows error toast on remove failure', async () => {
    mockedPM.list.mockResolvedValue({
      paymentMethods: [
        { id: 'pm1', type: 'card', last4: '4242', brand: 'Visa', expiryMonth: 12, expiryYear: 2026, isDefault: true },
      ],
    });
    mockedPM.remove.mockRejectedValue(new Error('fail'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const user = userEvent.setup();
    renderPaymentMethods();
    await waitFor(() => expect(screen.getByText('Remove')).toBeInTheDocument());
    await user.click(screen.getByText('Remove'));
    await waitFor(() => expect(screen.getByText(/failed to remove/i)).toBeInTheDocument());
  });
});
