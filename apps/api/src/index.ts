import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { healthRouter } from './routes/health.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/health', healthRouter);

app.listen(PORT, () => {
  console.log(`[api] Server running on http://localhost:${PORT}`);
});

export default app;
