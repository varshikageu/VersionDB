import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Env } from '../../config/env';
import type { GlobalRole, PublicUser, User } from '../../domain/types';
import type { CachePort } from '../../ports/cache.port';
import { toPublicUser, type UnitOfWork } from '../../ports/repositories.port';
import { randomToken, sha256Hex } from '../../shared/crypto';
import { conflict, unauthorized } from '../../shared/errors';
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
      if (isUniqueViolation(e)) throw conflict('ACCOUNT_EXISTS', 'An account with that email or username already exists');
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
