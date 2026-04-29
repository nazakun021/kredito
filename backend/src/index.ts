import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { config } from './config';
import { initDb } from './db';
import { startCronJobs } from './cron';
import { errorHandler } from './errors';
import authRoutes from './routes/auth';
import creditRoutes from './routes/credit';
import loanRoutes from './routes/loan';


const app = express();

initDb();
startCronJobs();

app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  })
);
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/credit', creditRoutes);
app.use('/api/loan', loanRoutes);
app.use('/api/tx', loanRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Kredito backend listening at http://localhost:${config.port}`);
});
