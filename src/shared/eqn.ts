import type { ConnectionPhase } from './protocol';

export const EQN_ORIGIN = 'https://eqn.news';
/** Same URL as the official site head poll, so Cloudflare's 1s shared cache absorbs it. */
export const EQN_NEWS_HEAD_URL = `${EQN_ORIGIN}/api/v1/news?limit=20`;
export const EQN_NEWS_ENDPOINT = `${EQN_ORIGIN}/api/v1/news`;
export const EQN_MCP_ENDPOINT = 'https://api.eqn.news/public/mcp';

export type NewsGroup = 'headline' | 'notice' | 'move' | 'tradfi' | 'social';
export type NewsDirection = 'up' | 'down';
export type NewsMarketSignal = 'price' | 'oi' | 'major' | 'stock';

export interface NewsChannelMeta {
  label: string;
  group: NewsGroup;
}

export const NEWS_CHANNELS: Record<string, NewsChannelMeta> = {
  main: { label: '方程式新闻', group: 'headline' },
  binance: { label: '币安公告', group: 'notice' },
  korea: { label: '韩所监控', group: 'notice' },
  tier2: { label: '二线上新', group: 'notice' },
  tier3: { label: '三线上新', group: 'notice' },
  alpha: { label: '币安 Alpha', group: 'notice' },
  earn: { label: '理财提醒', group: 'notice' },
  pricechange: { label: '价格异动', group: 'move' },
  oi: { label: 'OI 异动', group: 'move' },
  major: { label: '大幅波动', group: 'move' },
  tradfi: { label: '方程式财经', group: 'tradfi' },
  tfmoves: { label: '美股行情', group: 'tradfi' },
  cz: { label: 'CZ & 何一', group: 'social' },
  hl: { label: 'Hyperliquid', group: 'social' },
};

export const NEWS_GROUPS: NewsGroup[] = ['headline', 'notice', 'move', 'tradfi', 'social'];

export const NEWS_GROUP_META: Record<NewsGroup, { label: string; channels: string }> = {
  headline: { label: '头条', channels: '方程式新闻' },
  notice: { label: '公告', channels: '币安 · 韩所 · 二三线 · Alpha · 理财' },
  move: { label: '异动', channels: '价格 · OI · 大幅波动' },
  tradfi: { label: '财经', channels: '方程式财经 · 美股行情' },
  social: { label: '动态', channels: 'CZ & 何一 · Hyperliquid' },
};

export interface NewsMarketRef {
  signal: NewsMarketSignal;
  symbol: string;
  base?: string;
  name?: string;
  venue?: string;
  direction: NewsDirection;
  changePct: number;
  windowLabel: string;
  stance?: string;
  priceUsd?: number;
  refPriceUsd?: number;
  change1hPct?: number;
  change24hPct?: number;
  fundingRatePct?: number;
  oiUsd?: number;
  oiChangePct?: number;
  volumeUsd?: number;
  indexLabel?: string;
  indexPct?: number;
}

export interface NewsOriginal {
  language: string;
  text: string;
}

export interface NewsItem {
  id: string;
  no: number;
  publishedAt: string;
  receivedAt: string;
  channel: string;
  channels: string[];
  group: NewsGroup;
  kind?: string;
  source: string;
  title: string;
  body?: string;
  original?: NewsOriginal;
  coins: string[];
  market?: NewsMarketRef;
  sourceUrl?: string;
  pageUrl: string;
  telegramUrl?: string;
}

export interface NewsPage {
  items: NewsItem[];
  nextCursor: string | null;
}

export interface NewsConnectionState {
  phase: ConnectionPhase;
  lastPollAt: string | null;
  lastItemAt: string | null;
  failures: number;
  retryAt: string | null;
  message?: string;
}

export const EMPTY_NEWS_CONNECTION: NewsConnectionState = {
  phase: 'offline',
  lastPollAt: null,
  lastItemAt: null,
  failures: 0,
  retryAt: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function nonnegative(value: unknown): number | undefined {
  const amount = numberValue(value);
  return amount != null && amount >= 0 ? amount : undefined;
}

function httpsUrl(value: unknown): string | undefined {
  const raw = stringValue(value);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function newsChannelMeta(channel: string): NewsChannelMeta {
  return NEWS_CHANNELS[channel] ?? { label: channel, group: 'social' };
}

function primaryChannel(channels: string[]): string {
  if (channels.includes('main')) return 'main';
  return channels.find((channel) => channel in NEWS_CHANNELS) ?? channels[0] ?? 'main';
}

function cleanLine(line: string): string {
  return line
    .replace(/https?:\/\/t\.co\/\S+/g, '')
    .replace(/^\s*\*+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitText(text: string): { title: string; body?: string } {
  const lines = text.split(/\n+/).map(cleanLine).filter(Boolean);
  const [title = '', ...rest] = lines;
  return { title, body: rest.length ? rest.join('\n') : undefined };
}

function durationLabel(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} 秒`;
  if (seconds < 3_600) return `${Math.round(seconds / 60)} 分钟`;
  return `${Math.round(seconds / 3_600)} 小时`;
}

const EXCHANGE_LABELS: Record<string, string> = {
  binance: 'Binance',
  bybit: 'Bybit',
  okx: 'OKX',
  bitget: 'Bitget',
  hyperliquid: 'Hyperliquid',
  upbit: 'Upbit',
  bithumb: 'Bithumb',
};

function venueLabel(exchange: unknown, market: unknown): string | undefined {
  const name = stringValue(exchange);
  const label = name ? (EXCHANGE_LABELS[name.toLowerCase()] ?? name) : undefined;
  const marketLabel = market === 'perp' ? '永续' : market === 'spot' ? '现货' : undefined;
  return [label, marketLabel].filter(Boolean).join(' ') || undefined;
}

function oiStance(priceDirection: NewsDirection, oiChangePct: number | undefined): string | undefined {
  if (oiChangePct == null) return undefined;
  if (oiChangePct >= 0) return priceDirection === 'up' ? '多头进场' : '空头进场';
  return priceDirection === 'up' ? '空头回补' : '多头离场';
}

function marketValue(data: Record<string, unknown>): NewsMarketRef | undefined {
  const signal = stringValue(data.signal);
  const symbol = stringValue(data.symbol);
  const changePct = numberValue(data.pct) ?? numberValue(data.price_pct);
  if (!signal || !symbol || changePct == null) return undefined;

  const direction: NewsDirection =
    data.direction === 'down' || (data.direction !== 'up' && changePct < 0) ? 'down' : 'up';
  const context = isRecord(data.context) ? data.context : {};
  const windowSeconds = nonnegative(data.window);
  const common = {
    symbol,
    base: stringValue(data.base),
    direction,
    changePct,
    venue: venueLabel(data.exchange, data.market),
    priceUsd: nonnegative(data.price),
    change1hPct: numberValue(context.pct_1h),
    change24hPct: numberValue(context.pct_24h) ?? numberValue(data.price_24h_pct),
    fundingRatePct: numberValue(data.funding_rate_pct),
    oiUsd: nonnegative(data.oi_usd),
    volumeUsd: nonnegative(data.vol_24h_usd),
  };

  if (signal === 'price_move') {
    return {
      ...common,
      signal: 'price',
      windowLabel: windowSeconds != null ? `${durationLabel(windowSeconds)}内` : '短时',
    };
  }

  if (signal === 'price_oi_move') {
    const oiChangePct = numberValue(data.oi_pct);
    return {
      ...common,
      signal: 'oi',
      windowLabel: windowSeconds != null ? `${durationLabel(windowSeconds)}内` : '短时',
      oiChangePct,
      stance: oiStance(direction, oiChangePct),
    };
  }

  if (signal === 'price_major_move') {
    const windowText = windowSeconds != null ? durationLabel(windowSeconds) : '近期';
    return {
      ...common,
      signal: 'major',
      windowLabel:
        data.kind === 'drawdown'
          ? `较 ${windowText}${direction === 'up' ? '低点' : '高点'}`
          : `${windowText}内`,
    };
  }

  if (signal === 'us_big_move') {
    const isIndex = data.group === 'index';
    return {
      ...common,
      signal: 'stock',
      base: stringValue(data.base) ?? symbol,
      name: stringValue(data.name),
      venue: '美股',
      windowLabel: data.rule === 'day' ? '较昨收' : windowSeconds != null ? `${durationLabel(windowSeconds)}内` : '盘中',
      refPriceUsd: nonnegative(data.ref_price),
      volumeUsd: nonnegative(data.usd_volume),
      indexLabel: isIndex ? undefined : 'QQQ',
      indexPct: isIndex ? undefined : numberValue(data.index_pct),
    };
  }

  return undefined;
}

// Generic words the upstream coin matcher has tagged as tickers in real
// exchange notices ("Spot", "Dual Investment", "Lite Loan", "now supports").
const NOISY_COIN_MATCHES = new Set(['SPOT', 'DUAL', 'LITE', 'NOW']);

function coinsValue(value: unknown, exclude?: string): string[] {
  if (!Array.isArray(value)) return [];
  const coins = value.flatMap((coin): string[] => {
    const symbol = typeof coin === 'string' ? coin : isRecord(coin) ? coin.symbol : undefined;
    const normalized = stringValue(symbol)?.toUpperCase();
    return normalized &&
      /^[A-Z0-9]{1,15}$/.test(normalized) &&
      normalized !== exclude &&
      !NOISY_COIN_MATCHES.has(normalized)
      ? [normalized]
      : [];
  });
  return [...new Set(coins)].slice(0, 6);
}

function telegramUrlValue(deliveries: unknown, channel: string): string | undefined {
  if (!Array.isArray(deliveries)) return undefined;
  const telegram = deliveries.filter(
    (item): item is Record<string, unknown> => isRecord(item) && item.platform === 'telegram',
  );
  const preferred = telegram.find((item) => item.channel === channel) ?? telegram[0];
  return httpsUrl(preferred?.url);
}

function pageUrlValue(path: unknown, no: number): string {
  const raw = stringValue(path);
  return raw && /^\/(?:main|tradfi|monitor)\/\d+$/.test(raw)
    ? `${EQN_ORIGIN}${raw}`
    : `${EQN_ORIGIN}/${no}`;
}

/** Parses one `NewsOut` item from `GET https://eqn.news/api/v1/news`. */
export function parseNewsItem(
  input: unknown,
  now = new Date(),
  options: { historical?: boolean } = {},
): NewsItem | null {
  if (!isRecord(input)) return null;
  const no = numberValue(input.no);
  const publishedTs = numberValue(input.published_ts);
  if (no == null || !Number.isSafeInteger(no) || no <= 0 || publishedTs == null) return null;

  const channels = Array.isArray(input.channels)
    ? input.channels.filter((item): item is string => typeof item === 'string' && Boolean(item))
    : [];
  const channel = primaryChannel(channels);
  const i18n = isRecord(input.i18n) ? input.i18n : {};
  const zh = stringValue(i18n.zh);
  const en = stringValue(i18n.en);
  const sourceLanguage = stringValue(input.source_language) ?? 'en';
  const originalText = sourceLanguage !== 'zh' ? stringValue(i18n[sourceLanguage]) : undefined;
  const text = zh ?? en ?? originalText;
  if (!text) return null;

  const data = isRecord(input.data) ? input.data : {};
  const market = marketValue(data);
  const { title, body } = splitText(text);
  if (!title) return null;
  const originalTitle = originalText ? splitText(originalText).title : undefined;
  const source = isRecord(input.source) ? input.source : {};
  const publishedAt = new Date(publishedTs).toISOString();

  return {
    id: `eqn:${no}`,
    no,
    publishedAt,
    receivedAt: options.historical ? publishedAt : now.toISOString(),
    channel,
    channels,
    group: newsChannelMeta(channel).group,
    kind: stringValue(input.kind),
    source: stringValue(source.display_zh) ?? stringValue(source.display) ?? '方程式新闻',
    title,
    body,
    original:
      originalTitle && zh && originalTitle !== title
        ? { language: sourceLanguage.toUpperCase(), text: originalTitle }
        : undefined,
    coins: coinsValue(input.coins, market?.base?.toUpperCase()),
    market,
    sourceUrl: httpsUrl(input.url),
    pageUrl: pageUrlValue(input.path, no),
    telegramUrl: telegramUrlValue(input.deliveries, channel),
  };
}

export function compareNewsItems(left: NewsItem, right: NewsItem): number {
  const byTime = Date.parse(right.publishedAt) - Date.parse(left.publishedAt);
  return byTime || right.no - left.no;
}

export function parseNewsPage(
  input: unknown,
  now = new Date(),
  options: { historical?: boolean } = {},
): NewsPage {
  if (!isRecord(input) || !Array.isArray(input.items)) return { items: [], nextCursor: null };
  const byId = new Map<string, NewsItem>();
  for (const raw of input.items) {
    const item = parseNewsItem(raw, now, options);
    if (item) byId.set(item.id, item);
  }
  return {
    items: [...byId.values()].sort(compareNewsItems),
    nextCursor: stringValue(input.next_cursor) ?? null,
  };
}

/** Fallback parser for the MCP `list_news` item shape (fewer fields, no market data). */
export function parseMcpNewsItem(input: unknown, now = new Date()): NewsItem | null {
  if (!isRecord(input)) return null;
  const no = numberValue(input.no);
  const time = stringValue(input.time);
  const publishedMs = time ? Date.parse(time) : Number.NaN;
  if (no == null || !Number.isSafeInteger(no) || no <= 0 || !Number.isFinite(publishedMs)) {
    return null;
  }
  const text = stringValue(input.zh) ?? stringValue(input.en);
  if (!text) return null;
  const { title, body } = splitText(text);
  if (!title) return null;
  const channels = Array.isArray(input.channels)
    ? input.channels.filter((item): item is string => typeof item === 'string' && Boolean(item))
    : [];
  const channel = primaryChannel(channels);
  const pageUrl = httpsUrl(input.url);
  return {
    id: `eqn:${no}`,
    no,
    publishedAt: new Date(publishedMs).toISOString(),
    receivedAt: now.toISOString(),
    channel,
    channels,
    group: newsChannelMeta(channel).group,
    source: stringValue(input.source) ?? '方程式新闻',
    title,
    body,
    coins: coinsValue(input.coins),
    sourceUrl: httpsUrl(input.source_url),
    pageUrl: pageUrl?.startsWith(`${EQN_ORIGIN}/`) ? pageUrl : `${EQN_ORIGIN}/${no}`,
  };
}

export function normalizeNewsGroups(value: unknown, fallback: NewsGroup[]): NewsGroup[] {
  if (!Array.isArray(value)) return fallback;
  return NEWS_GROUPS.filter((group) => value.includes(group));
}
