import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import type { SnapshotData } from '../../domain/types';
import { countRecords } from '../../domain/snapshot';
import { sha256Hex } from '../../shared/crypto';
import { stableStringify } from '../../shared/json';
import { StorageConflictError, type SnapshotInfo, type StoragePort } from '../../ports/storage.port';

const SAFE_ID = /^[A-Za-z0-9_.-]+$/;

export class LocalStorageAdapter implements StoragePort {
  private locks = new Map<string, Promise<void>>();
  constructor(private root: string) { this.root = path.resolve(root); }

  private repoDir(repoId: string): string {
    if (!SAFE_ID.test(repoId)) throw new Error('unsafe repository id');
    return path.join(this.root, repoId);
  }
  private async atomicWrite(file: string, content: Buffer | string): Promise<void> {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${randomBytes(6).toString('hex')}.tmp`;
    await fs.writeFile(tmp, content);
    await fs.rename(tmp, file);
  }
  private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    this.locks.set(key, previous.then(() => gate));
    await previous;
    try { return await fn(); } finally { release(); if (this.locks.get(key) === gate) this.locks.delete(key); }
  }

  async initRepository(repoId: string): Promise<void> {
    await fs.mkdir(path.join(this.repoDir(repoId), 'objects'), { recursive: true });
    await fs.mkdir(path.join(this.repoDir(repoId), 'refs'), { recursive: true });
  }

  async putSnapshot(repoId: string, data: SnapshotData): Promise<SnapshotInfo> {
    const body = stableStringify(data);
    const hash = sha256Hex(body);
    const objDir = path.join(this.repoDir(repoId), 'objects', hash.slice(0, 2));
    const gzFile = path.join(objDir, `${hash}.json.gz`);
    const legacyFile = path.join(objDir, `${hash}.json`);

    try {
      await fs.access(gzFile);
    } catch {
      try {
        await fs.access(legacyFile);
      } catch {
        const compressed = gzipSync(Buffer.from(body, 'utf8'));
        await this.atomicWrite(gzFile, compressed);
      }
    }
    return { hash, recordCount: countRecords(data), sizeBytes: Buffer.byteLength(body, 'utf8') };
  }

  async getSnapshot(repoId: string, hash: string): Promise<SnapshotData> {
    if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error('invalid snapshot hash');
    const objDir = path.join(this.repoDir(repoId), 'objects', hash.slice(0, 2));
    const gzFile = path.join(objDir, `${hash}.json.gz`);
    const legacyFile = path.join(objDir, `${hash}.json`);

    try {
      const compressed = await fs.readFile(gzFile);
      let decompressed: Buffer;
      try {
        decompressed = gunzipSync(compressed);
      } catch (err) {
        throw new Error(`Corrupted compressed snapshot object: ${hash}`);
      }
      return JSON.parse(decompressed.toString('utf8')) as SnapshotData;
    } catch (e: any) {
      if (e.code === 'ENOENT') {
        const raw = await fs.readFile(legacyFile, 'utf8');
        return JSON.parse(raw) as SnapshotData;
      }
      throw e;
    }
  }

  async listSnapshotHashes(repoId: string): Promise<string[]> {
    const objectsDir = path.join(this.repoDir(repoId), 'objects');
    try {
      const subdirs = await fs.readdir(objectsDir);
      const hashes: string[] = [];
      for (const sub of subdirs) {
        const subPath = path.join(objectsDir, sub);
        try {
          const stat = await fs.stat(subPath);
          if (stat.isDirectory()) {
            const files = await fs.readdir(subPath);
            for (const file of files) {
              const match = file.match(/^([0-9a-f]{64})\.json(?:\.gz)?$/);
              if (match && !hashes.includes(match[1])) {
                hashes.push(match[1]);
              }
            }
          }
        } catch {
          // Ignore missing subdirs
        }
      }
      return hashes;
    } catch (e: any) {
      if (e.code === 'ENOENT') return [];
      throw e;
    }
  }

  async deleteSnapshot(repoId: string, hash: string): Promise<boolean> {
    if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error('invalid snapshot hash');
    const objDir = path.join(this.repoDir(repoId), 'objects', hash.slice(0, 2));
    const gzFile = path.join(objDir, `${hash}.json.gz`);
    const legacyFile = path.join(objDir, `${hash}.json`);
    let deleted = false;

    try {
      await fs.rm(gzFile, { force: true });
      deleted = true;
    } catch {}

    try {
      await fs.rm(legacyFile, { force: true });
      deleted = true;
    } catch {}

    return deleted;
  }

  private refFile(repoId: string, branch: string): string {
    if (!SAFE_ID.test(branch)) throw new Error('unsafe branch name');
    return path.join(this.repoDir(repoId), 'refs', branch);
  }
  async getRef(repoId: string, branch: string): Promise<string | null> {
    try { return (await fs.readFile(this.refFile(repoId, branch), 'utf8')).trim() || null; }
    catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null; throw e; }
  }
  async updateRef(repoId: string, branch: string, expected: string | null, next: string | null): Promise<void> {
    await this.withLock(`${repoId}/${branch}`, async () => {
      const current = await this.getRef(repoId, branch);
      if (current !== expected) throw new StorageConflictError(`ref ${branch}: expected ${expected}, found ${current}`);
      if (next === null) await fs.rm(this.refFile(repoId, branch), { force: true });
      else await this.atomicWrite(this.refFile(repoId, branch), next + '\n');
    });
  }

  async ping(): Promise<void> {
    await fs.mkdir(this.root, { recursive: true });
    await fs.access(this.root);
  }
}
