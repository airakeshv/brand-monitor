// v1.1 - persistence confirmed
// persistence test - safe to remove
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, statSync } from 'fs';

// load .env from monorepo root (one level up from backend/)
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });
import express from 'express';
import cors from 'cors';
import { initDB, runSeedMigration } from './models/user.js';
import { initWorkspaceTable } from './models/workspace.js';
import { initDigestTable } from './models/digest.js';
import { initDeliveryLogTable } from './models/deliveryLog.js';
import apiRouter from './routes/api.js';
import { requireAuth } from './middleware/auth.js';
import { scheduleDigest, startExecutiveDiscovery } from './scheduler/cronManager.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['https://brand-monitor-two.vercel.app', 'http://localhost:5173'],
}));
app.use(express.json());

// protect all /api/* routes except auth endpoints and ping
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/') || req.path === '/ping') return next();
  return requireAuth(req, res, next);
});
app.use('/api', apiRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── DB path diagnostics — verify volume is mounted correctly ──────────────────
const dbPath = resolve(process.env.DATABASE_PATH || 'data/brand-monitor.db');
const dbExists = existsSync(dbPath);
const dbSize   = dbExists ? statSync(dbPath).size : 0;
console.log(`[DB] path:   ${dbPath}`);
console.log(`[DB] exists: ${dbExists} | size: ${dbSize} bytes`);
if (!dbExists) {
  console.log('[DB] ⚠ File not found — new DB will be created. If this is a Railway deploy, confirm the Volume mount path matches DATABASE_PATH.');
} else {
  console.log('[DB] ✓ Existing DB found — data should persist from last run.');
}
// ─────────────────────────────────────────────────────────────────────────────

// initialise database then start server — order matters for FK dependencies
initDB();               // settings, users, magic_tokens tables
initWorkspaceTable();   // workspaces table (FK → users)
runSeedMigration();     // link existing settings row to seed user + workspace
initDigestTable();      // digests table + workspace_id column
initDeliveryLogTable(); // delivery_log table + workspace_id column
app.listen(PORT, () => {
  console.log(`Brand Monitor backend running on port ${PORT}`);
  console.log('Server timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
  console.log('Scheduling in UTC for all users');
  scheduleDigest();
  startExecutiveDiscovery();
});
