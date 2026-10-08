// Reads a whole number >= 1 from an environment variable, or returns `fallback`
// when the variable is missing or empty. Anything else stops the app with a clear error.
export function positiveIntFromEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer, got "${raw}".`);
  }
  return value;
}
