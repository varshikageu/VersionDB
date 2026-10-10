import { createApp } from './app';
import { loadEnv } from './config/env';
import { buildContainer } from './container';
import { createLogger, errorFields } from './observability/logger';

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL, { service: 'versiondb-api' });
  const container = buildContainer(env, logger);
  await container.uow.ping();
  await container.storage.ping();

  const server = createApp(container).listen(env.PORT, () => logger.info('listening', { port: env.PORT, env: env.NODE_ENV }));
  const janitor = setInterval(() => {
    container.services.idempotency.purgeExpired().catch((e) => logger.warn('janitor failed', errorFields(e)));
  }, 10 * 60_000);
  janitor.unref();

  let stopping = false;
  const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info('shutting down', { signal });
    clearInterval(janitor);
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    server.close(() => { container.uow.close().finally(() => process.exit(0)); });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (e) => logger.error('unhandledRejection', errorFields(e)));
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
