import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { stationsRouter } from './routes/stations.js';
import { ridesRouter } from './routes/rides.js';
import { paymentMethodsRouter } from './routes/payment-methods.js';
import { adminRouter } from './routes/admin.js';
import { subscriptionsRouter } from './routes/subscriptions.js';
import { reservationsRouter } from './routes/reservations.js';
import { disputesRouter } from './routes/disputes.js';
import { alertsRouter } from './routes/alerts.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/stations', stationsRouter);
  app.use('/api/rides', ridesRouter);
  app.use('/api/payment-methods', paymentMethodsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/subscriptions', subscriptionsRouter);
  app.use('/api/reservations', reservationsRouter);
  app.use('/api/disputes', disputesRouter);
  app.use('/api/admin/alerts', alertsRouter);

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

export default createApp();
