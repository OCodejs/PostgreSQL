import pg from 'pg';

const { Pool } = pg;

let pool;

export function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX || 5),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 3_000,
      statement_timeout: 5_000,
      application_name: 'ocodejs-control-plane',
      ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: true }
    });
    pool.on('error', (error) => {
      console.error(JSON.stringify({ level: 'error', event: 'pg_pool_error', message: error.message }));
    });
  }
  return pool;
}

export async function closePool() {
  if (pool) {
    const current = pool;
    pool = undefined;
    await current.end();
  }
}
