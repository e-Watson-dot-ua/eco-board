// Requests to the eco-board server.

// A request without an answer after this time is aborted. Otherwise a hanging
// server would stop the page from refreshing at all.
const REQUEST_TIMEOUT_MS = 10_000;

// Fetches JSON from our API. A server error page is HTML, not JSON, so don't
// let parsing hide the real problem.
export async function getJson(url) {
  let res;
  let body;
  try {
    // The timeout also covers reading the body, not only the start of the answer.
    res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    body = await res.json().catch((err) => {
      if (err.name === 'TimeoutError') throw err;
      return {};
    });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new Error(`No answer from the server within ${REQUEST_TIMEOUT_MS / 1000} s`);
    }
    throw err;
  }
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body;
}
