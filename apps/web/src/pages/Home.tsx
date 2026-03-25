import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

import { stationsApi, type StationSummary } from '../lib/api';
import { StationDetailPanel } from '../components/StationDetailPanel';
import { Spinner } from '../components/ui/Spinner';
import { useToast } from '../components/ui/Toast';
import { useWebSocket } from '../hooks/useWebSocket';

// Default center: San Francisco
const DEFAULT_CENTER: [number, number] = [37.7749, -122.4194];
const DEFAULT_ZOOM = 14;

// Fix Leaflet default icon path issue with bundlers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function stationIcon(availableBikes: number): L.DivIcon {
  let color: string;
  if (availableBikes >= 3) color = '#16a34a'; // green-600
  else if (availableBikes >= 1) color = '#ca8a04'; // yellow-600
  else color = '#dc2626'; // red-600

  return L.divIcon({
    className: 'station-marker',
    html: `<div style="
      background:${color};
      width:28px;height:28px;
      border-radius:50%;border:3px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,.35);
      display:flex;align-items:center;justify-content:center;
      color:white;font-size:12px;font-weight:700;
    ">${availableBikes}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

// Sub-component that manages markers inside the map
const StationMarkers = memo(function StationMarkers({
  stations,
  onSelect,
}: {
  stations: StationSummary[];
  onSelect: (s: StationSummary) => void;
}) {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
    }

    const cluster = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
    });

    stations.forEach((s) => {
      const marker = L.marker([s.lat, s.lng], { icon: stationIcon(s.availableBikes) });
      marker.bindTooltip(s.name, { direction: 'top', offset: [0, -14] });
      marker.on('click', () => onSelect(s));
      cluster.addLayer(marker);
    });

    map.addLayer(cluster);
    clusterRef.current = cluster;

    return () => {
      map.removeLayer(cluster);
    };
  }, [map, stations, onSelect]);

  return null;
});

// Sub-component that flies to user location
const UserLocationHandler = memo(function UserLocationHandler({
  onLocate,
}: {
  onLocate: (lat: number, lng: number) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        map.flyTo([latitude, longitude], DEFAULT_ZOOM, { duration: 1.5 });
        onLocate(latitude, longitude);
      },
      () => {
        // Permission denied or error — keep default center
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [map, onLocate]);

  return null;
});

const ConnectionBadge = memo(function ConnectionBadge({ status, lastUpdated }: { status: string; lastUpdated: Date | null }) {
  const colors: Record<string, string> = {
    connected: 'bg-green-500',
    polling: 'bg-yellow-500',
    disconnected: 'bg-red-500',
  };

  const [secondsAgo, setSecondsAgo] = useState<number | null>(null);

  useEffect(() => {
    if (!lastUpdated) return;
    const calc = () => setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  return (
    <div className="absolute right-3 top-3 z-20 flex items-center gap-2 rounded-lg bg-white/90 px-2.5 py-1.5 text-xs shadow-md backdrop-blur">
      <span className={`inline-block h-2 w-2 rounded-full ${colors[status] || 'bg-gray-400'}`} />
      <span className="text-gray-600 capitalize">{status}</span>
      {secondsAgo !== null && (
        <span className="text-gray-400">
          · {secondsAgo < 60 ? `${secondsAgo}s ago` : `${Math.floor(secondsAgo / 60)}m ago`}
        </span>
      )}
    </div>
  );
});

export default function Home() {
  const { toast } = useToast();
  const [stations, setStations] = useState<StationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState<StationSummary | null>(null);
  const [userLat, setUserLat] = useState<number | undefined>();
  const [userLng, setUserLng] = useState<number | undefined>();
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [sortKey, setSortKey] = useState<'name' | 'distance' | 'availableBikes'>('distance');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { status: wsStatus, lastMessage, lastUpdated } = useWebSocket();

  // Handle real-time station updates
  useEffect(() => {
    if (!lastMessage || lastMessage.type !== 'station:availability') return;
    const { stationId, availableBikes, emptyDocks } = lastMessage.data as {
      stationId: string;
      availableBikes: number;
      emptyDocks: number;
    };
    setStations((prev) =>
      prev.map((s) =>
        s.id === stationId ? { ...s, availableBikes, emptyDocks } : s,
      ),
    );
  }, [lastMessage]);

  const handleLocate = useCallback(
    (lat: number, lng: number) => {
      setUserLat(lat);
      setUserLng(lng);
      fetchStations(lat, lng);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const fetchStations = useCallback(
    async (lat: number, lng: number) => {
      try {
        setIsLoading(true);
        const data = await stationsApi.list(lat, lng, 10);
        setStations(data.stations);
      } catch {
        toast('Failed to load stations', 'error');
      } finally {
        setIsLoading(false);
      }
    },
    [toast],
  );

  // Fetch with default center if geolocation doesn't fire
  useEffect(() => {
    const timer = setTimeout(() => {
      if (stations.length === 0) {
        fetchStations(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);
      }
    }, 3000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = useCallback((s: StationSummary) => {
    setSelectedStation(s);
  }, []);

  const sortedStations = useMemo(() => [...stations].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortKey === 'name') return dir * a.name.localeCompare(b.name);
    return dir * (a[sortKey] - b[sortKey]);
  }), [stations, sortKey, sortDir]);

  const handleSort = (key: 'name' | 'distance' | 'availableBikes') => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div className="relative h-full w-full">
      {/* View toggle */}
      <button
        onClick={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
        className="absolute left-3 top-3 z-20 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-700 shadow-md backdrop-blur hover:bg-white"
        aria-label={`Switch to ${viewMode === 'map' ? 'list' : 'map'} view`}
      >
        {viewMode === 'map' ? '📋 List View' : '🗺️ Map View'}
      </button>

      {/* Connection status badge */}
      <ConnectionBadge status={wsStatus} lastUpdated={lastUpdated} />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/60">
          <div className="flex flex-col items-center gap-2">
            <Spinner className="h-10 w-10" />
            <p className="text-sm text-gray-500">Finding stations near you…</p>
          </div>
        </div>
      )}

      {viewMode === 'map' ? (
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          className="h-full w-full"
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <UserLocationHandler onLocate={handleLocate} />
          <StationMarkers stations={stations} onSelect={handleSelect} />
        </MapContainer>
      ) : (
        <div className="h-full overflow-auto p-4">
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm" role="grid" aria-label="Station list">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    { key: 'name' as const, label: 'Station' },
                    { key: 'distance' as const, label: 'Distance' },
                    { key: 'availableBikes' as const, label: 'Available Bikes' },
                  ].map((col) => (
                    <th
                      key={col.key}
                      className="cursor-pointer px-4 py-3 text-left font-medium text-gray-600 hover:text-gray-900 select-none"
                      onClick={() => handleSort(col.key)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSort(col.key); }}
                      tabIndex={0}
                      role="columnheader"
                      aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      {col.label} {sortKey === col.key && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedStations.map((s) => (
                  <tr
                    key={s.id}
                    className="cursor-pointer hover:bg-green-50 transition-colors"
                    onClick={() => handleSelect(s)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSelect(s); }}
                    tabIndex={0}
                    role="row"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{s.name}</p>
                      <p className="text-xs text-gray-500">{s.address}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.distance.toFixed(1)} km</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.availableBikes >= 3 ? 'bg-green-100 text-green-700'
                          : s.availableBikes >= 1 ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                      }`}>
                        {s.availableBikes} bikes
                      </span>
                    </td>
                  </tr>
                ))}
                {sortedStations.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                      No stations found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Station detail panel */}
      {selectedStation && (
        <StationDetailPanel
          station={selectedStation}
          userLat={userLat}
          userLng={userLng}
          onClose={() => setSelectedStation(null)}
        />
      )}
    </div>
  );
}
