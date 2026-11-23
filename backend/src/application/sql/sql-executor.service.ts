import pkg from 'node-sql-parser';
import type { Actor, JsonValue } from '../../domain/types';
import type { UnitOfWork } from '../../ports/repositories.port';
import { badRequest } from '../../shared/errors';
import type { SnapshotLoader } from '../commit/snapshot-loader';
import type { HistoryService } from '../history/history.service';
import type { MemberService } from '../member/member.service';
import type { RecordService } from '../record/record.service';

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

   const column =
      typeof expr.left.column === 'string'
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
      private records: RecordService,
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

      if (Array.isArray(ast)) {
         if (ast.length !== 1) {
            throw badRequest('UNSUPPORTED_SQL', 'Only one SQL statement is supported.');
         }
         ast = ast[0];
      }

      if (!ast) {
         throw badRequest('INVALID_SQL', 'Invalid SQL statement.');
      }

      if (ast.type === 'select') {
         return this.executeSelect(actor, repoId, branch, ast, startedAt);
      }

      if (ast.type === 'insert') {
         return this.executeInsert(actor, repoId, branch, ast, startedAt);
      }

      if (ast.type === 'update') {
         return this.executeUpdate(actor, repoId, branch, ast, startedAt);
      }

      if (ast.type === 'delete') {
         return this.executeDelete(actor, repoId, branch, ast, startedAt);
      }

      throw badRequest('UNSUPPORTED_SQL', 'This SQL statement is not supported.');
   }

   private getTable(ast: any): string {
      const table = ast.table?.[0]?.table;

      if (typeof table !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
         throw badRequest('INVALID_TABLE', 'Invalid collection name.');
      }

      return table;
   }

   private astValue(node: any): unknown {
      if (!node) {
         throw badRequest('INVALID_VALUE', 'Missing SQL value.');
      }

      switch (node.type) {
         case 'number':
            return Number(node.value);
         case 'single_quote_string':
         case 'double_quote_string':
         case 'string':
            return node.value;
         case 'bool':
            return node.value === true || node.value === 'true';
         case 'null':
            return null;
         default:
            throw badRequest('UNSUPPORTED_VALUE', 'Only literal SQL values are supported.');
      }
   }

   private getColumnName(node: any): string {
      const column =
         typeof node?.column === 'string'
            ? node.column
            : node?.column?.expr?.value
               ?? node?.value
               ?? node?.column?.value;

      if (
         typeof column !== 'string' ||
         !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)
      ) {
         throw badRequest('INVALID_COLUMN', 'Invalid SQL column name.');
      }

      return column;
   }

   private mutationResult(
      table: string,
      count: number,
      startedAt: number,
      operation: string,
   ): SqlQueryResult {
      return {
         status: 'success',
         rows: [],
         columns: [],
         rowCount: count,
         totalTableRows: count,
         executionTimeMs: Date.now() - startedAt,
         bufferHitsPct: 0,
         memoryMb: 0,
         targetTable: table,
         explainPlan: [`Staged ${operation} changes for collection "${table}"`],
         messages: [`${count} row(s) staged for ${operation}.`],
      };
   }

   private async executeSelect(
      actor: Actor,
      repoId: string,
      branch: string,
      ast: any,
      startedAt: number,
   ): Promise<SqlQueryResult> {
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
         throw badRequest('UNSUPPORTED_FROM', 'Query exactly one collection using FROM.');
      }

      const table = ast.from[0]?.table;

      if (typeof table !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
         throw badRequest('INVALID_TABLE', 'Invalid collection name.');
      }

      await this.members.authorize(actor, repoId, 'repo:read');

      const commitId = await this.history.resolveCommitId(repoId, branch);
      const snapshot = await this.snapshots.forCommit(repoId, commitId);
      const collection = snapshot[table] ?? {};

      // const allRows: Row[] = Object.entries(collection).map(([id, data]) => ({
      //    id,
      //    data: data as JsonValue,
      // }));

      // const filtered = allRows.filter((row) => matchesWhere(row, ast.where));
      // const totalTableRows = allRows.length;

      // let rows = filtered;
      const allRows: Row[] = Object.entries(collection).map(([id, data]) => ({
   id,
   data: data as JsonValue,
}));

// Merge pending working changes into the snapshot.
const pending = await this.records.listPending(actor, repoId, branch) as any[];

for (const change of pending ?? []) {
   if (change.collection !== table) continue;

   const existingIndex = allRows.findIndex(
      (row) => row.id === change.recordId,
   );

   if (change.op === 'delete') {
      if (existingIndex >= 0) {
         allRows.splice(existingIndex, 1);
      }
   } else if (change.op === 'put') {
      const updatedRow: Row = {
         id: change.recordId,
         data: change.data,
      };

      if (existingIndex >= 0) {
         allRows[existingIndex] = updatedRow;
      } else {
         allRows.push(updatedRow);
      }
   }
}

const filtered = allRows.filter((row) => matchesWhere(row, ast.where));
const totalTableRows = allRows.length;

let rows = filtered;

      if (ast.limit?.value?.length) {
         const limit = ast.limit.value[0]?.value;

         if (!Number.isInteger(limit) || limit < 0 || limit > 1000) {
            throw badRequest(
               'INVALID_LIMIT',
               'LIMIT must be an integer between 0 and 1000.',
            );
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

            const column =
               typeof item.expr.column === 'string'
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
            : ast.columns.map(
                 (item: any) =>
                    item.as ||
                    item.expr?.column?.expr?.value ||
                    item.expr?.column ||
                    'column',
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

   private async executeInsert(
      actor: Actor,
      repoId: string,
      branch: string,
      ast: any,
      startedAt: number,
   ): Promise<SqlQueryResult> {
      const table = this.getTable(ast);

      if (!ast.columns?.length || !ast.values?.values?.length) {
         throw badRequest(
            'UNSUPPORTED_INSERT',
            'INSERT must specify columns and VALUES.',
         );
      }

      await this.members.authorize(actor, repoId, 'record:write');

      const columns = ast.columns.map((column: any) => this.getColumnName(column));
      const valueRows = ast.values.values;

      let count = 0;

      for (const valueRow of valueRows) {
         if (valueRow.type !== 'expr_list' || valueRow.value.length !== columns.length) {
            throw badRequest(
               'INVALID_INSERT',
               'The number of values must match the number of columns.',
            );
         }

         const data: Record<string, unknown> = {};
         let recordId: string | undefined;

         for (let i = 0; i < columns.length; i++) {
            const column = columns[i];
            const value = this.astValue(valueRow.value[i]);

            if (column === 'id') {
               if (typeof value !== 'string' && typeof value !== 'number') {
                  throw badRequest('INVALID_ID', 'Record id must be a string or number.');
               }
               recordId = String(value);
            } else {
               data[column] = value;
            }
         }

         if (!recordId) {
            throw badRequest(
               'MISSING_ID',
               'INSERT must provide an id column for the record.',
            );
         }

         await this.records.stagePut(
            actor,
            repoId,
            branch,
            table,
            recordId,
            data as JsonValue,
         );

         count++;
      }

      return this.mutationResult(table, count, startedAt, 'INSERT');
   }

   private async executeUpdate(
      actor: Actor,
      repoId: string,
      branch: string,
      ast: any,
      startedAt: number,
   ): Promise<SqlQueryResult> {
      const table = this.getTable(ast);

      if (!Array.isArray(ast.set) || ast.set.length === 0) {
         throw badRequest('INVALID_UPDATE', 'UPDATE must contain SET assignments.');
      }

      await this.members.authorize(actor, repoId, 'record:write');

      const commitId = await this.history.resolveCommitId(repoId, branch);
      const snapshot = await this.snapshots.forCommit(repoId, commitId);
      const collection = snapshot[table] ?? {};

      const rows: Row[] = Object.entries(collection).map(([id, data]) => ({
         id,
         data: data as JsonValue,
      }));

      const pending = await this.records.listPending(actor, repoId, branch) as any[];

      for (const change of pending ?? []) {
         if (change.collection !== table) continue;

         const existingIndex = rows.findIndex((row) => row.id === change.recordId);

         if (change.op === 'delete') {
            if (existingIndex >= 0) rows.splice(existingIndex, 1);
         } else if (change.op === 'put') {
            const updatedRow = { id: change.recordId, data: change.data };

            if (existingIndex >= 0) {
               rows[existingIndex] = updatedRow;
            } else {
               rows.push(updatedRow);
            }
         }
      }

      const matchingRows = rows.filter((row) => matchesWhere(row, ast.where));

      for (const row of matchingRows) {
         const data = { ...(row.data as Record<string, unknown>) };

         for (const assignment of ast.set) {
            if (assignment.type !== 'column_ref') {
               throw badRequest('UNSUPPORTED_UPDATE', 'Unsupported UPDATE assignment.');
            }

            const column = this.getColumnName(assignment);
            const value = this.astValue(assignment.value);

            if (column === 'id') {
               throw badRequest('IMMUTABLE_ID', 'Record id cannot be changed.');
            }

            data[column] = value;
         }

         await this.records.stagePut(
            actor,
            repoId,
            branch,
            table,
            String(row.id),
            data as JsonValue,
         );
      }

      return this.mutationResult(table, matchingRows.length, startedAt, 'UPDATE');
   }

   private async executeDelete(
      actor: Actor,
      repoId: string,
      branch: string,
      ast: any,
      startedAt: number,
   ): Promise<SqlQueryResult> {
      const table = this.getTable(ast);

      await this.members.authorize(actor, repoId, 'record:write');

      const commitId = await this.history.resolveCommitId(repoId, branch);
      const snapshot = await this.snapshots.forCommit(repoId, commitId);
      const collection = snapshot[table] ?? {};

      const rows: Row[] = Object.entries(collection).map(([id, data]) => ({
         id,
         data: data as JsonValue,
      }));

      const pending = await this.records.listPending(actor, repoId, branch) as any[];

      for (const change of pending ?? []) {
         if (change.collection !== table) continue;

         const existingIndex = rows.findIndex((row) => row.id === change.recordId);

         if (change.op === 'delete') {
            if (existingIndex >= 0) rows.splice(existingIndex, 1);
         } else if (change.op === 'put') {
            const updatedRow = { id: change.recordId, data: change.data };

            if (existingIndex >= 0) {
               rows[existingIndex] = updatedRow;
            } else {
               rows.push(updatedRow);
            }
         }
      }

      const matchingRows = rows.filter((row) => matchesWhere(row, ast.where));

      for (const row of matchingRows) {
         await this.records.stageDelete(
            actor,
            repoId,
            branch,
            table,
            String(row.id),
         );
      }

      return this.mutationResult(table, matchingRows.length, startedAt, 'DELETE');
   }
}