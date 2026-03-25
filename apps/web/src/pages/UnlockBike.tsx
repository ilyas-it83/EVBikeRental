import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ridesApi, stationsApi, type StationDetail, type StationBike } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';

const UNLOCK_FEE = 1.0;
const PER_MINUTE_RATE = 0.15;

export default function UnlockBike() {
  const { bikeId } = useParams<{ bikeId: string }>();
  const [searchParams] = useSearchParams();
  const stationId = searchParams.get('stationId') ?? '';
  const navigate = useNavigate();
  const { toast } = useToast();

  const [station, setStation] = useState<StationDetail | null>(null);
  const [bike, setBike] = useState<StationBike | null>(null);
  const [isLoadingStation, setIsLoadingStation] = useState(true);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!stationId) return;
    stationsApi
      .getById(stationId)
      .then((data) => {
        setStation(data.station);
        const found = data.station.bikes.find((b) => b.id === bikeId);
        setBike(found ?? null);
      })
      .catch(() => toast('Failed to load station info', 'error'))
      .finally(() => setIsLoadingStation(false));
  }, [stationId, bikeId, toast]);

  const handleUnlock = async () => {
    if (!bikeId || !stationId) return;
    setIsUnlocking(true);
    try {
      await ridesApi.unlock(bikeId, stationId);
      toast('Bike unlocked! Enjoy your ride 🚲', 'success');
      navigate('/ride/active', { replace: true });
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? ((err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ??
            'Failed to unlock bike')
          : 'Failed to unlock bike';
      toast(msg, 'error');
    } finally {
      setIsUnlocking(false);
      setShowConfirm(false);
    }
  };

  if (isLoadingStation) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Unlock Bike</h1>

      {/* Bike info */}
      <div className="mb-6 rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold text-gray-900">{bike?.model ?? 'Bike'}</p>
            <p className="text-sm text-gray-500">ID: {bikeId?.slice(0, 8)}</p>
          </div>
          {bike && (
            <div className="flex items-center gap-2">
              <div className="h-3 w-16 overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full rounded-full ${bike.batteryLevel >= 60 ? 'bg-green-500' : bike.batteryLevel >= 30 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${bike.batteryLevel}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-600">{bike.batteryLevel}%</span>
            </div>
          )}
        </div>
        {station && <p className="mt-2 text-sm text-gray-500">📍 {station.name}</p>}
      </div>

      {/* Pricing */}
      <div className="mb-6 rounded-xl bg-green-50 p-5">
        <h2 className="mb-3 text-sm font-semibold text-green-800">Pricing</h2>
        <div className="space-y-1 text-sm text-green-700">
          <div className="flex justify-between">
            <span>Unlock fee</span>
            <span className="font-medium">${UNLOCK_FEE.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Per minute</span>
            <span className="font-medium">${PER_MINUTE_RATE.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Confirm dialog */}
      {showConfirm ? (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-5">
          <p className="mb-4 text-sm text-yellow-800">
            You&apos;ll be charged a ${UNLOCK_FEE.toFixed(2)} unlock fee plus ${PER_MINUTE_RATE.toFixed(2)}/min while
            riding. Confirm to unlock?
          </p>
          <div className="flex gap-3">
            <Button onClick={handleUnlock} isLoading={isUnlocking} className="flex-1">
              Confirm Unlock
            </Button>
            <Button variant="secondary" onClick={() => setShowConfirm(false)} disabled={isUnlocking} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setShowConfirm(true)} className="w-full" size="lg">
          🔓 Unlock Bike
        </Button>
      )}
    </div>
  );
}
