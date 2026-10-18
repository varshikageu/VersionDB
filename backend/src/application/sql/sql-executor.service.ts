
import pkg from 'node-sql-parser';
import type { Actor, JsonValue } from '../../domain/types';
import type { UnitOfWork } from '../../ports/repositories.port';
import { badRequest } from '../../shared/errors';
import type { SnapshotLoader } from '../commit/snapshot-loader';
import type { HistoryService } from '../history/history.service';
import type { MemberService } from '../member/member.service';

const parser = new pkg.Parser();

type Row = Record<string, unknown>;

export interface SqlQueryResult {
  status: 'success';
  rows: Row[];
  columns: { name: string; type: string }[];
  rowCount: number;
  totalTableRows: number;
  executionTimeMs: number;
  bufferHitsPct: number;
  memoryMb: number;
  targetTable: string;
  explainPlan: string[];
  messages: string[];
}

function readColumn(row: Row, name: string): unknown {
  if (name === 'id') return row.id;

  const data = row.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return (data as Record<string, unknown>)[name];
  }

  return undefined;
}

function matchesWhere(row: Row, expr: any): boolean {
  if (!expr) return true;

  if (expr.type !== 'binary_expr' || expr.left?.type !== 'column_ref') {
    throw badRequest(
      'UNSUPPORTED_WHERE',
      'Only simple column comparisons in WHERE are supported.',
    );
  }

  const column = typeof expr.left.column === 'string'
    ? expr.left.column
    : expr.left.column?.expr?.value;

  if (typeof column !== 'string') {
    throw badRequest('INVALID_COLUMN', 'Invalid column in WHERE.');
  }

  const actual = readColumn(row, column);
  const expected = expr.right?.value;

  switch (expr.operator) {
    case '=':
    case '==':
      return actual === expected;
    case '!=':
    case '<>':
      return actual !== expected;
    case '>':
      return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
    case '>=':
      return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
    case '<':
      return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
    case '<=':
      return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
    default:
      throw badRequest(
        'UNSUPPORTED_WHERE_OPERATOR',
        `WHERE operator ${String(expr.operator)} is not supported.`,
      );
  }
}

export class SqlExecutorService {
  constructor(
    private uow: UnitOfWork,
    private members: MemberService,
    private history: HistoryService,
    private snapshots: SnapshotLoader,
  ) {}

  async execute(
    actor: Actor,
    repoId: string,
    branch: string,
    sql: string,
  ): Promise<SqlQueryResult> {
    const startedAt = Date.now();
    const statement = sql.trim();

    if (!statement) {
      throw badRequest('EMPTY_SQL', 'SQL statement cannot be empty.');
    }

    let ast: any;

    try {
      ast = parser.astify(statement, { database: 'Postgresql' });
    } catch {
      throw badRequest('INVALID_SQL', 'The SQL statement has invalid syntax.');
    }

    if (Array.isArray(ast) || ast.type !== 'select') {
      throw badRequest(
        'UNSUPPORTED_SQL',
        'Only one SELECT statement is supported.',
      );
    }

    if (
      ast.with ||
      ast.groupby ||
      ast.having ||
      ast.window ||
      ast.into?.position ||
      ast.distinct?.type ||
      ast.orderby
    ) {
      throw badRequest(
        'UNSUPPORTED_SQL_FEATURE',
        'This query uses a SELECT feature that is not supported yet.',
      );
    }

    if (!Array.isArray(ast.from) || ast.from.length !== 1) {
      throw badRequest(
        'UNSUPPORTED_FROM',
        'Query exactly one collection using FROM.',
      );
    }

    const table = ast.from[0]?.table;
    if (typeof table !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
      throw badRequest('INVALID_TABLE', 'Invalid collection name.');
    }

    await this.members.authorize(actor, repoId, 'repo:read');

    const commitId = await this.history.resolveCommitId(repoId, branch);
    const snapshot = await this.snapshots.forCommit(repoId, commitId);
    const collection = snapshot[table] ?? {};

    const allRows: Row[] = Object.entries(collection).map(([id, data]) => ({
      id,
      data: data as JsonValue,
    }));

    const filtered = allRows.filter((row) => matchesWhere(row, ast.where));
    const totalTableRows = allRows.length;

    let rows = filtered;
    if (ast.limit?.value?.length) {
      const limit = ast.limit.value[0]?.value;
      if (!Number.isInteger(limit) || limit < 0 || limit > 1000) {
        throw badRequest('INVALID_LIMIT', 'LIMIT must be an integer between 0 and 1000.');
      }
      rows = rows.slice(0, limit);
    }

    const selectAll =
      ast.columns.length === 1 && ast.columns[0]?.expr?.column === '*';

    const outputRows = rows.map((row) => {
      const data = row.data as Record<string, unknown>;
      if (selectAll) return { ...data, id: row.id };

      const result: Row = {};
      for (const item of ast.columns) {
        if (item.expr?.type !== 'column_ref') {
          throw badRequest(
            'UNSUPPORTED_SELECT',
            'Only simple column names and SELECT * are supported.',
          );
        }

        const column = typeof item.expr.column === 'string'
          ? item.expr.column
          : item.expr.column?.expr?.value;

        if (typeof column !== 'string') {
          throw badRequest('INVALID_COLUMN', 'Invalid SELECT column.');
        }

        result[item.as || column] = readColumn(row, column);
      }
      return result;
    });

    const columnNames: string[] = outputRows.length
      ? Object.keys(outputRows[0])
      : selectAll
        ? ['id']
        : ast.columns.map((item: any) =>
            item.as || item.expr?.column?.expr?.value || item.expr?.column || 'column',
          );

    return {
      status: 'success',
      rows: outputRows,
      columns: columnNames.map((name) => ({ name, type: 'unknown' })),
      rowCount: outputRows.length,
      totalTableRows,
      executionTimeMs: Date.now() - startedAt,
      bufferHitsPct: 0,
      memoryMb: 0,
      targetTable: table,
      explainPlan: [`Read collection "${table}" from branch "${branch}" snapshot`],
      messages: [`Returned ${outputRows.length} row(s).`],
    };
  }
}
