/**
 * Effective-dated versions. Versions are never edited: a new price or cost is
 * a new version effective from a month; a wrong entry is voided (with a reason)
 * and replaced. The version for a month is the latest non-voided one effective
 * on or before that month, so adding a current price never changes history.
 */
import { addMonths, type Month } from "./month";

interface Versioned {
  readonly effectiveFrom: Month;
  readonly voided: boolean;
}

/** Non-voided versions, oldest first. */
export function activeVersions<T extends Versioned>(versions: readonly T[]): T[] {
  return versions.filter((v) => !v.voided).sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : a.effectiveFrom > b.effectiveFrom ? 1 : 0));
}

/** The version in effect for `month`, or null when none had started yet. */
export function versionFor<T extends Versioned>(versions: readonly T[], month: Month): T | null {
  let found: T | null = null;
  for (const v of activeVersions(versions)) {
    if (v.effectiveFrom <= month) found = v;
    else break;
  }
  return found;
}

export interface TimelineEntry<T> {
  readonly version: T;
  readonly from: Month;
  /** Last month this version applies; null = still current. */
  readonly to: Month | null;
}

/** Effective periods derived from consecutive versions (newest first, for display). */
export function timeline<T extends Versioned>(versions: readonly T[]): TimelineEntry<T>[] {
  const active = activeVersions(versions);
  return active
    .map((version, i) => ({
      version,
      from: version.effectiveFrom,
      to: i + 1 < active.length ? addMonths(active[i + 1].effectiveFrom, -1) : null,
    }))
    .reverse();
}

/** Versions for one owner (service or cost item). */
export function versionsOf<T extends Versioned, K extends keyof T>(versions: readonly T[], key: K, id: T[K]): T[] {
  return versions.filter((v) => v[key] === id);
}
