import type { NewAuditEntry, Repositories } from '../../ports/repositories.port';

/** Cross-cutting audit trail: every state-changing use case logs through here (inside its own transaction when it has one). */
export class AuditService {
  async log(repos: Repositories, entry: NewAuditEntry): Promise<void> {
    await repos.audit.append(entry);
  }
}
