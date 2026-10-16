import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

const migrationsDir = fileURLToPath(new URL('../migrations/', import.meta.url));

async function main() {
  const names = (await readdir(migrationsDir))
    .filter((name) => /^\d+_[a-zA-Z0-9_-]+\.sql$/.test(name))
    .sort();

  if (names.length === 0) {
    throw new Error('No SQL migration files were found.');
  }

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const name of names) {
      await client.query('BEGIN');
      try {
        // Prevent two deployment processes from applying the same migration at once.
        await client.query('SELECT pg_advisory_xact_lock(824631)');
        const { rowCount } = await client.query(
          'SELECT version FROM schema_migrations WHERE version = $1', [name],
        );
        if (rowCount > 0) {
          await client.query('COMMIT');
          console.log(`Already applied: ${name}`);
          continue;
        }

        const sql = await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [name]);
        await client.query('COMMIT');
        console.log(`Applied migration: ${name}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration failed: ${name}`, { cause: error });
      }
    }
  } finally {
    client.release();
  }
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
