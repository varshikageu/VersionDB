import { createHash, randomBytes } from 'node:crypto';
import { stableStringify } from './json';

export const sha256Hex = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');
export const randomToken = (bytes = 48): string => randomBytes(bytes).toString('base64url');

export const GENESIS_HASH = '0'.repeat(64);

/** Hash that chains an audit row to its predecessor. Must stay stable: verification recomputes it. */
export function computeAuditHash(p: {
  prevHash: string;
  repoId: string | null;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: Date;
}): string {
  return sha256Hex(
    [p.prevHash, p.repoId ?? '', p.actorId ?? '', p.action, p.entityType, p.entityId ?? '', stableStringify(p.metadata), p.createdAt.toISOString()].join('|'),
  );
}
