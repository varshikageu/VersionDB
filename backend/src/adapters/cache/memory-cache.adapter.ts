import type { CachePort } from '../../ports/cache.port';

/** Small in-process LRU + TTL cache. Cached values must be treated as immutable by callers. */
export class MemoryCache implements CachePort {
  private store = new Map<string, { value: unknown; expiresAt: number }>();
  constructor(private maxEntries = 256, private defaultTtlMs = 60_000) {}

  get<T>(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt < Date.now()) { this.store.delete(key); return undefined; }
    this.store.delete(key);       // refresh recency
    this.store.set(key, hit);
    return hit.value as T;
  }
  set<T>(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    this.store.delete(key);
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value as string;
      this.store.delete(oldest);
    }
  }
  delete(key: string): void { this.store.delete(key); }
}
