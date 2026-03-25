import { useEffect, useState } from 'react';
import { alertsApi, type AlertResponse } from '../../lib/api';
import { Spinner } from '../../components/ui/Spinner';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

const typeIcons: Record<string, string> = {
  low_battery: '🔋',
  station_full: '🅿️',
  station_empty: '🅿️',
  maintenance: '🔧',
  payment_failure: '💳',
};

const severityStyles: Record<string, string> = {
  info: 'bg-blue-100 text-blue-700',
  warning: 'bg-yellow-100 text-yellow-700',
  critical: 'bg-red-100 text-red-700',
};

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function Alerts() {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<AlertResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [readFilter, setReadFilter] = useState('');

  const fetchAlerts = () => {
    setIsLoading(true);
    const params: Record<string, unknown> = {};
    if (typeFilter) params.type = typeFilter;
    if (severityFilter) params.severity = severityFilter;
    if (readFilter) params.isRead = readFilter === 'read';

    alertsApi
      .list(params as { type?: string; severity?: string; isRead?: boolean })
      .then((data) => setAlerts(data.alerts))
      .catch(() => toast('Failed to load alerts', 'error'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, severityFilter, readFilter]);

  const handleMarkRead = async (id: string) => {
    try {
      await alertsApi.markRead(id);
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)));
    } catch {
      toast('Failed to mark as read', 'error');
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await alertsApi.dismiss(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      toast('Alert dismissed', 'success');
    } catch {
      toast('Failed to dismiss alert', 'error');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await alertsApi.markAllRead();
      setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
      toast('All marked as read', 'success');
    } catch {
      toast('Failed to mark all as read', 'error');
    }
  };

  if (isLoading && alerts.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-10 w-10" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Alerts</h1>
        <Button size="sm" variant="secondary" onClick={handleMarkAllRead}>
          ✓ Mark all read
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          aria-label="Filter by type"
        >
          <option value="">All types</option>
          <option value="low_battery">🔋 Low Battery</option>
          <option value="station_full">🅿️ Station Full</option>
          <option value="station_empty">🅿️ Station Empty</option>
          <option value="maintenance">🔧 Maintenance</option>
          <option value="payment_failure">💳 Payment Failure</option>
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          aria-label="Filter by severity"
        >
          <option value="">All severities</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
        <select
          value={readFilter}
          onChange={(e) => setReadFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          aria-label="Filter by read status"
        >
          <option value="">All</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
      </div>

      {/* Alerts list */}
      <div className="space-y-2">
        {alerts.length === 0 ? (
          <div className="rounded-xl bg-gray-50 py-12 text-center text-gray-500">
            No alerts found
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm ${
                !alert.isRead ? 'border-l-4 border-blue-500' : ''
              }`}
            >
              <span className="mt-0.5 text-2xl">{typeIcons[alert.type] || '📢'}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${severityStyles[alert.severity] || 'bg-gray-100 text-gray-700'}`}>
                    {alert.severity}
                  </span>
                  <span className="text-xs text-gray-400">{timeAgo(alert.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm text-gray-800">{alert.message}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                {!alert.isRead && (
                  <button
                    onClick={() => handleMarkRead(alert.id)}
                    className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                    title="Mark as read"
                  >
                    ✓
                  </button>
                )}
                <button
                  onClick={() => handleDismiss(alert.id)}
                  className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  title="Dismiss"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
