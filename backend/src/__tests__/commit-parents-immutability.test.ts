import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { Pool } from 'pg';
import { loadEnv } from '../config/env';

describe('Database Commit Parents Immutability Integration Tests', () => {
  let pool: Pool;
  const repoId = '10000000-0000-4000-8000-000000000001';
  const authorId = '00000000-0000-4000-8000-000000000002';
  const snapshotHash = '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a';

  before(async () => {
    const env = loadEnv();
    pool = new Pool({ connectionString: env.DATABASE_URL, max: 2 });
  });

  after(async () => {
    await pool.end();
  });

  it('allows creating a normal single-parent commit via create_commit_with_parents', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Create root commit
      const rootRes = await client.query(
        'SELECT create_commit_with_parents($1, $2, $3, $4, $5, $6) AS id',
        [repoId, snapshotHash, authorId, 'Root commit', 'initial', []]
      );
      const rootId = rootRes.rows[0].id;

      // Create child commit with root as parent
      const childRes = await client.query(
        'SELECT create_commit_with_parents($1, $2, $3, $4, $5, $6) AS id',
        [repoId, snapshotHash, authorId, 'Child commit', 'normal', [rootId]]
      );
      const childId = childRes.rows[0].id;

      const parents = await client.query(
        'SELECT parent_id, ord FROM commit_parents WHERE commit_id = $1 ORDER BY ord',
        [childId]
      );
      assert.equal(parents.rows.length, 1);
      assert.equal(parents.rows[0].parent_id, rootId);
      assert.equal(parents.rows[0].ord, 0);

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('allows creating a two-parent merge commit via create_commit_with_parents', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const p1Res = await client.query(
        'SELECT create_commit_with_parents($1, $2, $3, $4, $5, $6) AS id',
        [repoId, snapshotHash, authorId, 'Parent 1', 'normal', []]
      );
      const p2Res = await client.query(
        'SELECT create_commit_with_parents($1, $2, $3, $4, $5, $6) AS id',
        [repoId, snapshotHash, authorId, 'Parent 2', 'normal', []]
      );
      const p1 = p1Res.rows[0].id;
      const p2 = p2Res.rows[0].id;

      const mergeRes = await client.query(
        'SELECT create_commit_with_parents($1, $2, $3, $4, $5, $6) AS id',
        [repoId, snapshotHash, authorId, 'Merge commit', 'merge', [p1, p2]]
      );
      const mergeId = mergeRes.rows[0].id;

      const parents = await client.query(
        'SELECT parent_id, ord FROM commit_parents WHERE commit_id = $1 ORDER BY ord',
        [mergeId]
      );
      assert.equal(parents.rows.length, 2);
      assert.equal(parents.rows[0].parent_id, p1);
      assert.equal(parents.rows[0].ord, 0);
      assert.equal(parents.rows[1].parent_id, p2);
      assert.equal(parents.rows[1].ord, 1);

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('rejects direct retroactive INSERT into commit_parents', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const c1Res = await client.query(
        'SELECT create_commit_with_parents($1, $2, $3, $4, $5, $6) AS id',
        [repoId, snapshotHash, authorId, 'Commit 1', 'initial', []]
      );
      const c2Res = await client.query(
        'SELECT create_commit_with_parents($1, $2, $3, $4, $5, $6) AS id',
        [repoId, snapshotHash, authorId, 'Commit 2', 'initial', []]
      );
      const c1 = c1Res.rows[0].id;
      const c2 = c2Res.rows[0].id;

      // Attempting direct retroactive INSERT must fail
      await assert.rejects(
        async () => {
          await client.query(
            'INSERT INTO commit_parents (commit_id, parent_id, ord) VALUES ($1, $2, $3)',
            [c1, c2, 0]
          );
        },
        (err: any) => err.code === '42501' && err.message.includes('cannot retroactively add parents')
      );

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('rejects direct UPDATE on commit_parents', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const pRes = await client.query(
        'SELECT create_commit_with_parents($1, $2, $3, $4, $5, $6) AS id',
        [repoId, snapshotHash, authorId, 'P', 'initial', []]
      );
      const cRes = await client.query(
        'SELECT create_commit_with_parents($1, $2, $3, $4, $5, $6) AS id',
        [repoId, snapshotHash, authorId, 'C', 'normal', [pRes.rows[0].id]]
      );
      const childId = cRes.rows[0].id;

      // Attempting UPDATE must fail with 42501
      await assert.rejects(
        async () => {
          await client.query(
            'UPDATE commit_parents SET ord = 1 WHERE commit_id = $1',
            [childId]
          );
        },
        (err: any) => err.code === '42501' && err.message.includes('immutable')
      );

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('rejects direct DELETE on commit_parents outside recovery mode', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const pRes = await client.query(
        'SELECT create_commit_with_parents($1, $2, $3, $4, $5, $6) AS id',
        [repoId, snapshotHash, authorId, 'P', 'initial', []]
      );
      const cRes = await client.query(
        'SELECT create_commit_with_parents($1, $2, $3, $4, $5, $6) AS id',
        [repoId, snapshotHash, authorId, 'C', 'normal', [pRes.rows[0].id]]
      );
      const childId = cRes.rows[0].id;

      // Attempting direct DELETE must fail with 42501
      await assert.rejects(
        async () => {
          await client.query(
            'DELETE FROM commit_parents WHERE commit_id = $1',
            [childId]
          );
        },
        (err: any) => err.code === '42501' && err.message.includes('cannot be deleted directly')
      );

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });
});
