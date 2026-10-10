import type { Request, Response } from 'express';
import type { Actor } from '../../domain/types';
import type { Container } from '../../container';
import { unauthorized } from '../../shared/errors';
import { parse } from '../middleware/validate';
import * as s from '../schemas/schemas';

const actorOf = (req: Request): Actor => {
  if (!req.auth) throw unauthorized();
  return { userId: req.auth.userId, globalRole: req.auth.globalRole, ip: req.ip };
};

export function createControllers(c: Container) {
  const { auth, repositories, members, records, commits, history } = c.services;

  return {
    auth: {
      register: async (req: Request, res: Response) => {
        res.status(201).json({ user: await auth.register(parse(s.registerBody, req.body), req.ip) });
      },
      login: async (req: Request, res: Response) => {
        res.json(await auth.login(parse(s.loginBody, req.body), req.ip));
      },
      refresh: async (req: Request, res: Response) => {
        res.json(await auth.refresh(parse(s.refreshBody, req.body).refreshToken, req.ip));
      },
      logout: async (req: Request, res: Response) => {
        await auth.logout(parse(s.refreshBody, req.body).refreshToken);
        res.status(204).end();
      },
      me: async (req: Request, res: Response) => { res.json({ user: await auth.me(actorOf(req).userId) }); },
    },

    repositories: {
      create: async (req: Request, res: Response) => {
        res.status(201).json({ repository: await repositories.create(actorOf(req), parse(s.createRepoBody, req.body)) });
      },
      list: async (req: Request, res: Response) => { res.json({ repositories: await repositories.list(actorOf(req)) }); },
      get: async (req: Request, res: Response) => {
        res.json({ repository: await repositories.get(actorOf(req), parse(s.repoParams, req.params).repoId) });
      },
      branches: async (req: Request, res: Response) => {
        res.json({ branches: await repositories.listBranches(actorOf(req), parse(s.repoParams, req.params).repoId) });
      },
    },

    members: {
      list: async (req: Request, res: Response) => {
        res.json({ members: await members.list(actorOf(req), parse(s.repoParams, req.params).repoId) });
      },
      add: async (req: Request, res: Response) => {
        await members.add(actorOf(req), parse(s.repoParams, req.params).repoId, parse(s.memberBody, req.body));
        res.status(204).end();
      },
      setRole: async (req: Request, res: Response) => {
        const p = parse(s.memberParams, req.params);
        await members.setRole(actorOf(req), p.repoId, p.userId, parse(s.memberRoleBody, req.body).role);
        res.status(204).end();
      },
      remove: async (req: Request, res: Response) => {
        const p = parse(s.memberParams, req.params);
        await members.remove(actorOf(req), p.repoId, p.userId);
        res.status(204).end();
      },
    },

    records: {
      readBranch: async (req: Request, res: Response) => {
        const p = parse(s.branchParams, req.params);
        res.json(await records.read(actorOf(req), p.repoId, p.branch, parse(s.recordsQuery, req.query)));
      },
      readCommit: async (req: Request, res: Response) => {
        const p = parse(s.commitParams, req.params);
        res.json(await records.read(actorOf(req), p.repoId, p.commitId, parse(s.recordsQuery, req.query)));
      },
      getOne: async (req: Request, res: Response) => {
        const p = parse(s.recordParams, req.params);
        res.json(await records.getOne(actorOf(req), p.repoId, p.branch, p.collection, p.recordId));
      },
      put: async (req: Request, res: Response) => {
        const p = parse(s.recordParams, req.params);
        const change = await records.stagePut(actorOf(req), p.repoId, p.branch, p.collection, p.recordId, parse(s.putRecordBody, req.body).data);
        res.json({ pending: change });
      },
      remove: async (req: Request, res: Response) => {
        const p = parse(s.recordParams, req.params);
        await records.stageDelete(actorOf(req), p.repoId, p.branch, p.collection, p.recordId);
        res.status(204).end();
      },
      pending: async (req: Request, res: Response) => {
        const p = parse(s.branchParams, req.params);
        res.json({ pending: await records.listPending(actorOf(req), p.repoId, p.branch) });
      },
      discard: async (req: Request, res: Response) => {
        const p = parse(s.branchParams, req.params);
        res.json({ discarded: await records.discard(actorOf(req), p.repoId, p.branch) });
      },
    },

    commits: {
      create: async (req: Request, res: Response) => {
        const p = parse(s.branchParams, req.params);
        res.status(201).json({ commit: await commits.create(actorOf(req), p.repoId, p.branch, parse(s.commitBody, req.body).message) });
      },
      history: async (req: Request, res: Response) => {
        const p = parse(s.refParams, req.params);
        res.json(await history.log(actorOf(req), p.repoId, p.ref, parse(s.historyQuery, req.query)));
      },
      get: async (req: Request, res: Response) => {
        const p = parse(s.commitParams, req.params);
        res.json({ commit: await history.getCommit(actorOf(req), p.repoId, p.commitId) });
      },
    },
  };
}
