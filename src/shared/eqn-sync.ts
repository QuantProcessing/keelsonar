import { compareNewsItems, type NewsItem } from './eqn';

export const NEWS_LIMIT = 300;
/** Older-page backfill depth after a gap (100 items each, ~4 days of all channels). */
export const NEWS_GAP_PAGES = 5;

export interface HeadMergeInput {
  /** Items already held, newest first. */
  current: NewsItem[];
  /** Fresh head page (newest first). */
  head: NewsItem[];
  /** Cursor that ends the head page, `<published_ts>-<no>`; null = reached the end. */
  headCursor: string | null;
  /** Ids seen in the previous head page; used to detect retractions. */
  previousHeadIds: ReadonlySet<string>;
  /**
   * First successful poll after start/resume: merge silently, never alert, and
   * stamp arrival = publish time because we did not observe the real arrival.
   */
  baseline: boolean;
}

export interface HeadMergeResult {
  items: NewsItem[];
  /** Brand-new items to announce, newest first. Empty on baseline merges. */
  fresh: NewsItem[];
  revised: number;
  removed: number;
  /** Every head item was unknown: there may be more between head and `current`. */
  gap: boolean;
  headIds: Set<string>;
}

/** Fields that change when eqn.news revises an item (translation fixes, merges). */
function contentSignature(item: NewsItem): string {
  return JSON.stringify([
    item.title,
    item.body,
    item.original?.text,
    item.channels,
    item.coins,
    item.market,
    item.sourceUrl,
    item.telegramUrl,
  ]);
}

export function cursorTimestamp(cursor: string | null): number {
  if (!cursor) return 0;
  const value = Number(cursor.split('-')[0]);
  return Number.isFinite(value) ? value : 0;
}

/**
 * Applies one head poll to the held list, mirroring the official site:
 * unknown ids are new, known ids with different content are revisions, and ids
 * from the previous head that vanished while still inside the scanned window
 * were retracted (or merged into another story) upstream.
 */
export function mergeNewsHead(input: HeadMergeInput): HeadMergeResult {
  const byId = new Map(input.current.map((item) => [item.id, item]));
  const headIds = new Set(input.head.map((item) => item.id));
  const fresh: NewsItem[] = [];
  let revised = 0;

  for (const item of input.head) {
    const existing = byId.get(item.id);
    if (!existing) {
      const stored = input.baseline ? { ...item, receivedAt: item.publishedAt } : item;
      fresh.push(stored);
      byId.set(item.id, stored);
    } else if (contentSignature(existing) !== contentSignature(item)) {
      // Keep the original arrival time so latency stays honest after a revision.
      byId.set(item.id, { ...item, receivedAt: existing.receivedAt });
      revised += 1;
    }
  }

  // Items at exactly the cursor millisecond are ambiguous in order; never
  // treat them as retracted (same rule as the site: miss a retraction rather
  // than delete a live story).
  const floor = cursorTimestamp(input.headCursor);
  let removed = 0;
  if (!input.baseline) {
    for (const id of input.previousHeadIds) {
      if (headIds.has(id)) continue;
      const item = byId.get(id);
      if (!item) continue;
      const publishedMs = Date.parse(item.publishedAt);
      if (!floor || publishedMs > floor) {
        byId.delete(id);
        removed += 1;
      }
    }
  }

  // Also true on a resume baseline: the panel was closed long enough for the
  // whole head page to be new, so older pages must be backfilled.
  const gap =
    input.current.length > 0 &&
    input.head.length > 0 &&
    fresh.length === input.head.length &&
    input.headCursor != null;

  return {
    items: [...byId.values()].sort(compareNewsItems).slice(0, NEWS_LIMIT),
    fresh: input.baseline ? [] : fresh.sort(compareNewsItems),
    revised,
    removed,
    gap,
    headIds,
  };
}

/** Adds backfilled older items without announcing them. */
export function mergeNewsBackfill(current: NewsItem[], older: NewsItem[]): NewsItem[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of older) if (!byId.has(item.id)) byId.set(item.id, item);
  return [...byId.values()].sort(compareNewsItems).slice(0, NEWS_LIMIT);
}

export interface BackoffInput {
  failures: number;
  retryAfterMs?: number;
}

/** 1, 2, 4, 8, 10 s (capped), never shorter than the server's Retry-After. */
export function newsBackoffMs({ failures, retryAfterMs = 0 }: BackoffInput): number {
  const exponential = Math.min(10_000, 1_000 * 2 ** Math.min(Math.max(failures - 1, 0), 4));
  return Math.max(retryAfterMs, exponential);
}

/** Parses `Retry-After` in seconds or HTTP-date form. */
export function retryAfterMs(header: string | null, now = Date.now()): number {
  if (!header) return 0;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, date - now) : 0;
}
