import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/ui/Toast';
import Login from '../pages/Login';
import Register from '../pages/Register';

const mockLogin = vi.fn();
const mockRegister = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: mockLogin,
    register: mockRegister,
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderWithProviders(ui: React.ReactElement, route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>{ui}</ToastProvider>
    </MemoryRouter>,
  );
}

describe('Login Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form', () => {
    renderWithProviders(<Login />);
    expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('validates email is required', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);
    await user.type(screen.getByLabelText(/email/i), 'invalid');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByText(/enter a valid email/i)).toBeInTheDocument();
  });

  it('validates password is required', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
  });

  it('calls login and navigates on success', async () => {
    mockLogin.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithProviders(<Login />);
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({ email: 'test@example.com', password: 'password123' });
    });
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('shows error toast on login failure', async () => {
    const { AxiosError } = await import('axios');
    const err = new AxiosError('Unauthorized');
    (err as any).response = { data: { error: { message: 'Invalid email or password' } }, status: 401 };
    mockLogin.mockRejectedValue(err);

    const user = userEvent.setup();
    renderWithProviders(<Login />);
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
    });
  });

  it('shows generic error on non-axios error', async () => {
    mockLogin.mockRejectedValue(new Error('network error'));
    const user = userEvent.setup();
    renderWithProviders(<Login />);
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  it('has link to register page', () => {
    renderWithProviders(<Login />);
    expect(screen.getByRole('link', { name: /sign up/i })).toHaveAttribute('href', '/register');
  });
});

describe('Register Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders registration form', () => {
    renderWithProviders(<Register />);
    expect(screen.getByText(/create your account/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('validates name is required', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);
    await user.type(screen.getByLabelText(/name/i), 'Test');
    await user.type(screen.getByLabelText(/^email$/i), 'bad-email');
    await user.type(screen.getByLabelText(/^password$/i), 'Pass1234');
    await user.type(screen.getByLabelText(/confirm password/i), 'Pass1234');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByText(/enter a valid email/i)).toBeInTheDocument();
  });

  it('validates password minimum length', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);
    await user.type(screen.getByLabelText(/name/i), 'Test');
    await user.type(screen.getByLabelText(/^email$/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Ab1');
    await user.type(screen.getByLabelText(/confirm password/i), 'Ab1');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
  });

  it('validates password requires letter and number', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);
    await user.type(screen.getByLabelText(/name/i), 'Test');
    await user.type(screen.getByLabelText(/^email$/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'NoNumbers');
    await user.type(screen.getByLabelText(/confirm password/i), 'NoNumbers');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByText(/letter and one number/i)).toBeInTheDocument();
  });

  it('validates passwords match', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);
    await user.type(screen.getByLabelText(/name/i), 'Test');
    await user.type(screen.getByLabelText(/^email$/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Password1');
    await user.type(screen.getByLabelText(/confirm password/i), 'Password2');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it('calls register and navigates on success', async () => {
    mockRegister.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithProviders(<Register />);
    await user.type(screen.getByLabelText(/name/i), 'Test User');
    await user.type(screen.getByLabelText(/^email$/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Password1');
    await user.type(screen.getByLabelText(/confirm password/i), 'Password1');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({ name: 'Test User', email: 'test@example.com', password: 'Password1' });
    });
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('shows error toast on registration failure', async () => {
    const { AxiosError } = await import('axios');
    const err = new AxiosError('Conflict');
    (err as any).response = { data: { error: { message: 'Email already registered' } }, status: 409 };
    mockRegister.mockRejectedValue(err);

    const user = userEvent.setup();
    renderWithProviders(<Register />);
    await user.type(screen.getByLabelText(/name/i), 'Test');
    await user.type(screen.getByLabelText(/^email$/i), 'existing@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Password1');
    await user.type(screen.getByLabelText(/confirm password/i), 'Password1');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/email already registered/i)).toBeInTheDocument();
    });
  });

  it('has link to login page', () => {
    renderWithProviders(<Register />);
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
  });
});
