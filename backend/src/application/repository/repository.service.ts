import type { Env } from '../../config/env';
import { DEFAULT_BRANCH } from '../../config/constants';
import type { Actor, Branch, Repository, RepositoryWithRole } from '../../domain/types';
import type { StoragePort } from '../../ports/storage.port';
import type { UnitOfWork } from '../../ports/repositories.port';
import { conflict } from '../../shared/errors';
import { isUniqueViolation } from '../../shared/pg-errors';
import type { AuditService } from '../audit/audit.service';
import type { MemberService } from '../member/member.service';

export class RepositoryService {
  constructor(
    private uow: UnitOfWork, private storage: StoragePort, private env: Env,
    private audit: AuditService, private members: MemberService,
  ) {}

  /** Creates the repository, makes the creator its owner, and sets up an empty protected `main`. */
  async create(actor: Actor, input: { name: string; description: string }): Promise<RepositoryWithRole> {
    try {
      return await this.uow.transaction(async (repos) => {
        const repo = await repos.repositories.create({ ...input, ownerId: actor.userId });
        await repos.members.upsert({ repoId: repo.id, userId: actor.userId, role: 'owner', addedBy: actor.userId });
        await repos.branches.create({ repoId: repo.id, name: DEFAULT_BRANCH, headCommitId: null, createdBy: actor.userId });
        await repos.branches.protect(repo.id, DEFAULT_BRANCH, this.env.DEFAULT_REQUIRED_APPROVALS);
        await this.storage.initRepository(repo.id); // inside the tx: a storage failure rolls everything back
        await this.audit.log(repos, {
          repoId: repo.id, actorId: actor.userId, action: 'repository.create', entityType: 'repository', entityId: repo.id,
          metadata: { name: repo.name }, ip: actor.ip,
        });
        return { ...repo, role: 'owner' as const };
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw conflict('REPOSITORY_EXISTS', 'You already have a repository with that name');
      throw e;
    }
  }

  list(actor: Actor): Promise<RepositoryWithRole[]> {
    return this.uow.repos.repositories.listForUser(actor.userId, actor.globalRole === 'admin');
  }

  async get(actor: Actor, repoId: string): Promise<Repository & { role: string; branches: Branch[] }> {
    const { repo, role } = await this.members.authorize(actor, repoId, 'repo:read');
    const branches = await this.uow.repos.branches.list(repoId);
    return { ...repo, role, branches };
  }

  async listBranches(actor: Actor, repoId: string): Promise<Branch[]> {
    await this.members.authorize(actor, repoId, 'repo:read');
    return this.uow.repos.branches.list(repoId);
  }
}
