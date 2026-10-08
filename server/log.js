// Console logging with a local timestamp, e.g. "2026-10-08 14:05:09.123 http GET / 200 3ms".

function pad(number, length = 2) {
  return String(number).padStart(length, '0');
}

function timestamp() {
  const d = new Date();
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return `${date} ${time}.${pad(d.getMilliseconds(), 3)}`;
}

export const log = {
  info: (message) => console.log(`${timestamp()} ${message}`),
  warn: (message) => console.warn(`${timestamp()} ${message}`),
  error: (message) => console.error(`${timestamp()} ${message}`),
};
