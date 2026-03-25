/**
 * Map Component Tests
 *
 * Tests map/station display behavior against acceptance criteria.
 * Validates: station markers rendering, color-coding, detail panel,
 * loading state, empty state.
 *
 * Since react-leaflet is hard to unit test (canvas-based), we test
 * the station list/marker data rendering logic and UI behaviors
 * through a simplified component that represents the map panel.
 *
 * References: GitHub Issue #8, PRD §3.2
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { TEST_STATIONS } from '../test/setup.js';

// ─── Types ──────────────────────────────────────────

interface StationData {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  capacity: number;
  availableBikes: number;
}

// ─── Availability Color Logic ───────────────────────
// Mirrors the PRD: green (available), yellow (low), red (empty)

function getAvailabilityColor(availableBikes: number, capacity: number): string {
  if (availableBikes === 0) return 'red';
  if (availableBikes / capacity < 0.25) return 'yellow';
  return 'green';
}

// ─── Mock Station Components ────────────────────────
// Represents the expected component behavior. Once Fry builds
// the real components, tests will import those.

function StationMarker({
  station,
  onClick,
}: {
  station: StationData;
  onClick: (station: StationData) => void;
}) {
  const color = getAvailabilityColor(station.availableBikes, station.capacity);
  return (
    <button
      data-testid={`station-marker-${station.id}`}
      data-color={color}
      onClick={() => onClick(station)}
      aria-label={`${station.name} - ${station.availableBikes} bikes available`}
    >
      <span className={`marker-${color}`}>{station.name}</span>
    </button>
  );
}

function StationDetail({ station }: { station: StationData }) {
  return (
    <div data-testid="station-detail">
      <h2>{station.name}</h2>
      <p>{station.address}</p>
      <p data-testid="available-bikes">{station.availableBikes} bikes available</p>
      <p data-testid="capacity">Capacity: {station.capacity}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return <div data-testid="loading-skeleton">Loading stations...</div>;
}

function MapPanel({
  fetchStations,
}: {
  fetchStations: () => Promise<StationData[]>;
}) {
  const [stations, setStations] = useState<StationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState<StationData | null>(null);

  useEffect(() => {
    fetchStations()
      .then((data) => {
        setStations(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [fetchStations]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (stations.length === 0) {
    return <div data-testid="empty-state">No stations found in this area</div>;
  }

  return (
    <div data-testid="map-panel">
      <div data-testid="station-markers">
        {stations.map((station) => (
          <StationMarker
            key={station.id}
            station={station}
            onClick={setSelectedStation}
          />
        ))}
      </div>
      {selectedStation && <StationDetail station={selectedStation} />}
    </div>
  );
}

// ─── Tests ──────────────────────────────────────────

describe('Map Panel', () => {
  it('should render station markers from API data', async () => {
    const fetchStations = vi.fn().mockResolvedValue(TEST_STATIONS);

    render(<MapPanel fetchStations={fetchStations} />);

    await waitFor(() => {
      expect(screen.getByTestId('station-markers')).toBeInTheDocument();
    });

    expect(screen.getByTestId('station-marker-station-001')).toBeInTheDocument();
    expect(screen.getByTestId('station-marker-station-002')).toBeInTheDocument();
    expect(screen.getByTestId('station-marker-station-003')).toBeInTheDocument();
  });

  it('should color-code markers by availability (green/yellow/red)', async () => {
    const fetchStations = vi.fn().mockResolvedValue(TEST_STATIONS);

    render(<MapPanel fetchStations={fetchStations} />);

    await waitFor(() => {
      expect(screen.getByTestId('station-markers')).toBeInTheDocument();
    });

    // Station 001: 2/20 = 10% → yellow (< 25%)
    const marker1 = screen.getByTestId('station-marker-station-001');
    expect(marker1.getAttribute('data-color')).toBe('yellow');

    // Station 002: 1/15 ≈ 6.7% → yellow (< 25%)
    const marker2 = screen.getByTestId('station-marker-station-002');
    expect(marker2.getAttribute('data-color')).toBe('yellow');

    // Station 003: 0/10 = 0% → red (empty)
    const marker3 = screen.getByTestId('station-marker-station-003');
    expect(marker3.getAttribute('data-color')).toBe('red');
  });

  it('should open station detail panel when marker is clicked', async () => {
    const user = userEvent.setup();
    const fetchStations = vi.fn().mockResolvedValue(TEST_STATIONS);

    render(<MapPanel fetchStations={fetchStations} />);

    await waitFor(() => {
      expect(screen.getByTestId('station-markers')).toBeInTheDocument();
    });

    // No detail panel initially
    expect(screen.queryByTestId('station-detail')).not.toBeInTheDocument();

    // Click on station marker
    await user.click(screen.getByTestId('station-marker-station-001'));

    // Detail panel should appear
    expect(screen.getByTestId('station-detail')).toBeInTheDocument();
    const detail = within(screen.getByTestId('station-detail'));
    expect(detail.getByText('Central Park Station')).toBeInTheDocument();
    expect(screen.getByTestId('available-bikes')).toHaveTextContent('2 bikes available');
  });

  it('should show loading skeleton while fetching', async () => {
    // Never-resolving promise to keep loading state
    const fetchStations = vi.fn().mockReturnValue(new Promise(() => {}));

    render(<MapPanel fetchStations={fetchStations} />);

    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
    expect(screen.getByText('Loading stations...')).toBeInTheDocument();
  });

  it('should handle empty station list gracefully', async () => {
    const fetchStations = vi.fn().mockResolvedValue([]);

    render(<MapPanel fetchStations={fetchStations} />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    expect(screen.getByText(/no stations found/i)).toBeInTheDocument();
  });
});

describe('Availability color coding', () => {
  it('should return green when bikes are plentiful (>= 25%)', () => {
    expect(getAvailabilityColor(10, 20)).toBe('green');
    expect(getAvailabilityColor(5, 20)).toBe('green');
  });

  it('should return yellow when bikes are low (< 25% but > 0)', () => {
    expect(getAvailabilityColor(4, 20)).toBe('yellow');
    expect(getAvailabilityColor(1, 10)).toBe('yellow');
    expect(getAvailabilityColor(2, 20)).toBe('yellow');
  });

  it('should return red when no bikes available', () => {
    expect(getAvailabilityColor(0, 20)).toBe('red');
    expect(getAvailabilityColor(0, 10)).toBe('red');
  });
});
