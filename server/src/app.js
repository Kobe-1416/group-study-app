import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pool } from './db.js';
import authRoutes from './modules/auth/auth.routes.js';
import groupRoutes from './modules/groups/groups.routes.js';

export const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);

// Liveness: verifies that the API process responds.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Readiness-style check: verifies that PostgreSQL is reachable.
app.get('/health/db', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});
