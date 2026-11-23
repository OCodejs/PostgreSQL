import { createServer } from 'node:http';
import { getPool, closePool } from './db.mjs';

const port = Number(process.env.PORT || 8787);
const server = createServer(async (req, res) => {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');

  if (req.method === 'GET' && req.url === '/healthz') {
    res.writeHead(200).end(JSON.stringify({ service: 'ocodejs-control-plane', status: 'alive' }));
    return;
  }

  if (req.method === 'GET' && req.url === '/readyz') {
    try {
      const result = await getPool().query('SELECT current_timestamp AS checked_at, current_setting(\'server_version\') AS postgres_version');
      res.writeHead(200).end(JSON.stringify({
        service: 'ocodejs-control-plane',
        status: 'ready',
        database: { connected: true, version: result.rows[0].postgres_version, checkedAt: result.rows[0].checked_at }
      }));
    } catch (error) {
      res.writeHead(503).end(JSON.stringify({
        service: 'ocodejs-control-plane',
        status: 'not_ready',
        database: { connected: false, reason: process.env.DATABASE_URL ? 'connection_failed' : 'unconfigured' }
      }));
    }
    return;
  }

  res.writeHead(404).end(JSON.stringify({ error: 'not_found' }));
});

server.listen(port, '0.0.0.0', () => {
  console.log(JSON.stringify({ level: 'info', event: 'server_started', port }));
});

async function shutdown(signal) {
  console.log(JSON.stringify({ level: 'info', event: 'shutdown', signal }));
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
