import { LIMITS, UUID_RE } from '../../config/constants';
import type { Actor, Commit } from '../../domain/types';
import type { UnitOfWork } from '../../ports/repositories.port';
import { badRequest, notFound } from '../../shared/errors';
import type { MemberService } from '../member/member.service';

export class HistoryService {
  constructor(private uow: UnitOfWork, private members: MemberService) {}

  /** A ref is a branch name or a commit id. A branch name wins if both could match. Returns null for an empty branch. */
  async resolveCommitId(repoId: string, ref: string): Promise<string | null> {
    const branch = await this.uow.repos.branches.find(repoId, ref);
    if (branch) return branch.headCommitId;
    if (UUID_RE.test(ref) && (await this.uow.repos.commits.find(repoId, ref))) return ref.toLowerCase();
    throw notFound('Branch or commit');
  }

  async log(actor: Actor, repoId: string, ref: string, opts: { limit: number; before?: string }) {
    await this.members.authorize(actor, repoId, 'repo:read');
    const head = await this.resolveCommitId(repoId, ref);
    if (head === null) return { commits: [] as Commit[], nextCursor: null as string | null };
    const limit = Math.min(opts.limit, LIMITS.maxHistoryPage);
    let before: { createdAt: string; id: string } | undefined;
    if (opts.before) {
      const [createdAt, id] = opts.before.split('|');
      if (!createdAt || !id || !UUID_RE.test(id) || Number.isNaN(Date.parse(createdAt))) throw badRequest('INVALID_CURSOR', 'Invalid cursor');
      before = { createdAt, id };
    }
    const commits = await this.uow.repos.commits.history(repoId, head, limit + 1, before);
    const page = commits.slice(0, limit);
    const last = page[page.length - 1];
    const nextCursor = commits.length > limit && last ? `${last.createdAt.toISOString()}|${last.id}` : null;
    return { commits: page, nextCursor };
  }

  async getCommit(actor: Actor, repoId: string, commitId: string): Promise<Commit> {
    await this.members.authorize(actor, repoId, 'repo:read');
    const commit = await this.uow.repos.commits.find(repoId, commitId);
    if (!commit) throw notFound('Commit');
    return commit;
  }
}
