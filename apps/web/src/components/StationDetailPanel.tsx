import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { stationsApi, type StationDetail, type StationSummary } from '../lib/api';
import { Spinner } from './ui/Spinner';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';
import { useReservation } from '../hooks/useReservation';

interface StationDetailPanelProps {
  station: StationSummary;
  userLat?: number;
  userLng?: number;
  onClose: () => void;
}

function batteryColor(level: number): string {
  if (level >= 60) return 'bg-green-500';
  if (level >= 30) return 'bg-yellow-500';
  return 'bg-red-500';
}

// ~5 km/h average walking speed
function walkingTime(distanceKm: number): string {
  const minutes = Math.round((distanceKm / 5) * 60);
  if (minutes < 1) return '< 1 min walk';
  return `${minutes} min walk`;
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function StationDetailPanel({
  station,
  userLat,
  userLng,
  onClose,
}: StationDetailPanelProps) {
  const [detail, setDetail] = useState<StationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { toast } = useToast();
  const { reservation, remainingSeconds, reserve, cancel, isLoading: reservationLoading } = useReservation();
  const [reserveLoadingId, setReserveLoadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError('');

    stationsApi
      .getById(station.id)
      .then((data) => {
        if (!cancelled) setDetail(data.station);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load station details');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [station.id]);

  const distanceDisplay =
    station.distance < 1
      ? `${Math.round(station.distance * 1000)} m`
      : `${station.distance.toFixed(1)} km`;

  const navigate = useNavigate();
  const availableBikes = detail?.bikes.filter((b) => b.status === 'available') ?? [];

  const handleReserve = async (bikeId: string) => {
    setReserveLoadingId(bikeId);
    try {
      await reserve(bikeId, station.id);
      toast('Bike reserved for 15 minutes!', 'success');
    } catch {
      toast('Failed to reserve bike', 'error');
    } finally {
      setReserveLoadingId(null);
    }
  };

  const handleCancelReservation = async () => {
    try {
      await cancel();
      toast('Reservation cancelled', 'success');
    } catch {
      toast('Failed to cancel reservation', 'error');
    }
  };

  const isExpiringSoon = remainingSeconds > 0 && remainingSeconds < 120;

  return (
    <>
      {/* Backdrop — desktop only */}
      <div
        className="fixed inset-0 z-40 hidden bg-black/20 md:block"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white shadow-2xl md:inset-x-auto md:inset-y-0 md:right-0 md:w-96 md:rounded-t-none md:rounded-l-2xl"
        role="dialog"
        aria-label={`Station: ${station.name}`}
      >
        {/* Swipe indicator (mobile) */}
        <div className="flex justify-center pt-3 md:hidden">
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </div>

        <div className="p-5">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{station.name}</h2>
              <p className="mt-0.5 text-sm text-gray-500">{station.address}</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close panel"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Distance + walk time */}
          {userLat != null && userLng != null && (
            <div className="mb-4 flex gap-4 text-sm text-gray-600">
              <span>📍 {distanceDisplay}</span>
              <span>🚶 {walkingTime(station.distance)}</span>
            </div>
          )}

          {/* Quick stats */}
          <div className="mb-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-green-50 p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{station.availableBikes}</p>
              <p className="text-xs text-green-600">Available bikes</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 text-center">
              <p className="text-2xl font-bold text-gray-700">{station.emptyDocks}</p>
              <p className="text-xs text-gray-500">Empty docks</p>
            </div>
          </div>

          {/* Detail section */}
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : error ? (
            <p className="py-4 text-center text-sm text-red-500">{error}</p>
          ) : (
            <>
              {/* Active reservation banner */}
              {reservation && !reservationLoading && (
                <div
                  className={`mb-4 rounded-lg p-3 ${
                    isExpiringSoon ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-medium ${isExpiringSoon ? 'text-red-700' : 'text-blue-700'}`}>
                        {isExpiringSoon ? '⚠️ Reservation expiring!' : '🔒 Bike Reserved'}
                      </p>
                      <p className={`text-xs ${isExpiringSoon ? 'text-red-600' : 'text-blue-600'}`}>
                        Expires in {formatCountdown(remainingSeconds)}
                      </p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={handleCancelReservation}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Bike list */}
              {availableBikes.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700">Available Bikes</h3>
                  {availableBikes.map((bike) => {
                    const isReservedByMe = reservation?.bikeId === bike.id;
                    return (
                      <div
                        key={bike.id}
                        className={`rounded-lg border p-3 ${
                          isReservedByMe ? 'border-blue-300 bg-blue-50' : 'border-gray-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {bike.model}
                              {isReservedByMe && (
                                <span className="ml-2 text-xs font-medium text-blue-600">Reserved</span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500">ID: {bike.id.slice(0, 8)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Battery bar */}
                            <div className="h-3 w-16 overflow-hidden rounded-full bg-gray-200">
                              <div
                                className={`h-full rounded-full ${batteryColor(bike.batteryLevel)}`}
                                style={{ width: `${bike.batteryLevel}%` }}
                              />
                            </div>
                            <span className="w-9 text-right text-xs font-medium text-gray-600">
                              {bike.batteryLevel}%
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => navigate(`/unlock/${bike.id}?stationId=${station.id}`)}
                          >
                            🔓 Unlock
                          </Button>
                          {!reservation && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="flex-1"
                              isLoading={reserveLoadingId === bike.id}
                              onClick={() => handleReserve(bike.id)}
                            >
                              📌 Reserve
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {availableBikes.length === 0 && (
                <p className="py-4 text-center text-sm text-gray-500">
                  No bikes available at this station
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
