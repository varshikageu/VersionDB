export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** JSON with recursively sorted object keys: identical data always serialises identically (used for hashing/equality). */
export function stableStringify(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/** True when nesting depth is <= limit. Iterative, so hostile input cannot overflow the stack. */
export function withinDepth(value: unknown, limit: number): boolean {
  const stack: Array<[unknown, number]> = [[value, 1]];
  while (stack.length > 0) {
    const [v, depth] = stack.pop()!;
    if (typeof v !== 'object' || v === null) continue;
    if (depth > limit) return false;
    for (const child of Array.isArray(v) ? v : Object.values(v)) stack.push([child, depth + 1]);
  }
  return true;
}

export function jsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

export function jsonEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}
