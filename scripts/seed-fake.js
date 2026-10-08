// Fills device_readings with 30 days of simulated data for device FAKE-DEVICE,
// so the server and dashboard can be built before real EcoFlow data exists.
// Safe to run repeatedly: old FAKE-DEVICE rows are replaced.
// Remove the fake data with: DELETE FROM device_readings WHERE device_sn = 'FAKE-DEVICE';

import { connectWithRetry, pool } from '../src/database.js';
import { FAKE_DEVICE_SN as DEVICE_SN, simulateReading } from '../src/sources/fake-device.js';

const DAYS = 30;
const INTERVAL_MIN = 5;

function generateReadings() {
  const count = (DAYS * 24 * 60) / INTERVAL_MIN;
  const intervalMs = INTERVAL_MIN * 60_000;
  const start = Date.now() - count * intervalMs;
  const readings = [];
  let soc = 60; // battery level in percent, kept as a float between readings

  for (let i = 1; i <= count; i++) {
    const ts = new Date(start + i * intervalMs);
    const result = simulateReading(ts, soc, INTERVAL_MIN);
    readings.push(result.reading);
    soc = result.soc;
  }
  return readings;
}

try {
  await connectWithRetry();
  const readings = generateReadings();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM device_readings WHERE device_sn = $1', [DEVICE_SN]);
    // unnest() turns the five arrays into rows, so all readings go in one query.
    await client.query(
      `INSERT INTO device_readings
         (device_sn, ts, battery_level, power_in, power_out, temperature, raw)
       SELECT $1, ts, battery_level, power_in, power_out, temperature, '{"fake": true}'
       FROM unnest($2::timestamptz[], $3::smallint[], $4::int[], $5::int[], $6::numeric[])
         AS t(ts, battery_level, power_in, power_out, temperature)`,
      [
        DEVICE_SN,
        readings.map((r) => r.ts),
        readings.map((r) => r.batteryLevel),
        readings.map((r) => r.powerIn),
        readings.map((r) => r.powerOut),
        readings.map((r) => r.temperature),
      ],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  console.log(`Inserted ${readings.length} fake readings for ${DEVICE_SN}.`);
} finally {
  await pool.end();
}
