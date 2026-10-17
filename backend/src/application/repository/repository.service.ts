import type { Env } from '../../config/env';
import { DEFAULT_BRANCH } from '../../config/constants';
import type { Actor, Branch, Repository, RepositoryWithRole } from '../../domain/types';
import type { StoragePort } from '../../ports/storage.port';
import type { UnitOfWork } from '../../ports/repositories.port';
import { conflict, notFound } from '../../shared/errors';
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

  /**
   * Creates a new branch pointing to the source branch's head commit.
   * Requires maintainer or owner role on the repository.
   */
  async createBranch(
    actor: Actor,
    repoId: string,
    input: { name: string; sourceBranch: string }
  ): Promise<Branch & { sourceBranch: string }> {
    await this.members.authorize(actor, repoId, 'branch:create');

    const source = await this.uow.repos.branches.find(repoId, input.sourceBranch);
    if (!source) {
      throw notFound(`Source branch '${input.sourceBranch}'`);
    }

    const existing = await this.uow.repos.branches.find(repoId, input.name);
    if (existing) {
      throw conflict('BRANCH_EXISTS', `A branch with name '${input.name}' already exists in this repository`);
    }

    try {
      return await this.uow.transaction(async (repos) => {
        const branch = await repos.branches.create({
          repoId,
          name: input.name,
          headCommitId: source.headCommitId,
          createdBy: actor.userId,
        });

        await this.audit.log(repos, {
          repoId,
          actorId: actor.userId,
          action: 'branch.create',
          entityType: 'branch',
          entityId: branch.id,
          metadata: {
            name: branch.name,
            sourceBranch: source.name,
            headCommitId: source.headCommitId,
          },
          ip: actor.ip,
        });

        return { ...branch, sourceBranch: source.name };
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw conflict('BRANCH_EXISTS', `A branch with name '${input.name}' already exists in this repository`);
      }
      throw e;
    }
  }

  /**
   * Deletes a branch from the repository.
   * Rejects deletion of default branch, protected branches, or branches with open merge requests.
   * Requires maintainer or owner role.
   */
  async deleteBranch(
    actor: Actor,
    repoId: string,
    branchName: string,
    options?: { activeBranch?: string }
  ): Promise<{ deleted: boolean; branchName: string }> {
    const { repo } = await this.members.authorize(actor, repoId, 'branch:delete');

    if (branchName === repo.defaultBranch) {
      throw conflict('DEFAULT_BRANCH_PROTECTED', `Cannot delete default branch '${branchName}' of the repository`);
    }

    if (options?.activeBranch && branchName === options.activeBranch) {
      throw conflict('ACTIVE_BRANCH_CONFLICT', `Cannot delete currently active branch '${branchName}'. Switch to another branch first.`);
    }

    try {
      return await this.uow.transaction(async (repos) => {
        const branch = await repos.branches.lock(repoId, branchName);
        if (!branch) {
          throw notFound(`Branch '${branchName}'`);
        }

        if (branch.protection) {
          throw conflict('PROTECTED_BRANCH', `Branch '${branchName}' is protected and cannot be deleted`);
        }

        const hasOpenMr = await repos.branches.hasOpenMergeRequests(repoId, branchName);
        if (hasOpenMr) {
          throw conflict('BRANCH_IN_USE', `Branch '${branchName}' cannot be deleted because it has open merge requests`);
        }

        const deleted = await repos.branches.delete(repoId, branchName);

        await this.audit.log(repos, {
          repoId,
          actorId: actor.userId,
          action: 'branch.delete',
          entityType: 'branch',
          entityId: branch.id,
          metadata: {
            name: branch.name,
            headCommitId: branch.headCommitId,
          },
          ip: actor.ip,
        });

        return { deleted, branchName };
      });
    } catch (e) {
      if ((e as any)?.code === '42501' || (e as Error)?.message?.includes('protected')) {
        throw conflict('PROTECTED_BRANCH', `Branch '${branchName}' is protected and cannot be deleted`);
      }
      throw e;
    }
  }

  /**
   * Deletes a repository.
   * Requires owner role on the repository or platform admin.
   * Logs repository deletion to the audit trail (linked with repoId=null/entityId=repoId to preserve audit history),
   * then removes the repository row (which cascades to branches, members, etc.).
   */
  async delete(actor: Actor, repoId: string): Promise<{ deleted: boolean; repoId: string; name: string }> {
    const { repo } = await this.members.authorize(actor, repoId, 'repo:delete');

    return await this.uow.transaction(async (repos) => {
      await repos.repositories.lockForUpdate(repoId);

      // Audit log the deletion before removing the repository.
      // repoId: null ensures this entry is logged to the global immutable audit chain
      // so it survives the deletion of the repository itself and never violates FK constraints.
      await this.audit.log(repos, {
        repoId: null,
        actorId: actor.userId,
        action: 'repository.delete',
        entityType: 'repository',
        entityId: repo.id,
        metadata: {
          name: repo.name,
          deletedBy: actor.userId,
        },
        ip: actor.ip,
      });

      const deleted = await repos.repositories.delete(repoId);
      if (!deleted) {
        throw notFound('Repository');
      }

      return { deleted: true, repoId: repo.id, name: repo.name };
    });
  }
}
