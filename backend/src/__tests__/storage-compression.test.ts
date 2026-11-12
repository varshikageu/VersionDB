import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { gzipSync } from 'node:zlib';
import { LocalStorageAdapter } from '../adapters/storage/local-storage.adapter';
import type { SnapshotData } from '../domain/types';

describe('Task B: Snapshot Compression & Backward Compatibility', () => {
  it('writes snapshots compressed with .json.gz and reads them back transparently', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vdb-compress-test-'));
    try {
      const storage = new LocalStorageAdapter(tmpDir);
      const repoId = 'repo-compression-1';
      await storage.initRepository(repoId);

      // Create a snapshot with multiple collections and records
      const sampleData: SnapshotData = {
        users: {
          'u-1': { name: 'Alice', role: 'admin', email: 'alice@example.com' },
          'u-2': { name: 'Bob', role: 'developer', email: 'bob@example.com' },
        },
        orders: {
          'o-100': { amount: 250, status: 'completed', items: ['item-a', 'item-b'] },
        },
      };

      const info = await storage.putSnapshot(repoId, sampleData);
      assert.ok(info.hash);
      assert.equal(info.recordCount, 3);

      // Check on disk that .json.gz file was written
      const objDir = path.join(tmpDir, repoId, 'objects', info.hash.slice(0, 2));
      const gzFile = path.join(objDir, `${info.hash}.json.gz`);
      const gzStat = await fs.stat(gzFile);
      assert.ok(gzStat.isFile());
      assert.ok(gzStat.size > 0);

      // Read back via getSnapshot
      const loaded = await storage.getSnapshot(repoId, info.hash);
      assert.deepEqual(loaded, sampleData);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('transparently reads legacy uncompressed .json snapshot files', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vdb-legacy-test-'));
    try {
      const storage = new LocalStorageAdapter(tmpDir);
      const repoId = 'repo-legacy-1';
      await storage.initRepository(repoId);

      const sampleData: SnapshotData = {
        customers: {
          'c-1': { company: 'Acme Corp', tier: 'enterprise' },
        },
      };

      // Manually write an uncompressed legacy .json file
      const { stableStringify } = await import('../shared/json');
      const { sha256Hex } = await import('../shared/crypto');
      const body = stableStringify(sampleData);
      const hash = sha256Hex(body);

      const objDir = path.join(tmpDir, repoId, 'objects', hash.slice(0, 2));
      await fs.mkdir(objDir, { recursive: true });
      const legacyFile = path.join(objDir, `${hash}.json`);
      await fs.writeFile(legacyFile, body, 'utf8');

      // Verify that getSnapshot reads it without error
      const loaded = await storage.getSnapshot(repoId, hash);
      assert.deepEqual(loaded, sampleData);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('demonstrates compression ratio on larger structured snapshots', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vdb-ratio-test-'));
    try {
      const storage = new LocalStorageAdapter(tmpDir);
      const repoId = 'repo-ratio-1';
      await storage.initRepository(repoId);

      const largeSnapshot: SnapshotData = { records: {} };
      for (let i = 0; i < 200; i++) {
        largeSnapshot.records[`rec-${i}`] = {
          id: `rec-${i}`,
          title: `Automated test benchmark record title number ${i}`,
          payload: {
            metrics: [i * 1.5, i * 2.5, i * 3.5],
            description: 'Structured database snapshot content for compression verification in Phase 3',
            active: i % 2 === 0,
          },
        };
      }

      const info = await storage.putSnapshot(repoId, largeSnapshot);
      const objDir = path.join(tmpDir, repoId, 'objects', info.hash.slice(0, 2));
      const gzFile = path.join(objDir, `${info.hash}.json.gz`);
      const gzStat = await fs.stat(gzFile);

      // The uncompressed size is stored in info.sizeBytes
      assert.ok(gzStat.size < info.sizeBytes, `Compressed size (${gzStat.size}) should be smaller than raw (${info.sizeBytes})`);
      const ratio = ((1 - gzStat.size / info.sizeBytes) * 100).toFixed(1);
      assert.ok(parseFloat(ratio) > 50, `Expected at least 50% space savings, achieved ${ratio}%`);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('throws a controlled descriptive error when a compressed file is corrupted', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vdb-corrupt-test-'));
    try {
      const storage = new LocalStorageAdapter(tmpDir);
      const repoId = 'repo-corrupt-1';
      await storage.initRepository(repoId);

      const dummyHash = 'a'.repeat(64);
      const objDir = path.join(tmpDir, repoId, 'objects', dummyHash.slice(0, 2));
      await fs.mkdir(objDir, { recursive: true });
      const gzFile = path.join(objDir, `${dummyHash}.json.gz`);
      // Write invalid/corrupt gzip bytes
      await fs.writeFile(gzFile, Buffer.from([0x1f, 0x8b, 0x00, 0x99, 0xff, 0xee]));

      await assert.rejects(
        async () => storage.getSnapshot(repoId, dummyHash),
        (err: Error) => {
          return err.message.includes('Corrupted compressed snapshot object');
        }
      );
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
