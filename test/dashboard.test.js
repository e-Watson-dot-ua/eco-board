import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { installFakePage } from './fake-page.js';

// One page for the whole file: the tests below run in order, like a user
// opening the dashboard, clicking around, and the server going down and up.
const page = installFakePage({ pollIntervalMs: 10_000 });
const { byId, rangeButtons, charts, server, settle } = page;

function takeRequests() {
  return server.requests.splice(0);
}

describe('dashboard', () => {
  before(async () => {
    await import('../public/js/app.js');
    await settle();
  });

  it('loads the config, the latest reading and 24 hours of history', () => {
    assert.deepEqual(takeRequests(), [
      '/api/config', '/api/readings/latest', '/api/readings?range=24h',
    ]);
  });

  it('shows the latest reading in the cards', () => {
    assert.equal(byId('battery').textContent, 97);
    assert.equal(byId('battery-fill').style.width, '97%');
    assert.equal(byId('battery-low').hidden, true);
    assert.equal(byId('power-in').textContent, 275);
    assert.equal(byId('power-out').textContent, 41);
    assert.equal(byId('temperature').textContent, 28.5);
  });

  it('shows Online, the charging badge and the footer', () => {
    assert.equal(byId('connection-text').textContent, 'Online');
    assert.equal(byId('connection').title, 'New readings arrive on time (every 10 s)');
    assert.equal(byId('flow').hidden, false);
    assert.equal(byId('flow-text').textContent, 'Charging +234 W');
    assert.equal(byId('poll-info').textContent, 'Polling every 10 s');
    assert.equal(byId('device-sn').textContent, 'FAKE-DEVICE');
    assert.match(byId('status').textContent, /^Updated [^(]+$/, 'no age while online');
  });

  it('draws the three charts with the 24-hour data', () => {
    assert.equal(charts.created, 3);
    assert.deepEqual(charts.last.map((c) => c.canvas), ['chart-battery', 'chart-power', 'chart-temperature']);
    assert.deepEqual(charts.last[1].series, [['Power in', 288], ['Power out', 288]]);
  });

  it('switches to 7 days, replacing the old charts', async () => {
    rangeButtons[1].fire('click');
    await settle();

    assert.deepEqual(takeRequests(), ['/api/readings?range=7d']);
    assert.equal(rangeButtons[1].attributes['aria-pressed'], 'true');
    assert.equal(rangeButtons[0].attributes['aria-pressed'], 'false');
    assert.equal(charts.created, 6);
    assert.equal(charts.destroyed, 3, 'the old charts are destroyed, not left behind');
    assert.deepEqual(charts.last[0].series, [['Battery', 168]]);
  });

  it('shows Offline with the reason when the server is down, and keeps the last values', async () => {
    server.up = false;
    byId('refresh').fire('click');
    await settle();

    assert.equal(byId('connection-text').textContent, 'Offline');
    assert.equal(byId('connection').title, 'Could not load the data: Failed to fetch');
    assert.equal(byId('flow').hidden, true, 'no charging state while offline');
    assert.match(byId('status').textContent, /^Updated .+ \(.+\)$/, 'the age is shown while offline');
    assert.equal(byId('battery').textContent, 97, 'the last known values stay visible');
    assert.equal(byId('refresh').disabled, false);
    takeRequests();
  });

  it('is back Online when the server is up again', async () => {
    server.up = true;
    byId('refresh').fire('click');
    await settle();

    assert.equal(byId('connection-text').textContent, 'Online');
    assert.equal(byId('flow').hidden, false);
    assert.deepEqual(takeRequests(), ['/api/readings/latest', '/api/readings?range=7d']);
  });
});
