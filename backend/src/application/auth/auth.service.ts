import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Env } from '../../config/env';
import type { GlobalRole, PublicUser, User } from '../../domain/types';
import type { CachePort } from '../../ports/cache.port';
import { toPublicUser, type UnitOfWork } from '../../ports/repositories.port';
import { randomToken, sha256Hex } from '../../shared/crypto';
import { conflict, forbidden, notFound, unauthorized } from '../../shared/errors';
import { isUniqueViolation } from '../../shared/pg-errors';
import type { AuditService } from '../audit/audit.service';

export interface AuthResult { accessToken: string; refreshToken: string; expiresIn: number; user: PublicUser }

export class AuthService {
  private dummyHash: string | null = null;

  constructor(private uow: UnitOfWork, private env: Env, private cache: CachePort, private audit: AuditService) {}

  async register(input: { email: string; username: string; password: string }, ip?: string): Promise<PublicUser> {
    const passwordHash = await bcrypt.hash(input.password, this.env.BCRYPT_COST);
    try {
      return await this.uow.transaction(async (repos) => {
        const user = await repos.users.create({ email: input.email, username: input.username, passwordHash });
        await this.audit.log(repos, { repoId: null, actorId: user.id, action: 'auth.register', entityType: 'user', entityId: user.id, ip });
        return toPublicUser(user);
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw conflict('ACCOUNT_EXISTS', 'An account with that email already exists');
      throw e;
    }
  }

  async login(input: { identifier: string; password: string }, ip?: string): Promise<AuthResult> {
    const user = await this.uow.repos.users.findByIdentifier(input.identifier);
    // Always run one bcrypt comparison so response time does not reveal whether the account exists.
    const hash = user?.passwordHash ?? (this.dummyHash ??= bcrypt.hashSync('versiondb-dummy-password', this.env.BCRYPT_COST));
    const ok = await bcrypt.compare(input.password, hash);
    if (!user || !ok || user.disabled) {
      await this.audit.log(this.uow.repos, { repoId: null, actorId: user?.id ?? null, action: 'auth.login_failed', entityType: 'user', entityId: user?.id ?? null, ip });
      throw unauthorized('INVALID_CREDENTIALS', 'Invalid credentials');
    }
    const result = await this.issue(user);
    await this.audit.log(this.uow.repos, { repoId: null, actorId: user.id, action: 'auth.login', entityType: 'user', entityId: user.id, ip });
    return result;
  }

  /** Refresh tokens rotate on every use. Presenting an already-used token revokes the whole token family (theft signal). */
  async refresh(refreshToken: string, ip?: string): Promise<AuthResult> {
    const record = await this.uow.repos.tokens.findByHash(sha256Hex(refreshToken), 'refresh');
    if (!record) throw unauthorized('INVALID_REFRESH_TOKEN', 'Invalid refresh token');
    if (record.revokedAt) {
      await this.uow.repos.tokens.revokeAllForUser(record.userId, 'refresh');
      await this.audit.log(this.uow.repos, { repoId: null, actorId: record.userId, action: 'auth.refresh_reuse_detected', entityType: 'user', entityId: record.userId, ip });
      throw unauthorized('INVALID_REFRESH_TOKEN', 'Invalid refresh token');
    }
    if (record.expiresAt.getTime() < Date.now()) throw unauthorized('INVALID_REFRESH_TOKEN', 'Refresh token expired');
    const user = await this.uow.repos.users.findById(record.userId);
    if (!user || user.disabled) throw unauthorized('INVALID_REFRESH_TOKEN', 'Invalid refresh token');
    await this.uow.repos.tokens.revoke(record.id);
    return this.issue(user);
  }

  async logout(refreshToken: string): Promise<void> {
    const record = await this.uow.repos.tokens.findByHash(sha256Hex(refreshToken), 'refresh');
    if (record && !record.revokedAt) await this.uow.repos.tokens.revoke(record.id);
  }

  async me(userId: string): Promise<PublicUser> {
    return toPublicUser(await this.loadActiveUser(userId));
  }

  // --- Admin-Controlled User Management & Platform RBAC ---

  private assertAdmin(actor: import('../../domain/types').Actor): void {
    if (actor.globalRole !== 'admin') {
      throw forbidden('FORBIDDEN', 'Administrative privileges required');
    }
  }

  async adminListUsers(actor: import('../../domain/types').Actor): Promise<PublicUser[]> {
    this.assertAdmin(actor);
    const all = await this.uow.repos.users.list();
    return all.map(toPublicUser);
  }

  async adminCreateUser(
    actor: import('../../domain/types').Actor,
    input: { email: string; username: string; globalRole: GlobalRole; initialPassword?: string },
    ip?: string
  ): Promise<{ user: PublicUser; initialPassword: string }> {
    this.assertAdmin(actor);
    const rawPassword = input.initialPassword && input.initialPassword.length >= 10
      ? input.initialPassword
      : `Vdb!${randomToken(12)}9`;
    const passwordHash = await bcrypt.hash(rawPassword, this.env.BCRYPT_COST);

    try {
      return await this.uow.transaction(async (repos) => {
        const user = await repos.users.create({
          email: input.email.toLowerCase(),
          username: input.username,
          passwordHash,
          globalRole: input.globalRole,
        });
        await this.audit.log(repos, {
          repoId: null,
          actorId: actor.userId,
          action: 'admin.user_create',
          entityType: 'user',
          entityId: user.id,
          metadata: { globalRole: input.globalRole, email: input.email },
          ip,
        });
        return { user: toPublicUser(user), initialPassword: rawPassword };
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw conflict('ACCOUNT_EXISTS', 'An account with that email already exists');
      }
      throw e;
    }
  }

  async adminUpdateUser(
    actor: import('../../domain/types').Actor,
    userId: string,
    patch: { username?: string; globalRole?: GlobalRole; disabled?: boolean },
    ip?: string
  ): Promise<PublicUser> {
    this.assertAdmin(actor);
    const existing = await this.uow.repos.users.findById(userId);
    if (!existing) throw notFound('User');

    // Prevent deactivating or demoting the last active admin
    if ((patch.disabled === true || (patch.globalRole && patch.globalRole !== 'admin')) && existing.globalRole === 'admin') {
      const all = await this.uow.repos.users.list();
      const activeAdmins = all.filter((u) => u.globalRole === 'admin' && !u.disabled);
      if (activeAdmins.length <= 1) {
        throw conflict('LAST_ADMIN', 'Cannot disable or demote the last remaining active platform admin');
      }
    }

    const updated = await this.uow.transaction(async (repos) => {
      const u = await repos.users.update(userId, patch);
      if (!u) throw notFound('User');
      if (patch.disabled) {
        await repos.tokens.revokeAllForUser(userId, 'refresh');
      }
      await this.audit.log(repos, {
        repoId: null,
        actorId: actor.userId,
        action: 'admin.user_update',
        entityType: 'user',
        entityId: userId,
        metadata: patch,
        ip,
      });
      return u;
    });

    this.cache.delete(`user:${userId}`);
    return toPublicUser(updated);
  }

  async adminResetPassword(
    actor: import('../../domain/types').Actor,
    userId: string,
    ip?: string
  ): Promise<{ temporaryPassword: string }> {
    this.assertAdmin(actor);
    const target = await this.uow.repos.users.findById(userId);
    if (!target) throw notFound('User');

    const tempPassword = `Vdb!${randomToken(12)}9`;
    const passwordHash = await bcrypt.hash(tempPassword, this.env.BCRYPT_COST);

    await this.uow.transaction(async (repos) => {
      await repos.users.setPassword(userId, passwordHash);
      await repos.tokens.revokeAllForUser(userId, 'refresh');
      await this.audit.log(repos, {
        repoId: null,
        actorId: actor.userId,
        action: 'admin.user_reset_password',
        entityType: 'user',
        entityId: userId,
        ip,
      });
    });

    this.cache.delete(`user:${userId}`);
    return { temporaryPassword: tempPassword };
  }

  async adminListAuditLogs(
    actor: import('../../domain/types').Actor,
    query: { limit?: number; before?: number }
  ): Promise<import('../../domain/types').AuditEntry[]> {
    this.assertAdmin(actor);
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    return this.uow.repos.audit.listAll(limit, query.before);
  }

  verifyAccessToken(token: string): { userId: string; globalRole: GlobalRole } {
    try {
      const p = jwt.verify(token, this.env.JWT_ACCESS_SECRET, { algorithms: ['HS256'], issuer: this.env.JWT_ISSUER }) as jwt.JwtPayload;
      if (!p.sub) throw new Error('no subject');
      return { userId: p.sub, globalRole: p.role === 'admin' ? 'admin' : 'user' };
    } catch {
      throw unauthorized('INVALID_TOKEN', 'Invalid or expired access token');
    }
  }

  /** Short-lived cache so disabling an account takes effect within seconds without a DB hit per request. */
  async loadActiveUser(userId: string): Promise<User> {
    const cached = this.cache.get<User>(`user:${userId}`);
    if (cached) return cached;
    const user = await this.uow.repos.users.findById(userId);
    if (!user || user.disabled) throw unauthorized('INVALID_TOKEN', 'Account not available');
    this.cache.set(`user:${userId}`, user, 15_000);
    return user;
  }

  private async issue(user: User): Promise<AuthResult> {
    const accessToken = jwt.sign({ role: user.globalRole }, this.env.JWT_ACCESS_SECRET, {
      algorithm: 'HS256', subject: user.id, issuer: this.env.JWT_ISSUER, expiresIn: this.env.ACCESS_TOKEN_TTL_SECONDS,
    });
    const refreshToken = randomToken();
    await this.uow.repos.tokens.create({
      userId: user.id, tokenHash: sha256Hex(refreshToken), kind: 'refresh',
      expiresAt: new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_SECONDS * 1000),
    });
    return { accessToken, refreshToken, expiresIn: this.env.ACCESS_TOKEN_TTL_SECONDS, user: toPublicUser(user) };
  }
}
