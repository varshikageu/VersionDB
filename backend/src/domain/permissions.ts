import { forbidden } from '../shared/errors';
import type { GlobalRole, RepoRole } from './types';

export type Capability = 'repo:read' | 'record:write' | 'commit:create' | 'member:manage';

const RANK: Record<RepoRole, number> = { viewer: 1, reviewer: 2, maintainer: 3, owner: 4 };

/** Minimum repository role needed for each capability. */
const REQUIRED: Record<Capability, RepoRole> = {
  'repo:read': 'viewer',
  'record:write': 'maintainer',
  'commit:create': 'maintainer',
  'member:manage': 'owner',
};

/** Platform admins act as owner everywhere. */
export function effectiveRole(memberRole: RepoRole | null, globalRole: GlobalRole): RepoRole | null {
  return globalRole === 'admin' ? 'owner' : memberRole;
}

export function can(role: RepoRole | null, capability: Capability): boolean {
  return role !== null && RANK[role] >= RANK[REQUIRED[capability]];
}

export function assertCan(role: RepoRole | null, capability: Capability): void {
  if (!can(role, capability)) {
    throw forbidden('FORBIDDEN', `This action requires the ${REQUIRED[capability]} role or higher`);
  }
}
