// A simulated battery with solar charging and a household load.
// Used by `npm run seed:fake` (history) and by the fake source (live polling).

export const FAKE_DEVICE_SN = 'FAKE-DEVICE';

const CAPACITY_WH = 2048;

function noise(amount) {
  return (Math.random() - 0.5) * 2 * amount;
}

// Simulates one reading at time `ts`.
// `soc` is the battery level in percent (a float) before this reading, and
// `minutes` is the time since the previous reading. Returns the reading and
// the new battery level, which the caller passes into the next call.
export function simulateReading(ts, soc, minutes) {
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

  let newSoc = soc + (((powerIn - powerOut) * (minutes / 60)) / CAPACITY_WH) * 100;
  newSoc = Math.min(100, Math.max(0, newSoc));

  const temperature = Number((22 + (powerIn + powerOut) * 0.02 + noise(0.5)).toFixed(1));

  return {
    reading: { ts, batteryLevel: Math.round(newSoc), powerIn, powerOut, temperature },
    soc: newSoc,
  };
}
