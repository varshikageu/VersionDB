import { Pool, type QueryResult, type QueryResultRow } from 'pg';
import type { Env } from '../../config/env';

export interface Queryable {
  query<R extends QueryResultRow = any>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
}

export function createPool(env: Env): Pool {
  return new Pool({
    connectionString: env.DATABASE_URL,
    max: env.DB_POOL_MAX,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  });
}

/** JSON values go to jsonb as text so that a JSON `null` is not confused with SQL NULL. */
export const toJsonb = (v: unknown): string => JSON.stringify(v);
