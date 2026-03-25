import { useEffect, useState, type FormEvent } from 'react';
import { adminApi } from '../../lib/api';
import { Spinner } from '../../components/ui/Spinner';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';

interface Bike {
  id: string;
  serialNumber: string;
  model: string;
  stationId: string | null;
  stationName?: string;
  batteryLevel: number;
  status: string;
}

interface StationOption {
  id: string;
  name: string;
}

const STATUS_OPTIONS = ['available', 'rented', 'maintenance', 'retired'];

function batteryColor(level: number): string {
  if (level >= 60) return 'bg-green-500';
  if (level >= 30) return 'bg-yellow-500';
  return 'bg-red-500';
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    available: 'bg-green-100 text-green-700',
    rented: 'bg-blue-100 text-blue-700',
    maintenance: 'bg-yellow-100 text-yellow-700',
    retired: 'bg-gray-100 text-gray-600',
  };
  return colors[status] || 'bg-gray-100 text-gray-600';
}

const emptyForm = { serialNumber: '', model: '', stationId: '', batteryLevel: '100' };

export default function BikeManagement() {
  const { toast } = useToast();
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [stationOptions, setStationOptions] = useState<StationOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [filterStation, setFilterStation] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterLowBattery, setFilterLowBattery] = useState(false);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingBike, setEditingBike] = useState<Bike | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchBikes = () => {
    const params: Record<string, string | boolean> = {};
    if (filterStation) params.stationId = filterStation;
    if (filterStatus) params.status = filterStatus;
    if (filterLowBattery) params.lowBattery = true;

    adminApi
      .listBikes(params)
      .then((data) => setBikes(data.bikes || []))
      .catch(() => toast('Failed to load bikes', 'error'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    adminApi
      .listStations()
      .then((data) => setStationOptions((data.stations || []).map((s: StationOption) => ({ id: s.id, name: s.name }))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fetchBikes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStation, filterStatus, filterLowBattery]);

  const openAdd = () => {
    setEditingBike(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (bike: Bike) => {
    setEditingBike(bike);
    setForm({
      serialNumber: bike.serialNumber,
      model: bike.model,
      stationId: bike.stationId || '',
      batteryLevel: String(bike.batteryLevel),
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const batteryLevel = parseInt(form.batteryLevel, 10);
    if (!form.serialNumber.trim() || !form.model.trim()) {
      toast('Serial number and model are required', 'error');
      return;
    }
    if (isNaN(batteryLevel) || batteryLevel < 0 || batteryLevel > 100) {
      toast('Battery level must be 0-100', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        serialNumber: form.serialNumber.trim(),
        model: form.model.trim(),
        stationId: form.stationId,
        batteryLevel,
      };
      if (editingBike) {
        const data = await adminApi.updateBike(editingBike.id, payload);
        setBikes((prev) => prev.map((b) => (b.id === editingBike.id ? data.bike : b)));
        toast('Bike updated', 'success');
      } else {
        const data = await adminApi.createBike(payload);
        setBikes((prev) => [...prev, data.bike]);
        toast('Bike added', 'success');
      }
      setShowModal(false);
    } catch {
      toast('Failed to save bike', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetire = async (bike: Bike) => {
    if (!window.confirm(`Retire bike "${bike.serialNumber}"?`)) return;
    try {
      await adminApi.deleteBike(bike.id);
      setBikes((prev) => prev.filter((b) => b.id !== bike.id));
      toast('Bike retired', 'success');
    } catch {
      toast('Failed to retire bike', 'error');
    }
  };

  if (isLoading && bikes.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-10 w-10" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Bike Management</h1>
        <Button size="sm" onClick={openAdd}>
          + Add Bike
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={filterStation}
          onChange={(e) => setFilterStation(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
        >
          <option value="">All Stations</option>
          {stationOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={filterLowBattery}
            onChange={(e) => setFilterLowBattery(e.target.checked)}
            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          Low Battery
        </label>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Serial #</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Model</th>
              <th className="hidden px-4 py-3 text-left font-medium text-gray-600 sm:table-cell">Station</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Battery</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {bikes.map((bike) => (
              <tr key={bike.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-sm text-gray-900">{bike.serialNumber}</td>
                <td className="px-4 py-3 text-gray-700">{bike.model}</td>
                <td className="hidden px-4 py-3 text-gray-600 sm:table-cell">
                  {bike.stationName || bike.stationId?.slice(0, 8) || '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-2.5 w-16 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className={`h-full rounded-full ${batteryColor(bike.batteryLevel)}`}
                        style={{ width: `${bike.batteryLevel}%` }}
                      />
                    </div>
                    <span className="w-9 text-right text-xs font-medium text-gray-600">
                      {bike.batteryLevel}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(bike.status)}`}>
                    {bike.status.charAt(0).toUpperCase() + bike.status.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => openEdit(bike)}
                      className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleRetire(bike)}
                      className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      Retire
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {bikes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No bikes found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <form
              onSubmit={handleSubmit}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-4 text-lg font-bold text-gray-900">
                {editingBike ? 'Edit Bike' : 'Add Bike'}
              </h2>
              <div className="space-y-3">
                <Input
                  label="Serial Number"
                  value={form.serialNumber}
                  onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))}
                  required
                />
                <Input
                  label="Model"
                  value={form.model}
                  onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                  required
                />
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Station</label>
                  <select
                    value={form.stationId}
                    onChange={(e) => setForm((f) => ({ ...f, stationId: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
                    required
                  >
                    <option value="">Select station…</option>
                    {stationOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Battery Level (%)"
                  type="number"
                  min={0}
                  max={100}
                  value={form.batteryLevel}
                  onChange={(e) => setForm((f) => ({ ...f, batteryLevel: e.target.value }))}
                  required
                />
              </div>
              <div className="mt-5 flex gap-3">
                <Button type="submit" isLoading={isSubmitting} className="flex-1">
                  {editingBike ? 'Update' : 'Add'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
