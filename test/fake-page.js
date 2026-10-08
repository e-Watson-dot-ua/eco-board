// A fake browser page for testing the dashboard modules in Node.js: just enough
// of the DOM, fetch() and Chart.js for the modules in client/ to run.
// Call installFakePage() before importing client/app.js.

function fakeElement(id) {
  const listeners = {};
  return {
    id,
    textContent: '',
    hidden: false,
    title: '',
    disabled: false,
    dataset: {},
    style: {},
    attributes: {},
    classList: {
      names: new Set(),
      toggle(name, on) {
        if (on) this.names.add(name);
        else this.names.delete(name);
      },
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
      if (name === 'title') this.title = value;
    },
    removeAttribute(name) {
      delete this.attributes[name];
      if (name === 'title') this.title = '';
    },
    addEventListener(type, listener) {
      (listeners[type] ??= []).push(listener);
    },
    // Test helper: run the listeners, e.g. click('click').
    fire(type) {
      for (const listener of listeners[type] ?? []) listener();
    },
  };
}

export function installFakePage({ pollIntervalMs = 10_000 } = {}) {
  const elements = new Map();
  const byId = (id) => {
    if (!elements.has(id)) elements.set(id, fakeElement(id));
    return elements.get(id);
  };
  const rangeButtons = ['24h', '7d', '30d'].map((range) => {
    const button = fakeElement(`range-${range}`);
    button.dataset.range = range;
    return button;
  });
  const documentEvents = fakeElement('document');

  globalThis.document = {
    getElementById: byId,
    querySelectorAll: (selector) => (selector === '[data-range]' ? rangeButtons : []),
    hidden: false,
    documentElement: {},
    body: {},
    addEventListener: documentEvents.addEventListener,
  };
  globalThis.window = { matchMedia: () => ({ matches: false, addEventListener() {} }) };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '#123456', fontFamily: 'system-ui' });

  // Chart.js: counts charts, and remembers how many points each series got.
  const charts = { created: 0, destroyed: 0, last: [] };
  globalThis.Chart = class {
    static defaults = { font: {} };

    constructor(canvas, config) {
      charts.created++;
      charts.last = [
        ...charts.last,
        { canvas: canvas.id, series: config.data.datasets.map((d) => [d.label, d.data.length]) },
      ].slice(-3);
    }

    destroy() {
      charts.destroyed++;
    }
  };

  // The dashboard's refresh timer would keep the test process alive forever;
  // unref() lets Node.js exit when only those timers are left.
  const realSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (callback, ms, ...args) => {
    const timer = realSetTimeout(callback, ms, ...args);
    timer.unref?.();
    return timer;
  };

  // The server: answers like ours, and can be switched off.
  const server = { up: true, requests: [], latestTs: new Date(Date.now() - 3000).toISOString() };
  const json = (status, body) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  globalThis.fetch = async (url) => {
    server.requests.push(url);
    if (!server.up) throw new TypeError('Failed to fetch');
    if (url === '/api/config') return json(200, { deviceSn: 'FAKE-DEVICE', pollIntervalMs });
    if (url === '/api/readings/latest') {
      return json(200, {
        deviceSn: 'FAKE-DEVICE', ts: server.latestTs,
        batteryLevel: 97, powerIn: 275, powerOut: 41, temperature: 28.5,
      });
    }
    const points = { '24h': 288, '7d': 168, '30d': 180 }[url.split('range=')[1]];
    const readings = Array.from({ length: points }, (_, i) => ({
      ts: new Date(i * 1000).toISOString(), batteryLevel: 50, powerIn: 10, powerOut: 5, temperature: 25,
    }));
    return json(200, { readings });
  };

  // Lets pending requests and their follow-up work finish.
  const settle = () => new Promise((resolve) => realSetTimeout(resolve, 50));

  return { byId, rangeButtons, charts, server, settle };
}
