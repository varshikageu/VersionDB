import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { Logger } from '../../observability/logger';
import { metrics } from '../../observability/metrics';

export function requestContext(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const incoming = req.header('x-request-id');
    req.id = incoming && /^[A-Za-z0-9_.-]{8,64}$/.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-Id', req.id);
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const seconds = Number(process.hrtime.bigint() - started) / 1e9;
      const route = req.route ? `${req.baseUrl}${req.route.path as string}` : 'unmatched';
      metrics.inc('http_requests_total', { method: req.method, route, status: String(res.statusCode) });
      metrics.observe('http_request_duration_seconds', { method: req.method, route }, seconds);
      if (req.path !== '/health') {
        logger.info('request', { requestId: req.id, method: req.method, route, status: res.statusCode, ms: Math.round(seconds * 1000), userId: req.auth?.userId });
      }
    });
    next();
  };
}
