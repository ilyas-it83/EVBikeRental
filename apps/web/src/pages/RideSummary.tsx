import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ridesApi, type RideResponse } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { DisputeForm } from '../components/DisputeForm';

const UNLOCK_FEE = 1.0;
const PER_MINUTE_RATE = 0.15;

function formatDuration(minutes: number | null): string {
  if (minutes == null) return '—';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export default function RideSummary() {
  const { rideId } = useParams<{ rideId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [ride, setRide] = useState<RideResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDisputeForm, setShowDisputeForm] = useState(false);

  useEffect(() => {
    if (!rideId) return;
    ridesApi
      .getById(rideId)
      .then((data) => setRide(data.ride))
      .catch(() => toast('Failed to load ride details', 'error'))
      .finally(() => setIsLoading(false));
  }, [rideId, toast]);

  const handleDownloadReceipt = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-4">
        <p className="text-gray-500">Ride not found</p>
        <Button onClick={() => navigate('/')}>Back to Map</Button>
      </div>
    );
  }

  const minuteCharges = ride.durationMinutes != null ? ride.durationMinutes * PER_MINUTE_RATE : 0;
  const total = ride.cost ?? UNLOCK_FEE + minuteCharges;

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Ride Summary</h1>

      {/* Status badge */}
      <div className="mb-6 flex items-center gap-2">
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
            ride.status === 'completed'
              ? 'bg-green-100 text-green-700'
              : ride.status === 'active'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700'
          }`}
        >
          {ride.status.charAt(0).toUpperCase() + ride.status.slice(1)}
        </span>
        {ride.payment?.status === 'captured' && (
          <span className="inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
            💳 Paid
          </span>
        )}
      </div>

      {/* Trip details */}
      <div className="mb-6 rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm">🅰️</span>
            <span className="text-sm text-gray-700">{ride.startStationName ?? 'Start station'}</span>
          </div>
          <div className="ml-4 border-l-2 border-dashed border-gray-200 py-1 pl-6 text-xs text-gray-400">
            {formatDuration(ride.durationMinutes)}
            {ride.distanceKm != null && ` · ${ride.distanceKm.toFixed(1)} km`}
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-sm">🅱️</span>
            <span className="text-sm text-gray-700">{ride.endStationName ?? 'End station'}</span>
          </div>
        </div>

        {ride.bike && (
          <p className="text-sm text-gray-500">
            🚲 {ride.bike.model} · 🔋 {ride.bike.batteryLevel}%
          </p>
        )}
      </div>

      {/* Cost breakdown */}
      <div className="mb-6 rounded-xl bg-green-50 p-5">
        <h2 className="mb-3 text-sm font-semibold text-green-800">Cost Breakdown</h2>
        <div className="space-y-1 text-sm text-green-700">
          <div className="flex justify-between">
            <span>Unlock fee</span>
            <span>${UNLOCK_FEE.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>
              {ride.durationMinutes != null ? `${Math.round(ride.durationMinutes)} min` : '—'} × $
              {PER_MINUTE_RATE.toFixed(2)}
            </span>
            <span>${minuteCharges.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-green-200 pt-2 font-bold">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => navigate('/')} className="flex-1">
          🗺️ Back to Map
        </Button>
        <Button variant="secondary" onClick={() => navigate('/rides')} className="flex-1">
          📋 View History
        </Button>
      </div>
      {ride.status === 'completed' && (
        <div className="mt-3 flex gap-3">
          <Button variant="secondary" onClick={handleDownloadReceipt} className="flex-1" size="sm">
            🧾 Download Receipt
          </Button>
          <Button variant="ghost" onClick={() => setShowDisputeForm(true)} className="flex-1" size="sm">
            ⚠️ Dispute
          </Button>
        </div>
      )}

      {/* Dispute form modal */}
      {showDisputeForm && ride && (
        <DisputeForm
          rideId={ride.id}
          onClose={() => setShowDisputeForm(false)}
          onSubmitted={() => setShowDisputeForm(false)}
        />
      )}
    </div>
  );
}
