import { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { adminApi } from '../../lib/api';
import { Spinner } from '../../components/ui/Spinner';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

interface OverviewData {
  totalRides: number;
  totalRevenue: number;
  activeUsers: number;
  fleetUtilization: number;
}

interface ChartPoint {
  label: string;
  value: number;
}

export default function Analytics() {
  const { toast } = useToast();
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [ridesPerDay, setRidesPerDay] = useState<ChartPoint[]>([]);
  const [revenuePerWeek, setRevenuePerWeek] = useState<ChartPoint[]>([]);
  const [peakHours, setPeakHours] = useState<ChartPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [weeks, setWeeks] = useState(12);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [ov, rpd, rpw, ph] = await Promise.all([
        adminApi.getAnalyticsOverview(),
        adminApi.getRidesPerDay(days),
        adminApi.getRevenuePerWeek(weeks),
        adminApi.getPeakHours(),
      ]);
      setOverview(ov);
      setRidesPerDay(rpd.data || []);
      setRevenuePerWeek(rpw.data || []);
      setPeakHours(ph.data || []);
    } catch {
      toast('Failed to load analytics', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, weeks]);

  const handleExport = async (type: string) => {
    try {
      const blob = await adminApi.exportAnalytics('csv', type);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${type}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast('Failed to export', 'error');
    }
  };

  if (isLoading && !overview) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-10 w-10" />
      </div>
    );
  }

  const cards = [
    { label: 'Total Rides', value: overview?.totalRides?.toLocaleString() || '0', icon: '🚲' },
    { label: 'Total Revenue', value: `$${(overview?.totalRevenue || 0).toLocaleString()}`, icon: '💰' },
    { label: 'Active Users', value: overview?.activeUsers?.toLocaleString() || '0', icon: '👥' },
    { label: 'Fleet Utilization', value: `${overview?.fleetUtilization || 0}%`, icon: '📊' },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Analytics</h1>

      {/* Overview cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-xs font-medium text-gray-500">{card.icon} {card.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Date range filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Rides:</label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Revenue:</label>
          <select
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value={4}>4 weeks</option>
            <option value={8}>8 weeks</option>
            <option value={12}>12 weeks</option>
            <option value={24}>24 weeks</option>
          </select>
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Rides per day */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Rides per Day</h2>
            <Button size="sm" variant="ghost" onClick={() => handleExport('rides-per-day')}>
              📥 CSV
            </Button>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={ridesPerDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#16a34a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue per week */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Revenue per Week</h2>
            <Button size="sm" variant="ghost" onClick={() => handleExport('revenue-per-week')}>
              📥 CSV
            </Button>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={revenuePerWeek}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Peak hours */}
        <div className="rounded-xl bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Peak Hours</h2>
            <Button size="sm" variant="ghost" onClick={() => handleExport('peak-hours')}>
              📥 CSV
            </Button>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={peakHours}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
