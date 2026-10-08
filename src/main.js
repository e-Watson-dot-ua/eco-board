import { connectWithRetry, pool } from './database.js';
import { runMigrations } from './migrations.js';
import { startServer } from './server.js';

const port = Number(process.env.PORT) || 3000;

let server;
let shuttingDown = false;

async function shutdown(reason) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`Shutting down (${reason})...`);
  // Later: stop the poller here too, before the pool.
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end();
  console.log('Shutdown complete.');
}

// SIGINT = Ctrl+C in the terminal; SIGTERM = "please stop" from Docker/systemd.
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

await connectWithRetry();
await runMigrations();
server = await startServer(port);
console.log(`eco-board started: http://localhost:${port}`);
