import { describe, expect, it } from 'vitest';
import type { NewsItem } from './eqn';
import {
  NEWS_LIMIT,
  cursorTimestamp,
  mergeNewsBackfill,
  mergeNewsHead,
  newsBackoffMs,
  retryAfterMs,
} from './eqn-sync';

const BASE = Date.parse('2026-11-17T03:00:00.000Z');

function item(no: number, minutesAgo: number, patch: Partial<NewsItem> = {}): NewsItem {
  const publishedAt = new Date(BASE - minutesAgo * 60_000).toISOString();
  return {
    id: `eqn:${no}`,
    no,
    publishedAt,
    receivedAt: publishedAt,
    channel: 'main',
    channels: ['main'],
    group: 'headline',
    source: 'Test',
    title: `story ${no}`,
    coins: [],
    pageUrl: `https://eqn.news/main/${no}`,
    ...patch,
  };
}

function cursorFor(news: NewsItem): string {
  return `${Date.parse(news.publishedAt)}-${news.no}`;
}

describe('mergeNewsHead', () => {
  it('merges the first poll silently', () => {
    const head = [item(3, 1), item(2, 2)];
    const result = mergeNewsHead({
      current: [],
      head,
      headCursor: cursorFor(head[1]),
      previousHeadIds: new Set(),
      baseline: true,
    });
    expect(result.items.map((news) => news.no)).toEqual([3, 2]);
    expect(result.fresh).toEqual([]);
    expect(result.gap).toBe(false);
  });

  it('stamps baseline items as arriving when published, so latency is not inflated', () => {
    const late = { ...item(3, 90), receivedAt: new Date(BASE).toISOString() };
    const result = mergeNewsHead({
      current: [item(1, 200)],
      head: [late],
      headCursor: cursorFor(late),
      previousHeadIds: new Set(),
      baseline: true,
    });
    expect(result.items[0].receivedAt).toBe(result.items[0].publishedAt);
    // Panel was closed long enough that the whole head is new: backfill needed.
    expect(result.gap).toBe(true);
    expect(result.fresh).toEqual([]);
  });

  it('reports new ids newest first and keeps the list sorted', () => {
    const current = [item(2, 2), item(1, 3)];
    const head = [item(4, 0), item(3, 1), item(2, 2)];
    const result = mergeNewsHead({
      current,
      head,
      headCursor: cursorFor(head[2]),
      previousHeadIds: new Set(['eqn:2', 'eqn:1']),
      baseline: false,
    });
    expect(result.fresh.map((news) => news.no)).toEqual([4, 3]);
    expect(result.items.map((news) => news.no)).toEqual([4, 3, 2, 1]);
  });

  it('applies revisions but keeps the original arrival time', () => {
    const original = { ...item(5, 1), receivedAt: '2026-11-17T02:59:01.000Z' };
    const revised = item(5, 1, { title: 'corrected translation' });
    const result = mergeNewsHead({
      current: [original],
      head: [revised],
      headCursor: null,
      previousHeadIds: new Set(['eqn:5']),
      baseline: false,
    });
    expect(result.revised).toBe(1);
    expect(result.fresh).toEqual([]);
    expect(result.items[0].title).toBe('corrected translation');
    expect(result.items[0].receivedAt).toBe('2026-11-17T02:59:01.000Z');
  });

  it('removes items retracted from inside the scanned window only', () => {
    const current = [item(9, 1), item(8, 2), item(7, 10)];
    const head = [item(9, 1), item(6, 5)];
    const result = mergeNewsHead({
      current,
      head,
      // Window ends at 5 minutes ago: #8 (2 min) vanished inside it, #7 (10 min) is outside.
      headCursor: cursorFor(head[1]),
      previousHeadIds: new Set(['eqn:9', 'eqn:8', 'eqn:7']),
      baseline: false,
    });
    expect(result.removed).toBe(1);
    expect(result.items.map((news) => news.no)).toEqual([9, 6, 7]);
  });

  it('keeps items at exactly the cursor millisecond', () => {
    const edge = item(10, 4);
    const result = mergeNewsHead({
      current: [item(11, 1), edge],
      head: [item(11, 1)],
      headCursor: cursorFor(edge),
      previousHeadIds: new Set(['eqn:11', 'eqn:10']),
      baseline: false,
    });
    expect(result.removed).toBe(0);
  });

  it('flags a gap when every head item is unknown', () => {
    const head = [item(30, 0), item(29, 1)];
    const result = mergeNewsHead({
      current: [item(10, 60)],
      head,
      headCursor: cursorFor(head[1]),
      previousHeadIds: new Set(['eqn:10']),
      baseline: false,
    });
    expect(result.gap).toBe(true);
  });

  it('caps the retained list', () => {
    const current = Array.from({ length: NEWS_LIMIT }, (_, index) => item(index + 1, 1_000 - index));
    const result = mergeNewsHead({
      current,
      head: [item(10_000, 0)],
      headCursor: null,
      previousHeadIds: new Set(),
      baseline: false,
    });
    expect(result.items).toHaveLength(NEWS_LIMIT);
    expect(result.items[0].no).toBe(10_000);
  });
});

describe('mergeNewsBackfill', () => {
  it('adds older items without replacing held ones', () => {
    const held = item(5, 1, { title: 'held' });
    const result = mergeNewsBackfill([held], [item(5, 1, { title: 'older copy' }), item(4, 9)]);
    expect(result.map((news) => news.title)).toEqual(['held', 'story 4']);
  });
});

describe('backoff helpers', () => {
  it('backs off 1, 2, 4, 8, 10 seconds and honours Retry-After', () => {
    expect([1, 2, 3, 4, 5, 9].map((failures) => newsBackoffMs({ failures }))).toEqual([
      1_000, 2_000, 4_000, 8_000, 10_000, 10_000,
    ]);
    expect(newsBackoffMs({ failures: 1, retryAfterMs: 15_000 })).toBe(15_000);
  });

  it('parses Retry-After seconds and dates', () => {
    expect(retryAfterMs('2')).toBe(2_000);
    expect(retryAfterMs(new Date(BASE + 3_000).toUTCString(), BASE)).toBe(3_000);
    expect(retryAfterMs(null)).toBe(0);
    expect(retryAfterMs('soon')).toBe(0);
  });

  it('reads cursor timestamps', () => {
    expect(cursorTimestamp('1794880812758-15366')).toBe(1794880812758);
    expect(cursorTimestamp(null)).toBe(0);
  });
});
