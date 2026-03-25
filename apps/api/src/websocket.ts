import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { db } from './db/index.js';
import { bikes, stations } from './db/schema.js';
import { eq } from 'drizzle-orm';

let wss: WebSocketServer | null = null;

export function setupWebSocket(server: Server) {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    ws.on('error', (err) => console.error('[ws] Client error:', err));
  });

  console.log('[ws] WebSocket server attached');
}

export function broadcastStationUpdate(stationId: string) {
  if (!wss) return;

  const station = db.select().from(stations).where(eq(stations.id, stationId)).get();
  if (!station) return;

  const stationBikes = db.select().from(bikes).where(eq(bikes.stationId, stationId)).all();
  const availableBikes = stationBikes.filter((b) => b.status === 'available').length;
  const emptyDocks = station.dockCapacity - stationBikes.length;

  const message = JSON.stringify({
    type: 'station:availability',
    data: { stationId, availableBikes, emptyDocks },
  });

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}
