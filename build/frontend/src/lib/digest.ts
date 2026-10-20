// Rules of the top ideas digest (US-12). The database function digest_top_ideas
// (migration 20261021090000) applies the same rules; this file is used by the mock data source.
import type { DigestEntry } from '../types';

export const DIGEST_DAYS = 31;
export const DIGEST_SIZE = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

function dayStart(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

/** The window of a simulated day (YYYY-MM-DD): 31 days before it, up to but not including the day itself. */
export function digestWindow(asOf: string): { from: string; lastDay: string } {
  const start = dayStart(asOf);
  return {
    from: new Date(start - DIGEST_DAYS * DAY_MS).toISOString().slice(0, 10),
    lastDay: new Date(start - DAY_MS).toISOString().slice(0, 10),
  };
}

export function inDigestWindow(iso: string, asOf: string): boolean {
  const time = Date.parse(iso);
  const end = dayStart(asOf);
  return time >= end - DIGEST_DAYS * DAY_MS && time < end;
}

/** The test email is sent when the first day of a month is simulated. */
export function isFirstOfMonth(day: string): boolean {
  return /^\d{4}-\d{2}-01$/.test(day);
}

export type DigestCandidate = Omit<DigestEntry, 'total'> & { created_at: string };

/** Best total first (ratings plus votes); ties: the older idea first. At most DIGEST_SIZE entries. */
export function rankDigest(candidates: DigestCandidate[]): DigestEntry[] {
  return candidates
    .map((c) => ({ ...c, total: c.rating_sum + c.vote_count }))
    .sort((a, b) => b.total - a.total || a.created_at.localeCompare(b.created_at) || a.idea_id - b.idea_id)
    .slice(0, DIGEST_SIZE)
    .map(({ created_at: _created, ...entry }) => entry);
}
