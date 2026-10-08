import express from 'express';

export function startServer(port) {
  const app = express();

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  return new Promise((resolve, reject) => {
    // Localhost only for now: the dashboard is not reachable from other devices.
    const server = app.listen(port, '127.0.0.1');
    server.once('listening', () => resolve(server));
    server.once('error', reject);
  });
}
