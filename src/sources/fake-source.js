import { getLatestReading } from '../database.js';
import { FAKE_DEVICE_SN, simulateReading } from '../fake-device.js';

// After a long pause (app stopped for hours), simulate at most this many minutes,
// so the battery level doesn't jump in a single step.
const MAX_STEP_MIN = 15;

// A reading source backed by the simulation. The EcoFlow source will have the
// same shape: a deviceSn and readCurrent(), which returns one reading for "now".
export function createFakeSource() {
  let soc = null; // battery level as a float, carried between readings
  let lastTs = null;

  return {
    deviceSn: FAKE_DEVICE_SN,

    async readCurrent() {
      const now = new Date();
      if (soc === null) {
        // First reading: continue from the last saved one, so the charts don't jump.
        const latest = await getLatestReading(FAKE_DEVICE_SN);
        soc = latest?.batteryLevel ?? 60;
        lastTs = latest ? new Date(latest.ts) : now;
      }

      const minutes = Math.min((now - lastTs) / 60_000, MAX_STEP_MIN);
      const result = simulateReading(now, soc, minutes);
      soc = result.soc;
      lastTs = now;

      return { ...result.reading, raw: { fake: true } };
    },
  };
}
