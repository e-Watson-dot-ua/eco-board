import { connectWithRetry, pool } from '../src/database.js';
import { runMigrations } from '../src/migrate.js';

try {
  await connectWithRetry();
  await runMigrations();
  console.log('Migrations are up to date.');
} finally {
  await pool.end();
}
