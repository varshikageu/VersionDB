import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

/** Minimal .env loader (KEY=VALUE per line). Real environment variables always win. */
function loadDotEnv(file: string): void {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ISSUER: z.string().min(1).default('versiondb'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(3600).default(7 * 24 * 3600),
  BCRYPT_COST: z.coerce.number().int().min(10).max(15).default(12),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  DATA_DIR: z.string().default('./data'),
  DEFAULT_REQUIRED_APPROVALS: z.coerce.number().int().min(0).max(10).default(1),
  TRUST_PROXY: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  METRICS_TOKEN: z.string().min(16).optional(),
  IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().min(60).default(86400),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (source === process.env) loadDotEnv(path.resolve(process.cwd(), '.env'));
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production' && /change-me/i.test(env.JWT_ACCESS_SECRET)) {
    throw new Error('Refusing to start in production with the example JWT_ACCESS_SECRET');
  }
  return env;
}
