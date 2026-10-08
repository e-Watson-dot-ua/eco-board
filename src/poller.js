import { insertReading } from './database.js';
import { log } from './log.js';

// Every `intervalMs`, reads the current values from `source` and saves them.
// A failed poll is logged, and the next poll runs as usual. Polls never overlap:
// the next one is scheduled only after the previous one has finished.
export function startPoller({ source, intervalMs }) {
  let timer = null;
  let running = null; // the poll in progress, if any
  let stopped = false;

  async function pollOnce() {
    const start = performance.now();
    try {
      const r = await source.readCurrent();
      await insertReading(source.deviceSn, r);
      const ms = Math.round(performance.now() - start);
      log.info(
        `poll ${source.deviceSn} saved: ${r.batteryLevel} %, ${r.powerIn} W in, ` +
          `${r.powerOut} W out, ${r.temperature} °C (${ms}ms)`,
      );
    } catch (err) {
      log.error(`poll ${source.deviceSn} failed: ${err.message || err.code}`);
    }
  }

  function schedule(delayMs) {
    timer = setTimeout(async () => {
      running = pollOnce();
      await running;
      running = null;
      if (!stopped) schedule(intervalMs);
    }, delayMs);
  }

  schedule(0); // the first poll runs right away

  return {
    // Stops polling. If a poll is in progress, waits until it has finished.
    async stop() {
      stopped = true;
      clearTimeout(timer);
      await running;
    },
  };
}
