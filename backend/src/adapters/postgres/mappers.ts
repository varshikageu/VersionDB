import type { AuditEntry, Branch, Commit, Member, Repository, RepositoryWithRole, User, WorkingChange } from '../../domain/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export const mapUser = (r: Row): User => ({
  id: r.id, email: r.email, username: r.username, passwordHash: r.password_hash,
  globalRole: r.global_role, disabled: r.disabled, createdAt: r.created_at,
});
export const mapRepository = (r: Row): Repository => ({
  id: r.id, name: r.name, description: r.description, ownerId: r.owner_id, defaultBranch: r.default_branch, createdAt: r.created_at,
});
export const mapRepositoryWithRole = (r: Row): RepositoryWithRole => ({ ...mapRepository(r), role: r.role });
export const mapMember = (r: Row): Member => ({
  repoId: r.repo_id, userId: r.user_id, username: r.username, email: r.email, role: r.role, createdAt: r.created_at,
});
export const mapBranch = (r: Row): Branch => ({
  id: r.id, repoId: r.repo_id, name: r.name, headCommitId: r.head_commit_id, createdBy: r.created_by, createdAt: r.created_at,
  protection: r.required_approvals === null || r.required_approvals === undefined ? null : { requiredApprovals: r.required_approvals },
});
export const mapCommit = (r: Row, parents: string[]): Commit => ({
  id: r.id, repoId: r.repo_id, snapshotHash: r.snapshot_hash, authorId: r.author_id, authorName: r.author_name ?? null,
  message: r.message, kind: r.kind, createdAt: r.created_at, parents,
});
export const mapWorkingChange = (r: Row): WorkingChange => ({
  collection: r.collection, recordId: r.record_id, op: r.op, data: r.op === 'put' ? r.data : null, updatedAt: r.updated_at,
});
export const mapAudit = (r: Row): AuditEntry => ({
  id: Number(r.id), repoId: r.repo_id, actorId: r.actor_id, actorName: r.actor_name ?? null, action: r.action,
  entityType: r.entity_type, entityId: r.entity_id, metadata: r.metadata, ip: r.ip, hash: r.hash, createdAt: r.created_at,
});
