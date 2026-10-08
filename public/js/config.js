// Settings from the server (/api/config), loaded once when the page starts.
import { getJson } from './api.js';

export const config = {
  deviceSn: null,
  pollIntervalMs: null, // null means polling is off
};

export async function loadConfig() {
  try {
    Object.assign(config, await getJson('/api/config'));
  } catch {
    // Without the config, the page still works with the fallback refresh.
  }
}
