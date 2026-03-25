import { useCallback, useEffect, useRef, useState } from 'react';
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
function StationMarkers({
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
}

// Sub-component that flies to user location
function UserLocationHandler({
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
}

export default function Home() {
  const { toast } = useToast();
  const [stations, setStations] = useState<StationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState<StationSummary | null>(null);
  const [userLat, setUserLat] = useState<number | undefined>();
  const [userLng, setUserLng] = useState<number | undefined>();

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

  return (
    <div className="relative h-full w-full">
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/60">
          <div className="flex flex-col items-center gap-2">
            <Spinner className="h-10 w-10" />
            <p className="text-sm text-gray-500">Finding stations near you…</p>
          </div>
        </div>
      )}

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
