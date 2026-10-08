import assert from 'node:assert/strict';
import test from 'node:test';
import { getD1Database } from '../../src/server/d1-compat.ts';

test('libSQL adapter preserves prepared statement results and atomic D1 batches', async () => {
  const previousUrl = process.env.TURSO_DATABASE_URL;
  const previousToken = process.env.TURSO_AUTH_TOKEN;
  process.env.TURSO_DATABASE_URL = 'file::memory:';
  delete process.env.TURSO_AUTH_TOKEN;
  try {
    const db = getD1Database();
    assert.ok(db);
    await db.exec('CREATE TABLE adapter_test(id TEXT PRIMARY KEY, value INTEGER NOT NULL);');

    const insert = await db.prepare('INSERT INTO adapter_test(id,value) VALUES(?,?)').bind('one', 1).run();
    assert.equal(insert.meta.changes, 1);
    assert.deepEqual(await db.prepare('SELECT id,value FROM adapter_test WHERE id=?').bind('one').first(), { id: 'one', value: 1 });

    await assert.rejects(db.batch([
      db.prepare('UPDATE adapter_test SET value=value+1 WHERE id=?').bind('one'),
      db.prepare('INSERT INTO adapter_test(id,value) VALUES(?,?)').bind('one', 3),
    ]));
    assert.equal((await db.prepare('SELECT value FROM adapter_test WHERE id=?').bind('one').first<{value:number}>())?.value, 1);

    await db.batch([
      db.prepare('UPDATE adapter_test SET value=value+1 WHERE id=?').bind('one'),
      db.prepare('INSERT INTO adapter_test(id,value) VALUES(?,?)').bind('two', 2),
    ]);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM adapter_test').first<{n:number}>())?.n, 2);
  } finally {
    if (previousUrl === undefined) delete process.env.TURSO_DATABASE_URL;
    else process.env.TURSO_DATABASE_URL = previousUrl;
    if (previousToken === undefined) delete process.env.TURSO_AUTH_TOKEN;
    else process.env.TURSO_AUTH_TOKEN = previousToken;
  }
});
