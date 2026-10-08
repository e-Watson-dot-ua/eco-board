import { connectWithRetry, pool } from './database.js';
import { runMigrations } from './migrations.js';
import { startServer } from './server.js';
import { log } from './log.js';

const port = Number(process.env.PORT) || 3000;
// Until a real device is configured, show the data from npm run seed:fake.
const deviceSn = process.env.ECOFLOW_DEVICE_SN || 'FAKE-DEVICE';

let server;
let shuttingDown = false;

async function shutdown(reason) {
  if (shuttingDown) return;
  shuttingDown = true;

  log.info(`Shutting down (${reason})...`);
  // Later: stop the poller here too, before the pool.
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end();
  log.info('Shutdown complete.');
}

// SIGINT = Ctrl+C in the terminal; SIGTERM = "please stop" from Docker/systemd.
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

await connectWithRetry();
await runMigrations();
server = await startServer({ port, deviceSn });
log.info(`eco-board started: http://localhost:${port} (device ${deviceSn})`);
