import { connectWithRetry, pool } from '../server/database.js';
import { runMigrations } from '../server/migrations.js';

try {
  await connectWithRetry();
  await runMigrations();
  console.log('Migrations are up to date.');
} finally {
  await pool.end();
}
