import { getJson } from './js/api.js';
import { formatAge, formatInterval } from './js/format.js';

// Data counts as stale when this many polls in a row are missing.
const STALE_AFTER_MISSED_POLLS = 3;
// Used instead when the poll interval is unknown (e.g. polling is off).
const STALE_AFTER_DEFAULT_MS = 15 * 60_000;
const CONNECTION_LABELS = { online: 'Online', stale: 'Stale', offline: 'Offline' };
// Below this level the battery gauge shows a warning.
const LOW_BATTERY_PERCENT = 20;
// Net power within this margin counts as idle, so small noise doesn't flip the state.
const IDLE_WATTS = 5;
// Charging state badge: label, icon (an SVG path) and tooltip per state.
const FLOW_STATES = {
  charging: {
    label: 'Charging',
    icon: 'M12 19V5M5 12l7-7 7 7',
    hint: 'More power comes in than goes out: the battery is filling up',
  },
  discharging: {
    label: 'Discharging',
    icon: 'M12 5v14M19 12l-7 7-7-7',
    hint: 'More power goes out than comes in: the battery is running down',
  },
  idle: {
    label: 'Idle',
    icon: 'M5 12h14',
    hint: `Power in and power out are within ${IDLE_WATTS} W of each other`,
  },
};
// The page reloads its data shortly after the poller is expected to save a new
// reading. If no reading is expected (polling off, or a poll is overdue), it
// checks again after this fallback time.
const FALLBACK_REFRESH_MS = 60_000;
// Give the poller this much time to save the reading before asking for it.
const AFTER_POLL_MARGIN_MS = 2_000;
// Same breakpoint as the @media rule in styles.css.
const NARROW_SCREEN = window.matchMedia('(max-width: 600px)');

const el = {
  status: document.getElementById('status'),
  refresh: document.getElementById('refresh'),
  battery: document.getElementById('battery'),
  batteryLow: document.getElementById('battery-low'),
  batteryGauge: document.getElementById('battery-gauge'),
  batteryFill: document.getElementById('battery-fill'),
  flow: document.getElementById('flow'),
  flowIcon: document.getElementById('flow-icon'),
  flowText: document.getElementById('flow-text'),
  connection: document.getElementById('connection'),
  connectionText: document.getElementById('connection-text'),
  pollInfo: document.getElementById('poll-info'),
  deviceSn: document.getElementById('device-sn'),
  powerIn: document.getElementById('power-in'),
  powerOut: document.getElementById('power-out'),
  temperature: document.getElementById('temperature'),
  rangeButtons: document.querySelectorAll('[data-range]'),
};

let currentRange = '24h';
let lastReadings = [];
let charts = [];

// The reasons of the current refresh. A Set keeps each reason once, so when the
// latest reading and the history fail for the same reason, it is listed once.
// The page shows them as a tooltip on the Offline pill, not as extra text.
const errorReasons = new Set();

function clearErrors() {
  errorReasons.clear();
  el.connection.removeAttribute('title');
}

function showError(reason) {
  // Server messages end with a period, which would clash with the "; " separator.
  errorReasons.add(reason.replace(/\.$/, ''));
  el.connection.title = `Could not load the data: ${[...errorReasons].join('; ')}`;
  showConnection('offline');
}

function showBatteryGauge(level) {
  const percent = level ?? 0;
  el.batteryFill.style.width = `${percent}%`;
  el.batteryGauge.setAttribute('aria-valuenow', String(percent));

  // Low battery: warning color plus a "Low" label, so it is never color alone.
  const low = level != null && level < LOW_BATTERY_PERCENT;
  el.batteryGauge.classList.toggle('low', low);
  el.batteryLow.hidden = !low;
  el.batteryLow.title = `Battery is below ${LOW_BATTERY_PERCENT} %`;
}

function showFlow(powerIn, powerOut) {
  if (powerIn == null || powerOut == null) {
    el.flow.hidden = true;
    return;
  }
  const net = powerIn - powerOut;
  let state = 'idle';
  if (net > IDLE_WATTS) state = 'charging';
  if (net < -IDLE_WATTS) state = 'discharging';

  const { label, icon, hint } = FLOW_STATES[state];
  el.flowIcon.setAttribute('d', icon);
  el.flow.title = hint;
  el.flowText.textContent =
    state === 'idle' ? label : `${label} ${net > 0 ? '+' : '−'}${Math.abs(net)} W`;
  el.flow.dataset.state = state;
  el.flow.hidden = false;
}

// The time of the newest reading on the page. The status line computes its age
// from the current time on every refresh, so it also counts up while offline.
let lastReadingTs = null;

// Online: just the time. Stale or Offline: the time plus the age, because then
// the age is what matters ("Updated 14:02:30 (6 min ago)").
function showStatusLine() {
  if (!lastReadingTs) return;
  let text = `Updated ${lastReadingTs.toLocaleString()}`;
  if (el.connection.dataset.state !== 'online') {
    const ageSeconds = Math.max(0, Math.floor((Date.now() - lastReadingTs) / 1000));
    text += ` (${formatAge(ageSeconds)})`;
  }
  el.status.textContent = text;
}

async function loadLatest() {
  try {
    const body = await getJson('/api/readings/latest');
    el.battery.textContent = body.batteryLevel ?? '–';
    showBatteryGauge(body.batteryLevel);
    showFlow(body.powerIn, body.powerOut);
    el.powerIn.textContent = body.powerIn ?? '–';
    el.powerOut.textContent = body.powerOut ?? '–';
    el.temperature.textContent = body.temperature ?? '–';

    const ts = new Date(body.ts);
    lastReadingTs = ts;
    // The pill first: the status line depends on its state.
    showConnection(Date.now() - ts > staleAfterMs() ? 'stale' : 'online');
    showStatusLine();
    return ts;
  } catch (err) {
    showError(err.message);
    return null;
  }
}

function staleAfterMs() {
  return pollIntervalMs ? STALE_AFTER_MISSED_POLLS * pollIntervalMs : STALE_AFTER_DEFAULT_MS;
}

function showConnection(state) {
  // Requests finish in any order: an error in this refresh wins, even if
  // another request succeeds after it.
  const shown = errorReasons.size > 0 ? 'offline' : state;
  el.connection.dataset.state = shown;
  el.connectionText.textContent = CONNECTION_LABELS[shown];
  // Offline keeps its tooltip from showError(): the reason of the failure.
  if (shown !== 'offline') el.connection.title = connectionHint(shown);
  // The charging badge describes the battery right now, which is only known
  // while the data is fresh. showFlow() shows it again after the next good reading.
  if (shown !== 'online') el.flow.hidden = true;
}

function connectionHint(state) {
  const every = pollIntervalMs ? ` (every ${formatInterval(pollIntervalMs)})` : '';
  if (state === 'online') return `New readings arrive on time${every}`;
  return pollIntervalMs
    ? `No new reading for ${STALE_AFTER_MISSED_POLLS} polls in a row (one is expected ` +
        `every ${formatInterval(pollIntervalMs)})`
    : `No new reading for ${STALE_AFTER_DEFAULT_MS / 60_000} minutes`;
}

// Charts

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Time labels: hours for the 24h view, dates for the longer ones.
function formatTick(ms) {
  const date = new Date(ms);
  return currentRange === '24h'
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
}

function createChart(canvasId, datasets, { unit, min, max }) {
  return new Chart(document.getElementById(canvasId), {
    type: 'line',
    data: { datasets },
    options: {
      maintainAspectRatio: false,
      animation: false,
      parsing: false, // our data is already in { x, y } form
      // Hovering anywhere shows all series at that time, not only the nearest point.
      interaction: { mode: 'index', intersect: false },
      elements: {
        // Smooth curves that never overshoot the real values (no 101 %, no -3 W).
        line: { borderWidth: 2, cubicInterpolationMode: 'monotone' },
        point: { radius: 0, hoverRadius: 4, hitRadius: 8 },
      },
      scales: {
        x: {
          type: 'linear',
          ticks: {
            callback: formatTick,
            // Fewer time labels on phones, so they don't overlap.
            maxTicksLimit: NARROW_SCREEN.matches ? 4 : 8,
            maxRotation: 0,
          },
          grid: { display: false },
        },
        y: {
          min,
          max,
          ticks: { callback: (value) => `${value} ${unit}`, maxTicksLimit: 5 },
        },
      },
      plugins: {
        // One series needs no legend: the card title already names it.
        legend: {
          display: datasets.length > 1,
          align: 'end',
          labels: { boxWidth: 12, boxHeight: 2 },
        },
        tooltip: {
          callbacks: {
            title: (items) => new Date(items[0].parsed.x).toLocaleString(),
            label: (item) => ` ${item.dataset.label}: ${item.parsed.y} ${unit}`,
          },
        },
      },
    },
  });
}

function series(label, color, field) {
  return {
    label,
    borderColor: color,
    backgroundColor: color,
    data: lastReadings.map((r) => ({ x: Date.parse(r.ts), y: r[field] })),
  };
}

// Charts are rebuilt from scratch on every change: simple, and fast enough
// for ~300 points.
function renderCharts() {
  charts.forEach((chart) => chart.destroy());

  // Chart.js draws on a canvas, which cannot use CSS variables directly.
  Chart.defaults.color = cssVar('--muted');
  Chart.defaults.borderColor = cssVar('--border');
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;

  const blue = cssVar('--series-1');
  const orange = cssVar('--series-2');
  charts = [
    createChart('chart-battery', [series('Battery', blue, 'batteryLevel')], {
      unit: '%', min: 0, max: 100,
    }),
    createChart('chart-power', [
      series('Power in', blue, 'powerIn'),
      series('Power out', orange, 'powerOut'),
    ], { unit: 'W', min: 0 }),
    createChart('chart-temperature', [series('Temperature', blue, 'temperature')], {
      unit: '°C',
    }),
  ];
}

// Answers can arrive in a different order than the requests were sent, e.g. a
// slow "24h" refresh after a quick click on "7 days". Only the newest request
// may update the charts; older answers, and their errors, are ignored.
let latestHistoryRequest = 0;

async function loadHistory() {
  const request = ++latestHistoryRequest;
  try {
    const body = await getJson(`/api/readings?range=${currentRange}`);
    if (request !== latestHistoryRequest) return;
    lastReadings = body.readings;
    renderCharts();
  } catch (err) {
    if (request !== latestHistoryRequest) return;
    showError(err.message);
  }
}

// Refresh timing

let pollIntervalMs = null; // from /api/config; null means polling is off
let refreshTimer = null;

async function loadConfig() {
  try {
    const config = await getJson('/api/config');
    pollIntervalMs = config.pollIntervalMs;
    el.deviceSn.textContent = config.deviceSn;
    el.pollInfo.textContent = pollIntervalMs
      ? `Polling every ${formatInterval(pollIntervalMs)}`
      : 'Polling off';
  } catch {
    // Without the config, the page still works with the fallback refresh.
  }
}

// Next refresh: right after the poller should have saved its next reading,
// e.g. latest reading at 12:00:00 with a 5-minute interval -> refresh at 12:05:02.
function scheduleNextRefresh(latestTs) {
  clearTimeout(refreshTimer);

  let delay = Math.min(FALLBACK_REFRESH_MS, pollIntervalMs ?? FALLBACK_REFRESH_MS);
  if (pollIntervalMs && latestTs) {
    const untilNextReading = latestTs.getTime() + pollIntervalMs + AFTER_POLL_MARGIN_MS - Date.now();
    // Not positive: the reading is overdue (e.g. a poll failed), so keep the short delay.
    if (untilNextReading > 0) delay = untilNextReading;
  }

  refreshTimer = setTimeout(() => {
    // A hidden tab skips the refresh; becoming visible again triggers one.
    if (!document.hidden) refreshAll();
  }, delay);
}

// Event handlers and first load

async function refreshAll() {
  el.refresh.disabled = true;
  clearErrors();
  const [latestTs] = await Promise.all([loadLatest(), loadHistory()]);
  el.refresh.disabled = false;
  // Also after a failed refresh, so the age keeps counting while offline.
  showStatusLine();
  scheduleNextRefresh(latestTs);
}

el.refresh.addEventListener('click', refreshAll);

el.rangeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    currentRange = button.dataset.range;
    el.rangeButtons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    loadHistory();
  });
});

// Redraw the charts with the new colors when the system switches light/dark mode.
window.matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', renderCharts);
// ...and with the right number of time labels when the screen crosses 600 px.
NARROW_SCREEN.addEventListener('change', renderCharts);

// When the tab becomes visible again, reload right away.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshAll();
});

await loadConfig();
refreshAll();
