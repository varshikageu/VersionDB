import { z } from 'zod';
import { BRANCH_RE, COLLECTION_RE, LIMITS, RECORD_ID_RE, REPO_NAME_RE, USERNAME_RE } from '../../config/constants';

const email = z.string().trim().toLowerCase().email().max(254);

export const registerBody = z.object({
  email,
  username: z.string().trim().regex(USERNAME_RE, 'Use 3-32 letters, digits, "_", "." or "-"'),
  password: z.string().min(10, 'At least 10 characters')
    .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'At most 72 bytes')
    .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Must contain a letter and a digit'),
});
export const loginBody = z.object({ identifier: z.string().trim().min(1).max(254), password: z.string().min(1).max(1024) });
export const refreshBody = z.object({ refreshToken: z.string().min(20).max(200) });

export const repoParams = z.object({ repoId: z.string().uuid() });
export const createRepoBody = z.object({
  name: z.string().trim().regex(REPO_NAME_RE, 'Use 1-64 letters, digits, "_", "." or "-"'),
  description: z.string().trim().max(500).default(''),
});
export const memberBody = z.object({ email, role: z.enum(['viewer', 'reviewer', 'maintainer', 'owner']) });
export const memberRoleBody = z.object({ role: z.enum(['viewer', 'reviewer', 'maintainer', 'owner']) });
export const memberParams = repoParams.extend({ userId: z.string().uuid() });

const branch = z.string().regex(BRANCH_RE);
export const branchParams = repoParams.extend({ branch });
export const recordParams = branchParams.extend({
  collection: z.string().regex(COLLECTION_RE),
  recordId: z.string().regex(RECORD_ID_RE),
});
export const refParams = repoParams.extend({ ref: z.string().min(1).max(64) });
export const commitParams = repoParams.extend({ commitId: z.string().uuid() });

export const recordsQuery = z.object({
  collection: z.string().regex(COLLECTION_RE).optional(),
  limit: z.coerce.number().int().min(1).max(LIMITS.maxRecordPage).default(50),
  after: z.string().max(128).optional(),
});
export const putRecordBody = z.object({ data: z.record(z.string(), z.unknown()) });
export const commitBody = z.object({ message: z.string().min(1).max(LIMITS.maxCommitMessage) });
export const historyQuery = z.object({
  limit: z.coerce.number().int().min(1).max(LIMITS.maxHistoryPage).default(30),
  before: z.string().max(100).optional(),
});
