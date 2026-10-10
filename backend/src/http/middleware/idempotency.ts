import type { RequestHandler } from 'express';
import { IDEMPOTENCY_KEY_RE } from '../../config/constants';
import type { IdempotencyService } from '../../application/idempotency/idempotency.service';
import { sha256Hex } from '../../shared/crypto';
import { badRequest, conflict, unprocessable } from '../../shared/errors';
import { stableStringify } from '../../shared/json';
import type { Logger } from '../../observability/logger';

/**
 * Optional `Idempotency-Key` header on mutating POSTs. A retry with the same key and body replays the stored 2xx response
 * instead of repeating the action; the same key with a different body is rejected. Failed requests release the key.
 * Must run after `authenticate`.
 */
export function idempotent(service: IdempotencyService, logger: Logger): RequestHandler {
  return async (req, res, next) => {
    const key = req.header('idempotency-key');
    if (!key) return next();
    if (!IDEMPOTENCY_KEY_RE.test(key)) throw badRequest('INVALID_IDEMPOTENCY_KEY', 'Idempotency-Key must be 8-128 characters of letters, digits, _ . : -');
    const userId = req.auth!.userId;
    const requestHash = sha256Hex(`${req.method} ${req.originalUrl} ${stableStringify(req.body ?? null)}`);
    const state = await service.begin(userId, key, req.method, req.originalUrl, requestHash);

    if (state.kind === 'replay') {
      res.setHeader('Idempotent-Replay', 'true');
      res.status(state.status).json(state.body);
      return;
    }
    if (state.kind === 'in_progress') throw conflict('IDEMPOTENCY_IN_PROGRESS', 'A request with this Idempotency-Key is still being processed');
    if (state.kind === 'mismatch') throw unprocessable('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used with a different request');

    const send = res.json.bind(res);
    res.json = (body: unknown) => {
      const finish = res.statusCode >= 200 && res.statusCode < 300 ? service.complete(userId, key, res.statusCode, body) : service.release(userId, key);
      finish.catch((e) => logger.error('idempotency bookkeeping failed', { requestId: req.id, errMessage: (e as Error).message }));
      return send(body);
    };
    next();
  };
}
