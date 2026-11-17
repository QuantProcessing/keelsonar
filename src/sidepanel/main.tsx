import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/fira-code';
import '@fontsource-variable/noto-sans-sc';
import {
  AppWindow,
  ArrowLeft,
  BadgeCheck,
  Bell,
  BellOff,
  Bot,
  Check,
  Clipboard,
  Coins,
  Columns2,
  ExternalLink,
  Monitor,
  Moon,
  Network,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Repeat2,
  Rows3,
  Reply,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  UserMinus,
  UserPlus,
  UsersRound,
  Zap,
} from 'lucide-react';
import {
  DEFAULT_CONFIG,
  EMPTY_CONNECTION,
  STORAGE_KEYS,
  WIND_WEBSOCKET_URL,
  type BackgroundPush,
  type ConnectionPhase,
  type ConsensusRef,
  type FeedView,
  type GrokChatContext,
  type MergedSource,
  type RuntimeSnapshot,
  type SessionState,
  type StreamConfig,
  type ThemePreference,
  type TokenRef,
  type TradeTarget,
  type WindEvent,
  type WindSource,
} from '../shared/protocol';
import { sub2ApiPermissionPattern } from '../shared/grok';
import { operationPresentation } from '../shared/operation';
import { GrokWorkspace } from '../grok/GrokWorkspace';
import {
  EMPTY_NEWS_CONNECTION,
  newsChannelMeta,
  parseNewsItem,
  type NewsConnectionState,
  type NewsGroup,
  type NewsItem,
} from '../shared/eqn';
import { EQN_SAMPLE_ITEMS } from '../shared/eqn.fixture';
import { clockTime, formatPriceUsd, formatUsd, relativeTime } from './format';
import { SoundSettingsSection } from './SoundSettings';
import { BrandMark } from './BrandMark';
import { playAlertSound } from './sound';
import {
  alertTierForEvent,
  alertTierForNews,
  createAlertGate,
  highestTier,
  type SoundTier,
} from '../shared/alert';
import {
  ColumnHeader,
  MergedFilters,
  ViewBar,
  NewsCard,
  NewsEmpty,
  NewsFilters,
  NewsSettingsSection,
  SPLIT_MIN_WIDTH,
  feedLayout,
  newsGrokContext,
  type FeedTab,
  type NewsFilter,
  type ViewChoice,
} from './NewsFeed';
import './styles.css';

const isExtension = typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
const now = Date.now();

const DEMO_EVENTS: WindEvent[] = [
  {
    id: 'demo-x-reply-1',
    sequence: 1844,
    source: 'x',
    action: 'reply',
    occurredAt: new Date(now - 2_200).toISOString(),
    receivedAt: new Date(now - 1_980).toISOString(),
    author: 'Elon Musk',
    authorHandle: 'elonmusk',
    title: 'When is Diablo V? The D4 engine is out of date.',
    importance: 'high',
    reference: {
      kind: 'reply',
      author: 'wudijo',
      authorHandle: 'wudijo',
      text: "BLIZZCON MONTH! I'll be there, streaming on-site and meeting everyone. What are you most excited to see?",
      translation: '暴雪嘉年华月！我会在现场直播，也会和大家见面。',
      media: [],
    },
    sourceUrl: 'https://x.com/elonmusk/status/1',
  },
  {
    id: 'demo-x-follow-2',
    sequence: 1843,
    source: 'x',
    action: 'follow',
    occurredAt: new Date(now - 3_200).toISOString(),
    receivedAt: new Date(now - 2_910).toISOString(),
    author: 'Ansem',
    authorHandle: 'blknoiz06',
    title: '关注账号',
    importance: 'high',
    target: {
      name: 'Market Structure',
      handle: 'marketstructure',
      bio: 'On-chain research, market structure and liquidity analysis.',
      bioTranslation: '链上研究、市场结构与流动性分析。',
      followers: 128_400,
      following: 742,
      verified: true,
      profileUrl: 'https://x.com/marketstructure',
    },
    sourceUrl: 'https://x.com/marketstructure',
  },
  {
    id: 'demo-consensus-1',
    sequence: 1842,
    source: 'fomo',
    action: 'fomo_consensus',
    occurredAt: new Date(now - 4_200).toISOString(),
    receivedAt: new Date(now - 3_940).toISOString(),
    author: '共识',
    authorHandle: 'consensus',
    title: '共识买入 $CINEMA',
    importance: 'high',
    token: {
      chain: 'robinhood',
      address: '0x9936403a9cc72cf306063e3496ea387428a3aecd',
      symbol: 'CINEMA',
    },
    consensus: {
      people: 8,
      windowMinutes: 30,
      totalUsd: 79_100,
      participants: [
        { label: 'smol_intern', usd: 20_000, platform: 'fomo' },
        { label: 'edwin999', usd: 13_600, platform: 'fomo' },
        { label: 'kyle', usd: 11_000, platform: 'pumpfun' },
        { label: 'catsuki', usd: 11_000, platform: 'fomo' },
        { label: 'NotARandomUser', usd: 6_428, platform: 'fomo' },
        { label: 'Small_DDD', usd: 5_983, platform: 'pumpfun' },
        { label: 'jeetdegods', usd: 5_686, platform: 'fomo' },
        { label: 'mantis_213', usd: 5_500, platform: 'fomo' },
      ],
    },
  },
  {
    id: 'demo-tg-2',
    sequence: 1841,
    source: 'telegram',
    action: 'tweet',
    occurredAt: new Date(now - 34_000).toISOString(),
    receivedAt: new Date(now - 33_480).toISOString(),
    author: 'Smart Money Radar',
    authorHandle: 'smartradar',
    title: '频道发布新合约地址',
    body: '首条消息已编辑一次，合约地址保持不变。',
    importance: 'high',
    token: {
      chain: 'base',
      address: '0x8bf3a40f026bb3f4f7d5f3d2demo',
      symbol: 'RADAR',
    },
  },
  {
    id: 'demo-pump-3',
    sequence: 1840,
    source: 'pump',
    action: 'pump_buy',
    occurredAt: new Date(now - 92_000).toISOString(),
    receivedAt: new Date(now - 91_820).toISOString(),
    author: 'Pump Trader',
    authorHandle: 'pumptrader',
    title: '$PULSE',
    body: '再次买入，成交分布于 2 个区块。',
    amountUsd: 5_000,
    trade: {
      tokenAmount: 1_200_000,
      priceUsd: 0.00418,
      marketCapUsd: 4_180_000,
      cashSymbol: 'USDC',
      venue: 'pumpswap',
    },
    importance: 'urgent',
    position: { sequence: 'add' },
    token: {
      chain: 'sol',
      address: '3Wd7M9rJvA4Kp2nQdL6sY8demo',
      symbol: 'PULSE',
      quote: {
        marketCapUsd: 4_420_000,
        volume24hUsd: 9_800_000,
        priceUsd: 0.00442,
      },
    },
  },
  {
    id: 'demo-news-4',
    sequence: 1839,
    source: 'news',
    action: 'binance_new',
    occurredAt: new Date(now - 185_000).toISOString(),
    receivedAt: new Date(now - 184_400).toISOString(),
    author: '听风快讯',
    authorHandle: 'windnews',
    title: '交易所发布资产维护公告',
    body: '该消息没有可直接交易的合约地址。',
    importance: 'normal',
  },
];

/**
 * Local preview only: real eqn.news items re-stamped so the newest sits a few
 * seconds before page load while keeping the original spacing between items.
 */
function demoNews(): NewsItem[] {
  const parsed = EQN_SAMPLE_ITEMS.map((raw) => parseNewsItem(raw, new Date(now), { historical: true }))
    .filter((item): item is NewsItem => Boolean(item));
  const latest = Math.max(...parsed.map((item) => Date.parse(item.publishedAt)));
  const offsets = [6_000, 41_000, 3 * 60_000, 9 * 60_000, 22 * 60_000, 48 * 60_000];
  return parsed
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
    .map((item, index) => {
      const shifted =
        index < offsets.length
          ? now - offsets[index]
          : now - offsets[offsets.length - 1] - (latest - Date.parse(item.publishedAt)) / 6;
      const publishedAt = new Date(shifted).toISOString();
      return {
        ...item,
        publishedAt,
        receivedAt: new Date(shifted + 820 + index * 37).toISOString(),
      };
    });
}

const DEMO_NEWS_CONNECTION: NewsConnectionState = {
  phase: 'live',
  lastPollAt: new Date(now - 600).toISOString(),
  lastItemAt: new Date(now - 6_000).toISOString(),
  failures: 0,
  retryAt: null,
};

type MergedEntry =
  | { kind: 'signal'; at: number; event: WindEvent }
  | { kind: 'news'; at: number; item: NewsItem };

const MERGED_LIMIT = 240;
const NEWS_GROUP_KEYS: NewsGroup[] = ['headline', 'notice', 'move', 'tradfi', 'social'];

const PAGE_PARAMS = new URLSearchParams(window.location.search);
const IS_MONITOR_WINDOW = PAGE_PARAMS.get('window') === '1';

const DEMO_SNAPSHOT: RuntimeSnapshot = {
  config: {
    ...DEFAULT_CONFIG,
    feedView: PAGE_PARAMS.get('layout') === 'merged' ? 'merged' : DEFAULT_CONFIG.feedView,
  },
  news: demoNews(),
  newsConnection: DEMO_NEWS_CONNECTION,
  connection: {
    phase: 'live',
    session: 'authenticated',
    mode: 'user',
    latencyMs: 42,
    lastEventAt: DEMO_EVENTS[0].receivedAt,
    retryAt: null,
    receivedMessages: 18,
    eventFrames: 6,
    parsedEvents: 6,
    droppedEvents: 0,
    lastMessageType: 'event',
    lastCloseCode: null,
    message: '本地预览',
  },
  events: DEMO_EVENTS,
};

type SourceFilter = 'all' | WindSource;
type PanelView = 'stream' | 'settings' | 'grok';
type CommandResponse<T> = { ok: true; result: T } | { ok: false; error: string };

const SOURCE_META: Record<WindSource, { label: string; short: string }> = {
  x: { label: 'X', short: 'X' },
  telegram: { label: 'Telegram', short: 'TG' },
  fomo: { label: 'Fomo', short: 'FO' },
  pump: { label: 'Pump', short: 'PF' },
  chain: { label: '链上', short: '链' },
  news: { label: '快讯', short: '讯' },
  other: { label: '其他', short: '·' },
};

const FILTERS: Array<{ value: SourceFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'x', label: 'X' },
  { value: 'telegram', label: 'TG' },
  { value: 'fomo', label: 'Fomo' },
  { value: 'pump', label: 'Pump' },
  { value: 'chain', label: '链上' },
];

const LAYOUT_OPTIONS = [
  { value: 'split', label: '分栏并排', Icon: Columns2 },
  { value: 'merged', label: '合并为一列', Icon: Rows3 },
] satisfies Array<{ value: FeedView; label: string; Icon: typeof Columns2 }>;

function useViewportWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const sync = () => setWidth(window.innerWidth);
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);
  return width;
}

const THEME_OPTIONS = [
  { value: 'system', label: '跟随系统', Icon: Monitor },
  { value: 'light', label: '浅色', Icon: Sun },
  { value: 'dark', label: '深色', Icon: Moon },
] satisfies Array<{ value: ThemePreference; label: string; Icon: typeof Monitor }>;

function useResolvedTheme(preference: ThemePreference): 'light' | 'dark' {
  const [systemDark, setSystemDark] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setSystemDark(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const resolved = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  return resolved;
}

const TRADE_TARGET_META: Record<TradeTarget, { label: string }> = {
  debot: { label: 'deBot' },
  gmgn: { label: 'GMGN' },
};

function phaseLabel(phase: ConnectionPhase): string {
  switch (phase) {
    case 'live':
      return 'LIVE';
    case 'connecting':
      return '连接中';
    case 'reconnecting':
      return '重连中';
    case 'offline':
      return '已暂停';
    case 'error':
      return '连接错误';
    default:
      return '连接中';
  }
}

function sessionLabel(session: SessionState, mode: string | null): string {
  if (session === 'authenticated' || mode === 'user') return '登录态已确认';
  if (session === 'guest') return 'WebSocket 游客模式';
  if (session === 'checking') return '检查登录态';
  return '登录态未知';
}

function compactAddress(value: string): string {
  if (value.length <= 18) return value;
  return `${value.slice(0, 9)}…${value.slice(-6)}`;
}

function formatTradeUsd(value: number): string {
  const amount = Math.max(0, value);
  if (amount >= 1_000) return formatUsd(amount);
  if (amount >= 100) return `$${Math.round(amount).toLocaleString('en-US')}`;
  const decimals = amount >= 1 ? 2 : 4;
  return `$${amount.toFixed(decimals).replace(/\.?0+$/, '')}`;
}

function formatCompactNumber(value: number): string {
  const amount = Math.max(0, value);
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  if (amount >= 10) return Math.round(amount).toLocaleString('en-US');
  return amount.toFixed(2).replace(/\.?0+$/, '');
}

function isTradeEvent(event: WindEvent): boolean {
  return /^(?:fomo|pump)_(?:buy|sell)$/.test(event.action ?? '');
}

function chainPresentation(chain: string): { label: string; tone: string } {
  const normalized = chain.trim().toLowerCase();
  if (normalized === 'sol' || normalized === 'solana') {
    return { label: 'Solana', tone: 'solana' };
  }
  if (normalized === 'bsc' || normalized === 'bnb' || normalized === 'binance') {
    return { label: 'BNB Chain', tone: 'bnb' };
  }
  if (normalized === 'eth' || normalized === 'ethereum') {
    return { label: 'Ethereum', tone: 'ethereum' };
  }
  if (normalized === 'robinhood' || normalized === 'rbh') {
    return { label: 'Robinhood', tone: 'robinhood' };
  }
  if (normalized === 'base') return { label: 'Base', tone: 'base' };
  return { label: chain || '未知链', tone: 'other' };
}

function eventLag(event: WindEvent): string {
  const value = Date.parse(event.receivedAt) - Date.parse(event.occurredAt);
  if (!Number.isFinite(value) || value < 0) return '延迟未知';
  return value >= 1_000 ? `上游 ${(value / 1_000).toFixed(1)}s` : `上游 ${value}ms`;
}

async function sendCommand<T>(message: unknown): Promise<T> {
  if (!isExtension) throw new Error('本地预览不会调用扩展后台');
  const response = (await chrome.runtime.sendMessage(message)) as CommandResponse<T>;
  if (!response.ok) throw new Error(response.error);
  return response.result;
}

const alertGate = createAlertGate();

/** Plays the most important allowed tier for a batch, respecting the 1.5s gate. */
function playAlertFor(tiers: SoundTier[], config: StreamConfig): void {
  if (!config.soundEnabled) return;
  const tier = highestTier(tiers.filter((value) => config.soundTiers.includes(value)));
  if (tier && alertGate(tier)) playAlertSound(tier);
}

function SourceMark({ source }: { source: WindSource }) {
  return (
    <span className={`source-mark source-${source}`} title={SOURCE_META[source].label}>
      {SOURCE_META[source].short}
    </span>
  );
}

function EventAvatar({ event }: { event: WindEvent }) {
  return (
    <div className={`event-avatar source-${event.source}`}>
      <SourceMark source={event.source} />
      {event.avatarUrl && (
        <img
          src={event.avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={(image) => {
            image.currentTarget.hidden = true;
          }}
        />
      )}
    </div>
  );
}

function ConsensusContent({ consensus, title }: { consensus: ConsensusRef; title: string }) {
  const people = consensus.people || consensus.participants.length;
  return (
    <section className="consensus-block" aria-label="共识买入明细">
      <div className="consensus-title">
        <UsersRound size={17} aria-hidden="true" />
        <h2>{title}</h2>
      </div>
      <dl className="consensus-metrics">
        <div>
          <dt>参与</dt>
          <dd>{people || '—'}<small>人</small></dd>
        </div>
        <div>
          <dt>时间窗</dt>
          <dd>{consensus.windowMinutes ?? '—'}<small>分钟</small></dd>
        </div>
        <div>
          <dt>净买入</dt>
          <dd>{consensus.totalUsd != null ? `≈${formatUsd(consensus.totalUsd)}` : '—'}</dd>
        </div>
      </dl>
      {consensus.participants.length > 0 && (
        <div className="consensus-detail">
          <div className="consensus-detail-head">
            <span>参与明细</span>
            <span>净买入</span>
          </div>
          <ul className="consensus-participants">
            {consensus.participants.map((participant, index) => {
              const platform = participant.platform?.toLowerCase() ?? '';
              const platformLabel = platform === 'pumpfun' ? 'PF' : platform === 'fomo' ? 'FO' : '·';
              return (
                <li key={`${participant.label}-${index}`}>
                  <span
                    className={`participant-platform platform-${platform || 'other'}`}
                    title={platform === 'pumpfun' ? 'Pump.fun' : platform === 'fomo' ? 'Fomo' : '未知平台'}
                  >
                    {platformLabel}
                  </span>
                  <span className="participant-name" title={participant.label}>{participant.label}</span>
                  <strong>{participant.usd != null ? `≈${formatUsd(participant.usd)}` : '—'}</strong>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function TradeContent({ event }: { event: WindEvent }) {
  const symbol = event.token?.symbol;
  const metrics = [
    event.trade?.priceUsd != null
      ? { label: '成交价', value: formatPriceUsd(event.trade.priceUsd) }
      : null,
    event.trade?.marketCapUsd != null
      ? { label: '成交市值', value: formatUsd(event.trade.marketCapUsd) }
      : null,
    event.trade?.tokenAmount != null
      ? { label: '数量', value: formatCompactNumber(event.trade.tokenAmount) }
      : null,
  ].filter((metric): metric is { label: string; value: string } => metric != null);
  const details = [
    event.trade?.cashSymbol ? `结算 ${event.trade.cashSymbol}` : null,
    event.trade?.route,
    event.trade?.venue,
  ].filter((detail): detail is string => Boolean(detail));

  return (
    <section className="trade-summary" aria-label="成交摘要">
      <h2 className="trade-headline">
        {event.amountUsd != null && (
          <span className="trade-amount">≈{formatTradeUsd(event.amountUsd)}</span>
        )}
        {event.amountUsd != null && symbol && <span className="trade-separator">·</span>}
        {symbol && <span className="trade-symbol">${symbol}</span>}
        {event.amountUsd == null && !symbol && event.title}
      </h2>
      {metrics.length > 0 && (
        <dl className="trade-metrics">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <dt>{metric.label}</dt>
              <dd>{metric.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {details.length > 0 && <p className="trade-route">{details.join(' · ')}</p>}
      {event.body && <p className="trade-note">{event.body}</p>}
    </section>
  );
}

function ReferenceContent({ event }: { event: WindEvent }) {
  const reference = event.reference;
  if (!reference) return null;
  const handle = reference.authorHandle?.replace(/^@+/, '');
  const author = reference.author || (handle ? `@${handle}` : '原贴作者');
  const relation =
    reference.kind === 'reply'
      ? '回复的原贴'
      : reference.kind === 'repost'
        ? '转发的原贴'
        : reference.kind === 'quote'
          ? '引用的原贴'
          : '相关原贴';
  const RelationIcon = reference.kind === 'reply' ? Reply : Repeat2;

  return (
    <section className="reference-block" aria-label={relation}>
      <div className="reference-head">
        <span className="reference-avatar" aria-hidden="true">
          {author.slice(0, 1).toUpperCase()}
          {reference.avatarUrl && (
            <img
              src={reference.avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              onError={(image) => {
                image.currentTarget.hidden = true;
              }}
            />
          )}
        </span>
        <span className="reference-identity">
          <span className="reference-relation">
            <RelationIcon size={12} aria-hidden="true" />
            {relation}
          </span>
          <span className="reference-author-line">
            <strong>{author}</strong>
            {handle && <small>@{handle}</small>}
          </span>
        </span>
      </div>
      {reference.text && <blockquote>{reference.text}</blockquote>}
      {reference.translation && reference.translation !== reference.text && (
        <p>{reference.translation}</p>
      )}
      {reference.media.length > 0 && (
        <div className={`reference-media media-count-${Math.min(reference.media.length, 2)}`}>
          {reference.media.slice(0, 4).map((media, index) => {
            const previewUrl = media.posterUrl ??
              (media.type?.toLowerCase().includes('video') ? undefined : media.url);
            return previewUrl ? (
              <img
                key={`${media.url}-${index}`}
                src={previewUrl}
                alt="原贴媒体"
                referrerPolicy="no-referrer"
                onError={(image) => {
                  image.currentTarget.hidden = true;
                }}
              />
            ) : (
              <span className="reference-video" key={`${media.url}-${index}`}>
                原贴视频
              </span>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TargetContent({ event }: { event: WindEvent }) {
  const target = event.target;
  if (!target) return null;
  const handle = target.handle?.replace(/^@+/, '');
  const name = target.name || (handle ? `@${handle}` : '目标账号');
  const isUnfollow = event.action === 'unfollow';
  const ActionIcon = isUnfollow ? UserMinus : UserPlus;

  return (
    <section className="target-content" aria-label={`${isUnfollow ? '取消关注' : '关注'} ${name}`}>
      <h2 className="target-action-title">
        <ActionIcon size={17} aria-hidden="true" />
        {isUnfollow ? '取消关注' : '关注了'}
        <span>{handle ? `@${handle}` : name}</span>
      </h2>
      <div className="target-profile">
        {target.bannerUrl && (
          <img className="target-banner" src={target.bannerUrl} alt="" referrerPolicy="no-referrer" />
        )}
        <div className="target-profile-head">
          <span className="target-avatar" aria-hidden="true">
            {name.slice(0, 1).toUpperCase()}
            {target.avatarUrl && (
              <img
                src={target.avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                onError={(image) => {
                  image.currentTarget.hidden = true;
                }}
              />
            )}
          </span>
          <span className="target-identity">
            <span>
              <strong>{name}</strong>
              {target.verified && <BadgeCheck size={14} aria-label="已认证" />}
            </span>
            {handle && <small>@{handle}</small>}
          </span>
          {(target.following != null || target.followers != null) && (
            <dl className="target-counts">
              {target.following != null && (
                <div><dd>{formatCompactNumber(target.following)}</dd><dt>关注</dt></div>
              )}
              {target.followers != null && (
                <div><dd>{formatCompactNumber(target.followers)}</dd><dt>粉丝</dt></div>
              )}
            </dl>
          )}
        </div>
        {target.bio && <p className="target-bio">{target.bio}</p>}
        {target.bioTranslation && target.bioTranslation !== target.bio && (
          <p className="target-translation">{target.bioTranslation}</p>
        )}
      </div>
    </section>
  );
}

function TokenPanel({ token, onCopy }: { token: TokenRef; onCopy: () => void }) {
  const chain = chainPresentation(token.chain);
  const symbol = token.symbol || 'TOKEN';
  const quoteMetrics = [
    token.quote?.marketCapUsd != null
      ? { label: '现市值', value: formatUsd(token.quote.marketCapUsd) }
      : null,
    token.quote?.priceUsd != null
      ? { label: '现价', value: formatPriceUsd(token.quote.priceUsd) }
      : null,
    token.quote?.volume24hUsd != null
      ? { label: '24h 量', value: formatUsd(token.quote.volume24hUsd) }
      : null,
  ].filter((metric): metric is { label: string; value: string } => metric != null);
  return (
    <section className="asset-panel" aria-label={`${symbol} 代币和合约`}>
      <div className="asset-overview">
        <span className="token-avatar" aria-hidden="true">
          <Coins size={16} />
          {token.imageUrl && (
            <img
              src={token.imageUrl}
              alt=""
              referrerPolicy="no-referrer"
              onError={(image) => {
                image.currentTarget.hidden = true;
              }}
            />
          )}
        </span>
        <span className="asset-identity">
          <strong>${symbol}</strong>
          {token.name && token.name !== token.symbol && <small>{token.name}</small>}
        </span>
        <span className={`chain-badge chain-${chain.tone}`}>
          <Network size={12} aria-hidden="true" />
          {chain.label}
        </span>
      </div>
      {quoteMetrics.length > 0 && (
        <dl className="asset-market-metrics">
          {quoteMetrics.map((metric) => (
            <div key={metric.label}>
              <dt>{metric.label}</dt>
              <dd>{metric.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="contract-row">
        <span className="contract-label">CA</span>
        <code title={token.address}>{compactAddress(token.address)}</code>
        <button type="button" onClick={onCopy} aria-label={`复制 ${symbol} 合约地址`}>
          <Clipboard size={14} />
        </button>
      </div>
    </section>
  );
}

function EventItem({
  event,
  featured,
  currentTime,
  busyTarget,
  onTrade,
  onGrok,
  onCopy,
  onSource,
}: {
  event: WindEvent;
  featured?: boolean;
  currentTime: number;
  busyTarget?: TradeTarget;
  onTrade: (event: WindEvent, target: TradeTarget) => void;
  onGrok: (event: WindEvent) => void;
  onCopy: (event: WindEvent) => void;
  onSource: (event: WindEvent) => void;
}) {
  const operation = operationPresentation(event);
  const author = event.author || SOURCE_META[event.source].label;
  const authorHandle = event.authorHandle?.replace(/^@+/, '');
  return (
    <article
      className={`event-item source-${event.source} ${event.consensus ? 'is-consensus' : ''} ${featured ? 'is-featured' : ''} importance-${event.importance}`}
    >
      <div className="event-head">
        <EventAvatar event={event} />
        <div className="event-identity">
          <div className="event-identity-main">
            <strong title={author}>{author}</strong>
            <span className={`signal-chip operation-${operation.tone}`}>
              {SOURCE_META[event.source].label} · {operation.label}
            </span>
            {featured && <span className="fresh-chip">最新</span>}
          </div>
          {authorHandle && (
            <div className="event-identity-sub">
              <span className="event-handle" title={`@${authorHandle}`}>@{authorHandle}</span>
            </div>
          )}
        </div>
        <div className="event-clock">
          <time dateTime={event.occurredAt}>{clockTime(event.occurredAt)}</time>
          <small>{relativeTime(event.occurredAt, currentTime)} · {eventLag(event)}</small>
        </div>
      </div>

      <div className="event-content">
        {event.consensus ? (
          <ConsensusContent consensus={event.consensus} title={event.title} />
        ) : event.target ? (
          <TargetContent event={event} />
        ) : isTradeEvent(event) ? (
          <TradeContent event={event} />
        ) : (
          <>
            <h2>{event.title}</h2>
            {event.body && <p>{event.body}</p>}
          </>
        )}

        {event.reference && <ReferenceContent event={event} />}

        {event.token && (
          <TokenPanel token={event.token} onCopy={() => onCopy(event)} />
        )}

        <div className="event-actions">
          {event.token ? (
            <div className="trade-destinations" aria-label="打开交易平台">
              {(Object.keys(TRADE_TARGET_META) as TradeTarget[]).map((target) => (
                <button
                  key={target}
                  className="trade-destination"
                  type="button"
                  disabled={busyTarget != null}
                  onClick={() => onTrade(event, target)}
                >
                  {busyTarget === target ? (
                    <RefreshCw className="spin" size={13} aria-hidden="true" />
                  ) : (
                    <ExternalLink size={12} aria-hidden="true" />
                  )}
                  <span>{TRADE_TARGET_META[target].label}</span>
                </button>
              ))}
            </div>
          ) : (
            <span className="no-target">无可路由标的</span>
          )}
          {event.token && (
            <button className="source-link grok-link" type="button" onClick={() => onGrok(event)}>
              <Sparkles size={13} aria-hidden="true" />
              问 Grok
            </button>
          )}
          {event.sourceUrl && (
            <button className="source-link" type="button" onClick={() => onSource(event)}>
              看原文 <ExternalLink size={14} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function grokContextForEvent(event: WindEvent): GrokChatContext {
  const supportingContext = [
    event.body,
    event.reference?.text
      ? `相关原贴${event.reference.authorHandle ? ` @${event.reference.authorHandle.replace(/^@+/, '')}` : ''}：${event.reference.text}`
      : undefined,
    event.target?.bio
      ? `目标账号${event.target.handle ? ` @${event.target.handle.replace(/^@+/, '')}` : ''}：${event.target.bio}`
      : undefined,
  ].filter((value): value is string => Boolean(value));
  return {
    eventId: event.id,
    symbol: event.token?.symbol,
    name: event.token?.name,
    chain: event.token?.chain,
    address: event.token?.address,
    sourceLabel: SOURCE_META[event.source].label,
    authorHandle: event.authorHandle,
    title: event.title,
    body: supportingContext.join('\n') || undefined,
  };
}

function SettingsView({
  snapshot,
  onBack,
  onSaved,
  onThemePreview,
}: {
  snapshot: RuntimeSnapshot;
  onBack: () => void;
  onSaved: (snapshot: RuntimeSnapshot) => void;
  onThemePreview: (theme: ThemePreference) => void;
}) {
  const [draft, setDraft] = useState<StreamConfig>(snapshot.config);
  const [apiKey, setApiKey] = useState('');
  const [keyLoaded, setKeyLoaded] = useState(!isExtension);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isExtension) return;
    void chrome.storage.local
      .get(STORAGE_KEYS.grokApiKey)
      .then((stored) => {
        const value = stored[STORAGE_KEYS.grokApiKey];
        setApiKey(typeof value === 'string' ? value : '');
      })
      .catch((cause: unknown) =>
        setError(`无法读取 Sub2API Key：${cause instanceof Error ? cause.message : String(cause)}`),
      )
      .finally(() => setKeyLoaded(true));
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isExtension) {
        if (apiKey.trim() && !draft.sub2ApiBaseUrl.trim()) {
          throw new Error('填写 Sub2API Key 时也需要填写服务地址');
        }
        if (draft.sub2ApiBaseUrl.trim()) {
          const originPattern = sub2ApiPermissionPattern(draft.sub2ApiBaseUrl);
          const granted = await chrome.permissions.request({ origins: [originPattern] });
          if (!granted) throw new Error('需要允许访问 Sub2API 站点才能发送 Grok 对话');
        }
        const next = await sendCommand<RuntimeSnapshot>({
          type: 'config:save',
          config: draft,
        });
        if (apiKey.trim()) {
          await chrome.storage.local.set({ [STORAGE_KEYS.grokApiKey]: apiKey.trim() });
        } else {
          await chrome.storage.local.remove(STORAGE_KEYS.grokApiKey);
        }
        onSaved(next);
      } else {
        onSaved({ ...snapshot, config: draft });
      }
      onBack();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  const injectDemo = async () => {
    if (!isExtension) return;
    setSaving(true);
    setError(null);
    try {
      const next = await sendCommand<RuntimeSnapshot>({ type: 'demo:inject' });
      onSaved(next);
      onBack();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="settings-view">
      <header className="settings-header">
        <button type="button" className="icon-key" onClick={onBack} aria-label="返回实时流">
          <ArrowLeft size={19} />
        </button>
        <div>
          <h1>实时流、AI 与交易路由</h1>
          <p>连接听风实时流，并使用自己的 Sub2API 调用 Grok</p>
        </div>
      </header>

      <form onSubmit={save}>
        <section className="settings-section appearance-section">
          <h2>外观</h2>
          <div className="theme-options" role="group" aria-label="界面主题">
            {THEME_OPTIONS.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                className={draft.theme === value ? 'is-active' : ''}
                aria-pressed={draft.theme === value}
                onClick={() => {
                  setDraft((current) => ({ ...current, theme: value }));
                  onThemePreview(value);
                }}
              >
                <Icon size={15} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <p className="theme-help">跟随系统会随设备外观自动切换；深色主题适合低光盯盘。</p>

          <h3 className="settings-subhead">信息流布局</h3>
          <div className="theme-options layout-options" role="group" aria-label="信息流布局">
            {LAYOUT_OPTIONS.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                className={draft.feedView === value ? 'is-active' : ''}
                aria-pressed={draft.feedView === value}
                onClick={() => setDraft((current) => ({ ...current, feedView: value }))}
              >
                <Icon size={15} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <p className="theme-help">
            分栏需要至少 {SPLIT_MIN_WIDTH}px 宽：侧栏拖宽后自动并排，较窄时改为标签页切换，也可以从页脚打开分栏窗口。合并视图按时间交织两路消息，默认不含异动类快讯。
          </p>
        </section>

        <NewsSettingsSection
          draft={draft}
          connection={snapshot.newsConnection}
          onChange={setDraft}
        />

        <SoundSettingsSection draft={draft} onChange={setDraft} />

        <section className="settings-section">
          <h2>Grok 叙事调查</h2>
          <label>
            <span>Sub2API 地址</span>
            <input
              value={draft.sub2ApiBaseUrl}
              inputMode="url"
              autoComplete="off"
              placeholder="https://sub2api.example.com"
              onChange={(inputEvent) =>
                setDraft({ ...draft, sub2ApiBaseUrl: inputEvent.target.value })
              }
            />
          </label>
          <p className="field-help">可以填写服务根地址、/v1 或完整的 /v1/responses 地址。</p>
          <label>
            <span>Sub2API Key</span>
            <input
              type="password"
              value={apiKey}
              autoComplete="off"
              spellCheck={false}
              placeholder={keyLoaded ? 'sk-…' : '正在读取…'}
              disabled={!keyLoaded}
              onChange={(inputEvent) => setApiKey(inputEvent.target.value)}
            />
          </label>
          <label>
            <span>Grok 模型</span>
            <input
              value={draft.grokModel}
              autoComplete="off"
              spellCheck={false}
              placeholder={DEFAULT_CONFIG.grokModel}
              onChange={(inputEvent) => setDraft({ ...draft, grokModel: inputEvent.target.value })}
            />
          </label>
          <p className="credential-note">
            Key 只保存在 Chrome 扩展本地可信存储中；请求由后台直接发给你配置的 Sub2API，并启用 X Search 与 Web Search。
          </p>
        </section>

        <section className="settings-section">
          <h2>听风页面桥接</h2>
          <div className="fixed-endpoint">
            <span>页面同源 WebSocket</span>
            <code>{WIND_WEBSOCKET_URL}</code>
          </div>
          <div className={`session-row session-${snapshot.connection.session}`}>
            <span className="status-lamp" />
            <div>
              <strong>{sessionLabel(snapshot.connection.session, snapshot.connection.mode)}</strong>
              <small>
                已接收 {snapshot.connection.receivedMessages} 帧
                {' · '}事件 {snapshot.connection.eventFrames}
                {' · '}入流 {snapshot.connection.parsedEvents}
                {snapshot.connection.droppedEvents
                  ? ` · 丢弃 ${snapshot.connection.droppedEvents}`
                  : ''}
                {snapshot.connection.lastMessageType
                  ? ` · 最近 ${snapshot.connection.lastMessageType}`
                  : ''}
              </small>
            </div>
          </div>
          <button
            type="button"
            className="text-action"
            onClick={() => {
              if (isExtension) void sendCommand({ type: 'wind:open' });
              else window.open('https://wind.jokkimon.club/', '_blank', 'noopener,noreferrer');
            }}
          >
            <ExternalLink size={14} />
            打开听风登录页
          </button>
          <button
            type="button"
            className="text-action"
            disabled={saving}
            onClick={() => void injectDemo()}
          >
            <Zap size={14} />
            载入“玩偶兔子”诊断卡片
          </button>
        </section>

        <section className="settings-section">
          <h2>交易目标</h2>
          <label>
            <span>deBot 链接模板</span>
            <input
              value={draft.debotUrlTemplate}
              inputMode="url"
              onChange={(event) =>
                setDraft({ ...draft, debotUrlTemplate: event.target.value })
              }
            />
          </label>
          <label>
            <span>GMGN 链接模板</span>
            <input
              value={draft.gmgnUrlTemplate}
              inputMode="url"
              onChange={(event) =>
                setDraft({ ...draft, gmgnUrlTemplate: event.target.value })
              }
            />
          </label>
          <p className="field-help">可用占位符：{'{chain}'}、{'{address}'}、{'{symbol}'}</p>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={draft.reuseTradingTab}
              onChange={(event) =>
                setDraft({ ...draft, reuseTradingTab: event.target.checked })
              }
            />
            <span>
              <strong>复用已打开的交易标签页</strong>
              <small>避免每条预警都新开一个页面</small>
            </span>
          </label>
        </section>

        <aside className="safety-note">
          <ShieldCheck size={18} />
          <p>插件只打开标的，不会填单、签名或自动交易。最终操作仍由你在交易网站确认。</p>
        </aside>

        {error && <div className="form-error">{error}</div>}
        <button className="save-key" type="submit" disabled={saving || !keyLoaded}>
          {saving ? <RefreshCw className="spin" size={18} /> : <Check size={18} />}
          保存设置
        </button>
      </form>
    </main>
  );
}

function App() {
  const [view, setView] = useState<PanelView>('stream');
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot>(
    isExtension
      ? {
          config: DEFAULT_CONFIG,
          connection: EMPTY_CONNECTION,
          events: [],
          news: [],
          newsConnection: EMPTY_NEWS_CONNECTION,
        }
      : DEMO_SNAPSHOT,
  );
  const [filter, setFilter] = useState<SourceFilter>('all');
  const [tab, setTab] = useState<FeedTab>(() =>
    new URLSearchParams(window.location.search).get('tab') === 'news' ? 'news' : 'signals',
  );
  const [newsFilter, setNewsFilter] = useState<NewsFilter>('all');
  const [newsSeenAt, setNewsSeenAt] = useState(() =>
    isExtension ? Date.now() : Date.now() - 50_000,
  );
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [busyTrade, setBusyTrade] = useState<{
    eventId: string;
    target: TradeTarget;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const [themePreview, setThemePreview] = useState<ThemePreference | null>(null);
  const [grokContext, setGrokContext] = useState<GrokChatContext | null>(null);
  const previousEventId = useRef<string | null>(snapshot.events[0]?.id ?? null);
  const resolvedTheme = useResolvedTheme(themePreview ?? snapshot.config.theme);
  const viewportWidth = useViewportWidth();

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  // The port stays open for the panel's lifetime: the background counts open
  // ports to decide whether eqn.news should be polled at all.
  const configRef = useRef(snapshot.config);
  configRef.current = snapshot.config;

  useEffect(() => {
    if (!isExtension) return;
    let port: chrome.runtime.Port | null = null;
    let reconnectTimer: number | undefined;
    let disposed = false;
    const handleMessage = (message: BackgroundPush) => {
      const config = configRef.current;
      if (message.type === 'snapshot') {
        setSnapshot(message.snapshot);
        previousEventId.current = message.snapshot.events[0]?.id ?? null;
      } else if (message.type === 'connection') {
        setSnapshot((current) => ({ ...current, connection: message.connection }));
      } else if (message.type === 'news') {
        setSnapshot((current) => ({ ...current, news: message.news }));
      } else if (message.type === 'news-connection') {
        setSnapshot((current) => ({ ...current, newsConnection: message.connection }));
      } else if (message.type === 'news-fresh') {
        const visible = message.items.filter((item) => config.newsGroups.includes(item.group));
        if (message.alert) playAlertFor(visible.map(alertTierForNews), config);
        const audible = visible.filter((item) => config.soundTiers.includes(alertTierForNews(item)));
        if (audible.length) {
          const latest = audible[0];
          setLiveAnnouncement(
            `新快讯，${newsChannelMeta(latest.channel).label}：${latest.title}${audible.length > 1 ? `，另有 ${audible.length - 1} 条` : ''}`,
          );
        }
      } else if (message.type === 'event') {
        const isNewEvent = previousEventId.current !== message.event.id;
        setSnapshot((current) => ({
          ...current,
          events: [message.event, ...current.events.filter((item) => item.id !== message.event.id)],
        }));
        if (previousEventId.current && isNewEvent && message.alert) {
          playAlertFor([alertTierForEvent(message.event)], config);
        }
        if (isNewEvent) {
          setLiveAnnouncement(
            `新预警，${SOURCE_META[message.event.source].label}，${message.event.author || '未知账户'}：${message.event.title}`,
          );
        }
        previousEventId.current = message.event.id;
      }
    };

    // If Chrome restarts the service worker the port drops; reconnect so the
    // background re-counts this view and resumes eqn.news polling.
    const connect = () => {
      if (disposed) return;
      try {
        port = chrome.runtime.connect({ name: 'wind-sidepanel' });
      } catch {
        reconnectTimer = window.setTimeout(connect, 2_000);
        return;
      }
      port.onMessage.addListener(handleMessage);
      port.onDisconnect.addListener(() => {
        port = null;
        if (!disposed) reconnectTimer = window.setTimeout(connect, 1_000);
      });
    };
    connect();

    // Port messages keep the MV3 service worker alive while a view is open.
    const keepAlive = window.setInterval(() => {
      try {
        port?.postMessage({ type: 'keepalive' });
      } catch {
        // onDisconnect handles the reconnect.
      }
    }, 20_000);

    return () => {
      disposed = true;
      window.clearInterval(keepAlive);
      window.clearTimeout(reconnectTimer);
      port?.onMessage.removeListener(handleMessage);
      port?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2_400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const visibleEvents = useMemo(
    () =>
      filter === 'all'
        ? snapshot.events
        : snapshot.events.filter((event) => event.source === filter),
    [filter, snapshot.events],
  );

  const subscribedNews = useMemo(
    () => snapshot.news.filter((item) => snapshot.config.newsGroups.includes(item.group)),
    [snapshot.config.newsGroups, snapshot.news],
  );
  const visibleNews = useMemo(
    () =>
      newsFilter === 'all'
        ? subscribedNews
        : subscribedNews.filter((item) => item.group === newsFilter),
    [newsFilter, subscribedNews],
  );
  const newsUnread = useMemo(
    () => subscribedNews.filter((item) => Date.parse(item.receivedAt) > newsSeenAt).length,
    [newsSeenAt, subscribedNews],
  );

  const changeTab = (next: FeedTab) => {
    if (tab === 'news' || next === 'news') setNewsSeenAt(Date.now());
    setTab(next);
  };

  const mergedItems = useMemo(() => {
    const hidden = new Set<MergedSource>(snapshot.config.mergedHidden);
    const entries: MergedEntry[] = [
      ...(hidden.has('signals') ? [] : snapshot.events).map(
        (event): MergedEntry => ({ kind: 'signal', at: Date.parse(event.occurredAt), event }),
      ),
      ...(snapshot.config.newsEnabled ? subscribedNews : [])
        .filter((item) => !hidden.has(item.group))
        .map((item): MergedEntry => ({ kind: 'news', at: Date.parse(item.publishedAt), item })),
    ];
    return entries.sort((left, right) => right.at - left.at).slice(0, MERGED_LIMIT);
  }, [snapshot.config.mergedHidden, snapshot.config.newsEnabled, snapshot.events, subscribedNews]);

  const mergedCounts = useMemo(() => {
    const counts: Record<MergedSource, number> = {
      signals: snapshot.events.length,
      headline: 0,
      notice: 0,
      move: 0,
      tradfi: 0,
      social: 0,
    };
    for (const item of subscribedNews) counts[item.group] += 1;
    return counts;
  }, [snapshot.events.length, subscribedNews]);

  const saveConfigPatch = async (patch: Partial<StreamConfig>) => {
    const previous = snapshot;
    const nextConfig: StreamConfig = { ...snapshot.config, ...patch };
    setSnapshot((current) => ({ ...current, config: nextConfig }));
    if (!isExtension) return;
    try {
      const next = await sendCommand<RuntimeSnapshot>({ type: 'config:save', config: nextConfig });
      setSnapshot(next);
    } catch (cause) {
      setSnapshot(previous);
      setNotice(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const changeFeedView = async (next: FeedView) => {
    if (next === snapshot.config.feedView) return;
    await saveConfigPatch({ feedView: next });
  };

  const toggleMergedSource = async (source: MergedSource) => {
    const hidden = snapshot.config.mergedHidden;
    await saveConfigPatch({
      mergedHidden: hidden.includes(source)
        ? hidden.filter((value) => value !== source)
        : [...hidden, source],
    });
  };

  const openMonitorWindow = async () => {
    try {
      if (isExtension) {
        const result = await sendCommand<{ reused: boolean }>({ type: 'monitor:window:open' });
        setNotice(result.reused ? '已切换到分栏窗口' : '已打开分栏窗口');
      } else {
        window.open('/sidepanel.html?window=1', 'wind-monitor', 'popup,width=1180,height=920');
      }
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const openUrl = (url: string) => {
    if (isExtension) void chrome.tabs.create({ url });
    else window.open(url, '_blank', 'noopener,noreferrer');
  };

  const copyCoin = async (coin: string) => {
    try {
      await navigator.clipboard.writeText(coin);
      setNotice(`已复制 ${coin}`);
    } catch {
      setNotice('复制失败');
    }
  };

  const openTrade = async (event: WindEvent, target: TradeTarget) => {
    const targetLabel = TRADE_TARGET_META[target].label;
    setBusyTrade({ eventId: event.id, target });
    try {
      if (isExtension) {
        const result = await sendCommand<{ reused: boolean }>({
          type: 'trade:open',
          target,
          event,
        });
        setNotice(
          result.reused
            ? `已切换到现有 ${targetLabel} 标签页`
            : `已在 ${targetLabel} 打开交易标的`,
        );
      } else {
        setNotice(`本地预览：将在 ${targetLabel} 打开交易标的`);
      }
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyTrade((current) =>
        current?.eventId === event.id && current.target === target ? null : current,
      );
    }
  };

  const copyAddress = async (event: WindEvent) => {
    if (!event.token) return;
    try {
      await navigator.clipboard.writeText(event.token.address);
      setNotice('合约地址已复制');
    } catch {
      setNotice('复制失败，请手动选择合约地址');
    }
  };

  const openSource = (event: WindEvent) => {
    if (!event.sourceUrl) return;
    if (isExtension) void chrome.tabs.create({ url: event.sourceUrl });
    else window.open(event.sourceUrl, '_blank', 'noopener,noreferrer');
  };

  const openGrokWindow = async (context?: GrokChatContext) => {
    try {
      if (isExtension) {
        const result = await sendCommand<{ reused: boolean }>({
          type: 'grok:window:open',
          context,
        });
        setNotice(result.reused ? '已切换到 Grok 聊天窗口' : '已打开 Grok 聊天窗口');
      } else {
        const url = new URL('/chat.html', window.location.origin);
        if (context) url.searchParams.set('context', JSON.stringify(context));
        window.open(url, 'wind-grok-chat', 'popup,width=900,height=720');
      }
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const toggleConnection = async () => {
    if (!isExtension) {
      setSnapshot((current) => ({
        ...current,
        connection: {
          ...current.connection,
          phase: current.connection.phase === 'live' ? 'offline' : 'live',
        },
      }));
      return;
    }
    const shouldPause =
      snapshot.connection.phase === 'live' &&
      snapshot.connection.session === 'authenticated';
    const type = shouldPause ? 'stream:disconnect' : 'stream:connect';
    const next = await sendCommand<RuntimeSnapshot>({ type });
    setSnapshot(next);
  };

  const toggleSound = () => saveConfigPatch({ soundEnabled: !snapshot.config.soundEnabled });

  const toggleTheme = () =>
    saveConfigPatch({ theme: resolvedTheme === 'dark' ? 'light' : 'dark' });

  const closeSettings = () => {
    setThemePreview(null);
    setView('stream');
  };

  if (view === 'settings') {
    return (
      <SettingsView
        snapshot={snapshot}
        onBack={closeSettings}
        onSaved={(next) => {
          setSnapshot(next);
          setThemePreview(null);
        }}
        onThemePreview={setThemePreview}
      />
    );
  }

  if (view === 'grok' && grokContext) {
    return (
      <GrokWorkspace
        mode="sidepanel"
        context={grokContext}
        config={snapshot.config}
        onBack={() => setView('stream')}
        onOpenSettings={() => setView('settings')}
        onOpenWindow={(context) => void openGrokWindow(context)}
      />
    );
  }

  const live = snapshot.connection.phase === 'live';
  const needsLogin = snapshot.connection.session === 'guest';
  const newsPhase = snapshot.config.newsEnabled ? snapshot.newsConnection.phase : 'offline';
  const splitAvailable = viewportWidth >= SPLIT_MIN_WIDTH;
  const layout = feedLayout(snapshot.config.feedView, splitAvailable);

  const selectView = async (choice: ViewChoice) => {
    if (choice === 'merged') {
      await changeFeedView('merged');
      return;
    }
    if (choice === 'split') {
      await changeFeedView('split');
      return;
    }
    // Narrow panel picking a single feed: remember "split" so widening the
    // panel later shows both columns again.
    changeTab(choice);
    if (snapshot.config.feedView !== 'split') await changeFeedView('split');
  };

  const askGrokForEvent = (event: WindEvent) => {
    setGrokContext(grokContextForEvent(event));
    setView('grok');
  };
  const askGrokForNews = (item: NewsItem) => {
    setGrokContext(newsGrokContext(item));
    setView('grok');
  };

  const renderSignalCard = (event: WindEvent, featured: boolean) => (
    <EventItem
      key={event.id}
      event={event}
      featured={featured}
      currentTime={currentTime}
      busyTarget={busyTrade?.eventId === event.id ? busyTrade.target : undefined}
      onTrade={(item, target) => void openTrade(item, target)}
      onGrok={askGrokForEvent}
      onCopy={(item) => void copyAddress(item)}
      onSource={openSource}
    />
  );

  const renderNewsCard = (item: NewsItem, featured: boolean) => (
    <NewsCard
      key={item.id}
      item={item}
      featured={featured}
      currentTime={currentTime}
      onOpen={openUrl}
      onCopyCoin={(coin) => void copyCoin(coin)}
      onGrok={askGrokForNews}
    />
  );

  const signalFilters = (
    <nav className="source-filters" aria-label="筛选预警来源">
      {FILTERS.map((item) => (
        <button
          key={item.value}
          type="button"
          className={filter === item.value ? 'is-active' : ''}
          aria-pressed={filter === item.value}
          onClick={() => setFilter(item.value)}
        >
          {item.label}
          <span>
            {item.value === 'all'
              ? snapshot.events.length
              : snapshot.events.filter((event) => event.source === item.value).length}
          </span>
        </button>
      ))}
    </nav>
  );

  const newsFilters = (
    <NewsFilters
      items={subscribedNews}
      filter={newsFilter}
      enabledGroups={snapshot.config.newsGroups}
      onChange={setNewsFilter}
    />
  );

  const signalEmpty = (
    <div className="empty-feed">
      <Radio size={28} />
      <strong>
        {snapshot.connection.phase === 'connecting' ||
        snapshot.connection.phase === 'reconnecting'
          ? '正在连接听风'
          : needsLogin
            ? '等待听风登录'
            : live
              ? '连接成功，等待新预警'
              : '实时流暂不可用'}
      </strong>
      <p>
        {live
          ? `协议帧 ${snapshot.connection.receivedMessages} · 事件帧 ${snapshot.connection.eventFrames} · 已入流 ${snapshot.connection.parsedEvents} · 卡片 ${snapshot.events.length}`
          : '点击顶部连接状态可以立即重试。'}
      </p>
    </div>
  );

  const newsEmpty = (
    <NewsEmpty
      enabled={snapshot.config.newsEnabled}
      connection={snapshot.newsConnection}
      filtered={newsFilter !== 'all' && subscribedNews.length > 0}
      onOpenSettings={() => setView('settings')}
      onShowAll={() => setNewsFilter('all')}
    />
  );

  const signalList = visibleEvents.length
    ? visibleEvents.map((event, index) => renderSignalCard(event, index === 0))
    : signalEmpty;
  const newsList =
    snapshot.config.newsEnabled && visibleNews.length
      ? visibleNews.map((item, index) => renderNewsCard(item, index === 0))
      : newsEmpty;

  const newsStatus = !snapshot.config.newsEnabled
    ? '未开启'
    : snapshot.newsConnection.phase === 'live'
      ? `同步中 · ${subscribedNews.length} 条`
      : snapshot.newsConnection.phase === 'error'
        ? '同步失败'
        : '正在同步';
  const signalStatus = `${needsLogin ? '游客模式' : phaseLabel(snapshot.connection.phase)} · ${snapshot.events.length} 条`;

  const clearSignals = () => {
    if (isExtension) {
      void sendCommand({ type: 'events:clear' }).then(() =>
        setSnapshot((current) => ({ ...current, events: [] })),
      );
    } else {
      setSnapshot((current) => ({ ...current, events: [] }));
    }
  };

  return (
    <main className={`stream-view layout-${layout} ${IS_MONITOR_WINDOW ? 'is-monitor-window' : ''}`}>
      <header className="console-header">
        <div className="brand">
          <BrandMark />
          <div>
            <h1>KeelSonar</h1>
            <span>{isExtension ? '多源交易信号侧栏' : '合成事件 · 本地预览'}</span>
          </div>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className={`status-key phase-${snapshot.connection.phase}`}
            onClick={() => void toggleConnection()}
            aria-label={live && !needsLogin ? '暂停听风实时流' : '连接听风实时流'}
          >
            <span className="status-lamp" />
            <b>{needsLogin ? '游客模式' : phaseLabel(snapshot.connection.phase)}</b>
            {live && !needsLogin && snapshot.connection.latencyMs != null && (
              <small>{snapshot.connection.latencyMs}ms</small>
            )}
            {live && !needsLogin ? <Pause size={13} /> : <Play size={13} />}
          </button>
          <button
            className="icon-key"
            type="button"
            onClick={() => void toggleTheme()}
            aria-label={resolvedTheme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
            title={resolvedTheme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
          >
            {resolvedTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button
            className="icon-key"
            type="button"
            onClick={() => void toggleSound()}
            aria-label={snapshot.config.soundEnabled ? '关闭提示音' : '开启提示音'}
          >
            {snapshot.config.soundEnabled ? <Bell size={17} /> : <BellOff size={17} />}
          </button>
          <button
            className="icon-key"
            type="button"
            onClick={() => setView('settings')}
            aria-label="打开设置"
          >
            <Settings2 size={18} />
          </button>
        </div>
      </header>

      {needsLogin && (
        <section className="setup-band">
          <div>
            <strong>听风页面当前使用游客模式</strong>
            <p>请在听风页面重新登录；扩展会复用页面自身的登录会话，不会读取 Cookie。</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (isExtension) void sendCommand({ type: 'wind:open' });
              else window.open('https://wind.jokkimon.club/', '_blank', 'noopener,noreferrer');
            }}
          >
            打开听风 <ExternalLink size={16} />
          </button>
        </section>
      )}

      {snapshot.connection.message && snapshot.connection.phase !== 'live' && !needsLogin && (
        <div className="connection-note">
          {snapshot.connection.message}
          {snapshot.connection.phase === 'reconnecting' && snapshot.connection.retryAt && (
            <span> · {relativeTime(snapshot.connection.retryAt, currentTime)}</span>
          )}
        </div>
      )}

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      <ViewBar
        wide={splitAvailable}
        active={layout === 'tabs' ? tab : layout}
        signalCount={snapshot.events.length}
        newsCount={subscribedNews.length}
        newsUnread={newsUnread}
        newsPhase={newsPhase}
        onSelect={(choice) => void selectView(choice)}
      />

      {layout === 'split' ? (
        <div className="feed-columns">
          <section className="feed-column" aria-label="听风信号">
            <ColumnHeader title="听风信号" phase={snapshot.connection.phase} status={signalStatus}>
              <button type="button" className="column-action" onClick={clearSignals}>
                清空
              </button>
            </ColumnHeader>
            {signalFilters}
            <div className="event-feed">{signalList}</div>
          </section>
          <section className="feed-column" aria-label="方程式快讯">
            <ColumnHeader title="方程式快讯" phase={newsPhase} status={newsStatus} />
            {newsFilters}
            <div className="event-feed">{newsList}</div>
          </section>
        </div>
      ) : layout === 'merged' ? (
        <>
          <MergedFilters
            hidden={snapshot.config.mergedHidden}
            counts={mergedCounts}
            disabledGroups={NEWS_GROUP_KEYS.filter(
              (group) => !snapshot.config.newsEnabled || !snapshot.config.newsGroups.includes(group),
            )}
            onToggle={(source) => void toggleMergedSource(source)}
          />
          <section className="event-feed merged-feed" aria-label="合并信息流">
            {mergedItems.length ? (
              mergedItems.map((entry, index) =>
                entry.kind === 'signal'
                  ? renderSignalCard(entry.event, index === 0)
                  : renderNewsCard(entry.item, index === 0),
              )
            ) : (
              <div className="empty-feed">
                <Rows3 size={28} />
                <strong>合并视图暂时没有消息</strong>
                <p>上方可以选择合并视图包含哪些来源；异动类快讯默认不并入，以免淹没听风信号。</p>
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          {tab === 'news' ? newsFilters : signalFilters}
          <section
            className="event-feed"
            aria-label={tab === 'news' ? '方程式快讯' : '听风信号'}
          >
            {tab === 'news' ? newsList : signalList}
          </section>
        </>
      )}

      <footer className="console-footer">
        {layout === 'split' ? (
          <span>
            <span className={`footer-dot phase-${snapshot.connection.phase}`} />
            听风 {snapshot.events.length}
            <span className={`footer-dot phase-${newsPhase} footer-dot-gap`} />
            快讯 {subscribedNews.length}
            {snapshot.connection.latencyMs != null ? ` · ${snapshot.connection.latencyMs}ms` : ''}
          </span>
        ) : layout === 'merged' ? (
          <span>
            <span className={`footer-dot phase-${snapshot.connection.phase}`} />
            听风 {snapshot.connection.phase === 'live' ? '实时' : phaseLabel(snapshot.connection.phase)}
            <span className={`footer-dot phase-${newsPhase} footer-dot-gap`} />
            快讯 {newsStatus}
          </span>
        ) : tab === 'news' ? (
          <span>
            <span className={`footer-dot phase-${newsPhase}`} />
            方程式快讯 {newsStatus}
            {snapshot.config.newsEnabled && snapshot.newsConnection.lastPollAt
              ? ` · ${relativeTime(snapshot.newsConnection.lastPollAt, currentTime)}`
              : ''}
          </span>
        ) : (
          <span>
            <span className={`footer-dot phase-${snapshot.connection.phase}`} />
            {snapshot.events.length} 条预警
            {snapshot.connection.latencyMs != null ? ` · ${snapshot.connection.latencyMs}ms` : ''}
          </span>
        )}
        <div className="footer-actions">
          {!IS_MONITOR_WINDOW && (
            <button
              type="button"
              onClick={() => void openMonitorWindow()}
              title="在独立宽窗口中分栏查看"
            >
              <AppWindow size={13} /> 分栏窗口
            </button>
          )}
          <button type="button" onClick={() => void openGrokWindow()}>
            <Bot size={13} /> AI 对话
          </button>
          {layout === 'tabs' && tab === 'signals' && (
            <button type="button" onClick={clearSignals}>
              清空
            </button>
          )}
        </div>
      </footer>

      {notice && <div className="toast">{notice}</div>}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
