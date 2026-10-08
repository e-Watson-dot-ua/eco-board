import { connectWithRetry, pool } from '../src/database.js';
import { runMigrations } from '../src/migrations.js';

try {
  await connectWithRetry();
  await runMigrations();
  console.log('Migrations are up to date.');
} finally {
  await pool.end();
}
