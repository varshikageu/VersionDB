import type { ZodTypeAny, z } from 'zod';
import { badRequest } from '../../shared/errors';

/** Parses untrusted input (body / query / params) or throws a 400 listing every problem. */
export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw badRequest('VALIDATION_ERROR', 'Request validation failed', result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  return result.data;
}
