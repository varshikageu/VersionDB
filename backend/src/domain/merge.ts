import type { CommitRepo } from '../ports/repositories.port';
import type { ConflictResolutionMode, JsonValue, SnapshotData } from './types';
import { jsonEqual } from '../shared/json';

export interface ConflictInfo {
  path: string; // RFC 6901: "/collection/recordId" or "/collection/recordId/field"
  collection: string;
  recordId: string;
  field?: string;
  baseExists: boolean;
  baseValue: JsonValue | null;
  oursExists: boolean;
  oursValue: JsonValue | null;
  theirsExists: boolean;
  theirsValue: JsonValue | null;
}

export interface ThreeWayDiffResult {
  hasConflicts: boolean;
  conflicts: ConflictInfo[];
  cleanMerged: SnapshotData;
}

/**
 * Traverses history to find the Lowest Common Ancestor (LCA) commit between two branch heads.
 * Uses BFS backward from target head to mark ancestors, then BFS from source head to find the first overlap.
 */
export async function findCommonAncestor(
  commitsRepo: CommitRepo,
  repoId: string,
  sourceHeadId: string | null,
  targetHeadId: string | null,
): Promise<string | null> {
  if (!sourceHeadId || !targetHeadId) return null;
  if (sourceHeadId === targetHeadId) return sourceHeadId;

  const targetAncestors = new Set<string>();
  const queueTarget: string[] = [targetHeadId];
  const visitedTarget = new Set<string>([targetHeadId]);

  while (queueTarget.length > 0) {
    const curId = queueTarget.shift()!;
    targetAncestors.add(curId);
    const commit = await commitsRepo.find(repoId, curId);
    if (commit) {
      for (const p of commit.parents) {
        if (!visitedTarget.has(p)) {
          visitedTarget.add(p);
          queueTarget.push(p);
        }
      }
    }
  }

  const queueSource: string[] = [sourceHeadId];
  const visitedSource = new Set<string>([sourceHeadId]);

  while (queueSource.length > 0) {
    const curId = queueSource.shift()!;
    if (targetAncestors.has(curId)) {
      return curId;
    }
    const commit = await commitsRepo.find(repoId, curId);
    if (commit) {
      for (const p of commit.parents) {
        if (!visitedSource.has(p)) {
          visitedSource.add(p);
          queueSource.push(p);
        }
      }
    }
  }

  return null;
}

/**
 * Performs a three-way diff across base, ours (target branch), and theirs (source branch) snapshots.
 *
 * For each record:
 * - If only source changed it, take source (theirs).
 * - If only target changed it, retain target (ours).
 * - If both changed it identically, take the shared result.
 * - If both changed it differently:
 *     - If both are objects (records), check field by field.
 *     - For each conflicting field (or entire record if not an object or addition/deletion collision),
 *       generate a structured ConflictInfo.
 */
export function threeWayDiff(
  base: SnapshotData,
  ours: SnapshotData,
  theirs: SnapshotData,
): ThreeWayDiffResult {
  const allCollections = new Set<string>([
    ...Object.keys(base),
    ...Object.keys(ours),
    ...Object.keys(theirs),
  ]);

  const conflicts: ConflictInfo[] = [];
  const cleanMerged: SnapshotData = {};

  for (const coll of allCollections) {
    const baseColl = base[coll] ?? {};
    const oursColl = ours[coll] ?? {};
    const theirsColl = theirs[coll] ?? {};

    const allRecordIds = new Set<string>([
      ...Object.keys(baseColl),
      ...Object.keys(oursColl),
      ...Object.keys(theirsColl),
    ]);

    for (const recId of allRecordIds) {
      const baseExists = Object.prototype.hasOwnProperty.call(baseColl, recId);
      const oursExists = Object.prototype.hasOwnProperty.call(oursColl, recId);
      const theirsExists = Object.prototype.hasOwnProperty.call(theirsColl, recId);

      const baseVal = baseExists ? baseColl[recId] : null;
      const oursVal = oursExists ? oursColl[recId] : null;
      const theirsVal = theirsExists ? theirsColl[recId] : null;

      const oursChanged = !baseExists ? oursExists : (!oursExists || !jsonEqual(baseVal, oursVal));
      const theirsChanged = !baseExists ? theirsExists : (!theirsExists || !jsonEqual(baseVal, theirsVal));

      if (!oursChanged && !theirsChanged) {
        // Neither side changed from base
        if (baseExists) {
          (cleanMerged[coll] ??= {})[recId] = baseVal!;
        }
      } else if (oursChanged && !theirsChanged) {
        // Only ours changed
        if (oursExists) {
          (cleanMerged[coll] ??= {})[recId] = oursVal!;
        }
      } else if (!oursChanged && theirsChanged) {
        // Only theirs changed
        if (theirsExists) {
          (cleanMerged[coll] ??= {})[recId] = theirsVal!;
        }
      } else {
        // Both changed: check if they changed identically
        if (oursExists && theirsExists && jsonEqual(oursVal, theirsVal)) {
          (cleanMerged[coll] ??= {})[recId] = oursVal!;
        } else if (!oursExists && !theirsExists) {
          // Both deleted the record: clean deletion
        } else {
          // Conflict: both modified differently, or one deleted while one updated
          if (
            oursExists &&
            theirsExists &&
            typeof oursVal === 'object' &&
            oursVal !== null &&
            !Array.isArray(oursVal) &&
            typeof theirsVal === 'object' &&
            theirsVal !== null &&
            !Array.isArray(theirsVal)
          ) {
            // Record-level objects: compare field by field
            const baseObj = (typeof baseVal === 'object' && baseVal !== null && !Array.isArray(baseVal))
              ? (baseVal as Record<string, JsonValue>)
              : {};
            const oursObj = oursVal as Record<string, JsonValue>;
            const theirsObj = theirsVal as Record<string, JsonValue>;

            const allFields = new Set<string>([
              ...Object.keys(baseObj),
              ...Object.keys(oursObj),
              ...Object.keys(theirsObj),
            ]);

            const mergedObj: Record<string, JsonValue> = {};
            let hasFieldConflict = false;

            for (const f of allFields) {
              const fBaseExists = Object.prototype.hasOwnProperty.call(baseObj, f);
              const fOursExists = Object.prototype.hasOwnProperty.call(oursObj, f);
              const fTheirsExists = Object.prototype.hasOwnProperty.call(theirsObj, f);

              const fBaseVal = fBaseExists ? baseObj[f] : null;
              const fOursVal = fOursExists ? oursObj[f] : null;
              const fTheirsVal = fTheirsExists ? theirsObj[f] : null;

              const fOursChanged = !fBaseExists ? fOursExists : (!fOursExists || !jsonEqual(fBaseVal, fOursVal));
              const fTheirsChanged = !fBaseExists ? fTheirsExists : (!fTheirsExists || !jsonEqual(fBaseVal, fTheirsVal));

              if (!fOursChanged && !fTheirsChanged) {
                if (fBaseExists) mergedObj[f] = fBaseVal!;
              } else if (fOursChanged && !fTheirsChanged) {
                if (fOursExists) mergedObj[f] = fOursVal!;
              } else if (!fOursChanged && fTheirsChanged) {
                if (fTheirsExists) mergedObj[f] = fTheirsVal!;
              } else {
                // Both changed this field
                if (fOursExists && fTheirsExists && jsonEqual(fOursVal, fTheirsVal)) {
                  mergedObj[f] = fOursVal!;
                } else {
                  hasFieldConflict = true;
                  conflicts.push({
                    path: `/${coll}/${recId}/${f}`,
                    collection: coll,
                    recordId: recId,
                    field: f,
                    baseExists: fBaseExists,
                    baseValue: fBaseVal,
                    oursExists: fOursExists,
                    oursValue: fOursVal,
                    theirsExists: fTheirsExists,
                    theirsValue: fTheirsVal,
                  });
                }
              }
            }

            if (!hasFieldConflict) {
              (cleanMerged[coll] ??= {})[recId] = mergedObj;
            }
          } else {
            // Whole record collision (e.g. one deleted, one updated; or non-object values)
            conflicts.push({
              path: `/${coll}/${recId}`,
              collection: coll,
              recordId: recId,
              baseExists,
              baseValue: baseVal,
              oursExists,
              oursValue: oursVal,
              theirsExists,
              theirsValue: theirsVal,
            });
          }
        }
      }
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    cleanMerged,
  };
}

export interface AppliedResolution {
  path: string;
  resolution: ConflictResolutionMode;
  resolvedExists: boolean;
  resolvedValue: JsonValue | null;
}

/**
 * Builds the final merged snapshot applying resolved conflict values on top of the three-way base.
 */
export function buildMergedSnapshot(
  base: SnapshotData,
  ours: SnapshotData,
  theirs: SnapshotData,
  resolutions: AppliedResolution[],
): SnapshotData {
  const { cleanMerged } = threeWayDiff(base, ours, theirs);
  const result: SnapshotData = {};

  // Deep copy cleanMerged
  for (const [coll, records] of Object.entries(cleanMerged)) {
    result[coll] = {};
    for (const [recId, val] of Object.entries(records)) {
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        result[coll][recId] = { ...(val as Record<string, JsonValue>) };
      } else {
        result[coll][recId] = val;
      }
    }
  }

  // Apply resolutions
  for (const r of resolutions) {
    const parts = r.path.split('/').filter(Boolean);
    if (parts.length === 2) {
      // Entire record: /collection/recordId
      const [coll, recId] = parts;
      if (!r.resolvedExists) {
        if (result[coll]) {
          delete result[coll][recId];
          if (Object.keys(result[coll]).length === 0) delete result[coll];
        }
      } else {
        (result[coll] ??= {})[recId] = r.resolvedValue as JsonValue;
      }
    } else if (parts.length >= 3) {
      // Field level: /collection/recordId/field
      const [coll, recId, field] = parts;
      if (r.resolvedExists) {
        const collObj = (result[coll] ??= {});
        const rec = collObj[recId];
        let recordObj: Record<string, JsonValue> = {};
        if (typeof rec === 'object' && rec !== null && !Array.isArray(rec)) {
          recordObj = rec as Record<string, JsonValue>;
        } else {
          // Fallback to ours or theirs record structure if cleanMerged skipped this conflicted record
          const oursRec = ours[coll]?.[recId];
          if (typeof oursRec === 'object' && oursRec !== null && !Array.isArray(oursRec)) {
            recordObj = { ...(oursRec as Record<string, JsonValue>) };
          }
          collObj[recId] = recordObj;
        }
        recordObj[field] = r.resolvedValue as JsonValue;
      } else {
        // Field was deleted
        const collObj = result[coll];
        if (collObj && collObj[recId] && typeof collObj[recId] === 'object' && !Array.isArray(collObj[recId])) {
          delete (collObj[recId] as Record<string, JsonValue>)[field];
        }
      }
    }
  }

  // Clean empty collections
  for (const coll of Object.keys(result)) {
    if (Object.keys(result[coll]).length === 0) {
      delete result[coll];
    }
  }

  return result;
}
