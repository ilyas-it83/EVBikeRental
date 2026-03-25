import { useEffect, useState, type FormEvent } from 'react';
import { adminApi } from '../../lib/api';
import { Spinner } from '../../components/ui/Spinner';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';

interface Station {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  dockCapacity: number;
  availableBikes: number;
  isActive: boolean;
}

const emptyForm = { name: '', address: '', lat: '', lng: '', dockCapacity: '' };

export default function StationManagement() {
  const { toast } = useToast();
  const [stations, setStations] = useState<Station[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchStations = () => {
    adminApi
      .listStations()
      .then((data) => setStations(data.stations || []))
      .catch(() => toast('Failed to load stations', 'error'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchStations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdd = () => {
    setEditingStation(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (station: Station) => {
    setEditingStation(station);
    setForm({
      name: station.name,
      address: station.address,
      lat: String(station.lat),
      lng: String(station.lng),
      dockCapacity: String(station.dockCapacity),
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    const dockCapacity = parseInt(form.dockCapacity, 10);

    if (!form.name.trim() || !form.address.trim()) {
      toast('Name and address are required', 'error');
      return;
    }
    if (isNaN(lat) || isNaN(lng)) {
      toast('Enter valid coordinates', 'error');
      return;
    }
    if (isNaN(dockCapacity) || dockCapacity < 1) {
      toast('Dock capacity must be at least 1', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = { name: form.name.trim(), address: form.address.trim(), lat, lng, dockCapacity };
      if (editingStation) {
        const data = await adminApi.updateStation(editingStation.id, payload);
        setStations((prev) => prev.map((s) => (s.id === editingStation.id ? data.station : s)));
        toast('Station updated', 'success');
      } else {
        const data = await adminApi.createStation(payload);
        setStations((prev) => [...prev, data.station]);
        toast('Station created', 'success');
      }
      setShowModal(false);
    } catch {
      toast('Failed to save station', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (station: Station) => {
    if (!window.confirm(`Deactivate station "${station.name}"?`)) return;
    try {
      await adminApi.deleteStation(station.id);
      setStations((prev) => prev.filter((s) => s.id !== station.id));
      toast('Station deactivated', 'success');
    } catch {
      toast('Failed to deactivate station', 'error');
    }
  };

  const filtered = stations.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.address.toLowerCase().includes(search.toLowerCase()),
  );

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-10 w-10" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Station Management</h1>
        <Button size="sm" onClick={openAdd}>
          + Add Station
        </Button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search stations…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none sm:max-w-xs"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
              <th className="hidden px-4 py-3 text-left font-medium text-gray-600 sm:table-cell">Address</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Capacity</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Available</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((station) => (
              <tr key={station.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{station.name}</td>
                <td className="hidden px-4 py-3 text-gray-600 sm:table-cell">{station.address}</td>
                <td className="px-4 py-3 text-center text-gray-600">{station.dockCapacity}</td>
                <td className="px-4 py-3 text-center text-gray-600">{station.availableBikes}</td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      station.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {station.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => openEdit(station)}
                      className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeactivate(station)}
                      className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      Deactivate
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No stations found
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
                {editingStation ? 'Edit Station' : 'Add Station'}
              </h2>
              <div className="space-y-3">
                <Input
                  label="Name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
                <Input
                  label="Address"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Latitude"
                    type="number"
                    step="any"
                    value={form.lat}
                    onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
                    required
                  />
                  <Input
                    label="Longitude"
                    type="number"
                    step="any"
                    value={form.lng}
                    onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
                    required
                  />
                </div>
                <Input
                  label="Dock Capacity"
                  type="number"
                  min={1}
                  value={form.dockCapacity}
                  onChange={(e) => setForm((f) => ({ ...f, dockCapacity: e.target.value }))}
                  required
                />
              </div>
              <div className="mt-5 flex gap-3">
                <Button type="submit" isLoading={isSubmitting} className="flex-1">
                  {editingStation ? 'Update' : 'Create'}
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
