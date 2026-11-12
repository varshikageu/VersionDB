// Recovery script: records recovery in audit log using project's canonical computeAuditHash,
// and deletes the invalid retroactive edge under a safe transaction.
import { Pool } from 'pg';
import { loadEnv } from '../../config/env';
import { computeAuditHash } from '../../shared/crypto';

export async function executeRecovery(): Promise<void> {
  const env = loadEnv();
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 1 });
  const client = await pool.connect();

  try {
    const repoId = '10000000-0000-4000-8000-000000000001';
    const aliceCommitId = 'ce675614-83a1-45f5-83ae-8911d46be9ab';
    const mainInitCommitId = 'a934a46c-5d8a-407e-bb45-aae1ed8887cb';
    const mergeCommitId = '3e57868c-2d18-43b9-8ca6-c694206feebc';
    const actorId = '00000000-0000-4000-8000-000000000001';

    await client.query('BEGIN');

    // 1. Check if the invalid edge is present
    const checkEdge = await client.query(
      'SELECT 1 FROM commit_parents WHERE commit_id = $1 AND parent_id = $2 AND ord = 0',
      [aliceCommitId, mainInitCommitId]
    );

    if (checkEdge.rows.length === 0) {
      console.log('Recovery: Invalid edge not found or already repaired. Skipping.');
      await client.query('ROLLBACK');
      return;
    }

    // 2. Preconditions
    const mergeParents = await client.query(
      'SELECT parent_id, ord FROM commit_parents WHERE commit_id = $1 ORDER BY ord ASC',
      [mergeCommitId]
    );
    if (mergeParents.rows.length !== 2) {
      throw new Error(`Precondition failed: merge commit ${mergeCommitId} does not have exactly 2 parents`);
    }

    const aliceCommit = await client.query(
      'SELECT snapshot_hash FROM commits WHERE id = $1 AND repo_id = $2',
      [aliceCommitId, repoId]
    );
    if (!aliceCommit.rows[0] || aliceCommit.rows[0].snapshot_hash !== '74ddfc3862b430e20721ea9ef6ce315620be82d471f4ef3236e68598b3fdbeed') {
      throw new Error('Precondition failed: Alice commit snapshot hash mismatch');
    }

    // 3. Remove invalid edge using recovery_mode
    await client.query("SELECT set_config('versiondb.recovery_mode', 'on', true)");
    await client.query(
      'DELETE FROM commit_parents WHERE commit_id = $1 AND parent_id = $2 AND ord = 0',
      [aliceCommitId, mainInitCommitId]
    );
    await client.query("SELECT set_config('versiondb.recovery_mode', '', true)");

    // 4. Record in audit_logs with hash chaining
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`audit:${repoId}`]);
    const prev = await client.query(
      'SELECT hash FROM audit_logs WHERE repo_id IS NOT DISTINCT FROM $1::uuid ORDER BY id DESC LIMIT 1',
      [repoId]
    );
    const prevHash: string = prev.rows[0]?.hash ?? '0'.repeat(64);
    const createdAt = new Date();
    const metadata = {
      repairedCommitId: aliceCommitId,
      removedParentId: mainInitCommitId,
      ord: 0,
      reason: 'Removed retroactive parent link to restore true immutable orphan root ancestry',
    };
    const action = 'recovery.commit_parents_repaired';
    const entityType = 'commit';
    const entityId = aliceCommitId;

    const hash = computeAuditHash({
      prevHash,
      repoId,
      actorId,
      action,
      entityType,
      entityId,
      metadata,
      createdAt,
    });

    await client.query(
      `INSERT INTO audit_logs (repo_id, actor_id, action, entity_type, entity_id, metadata, prev_hash, hash, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)`,
      [repoId, actorId, action, entityType, entityId, JSON.stringify(metadata), prevHash, hash, createdAt]
    );

    await client.query('COMMIT');
    console.log('Recovery: Successfully repaired commit ancestry for Alice root commit and logged to audit trail.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('recovery.ts')) {
  executeRecovery().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

