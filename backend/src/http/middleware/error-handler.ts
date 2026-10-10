import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../../shared/errors';
import { isPgCode } from '../../shared/pg-errors';
import { errorFields, type Logger } from '../../observability/logger';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
};

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err, req, res, _next) => {
    const requestId = req.id;
    if (err instanceof AppError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details, requestId } });
      return;
    }
    const e = err as { type?: string; status?: number };
    if (e.type === 'entity.parse.failed') { res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON', requestId } }); return; }
    if (e.type === 'entity.too.large') { res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large', requestId } }); return; }
    // Database-level guards (protected branch, immutable rows, self-review) surface as insufficient_privilege.
    if (isPgCode(err, '42501')) { res.status(403).json({ error: { code: 'FORBIDDEN', message: 'This operation is not permitted', requestId } }); return; }
    if (isPgCode(err, '23505')) { res.status(409).json({ error: { code: 'CONFLICT', message: 'A conflicting record already exists', requestId } }); return; }
    logger.error('unhandled error', { requestId, method: req.method, path: req.path, ...errorFields(err) });
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong', requestId } });
  };
}
