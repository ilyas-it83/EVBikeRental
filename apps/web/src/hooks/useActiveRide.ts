import { useEffect, useState } from 'react';
import { ridesApi, type RideResponse } from '../lib/api';

export function useActiveRide() {
  const [activeRide, setActiveRide] = useState<RideResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchActive = () => {
      ridesApi
        .getActive()
        .then((data) => {
          if (!cancelled) setActiveRide(data.ride);
        })
        .catch(() => {
          if (!cancelled) setActiveRide(null);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    };

    fetchActive();

    // Poll every 30 seconds
    const interval = setInterval(fetchActive, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { activeRide, isLoading };
}
