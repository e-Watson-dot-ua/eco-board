import { setTimeout as sleep } from 'node:timers/promises';
import pg from 'pg';
import { log } from './log.js';

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
  log.error(`PostgreSQL pool error: ${err.message}`);
});

// Runs a query and logs it by name, e.g. 'db history ["FAKE-DEVICE","1 hour","7 days"] 9ms, 168 rows'.
async function query(name, text, params) {
  const start = performance.now();
  // Long parameters (e.g. a full EcoFlow response in raw) are shortened in the log.
  const paramsText = JSON.stringify(params);
  const shownParams = paramsText.length > 120 ? `${paramsText.slice(0, 117)}...` : paramsText;
  const logPrefix = `db ${name} ${shownParams}`;
  try {
    const result = await pool.query(text, params);
    const ms = Math.round(performance.now() - start);
    const rows = result.rowCount === 1 ? 'row' : 'rows';
    log.info(`${logPrefix} ${ms}ms, ${result.rowCount} ${rows}`);
    return result;
  } catch (err) {
    const ms = Math.round(performance.now() - start);
    log.error(`${logPrefix} failed after ${ms}ms: ${err.message || err.code}`);
    throw err;
  }
}

export async function insertReading(deviceSn, reading) {
  await query(
    'insert',
    `INSERT INTO device_readings
       (device_sn, ts, battery_level, power_in, power_out, temperature, raw)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      deviceSn,
      reading.ts,
      reading.batteryLevel,
      reading.powerIn,
      reading.powerOut,
      reading.temperature,
      reading.raw,
    ],
  );
}

export async function getLatestReading(deviceSn) {
  // temperature is numeric in Postgres, which pg returns as a string;
  // ::float8 makes it a normal JavaScript number.
  const { rows } = await query(
    'latest',
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

// Averages readings into time buckets, e.g. period '7 days' with bucket '1 hour'
// returns one row per hour of the last 7 days.
export async function getReadingHistory(deviceSn, { period, bucket }) {
  const { rows } = await query(
    'history',
    `SELECT date_bin($2::interval, ts, TIMESTAMPTZ '2000-01-01') AS ts,
            round(avg(battery_level))::int           AS "batteryLevel",
            round(avg(power_in))::int                AS "powerIn",
            round(avg(power_out))::int               AS "powerOut",
            round(avg(temperature), 1)::float8       AS temperature
       FROM device_readings
      WHERE device_sn = $1
        AND ts >= now() - $3::interval
      GROUP BY 1
      ORDER BY 1`,
    [deviceSn, bucket, period],
  );
  return rows;
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
      log.warn(
        `Database not ready (attempt ${attempt}/${attempts}): ${err.message || err.code}. ` +
          `Retrying in ${delayMs / 1000}s...`,
      );
      await sleep(delayMs);
    }
  }
}
