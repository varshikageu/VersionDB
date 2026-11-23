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

  const records: any = {
    stagePut: async () => {},
    stageDelete: async () => {},
    listPending: async () => [],
  };

  return new SqlExecutorService(uow, members, history, snapshots, records);
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

  it('rejects access when authorization fails', async () => {
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
      {} as any,
    );

    await assert.rejects(
      () =>
        deniedService.execute(
          actor,
          'repo-1',
          'main',
          'SELECT * FROM students',
        ),
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

    const records: any = {
      stagePut: async () => {},
      stageDelete: async () => {},
      listPending: async () => [],
    };

    const service = new SqlExecutorService(
      {} as any,
      members,
      history,
      snapshots,
      records,
    );

    const mainResult = await service.execute(
      actor,
      'repo-1',
      'main',
      'SELECT * FROM users',
    );

    assert.equal(mainResult.rows[0].name, 'MainUser');

    const featureResult = await service.execute(
      actor,
      'repo-1',
      'feature',
      'SELECT * FROM users',
    );

    assert.equal(featureResult.rows[0].name, 'FeatureUser');
  });

  it('rejects unsupported SQL statements like DROP and ALTER', async () => {
    const service = setup();

    for (const sql of [
      'DROP TABLE students',
      'ALTER TABLE students ADD COLUMN grade VARCHAR(10)',
    ]) {
      await assert.rejects(
        () => service.execute(actor, 'repo-1', 'main', sql),
        (error: any) => error.code === 'UNSUPPORTED_SQL',
        `Should reject: ${sql}`,
      );
    }
  });

  it('stages an INSERT into a collection', async () => {
    const staged: any[] = [];

    const snapshot = {
      students: {},
    };

    const records: any = {
      stagePut: async (
        actor: Actor,
        repoId: string,
        branchName: string,
        collection: string,
        recordId: string,
        data: any,
      ) => {
        staged.push({ repoId, branchName, collection, recordId, data });
      },
      stageDelete: async () => {},
      listPending: async () => [],
    };

    const service = new SqlExecutorService(
      {} as any,
      { authorize: async () => ({ role: 'maintainer' }) } as any,
      { resolveCommitId: async () => 'commit-1' } as any,
      { forCommit: async () => snapshot } as any,
      records,
    );

    const result = await service.execute(
      actor,
      'repo-1',
      'main',
      "INSERT INTO students (id, name, age) VALUES ('student-4', 'Rahul', 20)",
    );

    assert.equal(result.status, 'success');
    assert.equal(staged.length, 1);

    assert.deepEqual(staged[0], {
      repoId: 'repo-1',
      branchName: 'main',
      collection: 'students',
      recordId: 'student-4',
      data: { name: 'Rahul', age: 20 },
    });
  });

  it('stages an UPDATE for matching records', async () => {
    const staged: any[] = [];

    const snapshot = {
      students: {
        'student-1': { name: 'Aman', age: 21 },
        'student-2': { name: 'Riya', age: 17 },
        'student-3': { name: 'Kartik', age: 23 },
      },
    };

    const records: any = {
      stagePut: async (
        actor: Actor,
        repoId: string,
        branchName: string,
        collection: string,
        recordId: string,
        data: any,
      ) => {
        staged.push({ repoId, branchName, collection, recordId, data });
      },
      stageDelete: async () => {},
      listPending: async () => [],
    };

    const service = new SqlExecutorService(
      {} as any,
      { authorize: async () => ({ role: 'maintainer' }) } as any,
      { resolveCommitId: async () => 'commit-1' } as any,
      { forCommit: async () => snapshot } as any,
      records,
    );

    const result = await service.execute(
      actor,
      'repo-1',
      'main',
      'UPDATE students SET age = 22 WHERE age = 21',
    );

    assert.equal(result.status, 'success');
    assert.equal(staged.length, 1);

    assert.deepEqual(staged[0], {
      repoId: 'repo-1',
      branchName: 'main',
      collection: 'students',
      recordId: 'student-1',
      data: { name: 'Aman', age: 22 },
    });
  });

  it('stages a DELETE for matching records', async () => {
    const deleted: any[] = [];

    const snapshot = {
      students: {
        'student-1': { name: 'Aman', age: 21 },
        'student-2': { name: 'Riya', age: 17 },
        'student-3': { name: 'Kartik', age: 23 },
      },
    };

    const records: any = {
      stagePut: async () => {},
      stageDelete: async (
        actor: Actor,
        repoId: string,
        branchName: string,
        collection: string,
        recordId: string,
      ) => {
        deleted.push({ repoId, branchName, collection, recordId });
      },
      listPending: async () => [],
    };

    const service = new SqlExecutorService(
      {} as any,
      { authorize: async () => ({ role: 'maintainer' }) } as any,
      { resolveCommitId: async () => 'commit-1' } as any,
      { forCommit: async () => snapshot } as any,
      records,
    );

    const result = await service.execute(
      actor,
      'repo-1',
      'main',
      'DELETE FROM students WHERE age = 17',
    );

    assert.equal(result.status, 'success');
    assert.equal(deleted.length, 1);

    assert.deepEqual(deleted[0], {
      repoId: 'repo-1',
      branchName: 'main',
      collection: 'students',
      recordId: 'student-2',
    });
  });

  it('rejects a DELETE by a viewer even when no records match', async () => {
    const authorizationCalls: string[] = [];

    const members: any = {
      authorize: async (_actor: Actor, _repoId: string, action: string) => {
        authorizationCalls.push(action);

        if (action === 'record:write') {
          const error: any = new Error('Forbidden');
          error.code = 'FORBIDDEN';
          error.status = 403;
          throw error;
        }

        return { role: 'viewer' };
      },
    };

    const records: any = {
      stagePut: async () => {},
      stageDelete: async () => {},
      listPending: async () => [],
    };

    const service = new SqlExecutorService(
      {} as any,
      members,
      { resolveCommitId: async () => 'commit-1' } as any,
      {
        forCommit: async () => ({
          students: {
            'student-1': { name: 'Aman', age: 21 },
          },
        }),
      } as any,
      records,
    );

    await assert.rejects(
      () =>
        service.execute(
          actor,
          'repo-1',
          'main',
          'DELETE FROM students WHERE age = 99',
        ),
      (error: any) => error.code === 'FORBIDDEN',
    );

    assert.ok(authorizationCalls.includes('record:write'));
  });
  it('enforces viewer permissions for SELECT, INSERT, UPDATE and DELETE', async () => {
  const authorizationCalls: string[] = [];

  const members: any = {
    authorize: async (_actor: Actor, _repoId: string, action: string) => {
      authorizationCalls.push(action);

      if (action === 'repo:read') {
        return { role: 'viewer' };
      }

      const error: any = new Error('Forbidden');
      error.code = 'FORBIDDEN';
      error.status = 403;
      throw error;
    },
  };

  const records: any = {
    stagePut: async () => {},
    stageDelete: async () => {},
    listPending: async () => [],
  };

  const service = new SqlExecutorService(
    {} as any,
    members,
    { resolveCommitId: async () => 'commit-1' } as any,
    {
      forCommit: async () => ({
        students: {
          'student-1': { name: 'Aman', age: 21 },
        },
      }),
    } as any,
    records,
  );

  // Viewer should be able to read.
  const selectResult = await service.execute(
    actor,
    'repo-1',
    'main',
    'SELECT * FROM students',
  );

  assert.equal(selectResult.rowCount, 1);

  // Viewer should not be able to insert.
  await assert.rejects(
    () =>
      service.execute(
        actor,
        'repo-1',
        'main',
        "INSERT INTO students (id, name, age) VALUES ('student-2', 'Riya', 17)",
      ),
    (error: any) => error.code === 'FORBIDDEN',
  );

  // Viewer should not be able to update.
  await assert.rejects(
    () =>
      service.execute(
        actor,
        'repo-1',
        'main',
        'UPDATE students SET age = 22 WHERE age = 21',
      ),
    (error: any) => error.code === 'FORBIDDEN',
  );

  // Viewer should not be able to delete.
  await assert.rejects(
    () =>
      service.execute(
        actor,
        'repo-1',
        'main',
        'DELETE FROM students WHERE age = 21',
      ),
    (error: any) => error.code === 'FORBIDDEN',
  );

  assert.ok(authorizationCalls.includes('repo:read'));
  assert.equal(
    authorizationCalls.filter((action) => action === 'record:write').length,
    3,
  );
});
});