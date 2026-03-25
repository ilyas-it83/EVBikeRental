import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ridesApi, stationsApi, type RideResponse, type StationSummary } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';

const UNLOCK_FEE = 1.0;
const PER_MINUTE_RATE = 0.15;

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function ActiveRide() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [ride, setRide] = useState<RideResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [showEndRide, setShowEndRide] = useState(false);
  const [stations, setStations] = useState<StationSummary[]>([]);
  const [selectedStation, setSelectedStation] = useState('');
  const [isEnding, setIsEnding] = useState(false);
  const [isLoadingStations, setIsLoadingStations] = useState(false);

  // Fetch active ride
  useEffect(() => {
    ridesApi
      .getActive()
      .then((data) => {
        if (data.ride) {
          setRide(data.ride);
        } else {
          navigate('/', { replace: true });
        }
      })
      .catch(() => {
        toast('Failed to load active ride', 'error');
        navigate('/', { replace: true });
      })
      .finally(() => setIsLoading(false));
  }, [navigate, toast]);

  // Live timer
  useEffect(() => {
    if (!ride?.startTime) return;
    const startMs = new Date(ride.startTime).getTime();

    const tick = () => {
      setElapsed(Math.floor((Date.now() - startMs) / 1000));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [ride?.startTime]);

  // Fetch stations when ending ride
  const handleOpenEndRide = useCallback(() => {
    setShowEndRide(true);
    setIsLoadingStations(true);
    // Use default coordinates (SF) — in a real app we'd use geolocation
    stationsApi
      .list(37.7749, -122.4194, 50)
      .then((data) => {
        setStations(data.stations);
        const firstStation = data.stations[0];
        if (firstStation) setSelectedStation(firstStation.id);
      })
      .catch(() => toast('Failed to load stations', 'error'))
      .finally(() => setIsLoadingStations(false));
  }, [toast]);

  const handleEndRide = async () => {
    if (!ride || !selectedStation) return;
    setIsEnding(true);
    try {
      await ridesApi.endRide(ride.id, selectedStation);
      toast('Ride ended! 🎉', 'success');
      navigate(`/ride/${ride.id}/summary`, { replace: true });
    } catch {
      toast('Failed to end ride', 'error');
    } finally {
      setIsEnding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!ride) return null;

  const elapsedMinutes = elapsed / 60;
  const estimatedCost = UNLOCK_FEE + elapsedMinutes * PER_MINUTE_RATE;

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6 flex items-center gap-2">
        <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-green-500" />
        <h1 className="text-2xl font-bold text-gray-900">Active Ride</h1>
      </div>

      {/* Bike info */}
      <div className="mb-6 rounded-xl bg-white p-5 shadow-sm">
        <p className="text-lg font-semibold text-gray-900">{ride.bike?.model ?? 'Bike'}</p>
        {ride.bike && <p className="text-sm text-gray-500">🔋 {ride.bike.batteryLevel}%</p>}
        <p className="mt-1 text-sm text-gray-500">📍 Started at {ride.startStationName ?? 'station'}</p>
      </div>

      {/* Timer & cost */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-blue-50 p-5 text-center">
          <p className="text-3xl font-bold text-blue-700">{formatDuration(elapsed)}</p>
          <p className="mt-1 text-xs text-blue-600">Duration</p>
        </div>
        <div className="rounded-xl bg-green-50 p-5 text-center">
          <p className="text-3xl font-bold text-green-700">${estimatedCost.toFixed(2)}</p>
          <p className="mt-1 text-xs text-green-600">Est. Cost</p>
        </div>
      </div>

      <p className="mb-6 text-center text-xs text-gray-400">
        ${UNLOCK_FEE.toFixed(2)} unlock + ${PER_MINUTE_RATE.toFixed(2)}/min
      </p>

      {/* End ride flow */}
      {showEndRide ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <h2 className="mb-3 text-sm font-semibold text-red-800">Select Return Station</h2>

          {isLoadingStations ? (
            <div className="flex justify-center py-4">
              <Spinner className="h-6 w-6" />
            </div>
          ) : (
            <>
              <select
                value={selectedStation}
                onChange={(e) => setSelectedStation(e.target.value)}
                className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
              >
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.emptyDocks} docks available)
                  </option>
                ))}
              </select>

              <div className="flex gap-3">
                <Button
                  onClick={handleEndRide}
                  isLoading={isEnding}
                  className="flex-1 bg-red-600 hover:bg-red-700 focus:ring-red-500"
                >
                  Confirm End Ride
                </Button>
                <Button variant="secondary" onClick={() => setShowEndRide(false)} disabled={isEnding} className="flex-1">
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <Button
          onClick={handleOpenEndRide}
          className="w-full bg-red-600 hover:bg-red-700 focus:ring-red-500"
          size="lg"
        >
          🛑 End Ride
        </Button>
      )}
    </div>
  );
}
