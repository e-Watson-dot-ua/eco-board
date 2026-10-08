// Loading the data: the Refresh button, the automatic refresh after each
// expected poll, and reloading when the tab becomes visible again.
import { getJson } from './api.js';
import { showCards } from './cards.js';
import { loadHistory } from './charts.js';
import { config } from './config.js';
import { clearErrors, showError, showHeader, showStatusLine } from './header.js';

// The page reloads its data shortly after the poller is expected to save a new
// reading. If no reading is expected (polling off, or a poll is overdue), it
// checks again after this fallback time.
const FALLBACK_REFRESH_MS = 60_000;
// Give the poller this much time to save the reading before asking for it.
const AFTER_POLL_MARGIN_MS = 2_000;

const refreshButton = document.getElementById('refresh');

let refreshTimer = null;

// Wires up the Refresh button and the tab visibility. Called once when the page starts.
export function initRefresh() {
  refreshButton.addEventListener('click', refreshAll);

  // When the tab becomes visible again, reload right away.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshAll();
  });
}

export async function refreshAll() {
  refreshButton.disabled = true;
  clearErrors();
  const [latestTs] = await Promise.all([loadLatest(), loadHistory()]);
  refreshButton.disabled = false;
  // Also after a failed refresh, so the age keeps counting while offline.
  showStatusLine();
  scheduleNextRefresh(latestTs);
}

// Returns the time of the newest reading, or null if it could not be loaded.
async function loadLatest() {
  try {
    const body = await getJson('/api/readings/latest');
    showCards(body);
    showHeader(body);
    return new Date(body.ts);
  } catch (err) {
    showError(err.message);
    return null;
  }
}

// Next refresh: right after the poller should have saved its next reading,
// e.g. latest reading at 12:00:00 with a 5-minute interval -> refresh at 12:05:02.
function scheduleNextRefresh(latestTs) {
  clearTimeout(refreshTimer);

  let delay = Math.min(FALLBACK_REFRESH_MS, config.pollIntervalMs ?? FALLBACK_REFRESH_MS);
  if (config.pollIntervalMs && latestTs) {
    const untilNextReading =
      latestTs.getTime() + config.pollIntervalMs + AFTER_POLL_MARGIN_MS - Date.now();
    // Not positive: the reading is overdue (e.g. a poll failed), so keep the short delay.
    if (untilNextReading > 0) delay = untilNextReading;
  }

  refreshTimer = setTimeout(() => {
    // A hidden tab skips the refresh; becoming visible again triggers one.
    if (!document.hidden) refreshAll();
  }, delay);
}
