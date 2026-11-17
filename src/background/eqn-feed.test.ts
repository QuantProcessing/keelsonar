import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NewsConnectionState, NewsItem } from '../shared/eqn';
import { EqnNewsFeed } from './eqn-feed';

const BASE = Date.parse('2026-11-17T03:00:00.000Z');

function raw(no: number, secondsAgo: number, title = `story ${no}`) {
  return {
    id: String(no),
    no,
    path: `/main/${no}`,
    published_ts: BASE - secondsAgo * 1_000,
    channels: ['main'],
    kind: 'news',
    source: { display: 'Test', display_zh: '测试' },
    i18n: { zh: title },
    source_language: 'zh',
    coins: [],
    url: null,
    data: {},
    deliveries: [],
  };
}

function page(items: ReturnType<typeof raw>[], cursor: string | null = null) {
  return { items, next_cursor: cursor };
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function mcpResponse(items: Array<Record<string, unknown>>) {
  return jsonResponse({
    jsonrpc: '2.0',
    id: 1,
    result: { isError: false, structuredContent: { items, next_cursor: null } },
  });
}

describe('EqnNewsFeed', () => {
  let session: Record<string, unknown>;
  let fetchMock: ReturnType<typeof vi.fn>;
  let items: NewsItem[];
  let connection: NewsConnectionState | null;
  let fresh: NewsItem[][];

  function createFeed() {
    return new EqnNewsFeed({
      storageKey: 'eqnNewsItems',
      onItems: (next) => {
        items = next;
      },
      onConnection: (next) => {
        connection = next;
      },
      onFresh: (next) => fresh.push(next),
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE);
    session = {};
    items = [];
    connection = null;
    fresh = [];
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('chrome', {
      storage: {
        session: {
          get: async (key: string) => ({ [key]: session[key] }),
          set: async (value: Record<string, unknown>) => Object.assign(session, value),
        },
      },
    });
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not poll until enabled and a view is open', async () => {
    const feed = createFeed();
    feed.setEnabled(true);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(connection?.phase).toBe('offline');

    fetchMock.mockResolvedValue(jsonResponse(page([raw(2, 5), raw(1, 30)])));
    feed.setViewers(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://eqn.news/api/v1/news?limit=20');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'omit' });
    expect(items.map((item) => item.no)).toEqual([2, 1]);
    expect(fresh).toEqual([]);
    expect(connection?.phase).toBe('live');

    feed.setViewers(0);
    const calls = fetchMock.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock.mock.calls.length).toBe(calls);
    expect(connection?.phase).toBe('offline');
  });

  it('loads one older page behind the head on the very first open', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(page([raw(9, 1), raw(8, 2)], `${BASE - 2_000}-8`)))
      .mockResolvedValueOnce(jsonResponse(page([raw(7, 60), raw(6, 120)], `${BASE - 120_000}-6`)))
      .mockResolvedValue(jsonResponse(page([raw(9, 1), raw(8, 2)], `${BASE - 2_000}-8`)));
    const feed = createFeed();
    feed.setEnabled(true);
    feed.setViewers(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock.mock.calls[1][0]).toContain('limit=100&before=');
    expect(items.map((item) => item.no)).toEqual([9, 8, 7, 6]);
    expect(fresh).toEqual([]);
    // Only one page on first load, not the 5-page gap fill.
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('before='))).toHaveLength(1);
  });

  it('announces new items, applies retractions and persists', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(page([raw(2, 5), raw(1, 30)])))
      .mockResolvedValueOnce(jsonResponse(page([raw(3, 0), raw(1, 30)], `${BASE - 60_000}-0`)))
      .mockResolvedValue(jsonResponse(page([raw(3, 0), raw(1, 30)], `${BASE - 60_000}-0`)));
    const feed = createFeed();
    feed.setEnabled(true);
    feed.setViewers(1);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(fresh).toHaveLength(1);
    expect(fresh[0].map((item) => item.no)).toEqual([3]);
    // #2 vanished from the scanned window: retracted upstream.
    expect(items.map((item) => item.no)).toEqual([3, 1]);

    await vi.advanceTimersByTimeAsync(2_500);
    expect((session.eqnNewsItems as NewsItem[]).map((item) => item.no)).toEqual([3, 1]);
  });

  it('backfills older pages when the whole head is new after a resume', async () => {
    session.eqnNewsItems = [];
    fetchMock.mockResolvedValueOnce(jsonResponse(page([raw(10, 600)], null)));
    const feed = createFeed();
    feed.setEnabled(true);
    feed.setViewers(1);
    await vi.advanceTimersByTimeAsync(0);
    feed.setViewers(0);

    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(page([raw(40, 0), raw(39, 10)], `${BASE - 10_000}-39`)))
      .mockResolvedValueOnce(jsonResponse(page([raw(38, 20), raw(10, 600)], `${BASE - 600_000}-10`)))
      .mockResolvedValue(jsonResponse(page([raw(40, 0), raw(39, 10)], `${BASE - 10_000}-39`)));
    feed.setViewers(1);
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchMock.mock.calls[1][0]).toBe(
      `https://eqn.news/api/v1/news?limit=100&before=${encodeURIComponent(`${BASE - 10_000}-39`)}`,
    );
    expect(items.map((item) => item.no)).toEqual([40, 39, 38, 10]);
    // Resume baseline: no alert burst for items that arrived while closed.
    expect(fresh).toEqual([]);
  });

  it('backs off on 429 and switches to MCP after repeated failures', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.startsWith('https://api.eqn.news/public/mcp')) {
        return mcpResponse([
          {
            no: 7,
            time: new Date(BASE).toISOString(),
            channels: ['binance'],
            source: 'Binance EN',
            zh: '币安将上线 XYZ',
            coins: ['XYZ'],
            url: 'https://eqn.news/monitor/7',
          },
        ]);
      }
      return jsonResponse({ error: 'slow down' }, 429, { 'Retry-After': '2' });
    });
    const feed = createFeed();
    feed.setEnabled(true);
    feed.setViewers(1);

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(connection?.failures).toBe(1);
    // Retry-After (2s) wins over the 1s backoff.
    await vi.advanceTimersByTimeAsync(1_500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(600);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(2_100);
    const mcpCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/public/mcp'));
    expect(mcpCalls.length).toBeGreaterThan(0);
    expect(items[0]).toMatchObject({ no: 7, group: 'notice', coins: ['XYZ'] });
    expect(connection?.phase).toBe('live');
    expect(connection?.message).toContain('MCP');
  });

  it('surfaces errors only after three consecutive failures', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const feed = createFeed();
    feed.setEnabled(true);
    feed.setViewers(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(connection?.phase).toBe('connecting');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(connection?.phase).toBe('connecting');
    await vi.advanceTimersByTimeAsync(2_000);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(connection?.phase).toBe('error');
    expect(connection?.message).toContain('无法连接方程式接口');
  });

  it('restores persisted items on hydrate without inventing fresh alerts', async () => {
    session.eqnNewsItems = [
      {
        id: 'eqn:5',
        no: 5,
        publishedAt: new Date(BASE - 5_000).toISOString(),
        receivedAt: new Date(BASE - 4_000).toISOString(),
        channel: 'main',
        channels: ['main'],
        group: 'headline',
        source: 'Test',
        title: 'held',
        coins: [],
        pageUrl: 'https://eqn.news/main/5',
      },
      { id: 'evil', pageUrl: 'javascript:alert(1)' },
    ];
    const feed = createFeed();
    await feed.hydrate();
    expect(feed.snapshot().news.map((item) => item.no)).toEqual([5]);
  });
});
