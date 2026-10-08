// Text formatting for times and durations shown on the dashboard.

// How long ago something happened, rounded down: "1 min ago" means at least a full minute.
export function formatAge(seconds) {
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds} s ago`;
  if (seconds < 60 * 60) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 24 * 60 * 60) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86_400)} d ago`;
}

// An interval in milliseconds: 10000 -> "10 s", 300000 -> "5 min", 3600000 -> "1 h"
export function formatInterval(ms) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${Math.round(seconds / 3600)} h`;
}
