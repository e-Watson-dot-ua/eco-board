import { connectWithRetry, pool } from './database.js';
import { positiveIntFromEnv } from './env.js';
import { log } from './log.js';
import { runMigrations } from './migrations.js';
import { startPoller } from './poller.js';
import { startServer } from './server.js';
import { FAKE_DEVICE_SN } from './sources/fake-device.js';
import { createFakeSource } from './sources/fake-source.js';

const port = Number(process.env.PORT) || 3000;
const pollIntervalMs = positiveIntFromEnv('POLL_INTERVAL_MS', 5 * 60_000);
// Until a real device is configured, use the simulated one.
const deviceSn = process.env.ECOFLOW_DEVICE_SN || FAKE_DEVICE_SN;
// Only the simulated device can be polled until the EcoFlow source exists.
const pollingEnabled = deviceSn === FAKE_DEVICE_SN;

let server;
let poller;
let shuttingDown = false;

async function shutdown(reason) {
  if (shuttingDown) return;
  shuttingDown = true;

  log.info(`Shutting down (${reason})...`);
  // Order matters: the poller and the server both use the database pool.
  if (poller) await poller.stop();
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end();
  log.info('Shutdown complete.');
}

// SIGINT = Ctrl+C in the terminal; SIGTERM = "please stop" from Docker/systemd.
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

await connectWithRetry();
await runMigrations();
server = await startServer({
  port,
  deviceSn,
  pollIntervalMs: pollingEnabled ? pollIntervalMs : null,
});
log.info(`eco-board started: http://localhost:${port} (device ${deviceSn})`);

if (pollingEnabled) {
  poller = startPoller({ source: createFakeSource(), intervalMs: pollIntervalMs });
  log.info(`Polling the simulated device every ${pollIntervalMs / 1000}s.`);
} else {
  log.warn(`Polling is off: reading ${deviceSn} from the EcoFlow API is not built yet.`);
}
