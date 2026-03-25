import { useEffect, useState } from 'react';
import { disputesApi, type DisputeResponse } from '../../lib/api';
import { Spinner } from '../../components/ui/Spinner';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

const statusStyles: Record<string, string> = {
  open: 'bg-yellow-100 text-yellow-700',
  under_review: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  open: 'Open',
  under_review: 'Under Review',
  resolved: 'Resolved',
  rejected: 'Rejected',
};

const STATUS_OPTIONS = ['open', 'under_review', 'resolved', 'rejected'];

export default function DisputeManagement() {
  const { toast } = useToast();
  const [disputes, setDisputes] = useState<DisputeResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [resolution, setResolution] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchDisputes = () => {
    setIsLoading(true);
    disputesApi
      .adminList(filter ? { status: filter } : undefined)
      .then((data) => setDisputes(data.disputes))
      .catch(() => toast('Failed to load disputes', 'error'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchDisputes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleUpdate = async (id: string) => {
    if (!newStatus) return;
    setIsUpdating(true);
    try {
      const data = await disputesApi.adminUpdate(id, {
        status: newStatus,
        resolution: resolution.trim() || undefined,
      });
      setDisputes((prev) => prev.map((d) => (d.id === id ? data.dispute : d)));
      setSelectedId(null);
      setNewStatus('');
      setResolution('');
      toast('Dispute updated', 'success');
    } catch {
      toast('Failed to update dispute', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading && disputes.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-10 w-10" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dispute Management</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{statusLabels[s]}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Reason</th>
              <th className="hidden px-4 py-3 text-left font-medium text-gray-600 sm:table-cell">Description</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {disputes.map((d) => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900 capitalize">
                  {d.reason.replace('_', ' ')}
                </td>
                <td className="hidden max-w-xs truncate px-4 py-3 text-gray-600 sm:table-cell">
                  {d.description}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[d.status] || 'bg-gray-100 text-gray-700'}`}>
                    {statusLabels[d.status] || d.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {new Date(d.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => {
                      setSelectedId(selectedId === d.id ? null : d.id);
                      setNewStatus(d.status);
                      setResolution(d.resolution || '');
                    }}
                    className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                  >
                    {selectedId === d.id ? 'Close' : 'Review'}
                  </button>
                </td>
              </tr>
            ))}
            {disputes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No disputes found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Inline review panel */}
      {selectedId && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h3 className="mb-3 font-semibold text-gray-900">Update Dispute</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{statusLabels[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Resolution note</label>
              <input
                type="text"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="Optional resolution note…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" isLoading={isUpdating} onClick={() => handleUpdate(selectedId)}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
