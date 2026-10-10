import type { RequestHandler } from 'express';
import { tooManyRequests } from '../../shared/errors';

/** Fixed-window limiter per client IP (in-process; put a shared limiter at the proxy when running several instances). */
export function rateLimit(opts: { windowMs: number; max: number }): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
  }, opts.windowMs);
  timer.unref();
  return (req, res, next) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > opts.max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      throw tooManyRequests();
    }
    next();
  };
}
