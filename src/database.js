import { setTimeout as sleep } from 'node:timers/promises';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
}

function positiveIntFromEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer, got "${raw}".`);
  }
  return value;
}

const connectAttempts = positiveIntFromEnv('DB_CONNECT_ATTEMPTS', 10);
const connectDelayMs = positiveIntFromEnv('DB_CONNECT_DELAY_MS', 3000);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Without this handler, an error on an idle connection (e.g. the database
// container restarts) would crash the whole Node.js process.
pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message);
});

export async function getLatestReading(deviceSn) {
  // temperature is numeric in Postgres, which pg returns as a string;
  // ::float8 makes it a normal JavaScript number.
  const { rows } = await pool.query(
    `SELECT device_sn     AS "deviceSn",
            ts,
            battery_level AS "batteryLevel",
            power_in      AS "powerIn",
            power_out     AS "powerOut",
            temperature::float8 AS temperature
       FROM device_readings
      WHERE device_sn = $1
      ORDER BY ts DESC
      LIMIT 1`,
    [deviceSn],
  );
  return rows[0] ?? null;
}

export async function connectWithRetry({
  attempts = connectAttempts,
  delayMs = connectDelayMs,
} = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const { rows } = await pool.query('SELECT version()');
      return rows[0].version;
    } catch (err) {
      if (attempt === attempts) throw err;
      // When both IPv6 and IPv4 are refused, Node throws an AggregateError
      // with an empty message; the code (e.g. ECONNREFUSED) is the useful part.
      console.warn(
        `Database not ready (attempt ${attempt}/${attempts}): ${err.message || err.code}. ` +
          `Retrying in ${delayMs / 1000}s...`,
      );
      await sleep(delayMs);
    }
  }
}
