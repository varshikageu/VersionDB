import { Router } from 'express';
import type { Container } from '../../container';
import { createControllers } from '../controllers/controllers';
import { authenticate } from '../middleware/authenticate';
import { idempotent } from '../middleware/idempotency';
import { rateLimit } from '../middleware/rate-limit';

export function createApiRouter(c: Container): Router {
  const api = Router();
  const ctl = createControllers(c);
  const requireAuth = authenticate(c.services.auth);
  const once = idempotent(c.services.idempotency, c.logger);

  // --- authentication (public, rate limited) ---
  const authLimiter = rateLimit({ windowMs: 60_000, max: 20 });
  api.post('/auth/register', authLimiter, ctl.auth.register);
  api.post('/auth/login', authLimiter, ctl.auth.login);
  api.post('/auth/refresh', authLimiter, ctl.auth.refresh);
  api.post('/auth/logout', authLimiter, ctl.auth.logout);
  api.get('/auth/me', requireAuth, ctl.auth.me);

  // --- everything below requires a valid access token ---
  api.use(requireAuth);

  // repositories, membership, branch listing
  api.post('/repos', ctl.repositories.create);
  api.get('/repos', ctl.repositories.list);
  api.get('/repos/:repoId', ctl.repositories.get);
  api.get('/repos/:repoId/branches', ctl.repositories.branches);
  api.get('/repos/:repoId/members', ctl.members.list);
  api.post('/repos/:repoId/members', ctl.members.add);
  api.patch('/repos/:repoId/members/:userId', ctl.members.setRole);
  api.delete('/repos/:repoId/members/:userId', ctl.members.remove);

  // records: read committed data, stage edits in the caller's working state
  api.get('/repos/:repoId/branches/:branch/records', ctl.records.readBranch);
  api.get('/repos/:repoId/branches/:branch/records/:collection/:recordId', ctl.records.getOne);
  api.put('/repos/:repoId/branches/:branch/records/:collection/:recordId', ctl.records.put);
  api.delete('/repos/:repoId/branches/:branch/records/:collection/:recordId', ctl.records.remove);
  api.get('/repos/:repoId/branches/:branch/working', ctl.records.pending);
  api.delete('/repos/:repoId/branches/:branch/working', ctl.records.discard);

  // commits and version history
  api.post('/repos/:repoId/branches/:branch/commits', once, ctl.commits.create);
  api.get('/repos/:repoId/history/:ref', ctl.commits.history);
  api.get('/repos/:repoId/commits/:commitId', ctl.commits.get);
  api.get('/repos/:repoId/commits/:commitId/records', ctl.records.readCommit);

  return api;
}
