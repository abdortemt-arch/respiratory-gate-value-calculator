/**
 * Calendar months ("YYYY-MM"). Operating periods, price versions and cost
 * versions are all month-grained: a version takes effect on the 1st of a month.
 */

export type Month = string;

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function isMonth(value: unknown): value is Month {
  return typeof value === "string" && MONTH.test(value);
}

function parts(m: Month): [number, number] {
  const match = MONTH.exec(m);
  if (!match) throw new Error(`Invalid month: ${m}`);
  return [Number(match[1]), Number(match[2])];
}

/** "2026-01-15" or "2026-01-01T…" -> "2026-01" */
export function monthOf(date: string): Month {
  const m = date.slice(0, 7);
  if (!isMonth(m)) throw new Error(`Invalid date: ${date}`);
  return m;
}

/** "2026-01" -> "2026-01-01" (the date stored in the database). */
export function firstDay(m: Month): string {
  parts(m);
  return `${m}-01`;
}

export function lastDay(m: Month): string {
  return `${m}-${String(daysInMonth(m)).padStart(2, "0")}`;
}

export function addMonths(m: Month, n: number): Month {
  const [y, mo] = parts(m);
  const index = y * 12 + (mo - 1) + n;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function daysInMonth(m: Month): number {
  const [y, mo] = parts(m);
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

export function monthLabel(m: Month, style: "long" | "short" = "long"): string {
  const [y, mo] = parts(m);
  const name = NAMES[mo - 1];
  return `${style === "short" ? name.slice(0, 3) : name} ${y}`;
}

/** Inclusive range of months. */
export function monthRange(from: Month, to: Month): Month[] {
  const out: Month[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m);
  return out;
}

export function yearOf(m: Month): number {
  return parts(m)[0];
}

export function quarterOf(m: Month): { year: number; quarter: 1 | 2 | 3 | 4 } {
  const [y, mo] = parts(m);
  return { year: y, quarter: (Math.floor((mo - 1) / 3) + 1) as 1 | 2 | 3 | 4 };
}

export function quarterMonths(year: number, quarter: 1 | 2 | 3 | 4): Month[] {
  const start = `${year}-${String((quarter - 1) * 3 + 1).padStart(2, "0")}`;
  return monthRange(start, addMonths(start, 2));
}

export function yearMonths(year: number): Month[] {
  return monthRange(`${year}-01`, `${year}-12`);
}

/** January of the same year up to and including `m`. */
export function ytdMonths(m: Month): Month[] {
  return monthRange(`${yearOf(m)}-01`, m);
}

export function currentMonth(now: Date = new Date()): Month {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}
