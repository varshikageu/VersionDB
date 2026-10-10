import type { Actor, Member, RepoRole, Repository } from '../../domain/types';
import { assertCan, effectiveRole, type Capability } from '../../domain/permissions';
import { conflict, notFound } from '../../shared/errors';
import type { UnitOfWork } from '../../ports/repositories.port';
import type { AuditService } from '../audit/audit.service';

export class MemberService {
  constructor(private uow: UnitOfWork, private audit: AuditService) {}

  /**
   * Single authorization gate for every repository-scoped use case.
   * Users with no access get 404 (the repository's existence is not revealed); users with too little access get 403.
   */
  async authorize(actor: Actor, repoId: string, capability: Capability): Promise<{ repo: Repository; role: RepoRole }> {
    const repo = await this.uow.repos.repositories.findById(repoId);
    if (!repo) throw notFound('Repository');
    const member = await this.uow.repos.members.find(repoId, actor.userId);
    const role = effectiveRole(member, actor.globalRole);
    if (role === null) throw notFound('Repository');
    assertCan(role, capability);
    return { repo, role };
  }

  async list(actor: Actor, repoId: string): Promise<Member[]> {
    await this.authorize(actor, repoId, 'repo:read');
    return this.uow.repos.members.list(repoId);
  }

  async add(actor: Actor, repoId: string, input: { email: string; role: RepoRole }): Promise<void> {
    await this.authorize(actor, repoId, 'member:manage');
    const user = await this.uow.repos.users.findByEmail(input.email);
    if (!user || user.disabled) throw notFound('User');
    await this.uow.transaction(async (repos) => {
      await repos.members.upsert({ repoId, userId: user.id, role: input.role, addedBy: actor.userId });
      await this.audit.log(repos, {
        repoId, actorId: actor.userId, action: 'member.set_role', entityType: 'user', entityId: user.id,
        metadata: { role: input.role }, ip: actor.ip,
      });
    });
  }

  async setRole(actor: Actor, repoId: string, userId: string, role: RepoRole): Promise<void> {
    await this.authorize(actor, repoId, 'member:manage');
    await this.uow.transaction(async (repos) => {
      const current = await repos.members.find(repoId, userId);
      if (!current) throw notFound('Member');
      if (current === 'owner' && role !== 'owner' && (await repos.members.countOwners(repoId)) <= 1) {
        throw conflict('LAST_OWNER', 'A repository must keep at least one owner');
      }
      await repos.members.upsert({ repoId, userId, role, addedBy: actor.userId });
      await this.audit.log(repos, { repoId, actorId: actor.userId, action: 'member.set_role', entityType: 'user', entityId: userId, metadata: { role }, ip: actor.ip });
    });
  }

  async remove(actor: Actor, repoId: string, userId: string): Promise<void> {
    await this.authorize(actor, repoId, 'member:manage');
    await this.uow.transaction(async (repos) => {
      const current = await repos.members.find(repoId, userId);
      if (!current) throw notFound('Member');
      if (current === 'owner' && (await repos.members.countOwners(repoId)) <= 1) {
        throw conflict('LAST_OWNER', 'A repository must keep at least one owner');
      }
      await repos.members.remove(repoId, userId);
      await this.audit.log(repos, { repoId, actorId: actor.userId, action: 'member.remove', entityType: 'user', entityId: userId, ip: actor.ip });
    });
  }
}
