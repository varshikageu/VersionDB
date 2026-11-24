import { forbidden } from '../shared/errors';
import type { GlobalRole, RepoRole } from './types';

export type Capability =
  | 'repo:read'
  | 'record:write'
  | 'commit:create'
  | 'branch:create'
  | 'branch:delete'
  | 'member:manage'
  | 'repo:delete'
  | 'merge:create'
  | 'merge:review'
  | 'merge:execute';

/**
 * Repository capability mapping per role:
 * - viewer: read repository, history, branches
 * - reviewer: read repository, review & approve merge requests, resolve conflicts
 * - maintainer: read repository, write records, create commits, create/delete branches, create & execute merge requests
 * - owner: all maintainer & reviewer capabilities + manage members, delete repository
 */
const ROLE_CAPABILITIES: Record<RepoRole, Set<Capability>> = {
  viewer: new Set<Capability>(['repo:read']),
  reviewer: new Set<Capability>(['repo:read', 'merge:review']),
  maintainer: new Set<Capability>([
    'repo:read',
    'record:write',
    'commit:create',
    'branch:create',
    'branch:delete',
    'merge:create',
    'merge:execute',
  ]),
  owner: new Set<Capability>([
    'repo:read',
    'record:write',
    'commit:create',
    'branch:create',
    'branch:delete',
    'member:manage',
    'repo:delete',
    'merge:create',
    'merge:review',
    'merge:execute',
  ]),
};

/**
 * Resolves the effective repository role for a user given their repository membership and platform global role.
 * - Platform admins have full owner privileges across all repositories.
 * - Explicit repository membership role always takes precedence for repository-specific permissions.
 * - If user has no explicit repository membership:
 *   - Platform Reviewers receive reviewer access on visible repositories
 *   - Platform Developers receive maintainer access on visible repositories
 *   - Platform Viewers receive viewer access on visible repositories
 */
export function effectiveRole(memberRole: RepoRole | null, globalRole: GlobalRole): RepoRole | null {
  if (globalRole === 'admin') return 'owner';
  if (memberRole !== null) return memberRole;
  if (globalRole === 'reviewer') return 'reviewer';
  if (globalRole === 'developer') return 'maintainer';
  if (globalRole === 'viewer') return 'viewer';
  return null;
}

const REQUIRED: Record<Capability, string> = {
  'repo:read': 'viewer',
  'record:write': 'maintainer',
  'commit:create': 'maintainer',
  'branch:create': 'maintainer',
  'branch:delete': 'maintainer',
  'member:manage': 'owner',
  'repo:delete': 'owner',
  'merge:create': 'maintainer',
  'merge:review': 'reviewer',
  'merge:execute': 'maintainer',
};

export function can(role: RepoRole | null, capability: Capability): boolean {
  return role !== null && ROLE_CAPABILITIES[role]?.has(capability) === true;
}

export function assertCan(role: RepoRole | null, capability: Capability): void {
  if (!can(role, capability)) {
    throw forbidden('FORBIDDEN', `This action requires the ${REQUIRED[capability]} role or higher`);
  }
}
