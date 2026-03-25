import app from './app.js';
import { setupWebSocket } from './websocket.js';
import { expireReservations } from './services/reservation.service.js';

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`[api] Server running on http://localhost:${PORT}`);
});

setupWebSocket(server);
setInterval(expireReservations, 60_000);

export default app;
