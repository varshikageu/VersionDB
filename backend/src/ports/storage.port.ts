import type { SnapshotData } from '../domain/types';

export interface SnapshotInfo { hash: string; recordCount: number; sizeBytes: number }

/** Thrown when a compare-and-swap on a ref loses a race. */
export class StorageConflictError extends Error {
  constructor(message = 'Ref was updated concurrently') { super(message); this.name = 'StorageConflictError'; }
}

/**
 * Contract between Role 1 (backend) and Role 2 (storage engine).
 * Snapshots are immutable and content-addressed; refs (branch -> commit id) move only through compare-and-swap.
 */
export interface StoragePort {
  initRepository(repoId: string): Promise<void>;
  putSnapshot(repoId: string, data: SnapshotData): Promise<SnapshotInfo>;
  getSnapshot(repoId: string, hash: string): Promise<SnapshotData>;
  getRef(repoId: string, branch: string): Promise<string | null>;
  /** expected/next = null means "must not exist" / "delete". Throws StorageConflictError if expected does not match. */
  updateRef(repoId: string, branch: string, expected: string | null, next: string | null): Promise<void>;
  ping(): Promise<void>;
}
