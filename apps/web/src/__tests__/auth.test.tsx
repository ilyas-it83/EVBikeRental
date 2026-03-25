/**
 * Auth Components Tests
 *
 * Tests frontend auth UI behavior against acceptance criteria.
 * Validates: form validation, error display, protected routes,
 * API error handling.
 *
 * These tests mock the auth context and API layer to test component behavior
 * independent of backend implementation.
 *
 * References: GitHub Issues #7, #8, PRD §3.1
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { createContext, useContext } from 'react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import {
  createMockAuthContext,
  createAuthenticatedContext,
  type MockAuthContextValue,
} from '../test/setup.js';

// ─── Mock Auth Context Provider ─────────────────────
// This mirrors the expected AuthContext that Fry will build.
// Tests validate behavior contracts, not implementation.

const AuthContext = createContext<MockAuthContextValue>(createMockAuthContext());

function AuthProvider({ value, children }: { value: MockAuthContextValue; children: React.ReactNode }) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  return useContext(AuthContext);
}

// ─── Minimal Component Stubs ────────────────────────
// These mirror the expected component behavior from acceptance criteria.
// When Fry builds the real components, tests will import those instead.

function RegisterForm() {
  const { register } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setEmailError(null);
    setPasswordError(null);

    const form = new FormData(e.currentTarget);
    const email = form.get('email') as string;
    const password = form.get('password') as string;
    const name = form.get('name') as string;

    // Client-side validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    if (!/\d/.test(password)) {
      setPasswordError('Password must contain at least one number');
      return;
    }

    try {
      await (register as (...args: unknown[]) => Promise<void>)(email, password, name);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setError('An account with this email already exists');
      } else {
        setError('Registration failed. Please try again.');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="name">Name</label>
      <input id="name" name="name" type="text" />

      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="text" aria-label="Email" />
      {emailError && <span role="alert">{emailError}</span>}

      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" />
      {passwordError && <span role="alert">{passwordError}</span>}

      {error && <div role="alert">{error}</div>}
      <button type="submit">Register</button>
    </form>
  );
}

function LoginForm() {
  const { login } = useAuth();
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const email = form.get('email') as string;
    const password = form.get('password') as string;

    try {
      await (login as (...args: unknown[]) => Promise<void>)(email, password);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setError('Invalid email or password');
      } else {
        setError('Login failed. Please try again.');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="login-email">Email</label>
      <input id="login-email" name="email" type="email" />

      <label htmlFor="login-password">Password</label>
      <input id="login-password" name="password" type="password" />

      {error && <div role="alert">{error}</div>}
      <button type="submit">Log in</button>
    </form>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function Dashboard() {
  return <div>Welcome to your dashboard</div>;
}

// ─── Test Helpers ───────────────────────────────────

function renderWithProviders(
  ui: React.ReactElement,
  {
    authValue = createMockAuthContext(),
    initialRoute = '/',
  }: { authValue?: MockAuthContextValue; initialRoute?: string } = {},
) {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <AuthProvider value={authValue}>
        {ui}
      </AuthProvider>
    </MemoryRouter>,
  );
}

// ─── Tests ──────────────────────────────────────────

describe('Register Form', () => {
  it('should validate email format on submit', async () => {
    const user = userEvent.setup();
    const authCtx = createMockAuthContext();
    renderWithProviders(<RegisterForm />, { authValue: authCtx });

    await user.type(screen.getByLabelText('Name'), 'Test');
    await user.type(screen.getByLabelText('Email'), 'invalid-email');
    await user.type(screen.getByLabelText('Password'), 'StrongPass1');
    await user.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i);
    });

    // Register should NOT have been called
    expect(authCtx.register).not.toHaveBeenCalled();
  });

  it('should validate password minimum length', async () => {
    const user = userEvent.setup();
    const authCtx = createMockAuthContext();
    renderWithProviders(<RegisterForm />, { authValue: authCtx });

    await user.type(screen.getByLabelText('Name'), 'Test');
    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'Ab1');
    await user.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/at least 8 characters/i);
    });

    expect(authCtx.register).not.toHaveBeenCalled();
  });

  it('should validate password contains a number', async () => {
    const user = userEvent.setup();
    const authCtx = createMockAuthContext();
    renderWithProviders(<RegisterForm />, { authValue: authCtx });

    await user.type(screen.getByLabelText('Name'), 'Test');
    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'NoNumbersHere');
    await user.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/number/i);
    });

    expect(authCtx.register).not.toHaveBeenCalled();
  });

  it('should show error on duplicate email (API 409)', async () => {
    const user = userEvent.setup();
    const authCtx = createMockAuthContext({
      register: vi.fn().mockRejectedValue({
        response: { status: 409, data: { error: { message: 'Email already registered' } } },
        isAxiosError: true,
      }),
    });

    renderWithProviders(<RegisterForm />, { authValue: authCtx });

    await user.type(screen.getByLabelText('Name'), 'Test');
    await user.type(screen.getByLabelText('Email'), 'existing@example.com');
    await user.type(screen.getByLabelText('Password'), 'StrongPass1');
    await user.click(screen.getByRole('button', { name: /register/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/already exists/i);
    });
  });
});

describe('Login Form', () => {
  it('should submit and call login on valid input', async () => {
    const user = userEvent.setup();
    const loginFn = vi.fn().mockResolvedValue(undefined);
    const authCtx = createMockAuthContext({ login: loginFn });

    renderWithProviders(<LoginForm />, { authValue: authCtx });

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'StrongPass1');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(loginFn).toHaveBeenCalledWith('test@example.com', 'StrongPass1');
    });
  });

  it('should show error on invalid credentials (API 401)', async () => {
    const user = userEvent.setup();
    const authCtx = createMockAuthContext({
      login: vi.fn().mockRejectedValue({
        response: { status: 401, data: { error: { message: 'Invalid credentials' } } },
        isAxiosError: true,
      }),
    });

    renderWithProviders(<LoginForm />, { authValue: authCtx });

    await user.type(screen.getByLabelText('Email'), 'wrong@example.com');
    await user.type(screen.getByLabelText('Password'), 'WrongPass1');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/invalid/i);
    });
  });
});

describe('Protected Route', () => {
  it('should redirect to /login when not authenticated', () => {
    const authCtx = createMockAuthContext({ isAuthenticated: false });

    renderWithProviders(
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
      </Routes>,
      { authValue: authCtx, initialRoute: '/dashboard' },
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Welcome to your dashboard')).not.toBeInTheDocument();
  });

  it('should render children when authenticated', () => {
    const authCtx = createAuthenticatedContext();

    renderWithProviders(
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
      </Routes>,
      { authValue: authCtx, initialRoute: '/dashboard' },
    );

    expect(screen.getByText('Welcome to your dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });
});
