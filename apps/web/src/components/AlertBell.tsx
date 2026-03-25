import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { alertsApi, type AlertResponse } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

const typeIcons: Record<string, string> = {
  low_battery: '🔋',
  station_full: '🅿️',
  station_empty: '🅿️',
  maintenance: '🔧',
  payment_failure: '💳',
};

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function AlertBell() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [alerts, setAlerts] = useState<AlertResponse[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Only show for admins
  if (!user || user.role !== 'admin') return null;

  const fetchCount = useCallback(async () => {
    try {
      const data = await alertsApi.count();
      setCount(data.count);
    } catch {
      // silent
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await alertsApi.list({ isRead: false });
      setAlerts(data.alerts.slice(0, 10));
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  useEffect(() => {
    if (isOpen) fetchAlerts();
  }, [isOpen, fetchAlerts]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await alertsApi.markAllRead();
      setCount(0);
      setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
    } catch {
      // silent
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        aria-label="Notifications"
      >
        🔔
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-lg z-50">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <span className="text-sm font-semibold text-gray-900">Alerts</span>
            {count > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
              </div>
            ) : alerts.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">No new alerts</p>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 border-b border-gray-50 px-4 py-3 ${
                    !alert.isRead ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <span className="mt-0.5 text-lg">{typeIcons[alert.type] || '📢'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800">{alert.message}</p>
                    <p className="text-xs text-gray-400">{timeAgo(alert.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-gray-100 px-4 py-2">
            <Link
              to="/admin/alerts"
              onClick={() => setIsOpen(false)}
              className="block text-center text-xs font-medium text-green-600 hover:text-green-700"
            >
              View all alerts →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
