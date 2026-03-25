import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ridesApi, type RideResponse } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDuration(minutes: number | null): string {
  if (minutes == null) return '—';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function statusBadge(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-700';
    case 'active':
      return 'bg-blue-100 text-blue-700';
    case 'cancelled':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

export default function RideHistory() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [rides, setRides] = useState<RideResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const fetchRides = (pageNum: number, append = false) => {
    const setLoading = append ? setIsLoadingMore : setIsLoading;
    setLoading(true);
    ridesApi
      .list(pageNum, 20)
      .then((data) => {
        setRides((prev) => (append ? [...prev, ...data.rides] : data.rides));
        setHasMore(data.pagination.page < data.pagination.pages);
        setPage(data.pagination.page);
      })
      .catch(() => toast('Failed to load ride history', 'error'))
      .finally(() => setLoading(false));
  };

  const handleExportCsv = async () => {
    if (!exportFrom || !exportTo) {
      toast('Please select both dates', 'error');
      return;
    }
    setIsExporting(true);
    try {
      const blob = await ridesApi.exportCsv(exportFrom, exportTo);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rides-${exportFrom}-to-${exportTo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast('Failed to export rides', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    fetchRides(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Ride History</h1>
      </div>

      {/* CSV Export */}
      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl bg-gray-50 p-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">From</label>
          <input
            type="date"
            value={exportFrom}
            onChange={(e) => setExportFrom(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">To</label>
          <input
            type="date"
            value={exportTo}
            onChange={(e) => setExportTo(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <Button size="sm" variant="secondary" onClick={handleExportCsv} isLoading={isExporting}>
          📥 Export CSV
        </Button>
      </div>

      {rides.length === 0 ? (
        <div className="rounded-xl bg-gray-50 py-16 text-center">
          <p className="text-lg text-gray-500">No rides yet 🚲</p>
          <p className="mt-2 text-sm text-gray-400">Find a station to start riding!</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            🗺️ Find a Station
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {rides.map((ride) => (
            <div
              key={ride.id}
              className="cursor-pointer rounded-xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              onClick={() => setExpandedId(expandedId === ride.id ? null : ride.id)}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {ride.startStationName ?? 'Start'} → {ride.endStationName ?? 'End'}
                  </p>
                  <p className="text-xs text-gray-500">{formatDate(ride.startTime)}</p>
                </div>
                <div className="ml-3 flex items-center gap-2">
                  {ride.cost != null && (
                    <span className="text-sm font-semibold text-gray-900">${ride.cost.toFixed(2)}</span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(ride.status)}`}
                  >
                    {ride.status.charAt(0).toUpperCase() + ride.status.slice(1)}
                  </span>
                </div>
              </div>

              {/* Expanded detail */}
              {expandedId === ride.id && (
                <div className="mt-3 border-t border-gray-100 pt-3 text-sm text-gray-600">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-xs text-gray-400">Duration</span>
                      <p className="font-medium">{formatDuration(ride.durationMinutes)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400">Distance</span>
                      <p className="font-medium">
                        {ride.distanceKm != null ? `${ride.distanceKm.toFixed(1)} km` : '—'}
                      </p>
                    </div>
                    {ride.bike && (
                      <div>
                        <span className="text-xs text-gray-400">Bike</span>
                        <p className="font-medium">{ride.bike.model}</p>
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/ride/${ride.id}/summary`);
                    }}
                    className="mt-2"
                  >
                    View Details →
                  </Button>
                </div>
              )}
            </div>
          ))}

          {hasMore && (
            <Button
              variant="secondary"
              isLoading={isLoadingMore}
              onClick={() => fetchRides(page + 1, true)}
              className="w-full"
            >
              Load More
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
