// backend/src/index.ts

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { config } from './config';
import { errorHandler } from './errors';
import authRoutes from './routes/auth';
import creditRoutes from './routes/credit';
import loanRoutes from './routes/loan';
import txRoutes from './routes/tx';
import { rpcServer, horizonServer, issuerKeypair } from './stellar/client';

const app = express();

const authLimiter = rateLimit({ windowMs: 60_000, max: 10 });
const scoreLimiter = rateLimit({ windowMs: 60_000, max: 5 });

app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  }),
);

// Basic CSRF protection: require X-Requested-With for state-mutating requests
app.use((req, _res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    if (!req.headers['x-requested-with']) {
      return _res.status(403).json({ error: 'X-Requested-With header required' });
    }
  }
  next();
});

app.use(express.json());
app.use(cookieParser());
app.use(
  pinoHttp({
    customProps: (req, _res) => ({
      // Log path instead of full url to avoid leaking query params
      path: req.url.split('?')[0],
      wallet: (req as any).wallet,
    }),
    autoLogging: {
      ignore: (req) => req.url.startsWith('/health'),
    },
    redact: ['req.headers.authorization', 'req.headers.cookie'],
  }),
);

import adminRoutes from './routes/admin';

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/credit/generate', scoreLimiter);
app.use('/api/credit', creditRoutes);
app.use('/api/loan', loanRoutes);
app.use('/api/tx', txRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorHandler);

async function verifyConnectivity() {
  try {
    await rpcServer.getLatestLedger();
    await horizonServer.loadAccount(issuerKeypair.publicKey());
    console.log('✅ Stellar RPC and Horizon reachable');
  } catch (error) {
    console.error('❌ Stellar connectivity probe failed:', error);
    process.exit(1);
  }
}

verifyConnectivity().then(() => {
  app.listen(config.port, () => {
    console.log(`Kredito backend listening at http://localhost:${config.port}`);
  });
});
