// Fills device_readings with 30 days of simulated data for device FAKE-DEVICE,
// so the server and dashboard can be built before real EcoFlow data exists.
// Safe to run repeatedly: old FAKE-DEVICE rows are replaced.
// Remove the fake data with: DELETE FROM device_readings WHERE device_sn = 'FAKE-DEVICE';

import { connectWithRetry, pool } from '../src/database.js';

const DEVICE_SN = 'FAKE-DEVICE';
const DAYS = 30;
const INTERVAL_MIN = 5;
const CAPACITY_WH = 2048;

function noise(amount) {
  return (Math.random() - 0.5) * 2 * amount;
}

function generateReadings() {
  const count = (DAYS * 24 * 60) / INTERVAL_MIN;
  const intervalMs = INTERVAL_MIN * 60_000;
  const start = Date.now() - count * intervalMs;
  const readings = [];
  let soc = 60; // battery level in percent, kept as a float between readings

  for (let i = 1; i <= count; i++) {
    const ts = new Date(start + i * intervalMs);
    const hour = ts.getHours() + ts.getMinutes() / 60;

    // Solar-like charging between 06:00 and 18:00, strongest at noon.
    const sun = Math.max(0, Math.sin((Math.PI * (hour - 6)) / 12));
    let powerIn = Math.max(0, Math.round(sun * (300 + noise(30))));

    // Household load: a small base load, more in the evening.
    const eveningLoad = hour >= 18 && hour < 23 ? 100 : 0;
    let powerOut = Math.max(0, Math.round(40 + eveningLoad + noise(10)));

    // A full battery stops charging; an empty battery stops powering the load.
    if (soc >= 100) powerIn = Math.min(powerIn, powerOut);
    if (soc <= 5) powerOut = 0;

    soc += (((powerIn - powerOut) * (INTERVAL_MIN / 60)) / CAPACITY_WH) * 100;
    soc = Math.min(100, Math.max(0, soc));

    const temperature = Number((22 + (powerIn + powerOut) * 0.02 + noise(0.5)).toFixed(1));

    readings.push({ ts, batteryLevel: Math.round(soc), powerIn, powerOut, temperature });
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
