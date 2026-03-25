import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../lib/api';
import { Spinner } from '../../components/ui/Spinner';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

interface FleetOverviewData {
  totalBikes: number;
  totalStations: number;
  activeBikes: number;
  availableBikes: number;
  maintenanceBikes: number;
  activeRides: number;
  completedRidesToday: number;
  revenueToday: number;
}

interface FleetStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  availableBikes: number;
  dockCapacity: number;
  isActive: boolean;
}

export default function FleetOverview() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<FleetOverviewData | null>(null);
  const [stations, setStations] = useState<FleetStation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([adminApi.getFleetOverview(), adminApi.getFleetStations()])
      .then(([overviewData, stationsData]) => {
        setOverview(overviewData);
        setStations(stationsData.stations || []);
      })
      .catch(() => toast('Failed to load fleet overview', 'error'))
      .finally(() => setIsLoading(false));
  }, [toast]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-10 w-10" />
      </div>
    );
  }

  if (!overview) {
    return <p className="text-center text-gray-500">Failed to load overview data.</p>;
  }

  const stats = [
    { label: 'Total Bikes', value: overview.totalBikes, icon: '🚲', color: 'bg-blue-50 text-blue-700' },
    { label: 'Active Rides', value: overview.activeRides, icon: '🏃', color: 'bg-green-50 text-green-700' },
    { label: 'Available Bikes', value: overview.availableBikes, icon: '✅', color: 'bg-emerald-50 text-emerald-700' },
    { label: 'Maintenance', value: overview.maintenanceBikes, icon: '🔧', color: 'bg-yellow-50 text-yellow-700' },
    { label: 'Revenue Today', value: `$${overview.revenueToday.toFixed(2)}`, icon: '💰', color: 'bg-purple-50 text-purple-700' },
    { label: 'Rides Today', value: overview.completedRidesToday, icon: '📊', color: 'bg-indigo-50 text-indigo-700' },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Fleet Overview</h1>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => navigate('/admin/stations')}>
            + Add Station
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate('/admin/bikes')}>
            + Add Bike
          </Button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className={`rounded-xl p-4 ${stat.color}`}>
            <div className="flex items-center gap-2">
              <span className="text-lg">{stat.icon}</span>
              <p className="text-sm font-medium opacity-80">{stat.label}</p>
            </div>
            <p className="mt-2 text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Station overview */}
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Stations ({overview.totalStations})</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stations.map((station) => (
          <div
            key={station.id}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-medium text-gray-900">{station.name}</h3>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  station.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}
              >
                {station.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>🚲 {station.availableBikes} available</span>
              <span>🔲 {station.dockCapacity} docks</span>
            </div>
            {/* Simple utilization bar */}
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-green-500"
                style={{ width: `${station.dockCapacity > 0 ? (station.availableBikes / station.dockCapacity) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
