import { useCallback, useEffect, useRef, useState } from 'react';
import { reservationsApi } from '../lib/api';

export interface Reservation {
  id: string;
  bikeId: string;
  stationId: string;
  expiresAt: string;
  status: string;
}

export function useReservation() {
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const mountedRef = useRef(true);

  const fetchActive = useCallback(async () => {
    try {
      const data = await reservationsApi.getActive();
      if (mountedRef.current) {
        setReservation(data.reservation || null);
      }
    } catch {
      if (mountedRef.current) setReservation(null);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchActive();

    const interval = setInterval(fetchActive, 15_000);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchActive]);

  // Countdown timer
  useEffect(() => {
    if (!reservation?.expiresAt) {
      setRemainingSeconds(0);
      return;
    }

    const calcRemaining = () => {
      const diff = Math.max(0, Math.floor((new Date(reservation.expiresAt).getTime() - Date.now()) / 1000));
      setRemainingSeconds(diff);
      if (diff === 0) {
        setReservation(null);
      }
    };

    calcRemaining();
    const interval = setInterval(calcRemaining, 1000);
    return () => clearInterval(interval);
  }, [reservation]);

  const reserve = useCallback(async (bikeId: string, stationId: string) => {
    const data = await reservationsApi.create(bikeId, stationId);
    setReservation(data.reservation);
    return data.reservation;
  }, []);

  const cancel = useCallback(async () => {
    if (!reservation) return;
    await reservationsApi.cancel(reservation.id);
    setReservation(null);
  }, [reservation]);

  return { reservation, isLoading, remainingSeconds, reserve, cancel };
}
