// The header card: connection pill (Online / Stale / Offline), status line,
// charging badge and the footer with the poll interval and serial number.
import { config } from './config.js';
import { formatAge, formatInterval } from './format.js';

// Data counts as stale when this many polls in a row are missing.
const STALE_AFTER_MISSED_POLLS = 3;
// Used instead when the poll interval is unknown (e.g. polling is off).
const STALE_AFTER_DEFAULT_MS = 15 * 60_000;
const CONNECTION_LABELS = { online: 'Online', stale: 'Stale', offline: 'Offline' };
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

const el = {
  status: document.getElementById('status'),
  flow: document.getElementById('flow'),
  flowIcon: document.getElementById('flow-icon'),
  flowText: document.getElementById('flow-text'),
  connection: document.getElementById('connection'),
  connectionText: document.getElementById('connection-text'),
  pollInfo: document.getElementById('poll-info'),
  deviceSn: document.getElementById('device-sn'),
};

// The reasons of the current refresh. A Set keeps each reason once, so when the
// latest reading and the history fail for the same reason, it is listed once.
// The page shows them as a tooltip on the Offline pill, not as extra text.
const errorReasons = new Set();

// The time of the newest reading on the page. The status line computes its age
// from the current time on every refresh, so it also counts up while offline.
let lastReadingTs = null;

// Shows a successfully loaded reading: charging badge, pill and status line.
export function showHeader(reading) {
  showFlow(reading.powerIn, reading.powerOut);
  lastReadingTs = new Date(reading.ts);
  // The pill first: the status line depends on its state.
  showConnection(Date.now() - lastReadingTs > staleAfterMs() ? 'stale' : 'online');
  showStatusLine();
}

export function clearErrors() {
  errorReasons.clear();
  el.connection.removeAttribute('title');
}

export function showError(reason) {
  // Server messages end with a period, which would clash with the "; " separator.
  errorReasons.add(reason.replace(/\.$/, ''));
  el.connection.title = `Could not load the data: ${[...errorReasons].join('; ')}`;
  showConnection('offline');
}

// Online: just the time. Stale or Offline: the time plus the age, because then
// the age is what matters ("Updated 14:02:30 (6 min ago)").
export function showStatusLine() {
  if (!lastReadingTs) return;
  let text = `Updated ${lastReadingTs.toLocaleString()}`;
  if (el.connection.dataset.state !== 'online') {
    const ageSeconds = Math.max(0, Math.floor((Date.now() - lastReadingTs) / 1000));
    text += ` (${formatAge(ageSeconds)})`;
  }
  el.status.textContent = text;
}

export function showFooter() {
  el.deviceSn.textContent = config.deviceSn ?? '';
  el.pollInfo.textContent = config.pollIntervalMs
    ? `Polling every ${formatInterval(config.pollIntervalMs)}`
    : 'Polling off';
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

function staleAfterMs() {
  return config.pollIntervalMs
    ? STALE_AFTER_MISSED_POLLS * config.pollIntervalMs
    : STALE_AFTER_DEFAULT_MS;
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
  const every = config.pollIntervalMs ? ` (every ${formatInterval(config.pollIntervalMs)})` : '';
  if (state === 'online') return `New readings arrive on time${every}`;
  return config.pollIntervalMs
    ? `No new reading for ${STALE_AFTER_MISSED_POLLS} polls in a row (one is expected ` +
        `every ${formatInterval(config.pollIntervalMs)})`
    : `No new reading for ${STALE_AFTER_DEFAULT_MS / 60_000} minutes`;
}
