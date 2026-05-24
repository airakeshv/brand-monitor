// persistence test - safe to remove
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// load .env from monorepo root (one level up from backend/)
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });
import express from 'express';
import cors from 'cors';
import { initDB } from './models/user.js';
import { initDigestTable } from './models/digest.js';
import { initDeliveryLogTable } from './models/deliveryLog.js';
import apiRouter from './routes/api.js';
import { scheduleDigest } from './scheduler/cronManager.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['https://brand-monitor-two.vercel.app', 'http://localhost:5173'],
}));
app.use(express.json());

app.use('/api', apiRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// initialise database then start server
initDB();
initDigestTable();
initDeliveryLogTable();
app.listen(PORT, () => {
  console.log(`Brand Monitor backend running on port ${PORT}`);
  scheduleDigest();
});
