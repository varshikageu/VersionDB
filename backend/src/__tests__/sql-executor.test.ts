
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SqlExecutorService } from '../application/sql/sql-executor.service';
import type { Actor } from '../domain/types';

const actor: Actor = {
  userId: 'user-1',
  globalRole: 'user',
  ip: '127.0.0.1',
};

function setup() {
  const snapshot = {
    students: {
      'student-1': { name: 'Aman', age: 21 },
      'student-2': { name: 'Riya', age: 17 },
      'student-3': { name: 'Kartik', age: 23 },
    },
  };

  const uow: any = {};
  const members: any = {
    authorize: async () => ({ role: 'maintainer' }),
  };
  const history: any = {
    resolveCommitId: async () => 'commit-1',
  };
  const snapshots: any = {
    forCommit: async () => snapshot,
  };

  return new SqlExecutorService(uow, members, history, snapshots);
}

describe('SqlExecutorService', () => {
  it('executes SELECT * from a collection', async () => {
    const service = setup();

    const result = await service.execute(
      actor,
      'repo-1',
      'main',
      'SELECT * FROM students',
    );

    assert.equal(result.status, 'success');
    assert.equal(result.rowCount, 3);
    assert.equal(result.targetTable, 'students');
    assert.equal(result.rows[0].name, 'Aman');
  });

  it('filters rows with a WHERE comparison', async () => {
    const service = setup();

    const result = await service.execute(
      actor,
      'repo-1',
      'main',
      'SELECT name, age FROM students WHERE age > 18',
    );

    assert.equal(result.rowCount, 2);
    assert.deepEqual(
      result.rows.map((row) => row.name),
      ['Aman', 'Kartik'],
    );
  });

  it('limits the returned rows', async () => {
    const service = setup();

    const result = await service.execute(
      actor,
      'repo-1',
      'main',
      'SELECT * FROM students LIMIT 1',
    );

    assert.equal(result.rowCount, 1);
    assert.equal(result.totalTableRows, 3);
  });

  it('rejects non-SELECT statements', async () => {
    const service = setup();

    await assert.rejects(
      () => service.execute(actor, 'repo-1', 'main', 'DELETE FROM students'),
      (error: any) => error.code === 'UNSUPPORTED_SQL',
    );
  });

  it('rejects access when authorization fails', async () => {
    const service = setup();
    const deniedMembers: any = {
      authorize: async () => {
        const error: any = new Error('Forbidden');
        error.status = 403;
        error.code = 'FORBIDDEN';
        throw error;
      },
    };

    const deniedService = new SqlExecutorService(
      {} as any,
      deniedMembers,
      { resolveCommitId: async () => 'commit-1' } as any,
      { forCommit: async () => ({}) } as any,
    );

    await assert.rejects(
      () => deniedService.execute(actor, 'repo-1', 'main', 'SELECT * FROM students'),
      (error: any) => error.code === 'FORBIDDEN',
    );
  });
});
