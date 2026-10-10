// Migration runner:  npm run db:migrate   (add --seed to also load database/seed/*.sql — development only)
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { loadEnv } from '../../config/env';
import { sha256Hex } from '../../shared/crypto';

function findDatabaseDir(): string {
  if (process.env.DATABASE_DIR) return path.resolve(process.env.DATABASE_DIR);
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, 'database');
    if (fs.existsSync(path.join(candidate, 'migrations'))) return candidate;
    dir = path.dirname(dir);
  }
  throw new Error('Could not locate the database/ directory (set DATABASE_DIR)');
}

async function main(): Promise<void> {
  const env = loadEnv();
  const seed = process.argv.includes('--seed');
  if (seed && env.NODE_ENV === 'production') throw new Error('Refusing to load dev seed data in production');
  const dbDir = findDatabaseDir();
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 1 });
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(727001)');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
    const applied = new Map<string, string>(
      (await client.query('SELECT name, checksum FROM schema_migrations')).rows.map((r: { name: string; checksum: string }) => [r.name, r.checksum]),
    );
    const files = fs.readdirSync(path.join(dbDir, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
    let count = 0;
    for (const file of files) {
      const sql = fs.readFileSync(path.join(dbDir, 'migrations', file), 'utf8');
      const checksum = sha256Hex(sql);
      const previous = applied.get(file);
      if (previous) {
        if (previous !== checksum) throw new Error(`Migration ${file} was modified after being applied`);
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [file, checksum]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${(e as Error).message}`);
      }
      console.log(`applied ${file}`);
      count += 1;
    }
    console.log(count === 0 ? 'database is up to date' : `${count} migration(s) applied`);
    if (seed) {
      const seedDir = path.join(dbDir, 'seed');
      for (const file of fs.readdirSync(seedDir).filter((f) => f.endsWith('.sql')).sort()) {
        await client.query(fs.readFileSync(path.join(seedDir, file), 'utf8'));
        console.log(`seeded ${file}`);
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(727001)').catch(() => undefined);
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
