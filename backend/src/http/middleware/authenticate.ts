import type { RequestHandler } from 'express';
import type { AuthService } from '../../application/auth/auth.service';
import { unauthorized } from '../../shared/errors';

export function authenticate(auth: AuthService): RequestHandler {
  return async (req, _res, next) => {
    const header = req.header('authorization');
    const match = header ? /^Bearer\s+(\S+)$/i.exec(header) : null;
    if (!match) throw unauthorized();
    const claims = auth.verifyAccessToken(match[1]!);
    const user = await auth.loadActiveUser(claims.userId);
    req.auth = { userId: user.id, globalRole: user.globalRole }; // role from the DB row, not the (possibly stale) token
    next();
  };
}
