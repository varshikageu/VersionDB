import { COLLECTION_RE, RECORD_ID_RE, RESERVED_KEYS } from '../config/constants';
import { badRequest } from '../shared/errors';
import type { JsonValue, SnapshotData } from './types';

export interface RecordChange { op: 'put' | 'delete'; collection: string; recordId: string; data?: JsonValue | null }

export function assertValidNames(collection: string, recordId?: string): void {
  if (!COLLECTION_RE.test(collection) || RESERVED_KEYS.has(collection)) throw badRequest('INVALID_COLLECTION', 'Invalid collection name');
  if (recordId !== undefined && (!RECORD_ID_RE.test(recordId) || RESERVED_KEYS.has(recordId))) throw badRequest('INVALID_RECORD_ID', 'Invalid record id');
}

/** Returns a new snapshot; the input (which may come from a cache) is never mutated. */
export function applyChanges(base: SnapshotData, changes: RecordChange[]): SnapshotData {
  const next: SnapshotData = {};
  for (const [c, records] of Object.entries(base)) next[c] = { ...records };
  for (const ch of changes) {
    if (ch.op === 'put') {
      (next[ch.collection] ??= {})[ch.recordId] = ch.data as JsonValue;
    } else {
      const coll = next[ch.collection];
      if (coll) {
        delete coll[ch.recordId];
        if (Object.keys(coll).length === 0) delete next[ch.collection];
      }
    }
  }
  return next;
}

export function countRecords(s: SnapshotData): number {
  let n = 0;
  for (const records of Object.values(s)) n += Object.keys(records).length;
  return n;
}

export function hasRecord(s: SnapshotData, collection: string, recordId: string): boolean {
  return Object.prototype.hasOwnProperty.call(s[collection] ?? {}, recordId);
}
