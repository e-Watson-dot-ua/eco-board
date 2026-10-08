// Data older than this is shown as a warning (the poller runs every 5 minutes).
const STALE_AFTER_MIN = 15;
// Below this level the battery gauge shows a warning.
const LOW_BATTERY_PERCENT = 20;
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
  error: document.getElementById('error'),
  battery: document.getElementById('battery'),
  batteryLow: document.getElementById('battery-low'),
  batteryGauge: document.getElementById('battery-gauge'),
  batteryFill: document.getElementById('battery-fill'),
  powerIn: document.getElementById('power-in'),
  powerOut: document.getElementById('power-out'),
  temperature: document.getElementById('temperature'),
  rangeButtons: document.querySelectorAll('[data-range]'),
};

let currentRange = '24h';
let lastReadings = [];
let charts = [];

// A server error page is HTML, not JSON, so don't let parsing hide the real problem.
async function getJson(url) {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body;
}

function showError(message) {
  el.error.textContent = message;
  el.error.hidden = false;
}

function formatAge(minutes) {
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / (24 * 60))} d ago`;
}

function showBatteryGauge(level) {
  const percent = level ?? 0;
  el.batteryFill.style.width = `${percent}%`;
  el.batteryGauge.setAttribute('aria-valuenow', String(percent));

  // Low battery: warning color plus a "Low" label, so it is never color alone.
  const low = level != null && level < LOW_BATTERY_PERCENT;
  el.batteryGauge.classList.toggle('low', low);
  el.batteryLow.hidden = !low;
}

async function loadLatest() {
  try {
    const body = await getJson('/api/readings/latest');
    el.battery.textContent = body.batteryLevel ?? '–';
    showBatteryGauge(body.batteryLevel);
    el.powerIn.textContent = body.powerIn ?? '–';
    el.powerOut.textContent = body.powerOut ?? '–';
    el.temperature.textContent = body.temperature ?? '–';

    const ts = new Date(body.ts);
    const ageMin = Math.round((Date.now() - ts) / 60_000);
    el.status.textContent =
      `${body.deviceSn} · updated ${ts.toLocaleString()} (${formatAge(ageMin)})`;
    el.status.classList.toggle('stale', ageMin > STALE_AFTER_MIN);
    return ts;
  } catch (err) {
    showError(`Could not load the latest reading: ${err.message}`);
    return null;
  }
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

async function loadHistory() {
  try {
    const body = await getJson(`/api/readings?range=${currentRange}`);
    lastReadings = body.readings;
    renderCharts();
  } catch (err) {
    showError(`Could not load the history: ${err.message}`);
  }
}

// Refresh timing

let pollIntervalMs = null; // from /api/config; null means polling is off
let refreshTimer = null;

async function loadConfig() {
  try {
    ({ pollIntervalMs } = await getJson('/api/config'));
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
  el.error.hidden = true;
  const [latestTs] = await Promise.all([loadLatest(), loadHistory()]);
  el.refresh.disabled = false;
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
