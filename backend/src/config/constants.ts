export const LIMITS = {
  maxRecordBytes: 256 * 1024,
  maxPendingChanges: 5000,
  maxJsonDepth: 32,
  maxCommitMessage: 2000,
  maxHistoryPage: 100,
  maxRecordPage: 200,
} as const;

// Names that end up as JSON object keys / URL segments.
export const COLLECTION_RE = /^[A-Za-z0-9_.-]{1,64}$/;
export const RECORD_ID_RE = /^[A-Za-z0-9_.:-]{1,128}$/;
export const BRANCH_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
export const REPO_NAME_RE = /^[A-Za-z0-9_.-]{1,64}$/;
export const USERNAME_RE = /^[A-Za-z0-9_.-]{3,32}$/;
export const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_.:-]{8,128}$/;
export const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export const DEFAULT_BRANCH = 'main';
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
