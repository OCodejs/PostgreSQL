import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool, closePool } from '../src/db.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, '../../../infra/postgres/migrations');
const pool = getPool();

async function main() {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(7219042026)');
    const files = (await readdir(migrationsDir)).filter((name) => /^\d+_[a-z0-9_]+\.sql$/.test(name)).sort();
    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      const source = await readFile(path.join(migrationsDir, file), 'utf8');
      const checksum = createHash('sha256').update(source).digest('hex');
      const ledgerExists = await client.query("SELECT to_regclass('public.schema_migrations') AS ledger");
      if (ledgerExists.rows[0].ledger) {
        const existing = await client.query('SELECT checksum FROM schema_migrations WHERE version = $1', [version]);
        if (existing.rowCount) {
          if (existing.rows[0].checksum !== checksum) throw new Error(`Checksum mismatch for applied migration ${version}`);
          console.log(`skip ${version}`);
          continue;
        }
      }
      await client.query(source);
      await client.query(
        'INSERT INTO schema_migrations(version, checksum) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING',
        [version, checksum]
      );
      console.log(`applied ${version}`);
    }
  } finally {
    try { await client.query('SELECT pg_advisory_unlock(7219042026)'); } catch {}
    client.release();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ level: 'fatal', event: 'migration_failed', message: error.message }));
  process.exitCode = 1;
}).finally(closePool);
