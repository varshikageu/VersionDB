import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Container } from './container';
import { errorHandler, notFoundHandler } from './http/middleware/error-handler';
import { requestContext } from './http/middleware/request-context';
import { createApiRouter } from './http/routes';
import { metrics } from './observability/metrics';

export function createApp(c: Container): Express {
  const app = express();
  app.disable('x-powered-by');
  if (c.env.TRUST_PROXY) app.set('trust proxy', 1);

  app.use(requestContext(c.logger));
  app.use(helmet());
  app.use(cors({
    origin: c.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'Idempotent-Replay'],
  }));
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => { res.json({ status: 'ok' }); });
  app.get('/ready', async (_req, res) => {
    try {
      await Promise.all([c.uow.ping(), c.storage.ping()]);
      res.json({ status: 'ready' });
    } catch (e) {
      c.logger.error('readiness check failed', { errMessage: (e as Error).message });
      res.status(503).json({ status: 'unavailable' });
    }
  });
  app.get('/metrics', (req, res) => {
    const token = c.env.METRICS_TOKEN;
    if (token ? req.header('authorization') !== `Bearer ${token}` : c.env.NODE_ENV === 'production') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
      return;
    }
    res.type('text/plain; version=0.0.4').send(metrics.render());
  });

  app.use('/api', createApiRouter(c));
  app.use(notFoundHandler);
  app.use(errorHandler(c.logger));
  return app;
}
