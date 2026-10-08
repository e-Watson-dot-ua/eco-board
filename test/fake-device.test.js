import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { simulateReading } from '../src/sources/fake-device.js';

// Local times on one day, so the tests don't depend on when they run.
const at = (hour) => new Date(2026, 0, 15, hour, 0);

describe('simulateReading', () => {
  it('keeps the battery level between 0 and 100 % over 30 days', () => {
    let soc = 60;
    const start = at(0).getTime();
    for (let i = 0; i < 30 * 24 * 12; i++) {
      const result = simulateReading(new Date(start + i * 5 * 60_000), soc, 5);
      soc = result.soc;
      assert.ok(soc >= 0 && soc <= 100, `battery level out of range: ${soc}`);
      assert.ok(result.reading.batteryLevel >= 0 && result.reading.batteryLevel <= 100);
    }
  });

  it('has no solar input at night', () => {
    assert.equal(simulateReading(at(2), 50, 5).reading.powerIn, 0);
  });

  it('stops charging when the battery is full', () => {
    const { reading, soc } = simulateReading(at(12), 100, 5);
    assert.ok(reading.powerIn <= reading.powerOut, 'a full battery takes no extra power');
    assert.equal(soc, 100);
  });

  it('stops powering the load when the battery is nearly empty', () => {
    assert.equal(simulateReading(at(20), 5, 5).reading.powerOut, 0);
  });
});
