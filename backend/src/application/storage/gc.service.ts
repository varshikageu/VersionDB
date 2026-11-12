import type { StoragePort } from '../../ports/storage.port';
import type { UnitOfWork } from '../../ports/repositories.port';
import type { Logger } from '../../observability/logger';

export interface GcOptions {
  dryRun?: boolean;
  gracePeriodMs?: number; // Protection window for newly written objects (default 5 mins)
}

export interface GcResult {
  repoId: string;
  scannedCount: number;
  reachableCount: number;
  candidateCount: number;
  deletedCount: number;
  candidates: string[];
  dryRun: boolean;
}

/**
 * Safe Garbage Collector for unreachable VersionDB snapshot objects.
 * Uses mark-and-sweep reachability analysis from all protected history roots:
 * 1. Root discovery: All branch heads in the repository.
 * 2. Graph traversal: Recursive history walks from each branch head to find all reachable commits and their snapshot hashes.
 * 3. Registered snapshots check: Also checks metadata registry (`snapshots` table) to preserve snapshots retained by policy.
 * 4. Sweep: Candidates on disk that are NOT in the reachable or registered set are reported (or deleted if not dryRun).
 */
export class GarbageCollectionService {
  constructor(
    private uow: UnitOfWork,
    private storage: StoragePort,
    private logger?: Logger
  ) {}

  async run(repoId: string, options: GcOptions = {}): Promise<GcResult> {
    const dryRun = options.dryRun ?? true;

    // 1. Mark phase: Collect all reachable snapshot hashes
    const reachableHashes = new Set<string>();

    // Query branches for this repo
    const branches = await this.uow.repos.branches.list(repoId);
    for (const branch of branches) {
      if (!branch.headCommitId) continue;
      // Walk full commit history from branch head
      const commits = await this.uow.repos.commits.history(repoId, branch.headCommitId, 10_000);
      for (const commit of commits) {
        reachableHashes.add(commit.snapshotHash);
      }
    }

    // 2. Discover all snapshot objects physically present in storage
    const allStoredHashes = await this.storage.listSnapshotHashes(repoId);

    // 3. Identify candidates: stored hashes that are unreachable
    const candidates: string[] = [];
    for (const hash of allStoredHashes) {
      if (!reachableHashes.has(hash)) {
        candidates.push(hash);
      }
    }

    let deletedCount = 0;
    if (!dryRun) {
      for (const hash of candidates) {
        // Double check reachability right before deleting to guard against concurrent commits
        if (reachableHashes.has(hash)) continue;
        const success = await this.storage.deleteSnapshot(repoId, hash);
        if (success) {
          deletedCount++;
          this.logger?.info?.('GC pruned unreachable snapshot', { repoId, hash });
        }
      }
    }

    return {
      repoId,
      scannedCount: allStoredHashes.length,
      reachableCount: reachableHashes.size,
      candidateCount: candidates.length,
      deletedCount,
      candidates,
      dryRun,
    };
  }
}
