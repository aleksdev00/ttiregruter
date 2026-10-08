import { createClient, type Client, type InArgs, type InStatement, type ResultSet } from '@libsql/client';

type BoundValue = string | number | bigint | null | ArrayBuffer | ArrayBufferView;
type Statement = { sql: string; args: BoundValue[] };

class PreparedStatement {
  private readonly client: Client;
  private readonly statement: Statement;

  constructor(client: Client, statement: Statement) {
    this.client = client;
    this.statement = statement;
  }

  bind(...args: BoundValue[]) {
    return new PreparedStatement(this.client, { ...this.statement, args });
  }

  async all<T = Record<string, unknown>>() {
    const result = await this.client.execute({ sql: this.statement.sql, args: this.statement.args as InArgs });
    return toD1Result<T>(result);
  }

  async first<T = Record<string, unknown>>(columnName?: string): Promise<T | null> {
    const result = await this.client.execute({ sql: this.statement.sql, args: this.statement.args as InArgs });
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return (columnName ? row[columnName] ?? null : row) as T | null;
  }

  async run() {
    const result = await this.client.execute({ sql: this.statement.sql, args: this.statement.args as InArgs });
    return toD1Result(result);
  }

  get statementForBatch(): InStatement {
    return { sql: this.statement.sql, args: this.statement.args as InArgs };
  }
}

function toD1Result<T>(result: ResultSet) {
  return {
    success: true as const,
    results: result.rows as unknown as T[],
    meta: {
      changes: Number(result.rowsAffected),
      last_row_id: result.lastInsertRowid == null ? 0 : Number(result.lastInsertRowid),
      duration: 0,
      served_by: 'turso-libsql',
      internal_stats: null,
    },
  };
}

let client: Client | undefined;

export function getLibsqlClient() {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  if (!url) throw new Error('TURSO_DATABASE_URL is not configured. Connect a Turso database in Vercel.');
  client ??= createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  return client;
}

export function getD1Database(): D1Database | undefined {
  if (!process.env.TURSO_DATABASE_URL?.trim()) return undefined;
  const libsql = getLibsqlClient();
  return {
    prepare(sql: string) {
      return new PreparedStatement(libsql, { sql, args: [] }) as unknown as D1PreparedStatement;
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]) {
      const input = statements.map((statement) => {
        if (!(statement instanceof PreparedStatement)) {
          throw new TypeError('All statements in a database batch must be prepared by this adapter.');
        }
        return statement.statementForBatch;
      });
      return (await libsql.batch(input, 'write')).map((result) => toD1Result<T>(result));
    },
    exec(sql: string) {
      return libsql.executeMultiple(sql).then(() => ({ count: 0, duration: 0 }));
    },
  } as unknown as D1Database;
}

