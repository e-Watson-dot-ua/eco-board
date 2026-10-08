import express from 'express';
import { getLatestReading } from './database.js';

export function startServer({ port, deviceSn }) {
  const app = express();

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/readings/latest', async (req, res) => {
    const reading = await getLatestReading(deviceSn);
    if (!reading) {
      res.status(404).json({ error: `No readings yet for device ${deviceSn}.` });
      return;
    }
    res.json(reading);
  });

  return new Promise((resolve, reject) => {
    // Localhost only for now: the dashboard is not reachable from other devices.
    const server = app.listen(port, '127.0.0.1');
    server.once('listening', () => resolve(server));
    server.once('error', reject);
  });
}
