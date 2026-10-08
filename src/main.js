import { connectWithRetry, pool } from './database.js';
import { runMigrations } from './migrate.js';

let shuttingDown = false;

async function shutdown(reason) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`Shutting down (${reason})...`);
  // Later: stop the poller and close the HTTP server here, before the pool.
  await pool.end();
  console.log('Shutdown complete.');
}

// SIGINT = Ctrl+C in the terminal; SIGTERM = "please stop" from Docker/systemd.
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

await connectWithRetry();
await runMigrations();
console.log('eco-board started.');

// Nothing keeps the process running yet (no poller, no server), so stop here.
// Remove this line when the poller or the server is added.
await shutdown('startup finished');
