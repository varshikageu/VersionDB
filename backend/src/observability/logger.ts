export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface Logger {
  debug(msg: string, ctx?: Record<string, unknown>): void;
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

/** One JSON object per line on stdout/stderr. Never pass secrets, tokens or passwords in ctx. */
export function createLogger(level: LogLevel, bindings: Record<string, unknown> = {}): Logger {
  const write = (lvl: LogLevel, msg: string, ctx?: Record<string, unknown>) => {
    if (ORDER[lvl] < ORDER[level]) return;
    const line = JSON.stringify({ time: new Date().toISOString(), level: lvl, msg, ...bindings, ...ctx });
    (lvl === 'error' || lvl === 'warn' ? process.stderr : process.stdout).write(line + '\n');
  };
  return {
    debug: (m, c) => write('debug', m, c),
    info: (m, c) => write('info', m, c),
    warn: (m, c) => write('warn', m, c),
    error: (m, c) => write('error', m, c),
    child: (b) => createLogger(level, { ...bindings, ...b }),
  };
}

export function errorFields(e: unknown): Record<string, unknown> {
  if (e instanceof Error) return { errName: e.name, errMessage: e.message, stack: e.stack };
  return { errMessage: String(e) };
}
