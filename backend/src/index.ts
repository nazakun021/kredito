import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from './db';
import { startCronJobs } from './cron';
import authRoutes from './routes/auth';
import creditRoutes from './routes/credit';
import loanRoutes from './routes/loan';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Initialize Database
initDb();

// Start Cron Jobs
startCronJobs();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/credit', creditRoutes);
app.use('/api/loan', loanRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Kredito backend listening at http://localhost:${port}`);
});
