
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

  it('queries the snapshot of the requested branch and isolates between branches', async () => {
    const mainSnapshot = {
      users: { 'u-1': { name: 'MainUser' } },
    };
    const featureSnapshot = {
      users: { 'u-2': { name: 'FeatureUser' } },
    };

    const history: any = {
      resolveCommitId: async (_repoId: string, branch: string) => {
        return branch === 'feature' ? 'commit-feature' : 'commit-main';
      },
    };

    const snapshots: any = {
      forCommit: async (_repoId: string, commitId: string) => {
        return commitId === 'commit-feature' ? featureSnapshot : mainSnapshot;
      },
    };

    const members: any = {
      authorize: async () => ({ role: 'viewer' }),
    };

    const service = new SqlExecutorService({} as any, members, history, snapshots);

    const mainResult = await service.execute(actor, 'repo-1', 'main', 'SELECT * FROM users');
    assert.equal(mainResult.rows[0].name, 'MainUser');

    const featureResult = await service.execute(actor, 'repo-1', 'feature', 'SELECT * FROM users');
    assert.equal(featureResult.rows[0].name, 'FeatureUser');
  });

  it('rejects unsupported SQL statements like DROP, INSERT, UPDATE, ALTER', async () => {
    const service = setup();

    for (const sql of [
      'INSERT INTO students (id, name) VALUES ("s-4", "Test")',
      'UPDATE students SET age = 22 WHERE id = "student-1"',
      'DROP TABLE students',
      'ALTER TABLE students ADD COLUMN grade VARCHAR(10)',
    ]) {
      await assert.rejects(
        () => service.execute(actor, 'repo-1', 'main', sql),
        (error: any) => error.code === 'UNSUPPORTED_SQL',
        `Should reject: ${sql}`
      );
    }
  });
});

