// The history section: range buttons (24 hours / 7 days / 30 days) and the
// three Chart.js charts for battery level, power and temperature.
import { getJson } from './api.js';
import { showError } from './header.js';

// Same breakpoint as the @media rule in styles.css.
const NARROW_SCREEN = window.matchMedia('(max-width: 600px)');

const rangeButtons = document.querySelectorAll('[data-range]');

let currentRange = '24h';
let lastReadings = [];
let charts = [];

// Answers can arrive in a different order than the requests were sent, e.g. a
// slow "24h" refresh after a quick click on "7 days". Only the newest request
// may update the charts; older answers, and their errors, are ignored.
let latestHistoryRequest = 0;

// Wires up the range buttons and redraws on theme or screen size changes.
// Called once when the page starts.
export function initCharts() {
  rangeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      currentRange = button.dataset.range;
      rangeButtons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      loadHistory();
    });
  });

  // Redraw the charts with the new colors when the system switches light/dark mode.
  window.matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', renderCharts);
  // ...and with the right number of time labels when the screen crosses 600 px.
  NARROW_SCREEN.addEventListener('change', renderCharts);
}

export async function loadHistory() {
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

function series(label, color, field) {
  return {
    label,
    borderColor: color,
    backgroundColor: color,
    data: lastReadings.map((r) => ({ x: Date.parse(r.ts), y: r[field] })),
  };
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

// Time labels: hours for the 24h view, dates for the longer ones.
function formatTick(ms) {
  const date = new Date(ms);
  return currentRange === '24h'
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
