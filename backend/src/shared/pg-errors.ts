interface PgLikeError { code?: string; constraint?: string }

export function isUniqueViolation(e: unknown, constraintContains?: string): boolean {
  const err = e as PgLikeError;
  if (err?.code !== '23505') return false;
  return constraintContains ? (err.constraint ?? '').includes(constraintContains) : true;
}
export const isPgCode = (e: unknown, code: string): boolean => (e as PgLikeError)?.code === code;
