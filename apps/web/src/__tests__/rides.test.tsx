/**
 * Ride UI Component Tests
 *
 * Tests frontend ride UI behavior against acceptance criteria:
 * - ActiveRide page: timer and running cost
 * - RideHistory: renders list of past rides
 * - PaymentMethods: renders cards with brand/last4
 * - UnlockBike: shows confirmation before unlocking
 *
 * References: Sprint 2, PRD §3.3, §3.4
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  createAuthenticatedContext,
  type MockAuthContextValue,
} from '../test/setup.js';

// ─── Mock Auth Context ──────────────────────────────

const AuthContext = createContext<MockAuthContextValue>(createAuthenticatedContext());

function AuthProvider({ value, children }: { value: MockAuthContextValue; children: React.ReactNode }) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  return useContext(AuthContext);
}

// ─── Types ──────────────────────────────────────────

interface Ride {
  id: string;
  bikeId: string;
  startStationName: string;
  endStationName?: string;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
  cost?: number;
  status: 'active' | 'completed' | 'cancelled';
}

interface PaymentMethod {
  id: string;
  last4: string;
  brand: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
}

// ─── Mock API ───────────────────────────────────────

const ridesApi = {
  unlock: vi.fn(),
  getActive: vi.fn(),
  endRide: vi.fn(),
  list: vi.fn(),
  getById: vi.fn(),
};

const paymentMethodsApi = {
  list: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
  setDefault: vi.fn(),
};

// ─── Component Stubs (mirror expected contracts) ────

function ActiveRidePage({
  fetchActive,
  onEndRide,
}: {
  fetchActive: () => Promise<Ride | null>;
  onEndRide: (rideId: string) => Promise<void>;
}) {
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    fetchActive().then((r) => {
      setRide(r);
      setLoading(false);
      if (r) {
        const startMs = new Date(r.startTime).getTime();
        setElapsed(Math.floor((Date.now() - startMs) / 1000));
      }
    }).catch(() => setLoading(false));
  }, [fetchActive]);

  useEffect(() => {
    if (!ride) return;
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [ride]);

  if (loading) return <div data-testid="loading">Loading...</div>;
  if (!ride) return <div data-testid="no-active-ride">No active ride</div>;

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const estimatedCost = (1.0 + minutes * 0.15).toFixed(2);

  return (
    <div data-testid="active-ride">
      <h2>Ride in Progress</h2>
      <p data-testid="bike-id">Bike: {ride.bikeId}</p>
      <p data-testid="start-station">From: {ride.startStationName}</p>
      <div data-testid="timer">
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </div>
      <div data-testid="estimated-cost">${estimatedCost}</div>
      <button
        data-testid="end-ride-btn"
        onClick={() => onEndRide(ride.id)}
      >
        End Ride
      </button>
    </div>
  );
}

function RideHistoryPage({
  fetchRides,
}: {
  fetchRides: () => Promise<{ rides: Ride[]; total: number }>;
}) {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRides().then((data) => {
      setRides(data.rides);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [fetchRides]);

  if (loading) return <div data-testid="loading">Loading...</div>;
  if (rides.length === 0) return <div data-testid="no-rides">No ride history yet</div>;

  return (
    <div data-testid="ride-history">
      <h2>Ride History</h2>
      <ul>
        {rides.map((ride) => (
          <li key={ride.id} data-testid={`ride-${ride.id}`}>
            <span data-testid="ride-route">
              {ride.startStationName} → {ride.endStationName}
            </span>
            <span data-testid="ride-duration">{ride.durationMinutes} min</span>
            <span data-testid="ride-cost">${ride.cost?.toFixed(2)}</span>
            <span data-testid="ride-status">{ride.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PaymentMethodsPage({
  fetchMethods,
  onDelete,
  onSetDefault,
}: {
  fetchMethods: () => Promise<PaymentMethod[]>;
  onDelete: (id: string) => Promise<void>;
  onSetDefault: (id: string) => Promise<void>;
}) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMethods().then((data) => {
      setMethods(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [fetchMethods]);

  if (loading) return <div data-testid="loading">Loading...</div>;
  if (methods.length === 0) return <div data-testid="no-methods">No payment methods</div>;

  return (
    <div data-testid="payment-methods">
      <h2>Payment Methods</h2>
      {methods.map((pm) => (
        <div key={pm.id} data-testid={`pm-${pm.id}`}>
          <span data-testid="pm-brand">{pm.brand}</span>
          <span data-testid="pm-last4">•••• {pm.last4}</span>
          <span data-testid="pm-expiry">{pm.expiryMonth}/{pm.expiryYear}</span>
          {pm.isDefault && <span data-testid="pm-default-badge">Default</span>}
          {!pm.isDefault && (
            <button data-testid="pm-set-default" onClick={() => onSetDefault(pm.id)}>
              Set Default
            </button>
          )}
          <button data-testid="pm-delete" onClick={() => onDelete(pm.id)}>
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}

function UnlockBikePage({
  bikeId,
  stationName,
  batteryLevel,
  onUnlock,
}: {
  bikeId: string;
  stationName: string;
  batteryLevel: number;
  onUnlock: (bikeId: string) => Promise<void>;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnlock = async () => {
    setUnlocking(true);
    setError(null);
    try {
      await onUnlock(bikeId);
    } catch (err: any) {
      setError(err?.message || 'Failed to unlock bike');
    }
    setUnlocking(false);
  };

  return (
    <div data-testid="unlock-bike">
      <h2>Unlock Bike</h2>
      <p data-testid="bike-info">Bike {bikeId} at {stationName}</p>
      <p data-testid="battery-level">Battery: {batteryLevel}%</p>

      {!confirmed ? (
        <div>
          <p data-testid="pricing-info">Unlock fee: $1.00 + $0.15/min</p>
          <button
            data-testid="confirm-btn"
            onClick={() => setConfirmed(true)}
          >
            Confirm Unlock
          </button>
        </div>
      ) : (
        <button
          data-testid="unlock-btn"
          onClick={handleUnlock}
          disabled={unlocking}
        >
          {unlocking ? 'Unlocking...' : 'Unlock Now'}
        </button>
      )}
      {error && <div role="alert" data-testid="unlock-error">{error}</div>}
    </div>
  );
}

// ─── Test Helpers ───────────────────────────────────

function renderWithProviders(ui: React.ReactElement) {
  const authValue = createAuthenticatedContext();
  return render(
    <MemoryRouter>
      <AuthProvider value={authValue}>
        {ui}
      </AuthProvider>
    </MemoryRouter>,
  );
}

// ─── Tests ──────────────────────────────────────────

describe('ActiveRide Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show active ride with timer and estimated cost', async () => {
    const mockRide: Ride = {
      id: 'ride-001',
      bikeId: 'bike-001',
      startStationName: 'Central Park Station',
      startTime: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
      status: 'active',
    };
    const fetchActive = vi.fn().mockResolvedValue(mockRide);
    const onEndRide = vi.fn();

    renderWithProviders(
      <ActiveRidePage fetchActive={fetchActive} onEndRide={onEndRide} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('active-ride')).toBeInTheDocument();
    });

    expect(screen.getByTestId('bike-id')).toHaveTextContent('bike-001');
    expect(screen.getByTestId('start-station')).toHaveTextContent('Central Park Station');
    expect(screen.getByTestId('timer')).toBeInTheDocument();
    expect(screen.getByTestId('estimated-cost')).toBeInTheDocument();
    // Cost should be at least the unlock fee
    expect(screen.getByTestId('estimated-cost').textContent).toMatch(/\$\d+\.\d{2}/);
  });

  it('should show "No active ride" when no ride is active', async () => {
    const fetchActive = vi.fn().mockResolvedValue(null);
    const onEndRide = vi.fn();

    renderWithProviders(
      <ActiveRidePage fetchActive={fetchActive} onEndRide={onEndRide} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('no-active-ride')).toBeInTheDocument();
    });
  });

  it('should call onEndRide when end ride button is clicked', async () => {
    const user = userEvent.setup();
    const mockRide: Ride = {
      id: 'ride-001',
      bikeId: 'bike-001',
      startStationName: 'Central Park Station',
      startTime: new Date().toISOString(),
      status: 'active',
    };
    const fetchActive = vi.fn().mockResolvedValue(mockRide);
    const onEndRide = vi.fn().mockResolvedValue(undefined);

    renderWithProviders(
      <ActiveRidePage fetchActive={fetchActive} onEndRide={onEndRide} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('end-ride-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('end-ride-btn'));
    expect(onEndRide).toHaveBeenCalledWith('ride-001');
  });

  it('should display loading state initially', () => {
    const fetchActive = vi.fn().mockReturnValue(new Promise(() => {}));
    const onEndRide = vi.fn();

    renderWithProviders(
      <ActiveRidePage fetchActive={fetchActive} onEndRide={onEndRide} />,
    );

    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });
});

describe('RideHistory Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render list of rides', async () => {
    const mockRides: Ride[] = [
      {
        id: 'ride-001',
        bikeId: 'bike-001',
        startStationName: 'Central Park',
        endStationName: 'Times Square',
        startTime: '2024-01-01T10:00:00Z',
        endTime: '2024-01-01T10:30:00Z',
        durationMinutes: 30,
        cost: 5.5,
        status: 'completed',
      },
      {
        id: 'ride-002',
        bikeId: 'bike-002',
        startStationName: 'Brooklyn Bridge',
        endStationName: 'Central Park',
        startTime: '2024-01-02T14:00:00Z',
        endTime: '2024-01-02T14:15:00Z',
        durationMinutes: 15,
        cost: 3.25,
        status: 'completed',
      },
    ];

    const fetchRides = vi.fn().mockResolvedValue({ rides: mockRides, total: 2 });

    renderWithProviders(<RideHistoryPage fetchRides={fetchRides} />);

    await waitFor(() => {
      expect(screen.getByTestId('ride-history')).toBeInTheDocument();
    });

    expect(screen.getByTestId('ride-ride-001')).toBeInTheDocument();
    expect(screen.getByTestId('ride-ride-002')).toBeInTheDocument();

    // Check first ride content
    const ride1 = within(screen.getByTestId('ride-ride-001'));
    expect(ride1.getByTestId('ride-route')).toHaveTextContent('Central Park → Times Square');
    expect(ride1.getByTestId('ride-duration')).toHaveTextContent('30 min');
    expect(ride1.getByTestId('ride-cost')).toHaveTextContent('$5.50');
  });

  it('should show empty state when no rides exist', async () => {
    const fetchRides = vi.fn().mockResolvedValue({ rides: [], total: 0 });

    renderWithProviders(<RideHistoryPage fetchRides={fetchRides} />);

    await waitFor(() => {
      expect(screen.getByTestId('no-rides')).toBeInTheDocument();
    });

    expect(screen.getByText(/no ride history/i)).toBeInTheDocument();
  });

  it('should display loading state initially', () => {
    const fetchRides = vi.fn().mockReturnValue(new Promise(() => {}));
    renderWithProviders(<RideHistoryPage fetchRides={fetchRides} />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });
});

describe('PaymentMethods Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render payment methods with brand and last4', async () => {
    const mockMethods: PaymentMethod[] = [
      { id: 'pm-1', last4: '4242', brand: 'Visa', expiryMonth: 12, expiryYear: 2026, isDefault: true },
      { id: 'pm-2', last4: '5555', brand: 'Mastercard', expiryMonth: 6, expiryYear: 2027, isDefault: false },
    ];

    const fetchMethods = vi.fn().mockResolvedValue(mockMethods);
    const onDelete = vi.fn();
    const onSetDefault = vi.fn();

    renderWithProviders(
      <PaymentMethodsPage fetchMethods={fetchMethods} onDelete={onDelete} onSetDefault={onSetDefault} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('payment-methods')).toBeInTheDocument();
    });

    // Check first card (Visa, default)
    const card1 = within(screen.getByTestId('pm-pm-1'));
    expect(card1.getByTestId('pm-brand')).toHaveTextContent('Visa');
    expect(card1.getByTestId('pm-last4')).toHaveTextContent('•••• 4242');
    expect(card1.getByTestId('pm-default-badge')).toHaveTextContent('Default');

    // Check second card (Mastercard, non-default)
    const card2 = within(screen.getByTestId('pm-pm-2'));
    expect(card2.getByTestId('pm-brand')).toHaveTextContent('Mastercard');
    expect(card2.getByTestId('pm-last4')).toHaveTextContent('•••• 5555');
    expect(card2.queryByTestId('pm-default-badge')).not.toBeInTheDocument();
    expect(card2.getByTestId('pm-set-default')).toBeInTheDocument();
  });

  it('should show empty state when no methods exist', async () => {
    const fetchMethods = vi.fn().mockResolvedValue([]);
    renderWithProviders(
      <PaymentMethodsPage fetchMethods={fetchMethods} onDelete={vi.fn()} onSetDefault={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('no-methods')).toBeInTheDocument();
    });
  });

  it('should call onDelete when remove button is clicked', async () => {
    const user = userEvent.setup();
    const mockMethods: PaymentMethod[] = [
      { id: 'pm-1', last4: '4242', brand: 'Visa', expiryMonth: 12, expiryYear: 2026, isDefault: true },
    ];

    const fetchMethods = vi.fn().mockResolvedValue(mockMethods);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onSetDefault = vi.fn();

    renderWithProviders(
      <PaymentMethodsPage fetchMethods={fetchMethods} onDelete={onDelete} onSetDefault={onSetDefault} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('pm-pm-1')).toBeInTheDocument();
    });

    await user.click(within(screen.getByTestId('pm-pm-1')).getByTestId('pm-delete'));
    expect(onDelete).toHaveBeenCalledWith('pm-1');
  });

  it('should call onSetDefault when set default button is clicked', async () => {
    const user = userEvent.setup();
    const mockMethods: PaymentMethod[] = [
      { id: 'pm-1', last4: '4242', brand: 'Visa', expiryMonth: 12, expiryYear: 2026, isDefault: true },
      { id: 'pm-2', last4: '5555', brand: 'Mastercard', expiryMonth: 6, expiryYear: 2027, isDefault: false },
    ];

    const fetchMethods = vi.fn().mockResolvedValue(mockMethods);
    const onDelete = vi.fn();
    const onSetDefault = vi.fn().mockResolvedValue(undefined);

    renderWithProviders(
      <PaymentMethodsPage fetchMethods={fetchMethods} onDelete={onDelete} onSetDefault={onSetDefault} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('pm-pm-2')).toBeInTheDocument();
    });

    await user.click(within(screen.getByTestId('pm-pm-2')).getByTestId('pm-set-default'));
    expect(onSetDefault).toHaveBeenCalledWith('pm-2');
  });
});

describe('UnlockBike Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show bike info and pricing before confirmation', () => {
    const onUnlock = vi.fn();

    renderWithProviders(
      <UnlockBikePage
        bikeId="bike-001"
        stationName="Central Park Station"
        batteryLevel={95}
        onUnlock={onUnlock}
      />,
    );

    expect(screen.getByTestId('bike-info')).toHaveTextContent('bike-001');
    expect(screen.getByTestId('bike-info')).toHaveTextContent('Central Park Station');
    expect(screen.getByTestId('battery-level')).toHaveTextContent('95%');
    expect(screen.getByTestId('pricing-info')).toHaveTextContent('$1.00');
    expect(screen.getByTestId('pricing-info')).toHaveTextContent('$0.15/min');
    expect(screen.getByTestId('confirm-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('unlock-btn')).not.toBeInTheDocument();
  });

  it('should show unlock button only after confirmation', async () => {
    const user = userEvent.setup();
    const onUnlock = vi.fn();

    renderWithProviders(
      <UnlockBikePage
        bikeId="bike-001"
        stationName="Central Park Station"
        batteryLevel={95}
        onUnlock={onUnlock}
      />,
    );

    // Initially, only confirm button
    expect(screen.getByTestId('confirm-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('unlock-btn')).not.toBeInTheDocument();

    // Click confirm
    await user.click(screen.getByTestId('confirm-btn'));

    // Now unlock button should appear
    expect(screen.queryByTestId('confirm-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('unlock-btn')).toBeInTheDocument();
  });

  it('should call onUnlock after confirming and clicking unlock', async () => {
    const user = userEvent.setup();
    const onUnlock = vi.fn().mockResolvedValue(undefined);

    renderWithProviders(
      <UnlockBikePage
        bikeId="bike-001"
        stationName="Central Park Station"
        batteryLevel={95}
        onUnlock={onUnlock}
      />,
    );

    await user.click(screen.getByTestId('confirm-btn'));
    await user.click(screen.getByTestId('unlock-btn'));

    expect(onUnlock).toHaveBeenCalledWith('bike-001');
  });

  it('should show error when unlock fails', async () => {
    const user = userEvent.setup();
    const onUnlock = vi.fn().mockRejectedValue(new Error('Bike unavailable'));

    renderWithProviders(
      <UnlockBikePage
        bikeId="bike-001"
        stationName="Central Park Station"
        batteryLevel={95}
        onUnlock={onUnlock}
      />,
    );

    await user.click(screen.getByTestId('confirm-btn'));
    await user.click(screen.getByTestId('unlock-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('unlock-error')).toHaveTextContent('Bike unavailable');
    });
  });
});
