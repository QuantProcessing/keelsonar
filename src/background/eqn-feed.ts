import {
  EMPTY_NEWS_CONNECTION,
  EQN_MCP_ENDPOINT,
  EQN_NEWS_ENDPOINT,
  EQN_NEWS_HEAD_URL,
  parseMcpNewsItem,
  parseNewsPage,
  type NewsConnectionState,
  type NewsItem,
  type NewsPage,
} from '../shared/eqn';
import {
  NEWS_GAP_PAGES,
  NEWS_LIMIT,
  mergeNewsBackfill,
  mergeNewsHead,
  newsBackoffMs,
  retryAfterMs,
} from '../shared/eqn-sync';

const POLL_INTERVAL_MS = 1_000;
const BACKFILL_PAGE = 100;
const REQUEST_TIMEOUT_MS = 8_000;
/** Consecutive primary failures before switching to the official MCP. */
const MCP_FALLBACK_AFTER = 3;
/** While on MCP, probe the primary API again this often. */
const PRIMARY_PROBE_MS = 60_000;
/** MCP allows ~5 req/s per IP and answers in ~1s; poll it gently. */
const MCP_POLL_MS = 3_000;
const PERSIST_DEBOUNCE_MS = 2_000;

type HeadSource = 'primary' | 'mcp';

export interface NewsFeedHost {
  storageKey: string;
  onItems: (items: NewsItem[]) => void;
  onConnection: (connection: NewsConnectionState) => void;
  onFresh: (items: NewsItem[]) => void;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfter: number,
  ) {
    super(status === 429 ? '方程式接口限流（429）' : `方程式接口返回 HTTP ${status}`);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fetchJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      // Public API: never attach cookies, and revalidate against the 1s CDN cache.
      credentials: 'omit',
      cache: 'no-cache',
      signal: controller.signal,
      headers: { Accept: 'application/json', ...init.headers },
    });
    if (!response.ok) {
      throw new HttpError(response.status, retryAfterMs(response.headers.get('Retry-After')));
    }
    return (await response.json()) as unknown;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('方程式接口请求超时');
    }
    if (error instanceof TypeError) throw new Error('无法连接方程式接口');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHeadPrimary(now: Date): Promise<NewsPage> {
  return parseNewsPage(await fetchJson(EQN_NEWS_HEAD_URL), now);
}

async function fetchOlderPrimary(before: string, now: Date): Promise<NewsPage> {
  const url = `${EQN_NEWS_ENDPOINT}?limit=${BACKFILL_PAGE}&before=${encodeURIComponent(before)}`;
  return parseNewsPage(await fetchJson(url), now, { historical: true });
}

async function fetchHeadMcp(now: Date): Promise<NewsPage> {
  const payload = await fetchJson(EQN_MCP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: now.getTime(),
      method: 'tools/call',
      params: { name: 'list_news', arguments: { channel: 'all', limit: 20 } },
    }),
  });
  const result =
    payload && typeof payload === 'object' && 'result' in payload
      ? (payload as {
          result?: {
            isError?: boolean;
            structuredContent?: { items?: unknown; next_cursor?: unknown };
          };
        }).result
      : undefined;
  const items = result?.structuredContent?.items;
  if (!result || result.isError || !Array.isArray(items)) {
    throw new Error('方程式 MCP 返回格式异常');
  }
  const cursor = result.structuredContent?.next_cursor;
  return {
    items: items
      .map((raw) => parseMcpNewsItem(raw, now))
      .filter((item): item is NewsItem => Boolean(item)),
    nextCursor: typeof cursor === 'string' ? cursor : null,
  };
}

function isStoredNewsItem(value: unknown): value is NewsItem {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    record.id.startsWith('eqn:') &&
    typeof record.no === 'number' &&
    typeof record.title === 'string' &&
    typeof record.publishedAt === 'string' &&
    typeof record.receivedAt === 'string' &&
    typeof record.group === 'string' &&
    typeof record.pageUrl === 'string' &&
    record.pageUrl.startsWith('https://eqn.news/') &&
    Array.isArray(record.coins) &&
    Array.isArray(record.channels)
  );
}

/**
 * Polls eqn.news while at least one extension view is open and the feature is
 * enabled. The head URL is identical to the official site's, so Cloudflare's
 * shared 1s cache answers it; closing every view stops all requests.
 */
export class EqnNewsFeed {
  private items: NewsItem[] = [];
  private connection: NewsConnectionState = EMPTY_NEWS_CONNECTION;
  private enabled = false;
  private viewers = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private polling = false;
  private generation = 0;
  private baseline = true;
  private headIds = new Set<string>();
  private lastHeadSignature = '';
  private failures = 0;
  private primaryFailures = 0;
  private usingMcp = false;
  private primaryProbeAt = 0;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly host: NewsFeedHost) {}

  async hydrate(): Promise<void> {
    const stored = await chrome.storage.session.get(this.host.storageKey);
    const raw = stored[this.host.storageKey];
    if (!Array.isArray(raw)) return;
    this.items = raw.filter(isStoredNewsItem).slice(0, NEWS_LIMIT);
    this.connection = { ...EMPTY_NEWS_CONNECTION, lastItemAt: this.items[0]?.publishedAt ?? null };
  }

  snapshot(): { news: NewsItem[]; newsConnection: NewsConnectionState } {
    return { news: this.items, newsConnection: this.connection };
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.restart();
  }

  /** Number of open extension views (side panel and/or monitor window). */
  setViewers(count: number): void {
    const wasActive = this.active;
    this.viewers = count;
    if (wasActive !== this.active) this.restart();
  }

  private get active(): boolean {
    return this.enabled && this.viewers > 0;
  }

  private restart(): void {
    // Bumping the generation makes any in-flight poll drop its result.
    this.generation += 1;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;

    if (!this.active) {
      this.setConnection({
        phase: 'offline',
        retryAt: null,
        failures: 0,
        message: this.enabled ? '侧栏关闭期间暂停同步，重新打开时补齐' : '方程式快讯未开启',
      });
      return;
    }

    // Resume: the next head merges silently and backfills any gap, so a long
    // pause doesn't replay dozens of alerts.
    this.baseline = true;
    this.failures = 0;
    this.primaryFailures = 0;
    this.setConnection({
      phase: this.items.length ? 'reconnecting' : 'connecting',
      retryAt: null,
      failures: 0,
      message: '正在同步方程式快讯…',
    });
    this.schedule(0);
  }

  private schedule(delay: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.poll(), Math.max(0, delay));
  }

  private async fetchHead(now: Date): Promise<{ page: NewsPage; source: HeadSource }> {
    const probePrimary = !this.usingMcp || now.getTime() >= this.primaryProbeAt;
    if (probePrimary) {
      try {
        const page = await fetchHeadPrimary(now);
        if (this.usingMcp) console.info('[KeelSonar] 方程式主接口已恢复');
        this.usingMcp = false;
        this.primaryFailures = 0;
        return { page, source: 'primary' };
      } catch (error) {
        this.primaryFailures += 1;
        this.primaryProbeAt = now.getTime() + PRIMARY_PROBE_MS;
        if (this.primaryFailures < MCP_FALLBACK_AFTER) throw error;
        console.warn('[KeelSonar] 方程式主接口连续失败，尝试官方 MCP', { error: errorMessage(error) });
      }
    }
    const page = await fetchHeadMcp(now);
    if (!this.usingMcp) console.warn('[KeelSonar] 方程式快讯改用官方 MCP 同步');
    this.usingMcp = true;
    return { page, source: 'mcp' };
  }

  private async poll(): Promise<void> {
    this.timer = null;
    if (!this.active || this.polling) return;
    this.polling = true;
    const generation = this.generation;
    const startedAt = Date.now();
    let delay = POLL_INTERVAL_MS;

    try {
      const now = new Date(startedAt);
      const { page, source } = await this.fetchHead(now);
      if (generation !== this.generation) return;
      await this.applyHead(page, now, source);
      if (generation !== this.generation) return;
      this.failures = 0;
      this.setConnection({
        phase: 'live',
        lastPollAt: now.toISOString(),
        failures: 0,
        retryAt: null,
        message: this.usingMcp ? '主接口暂不可用，正在通过官方 MCP 同步（行情字段较少）' : undefined,
      });
      if (this.usingMcp) delay = MCP_POLL_MS;
    } catch (error) {
      if (generation !== this.generation) return;
      this.failures += 1;
      delay = newsBackoffMs({
        failures: this.failures,
        retryAfterMs: error instanceof HttpError ? error.retryAfter : 0,
      });
      if (this.failures === 1) {
        console.warn('[KeelSonar] 方程式快讯同步失败', { error: errorMessage(error) });
      }
      // Like the official site: only surface trouble after 3 straight failures.
      const visible = this.failures >= MCP_FALLBACK_AFTER;
      this.setConnection({
        phase: visible ? (this.items.length ? 'reconnecting' : 'error') : this.connection.phase,
        failures: this.failures,
        retryAt: new Date(Date.now() + delay).toISOString(),
        message: visible
          ? `${errorMessage(error)}，${Math.ceil(delay / 1_000)} 秒后重试`
          : this.connection.message,
      });
    } finally {
      this.polling = false;
      if (generation === this.generation && this.active) {
        this.schedule(delay - (Date.now() - startedAt));
      }
    }
  }

  private async applyHead(page: NewsPage, now: Date, source: HeadSource): Promise<void> {
    // With a 1s CDN cache most polls return the same page; skip the merge.
    const signature = JSON.stringify(
      page.items.map((item) => [item.id, item.title, item.body, item.channels, item.coins]),
    );
    if (!this.baseline && signature === this.lastHeadSignature) return;
    this.lastHeadSignature = signature;

    const wasBaseline = this.baseline;
    const hadItems = this.items.length > 0;
    const result = mergeNewsHead({
      current: this.items,
      head: page.items,
      headCursor: page.nextCursor,
      previousHeadIds: this.headIds,
      baseline: this.baseline,
    });
    this.items = result.items;
    this.headIds = result.headIds;
    this.baseline = false;

    // MCP pages use a different cursor space for older items; only the primary
    // API can backfill. A gap left unfilled is acceptable (same as the site).
    // First load with nothing stored: fetch one 100-item page behind the head,
    // like the official site's first screen.
    const initialFill = wasBaseline && !hadItems;
    const backfilled = (result.gap || initialFill) && source === 'primary' && page.nextCursor;
    if (backfilled) {
      await this.backfill(page.nextCursor!, now, initialFill ? 1 : NEWS_GAP_PAGES);
    }

    if (result.removed) console.info('[KeelSonar] 方程式撤回快讯', { removed: result.removed });
    if (result.fresh.length) {
      this.setConnection({ lastItemAt: result.fresh[0].publishedAt });
      console.info('[KeelSonar] 方程式新快讯', {
        count: result.fresh.length,
        latest: result.fresh[0].no,
      });
    }
    if (result.fresh.length || result.revised || result.removed || backfilled || wasBaseline) {
      this.persist();
      this.host.onItems(this.items);
    }
    if (result.fresh.length) this.host.onFresh(result.fresh);
  }

  private async backfill(cursor: string, now: Date, maxPages: number): Promise<void> {
    const held = new Set(this.items.map((item) => item.id));
    let next: string | null = cursor;
    let older: NewsItem[] = [];
    for (let page = 0; page < maxPages && next; page += 1) {
      try {
        const result = await fetchOlderPrimary(next, now);
        older = older.concat(result.items);
        next = result.nextCursor;
        if (result.items.some((item) => held.has(item.id))) break;
      } catch (error) {
        console.warn('[KeelSonar] 方程式快讯补漏失败', { error: errorMessage(error) });
        break;
      }
    }
    if (!older.length) return;
    this.items = mergeNewsBackfill(this.items, older);
    console.info('[KeelSonar] 方程式快讯补漏完成', { fetched: older.length });
  }

  private setConnection(patch: Partial<NewsConnectionState>): void {
    this.connection = { ...this.connection, ...patch };
    this.host.onConnection(this.connection);
  }

  private persist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void chrome.storage.session.set({ [this.host.storageKey]: this.items });
    }, PERSIST_DEBOUNCE_MS);
  }
}
