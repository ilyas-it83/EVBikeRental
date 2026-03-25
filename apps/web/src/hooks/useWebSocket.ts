import { useCallback, useEffect, useRef, useState } from 'react';
import { stationsApi } from '../lib/api';

export interface WsMessage {
  type: string;
  data: Record<string, unknown>;
}

type ConnectionStatus = 'connected' | 'polling' | 'disconnected';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';
const MAX_RECONNECT_DELAY = 30_000;
const MAX_WS_FAILURES = 3;
const POLL_INTERVAL = 30_000;

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const failureCount = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const pollTimer = useRef<ReturnType<typeof setInterval>>();
  const mountedRef = useRef(true);
  const connectRef = useRef<() => void>();

  const startPolling = useCallback(() => {
    if (pollTimer.current) return;
    setStatus('polling');
    setIsConnected(false);

    pollTimer.current = setInterval(async () => {
      try {
        const data = await stationsApi.list(37.7749, -122.4194, 50);
        if (mountedRef.current) {
          data.stations.forEach((s: { id: string; availableBikes: number; emptyDocks: number }) => {
            const msg: WsMessage = {
              type: 'station:availability',
              data: { stationId: s.id, availableBikes: s.availableBikes, emptyDocks: s.emptyDocks },
            };
            setLastMessage(msg);
          });
          setLastUpdated(new Date());
        }
      } catch {
        // polling failed silently
      }
    }, POLL_INTERVAL);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = undefined;
    }
  }, []);

  // Use a ref-based connect to avoid circular useCallback dependencies
  useEffect(() => {
    connectRef.current = () => {
      if (!mountedRef.current) return;

      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!mountedRef.current) return;
          setIsConnected(true);
          setStatus('connected');
          reconnectAttempt.current = 0;
          failureCount.current = 0;
          stopPolling();
        };

        ws.onmessage = (event) => {
          if (!mountedRef.current) return;
          try {
            const msg: WsMessage = JSON.parse(event.data);
            setLastMessage(msg);
            setLastUpdated(new Date());
          } catch {
            // ignore malformed messages
          }
        };

        ws.onclose = () => {
          if (!mountedRef.current) return;
          setIsConnected(false);
          failureCount.current++;

          if (failureCount.current >= MAX_WS_FAILURES) {
            setStatus('disconnected');
            startPolling();
            return;
          }

          const delay = Math.min(1000 * Math.pow(2, reconnectAttempt.current), MAX_RECONNECT_DELAY);
          reconnectAttempt.current++;
          setStatus('disconnected');
          reconnectTimer.current = setTimeout(() => connectRef.current?.(), delay);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        failureCount.current++;
        if (failureCount.current >= MAX_WS_FAILURES) {
          startPolling();
        }
      }
    };
  }, [startPolling, stopPolling]);

  useEffect(() => {
    mountedRef.current = true;
    connectRef.current?.();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      stopPolling();
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [stopPolling]);

  return { isConnected, status, lastMessage, lastUpdated };
}
