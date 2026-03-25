import { useEffect, useState } from 'react';
import { disputesApi, type DisputeResponse } from '../lib/api';
import { Spinner } from '../components/ui/Spinner';
import { useToast } from '../components/ui/Toast';

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Disputes() {
  const { toast } = useToast();
  const [disputes, setDisputes] = useState<DisputeResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    disputesApi
      .list()
      .then((data) => setDisputes(data.disputes))
      .catch(() => toast('Failed to load disputes', 'error'))
      .finally(() => setIsLoading(false));
  }, [toast]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">My Disputes</h1>

      {disputes.length === 0 ? (
        <div className="rounded-xl bg-gray-50 py-16 text-center">
          <p className="text-lg text-gray-500">No disputes filed</p>
          <p className="mt-2 text-sm text-gray-400">Disputes you file will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((d) => (
            <div key={d.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 capitalize">
                    {d.reason.replace('_', ' ')}
                  </p>
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">{d.description}</p>
                  <p className="mt-1 text-xs text-gray-400">{formatDate(d.createdAt)}</p>
                </div>
                <span className={`ml-3 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[d.status] || 'bg-gray-100 text-gray-700'}`}>
                  {statusLabels[d.status] || d.status}
                </span>
              </div>
              {d.resolution && (
                <div className="mt-3 rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-600">Resolution</p>
                  <p className="mt-0.5 text-sm text-gray-700">{d.resolution}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
