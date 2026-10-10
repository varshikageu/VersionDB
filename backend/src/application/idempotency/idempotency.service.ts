import type { UnitOfWork } from '../../ports/repositories.port';

export class IdempotencyService {
  constructor(private uow: UnitOfWork, private ttlSeconds: number) {}
  begin(userId: string, key: string, method: string, path: string, requestHash: string) {
    return this.uow.repos.idempotency.begin({ userId, key, method, path, requestHash, ttlSeconds: this.ttlSeconds });
  }
  complete(userId: string, key: string, status: number, body: unknown) { return this.uow.repos.idempotency.complete(userId, key, status, body); }
  release(userId: string, key: string) { return this.uow.repos.idempotency.release(userId, key); }
  async purgeExpired(): Promise<void> {
    await this.uow.repos.idempotency.deleteExpired();
    await this.uow.repos.tokens.deleteExpired();
  }
}
