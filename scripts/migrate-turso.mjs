import { createClient } from '@libsql/client';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const url = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
if (!url || !authToken) {
  console.error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before running the schema migration.');
  process.exit(1);
}

const client = createClient({ url, authToken });
await client.execute('CREATE TABLE IF NOT EXISTS tti_schema_migrations (name TEXT PRIMARY KEY NOT NULL, applied_at INTEGER NOT NULL)');
const directory = new URL('../drizzle/', import.meta.url);
const files = (await readdir(directory)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();

for (const name of files) {
  const found = await client.execute({ sql: 'SELECT name FROM tti_schema_migrations WHERE name=?', args: [name] });
  if (found.rows.length) continue;
  const contents = await readFile(join(directory.pathname, name), 'utf8');
  const statements = contents
    .split('--> statement-breakpoint')
    .map((statement) => statement.replace(/^\s*--[^\n]*(?:\n|$)/gm, ''))
    .map((statement) => statement.trim())
    .filter(Boolean)
    .map((sql) => ({ sql }));
  statements.push({ sql: 'INSERT INTO tti_schema_migrations(name,applied_at) VALUES(?,?)', args: [name, Date.now()] });
  await client.batch(statements, 'write');
  console.log(`Applied ${name}`);
}

await client.close();
console.log(`Schema ready (${files.length} migrations).`);
