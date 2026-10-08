import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';

// poller.js imports database.js, which needs a DATABASE_URL. The tests never
// connect: they pass their own save() function to the poller.
process.env.DATABASE_URL ??= 'postgres://test@localhost:1/not-used';
const { startPoller } = await import('../src/poller.js');

// A source that counts its calls; `fail` lists call numbers that throw.
function testSource({ fail = [], delayMs = 0 } = {}) {
  const source = {
    deviceSn: 'TEST-SN',
    calls: 0,
    async readCurrent() {
      source.calls++;
      if (delayMs) await sleep(delayMs);
      if (fail.includes(source.calls)) throw new Error('simulated API error');
      return { ts: new Date(), batteryLevel: 50, powerIn: 100, powerOut: 40, temperature: 25 };
    },
  };
  return source;
}

describe('startPoller', () => {
  beforeEach(() => {
    // Keep the test output clean; the poller logs every poll.
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});
  });

  it('polls right away and then at the interval, saving under the device serial number', async () => {
    const saved = [];
    const source = testSource();
    const poller = startPoller({ source, intervalMs: 30, save: async (sn, r) => saved.push(sn) });

    await sleep(10);
    assert.equal(source.calls, 1, 'the first poll runs right away');
    await sleep(100);
    await poller.stop();

    assert.ok(source.calls >= 3, `expected several polls, got ${source.calls}`);
    assert.deepEqual(new Set(saved), new Set(['TEST-SN']));
  });

  it('keeps polling after a failed poll', async () => {
    const saved = [];
    const source = testSource({ fail: [2] });
    const poller = startPoller({ source, intervalMs: 20, save: async (sn, r) => saved.push(r) });

    await sleep(100);
    await poller.stop();

    assert.ok(source.calls >= 3, 'polls 3 and later still run after poll 2 failed');
    assert.equal(saved.length, source.calls - 1, 'every poll except the failed one is saved');
    assert.ok(console.error.mock.calls.some((c) => c.arguments[0].includes('simulated API error')));
  });

  it('stops polling, and stop() waits for a poll that is still running', async () => {
    const saved = [];
    const source = testSource({ delayMs: 50 });
    const poller = startPoller({ source, intervalMs: 10, save: async (sn, r) => saved.push(r) });

    await sleep(10); // the first poll is now in progress
    await poller.stop();
    assert.equal(saved.length, 1, 'the running poll finished and was saved before stop() returned');

    const callsAtStop = source.calls;
    await sleep(80);
    assert.equal(source.calls, callsAtStop, 'no polls after stop()');
  });
});
