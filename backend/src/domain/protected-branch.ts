import { forbidden } from '../shared/errors';
import type { Branch } from './types';

/**
 * Protected-main rule. A protected branch only moves through an approved merge or an explicit rollback.
 * The single exception is the bootstrap: while a protected branch has no commits yet, the first commit may land directly.
 */
export function assertDirectWriteAllowed(branch: Branch): void {
  if (branch.protection && branch.headCommitId !== null) {
    throw forbidden(
      'PROTECTED_BRANCH',
      `Branch "${branch.name}" is protected. Create a branch and open a merge request instead.`,
    );
  }
}
