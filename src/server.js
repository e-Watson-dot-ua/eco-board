import { join } from 'node:path';
import express from 'express';
import { getLatestReading, getReadingHistory } from './database.js';
import { log } from './log.js';

// Each range gets a bucket size that keeps the chart at roughly 170-290 points.
const RANGES = {
  '24h': { period: '24 hours', bucket: '5 minutes' },
  '7d': { period: '7 days', bucket: '1 hour' },
  '30d': { period: '30 days', bucket: '4 hours' },
};

// Logs each request once its response is sent, e.g. "http GET /api/readings?range=7d 200 12ms".
function logRequests(req, res, next) {
  const start = performance.now();
  res.on('finish', () => {
    const ms = Math.round(performance.now() - start);
    log.info(`http ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
}

export function startServer({ port, deviceSn, pollIntervalMs }) {
  const app = express();

  // First, so that every request is logged, including static files.
  app.use(logRequests);

  // The dashboard: src/public/index.html is served at http://localhost:PORT/
  app.use(express.static(join(import.meta.dirname, 'public')));
  // Chart.js from node_modules, so the dashboard also works without internet.
  app.use(
    '/vendor/chart.js',
    express.static(join(import.meta.dirname, '..', 'node_modules', 'chart.js', 'dist')),
  );

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Settings the dashboard needs; pollIntervalMs is null when polling is off.
  app.get('/api/config', (req, res) => {
    res.json({ deviceSn, pollIntervalMs });
  });

  app.get('/api/readings/latest', async (req, res) => {
    const reading = await getLatestReading(deviceSn);
    if (!reading) {
      res.status(404).json({ error: `No readings yet for device ${deviceSn}.` });
      return;
    }
    res.json(reading);
  });

  app.get('/api/readings', async (req, res) => {
    const range = req.query.range ?? '24h';
    // Object.hasOwn, not RANGES[range]: a range like "toString" must not match.
    if (!Object.hasOwn(RANGES, range)) {
      res.status(400).json({
        error: `Invalid range "${range}". Use one of: ${Object.keys(RANGES).join(', ')}.`,
      });
      return;
    }

    const readings = await getReadingHistory(deviceSn, RANGES[range]);
    res.json({ deviceSn, range, bucket: RANGES[range].bucket, readings });
  });

  return new Promise((resolve, reject) => {
    // Localhost only for now: the dashboard is not reachable from other devices.
    const server = app.listen(port, '127.0.0.1');
    server.once('listening', () => resolve(server));
    server.once('error', reject);
  });
}
