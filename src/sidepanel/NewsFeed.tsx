import type { ReactNode } from 'react';
import {
  Bell,
  BellOff,
  Columns2,
  Rows3,
  Eye,
  EyeOff,
  ExternalLink,
  Newspaper,
  Send,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  EQN_NEWS_ENDPOINT,
  NEWS_GROUPS,
  NEWS_GROUP_META,
  newsChannelMeta,
  type NewsConnectionState,
  type NewsGroup,
  type NewsItem,
  type NewsMarketRef,
} from '../shared/eqn';
import type { FeedView, GrokChatContext, MergedSource, StreamConfig } from '../shared/protocol';
import {
  dayAwareClock,
  formatPriceUsd,
  formatRatePercent,
  formatSignedPercent,
  formatUsd,
  relativeTime,
} from './format';

export type NewsFilter = 'all' | NewsGroup;
export type FeedTab = 'signals' | 'news';
export type FeedLayout = 'split' | 'merged' | 'tabs';

/** Side-by-side columns need roughly two 340px columns plus gutters. */
export const SPLIT_MIN_WIDTH = 720;

const NEWS_FILTERS: Array<{ value: NewsFilter; label: string }> = [
  { value: 'all', label: '全部' },
  ...NEWS_GROUPS.map((group) => ({ value: group, label: NEWS_GROUP_META[group].label })),
];

const FRESH_WINDOW_MS = 120_000;

export function ColumnHeader({
  title,
  phase,
  status,
  children,
}: {
  title: string;
  phase: NewsConnectionState['phase'];
  status: string;
  children?: ReactNode;
}) {
  return (
    <header className="column-head">
      <h2>
        <span className={`footer-dot phase-${phase}`} aria-hidden="true" />
        {title}
      </h2>
      <span className="column-status">{status}</span>
      {children}
    </header>
  );
}

export type ViewChoice = 'signals' | 'news' | 'merged' | 'split';

/**
 * One row under the header. Narrow panels can't fit two columns, so the
 * choices are the two single feeds plus the merged timeline; once the panel
 * is wide enough the choices become split columns vs merged timeline.
 */
export function ViewBar({
  wide,
  active,
  signalCount,
  newsCount,
  newsUnread,
  newsPhase,
  onSelect,
}: {
  wide: boolean;
  active: ViewChoice;
  signalCount: number;
  newsCount: number;
  newsUnread: number;
  newsPhase: NewsConnectionState['phase'];
  onSelect: (choice: ViewChoice) => void;
}) {
  const newsTrouble = newsPhase === 'error' || newsPhase === 'reconnecting';
  const options: Array<{ value: ViewChoice; content: ReactNode; title: string }> = wide
    ? [
        {
          value: 'split',
          title: '听风信号与方程式快讯左右并排',
          content: (
            <>
              <Columns2 size={14} aria-hidden="true" />
              分栏
            </>
          ),
        },
        {
          value: 'merged',
          title: '两路消息按时间合并为一列',
          content: (
            <>
              <Rows3 size={14} aria-hidden="true" />
              合并
            </>
          ),
        },
      ]
    : [
        {
          value: 'signals',
          title: '只看听风信号',
          content: (
            <>
              听风信号
              <span className="tab-count">{signalCount}</span>
            </>
          ),
        },
        {
          value: 'news',
          title: '只看方程式快讯',
          content: (
            <>
              方程式快讯
              {newsTrouble && <span className="tab-alert" aria-label="快讯同步异常" />}
              {newsUnread > 0 && active !== 'news' && active !== 'merged' ? (
                <span className="tab-count is-unread">{newsUnread > 99 ? '99+' : newsUnread} 新</span>
              ) : (
                <span className="tab-count">{newsCount}</span>
              )}
            </>
          ),
        },
        {
          value: 'merged',
          title: '两路消息按时间合并为一列',
          content: (
            <>
              <Rows3 size={14} aria-hidden="true" />
              合并
            </>
          ),
        },
      ];

  return (
    <div className={`view-tabs ${wide ? 'is-wide' : ''}`} role="group" aria-label="信息流视图">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={active === option.value}
          title={option.title}
          onClick={() => onSelect(option.value)}
        >
          {option.content}
        </button>
      ))}
    </div>
  );
}

export function NewsFilters({
  items,
  filter,
  enabledGroups,
  onChange,
}: {
  items: NewsItem[];
  filter: NewsFilter;
  enabledGroups: NewsGroup[];
  onChange: (filter: NewsFilter) => void;
}) {
  return (
    <nav className="source-filters" aria-label="筛选快讯频道">
      {NEWS_FILTERS.map((item) => {
        const disabled = item.value !== 'all' && !enabledGroups.includes(item.value);
        const count =
          item.value === 'all'
            ? items.length
            : items.filter((news) => news.group === item.value).length;
        return (
          <button
            key={item.value}
            type="button"
            className={filter === item.value ? 'is-active' : ''}
            aria-pressed={filter === item.value}
            disabled={disabled}
            title={
              item.value === 'all'
                ? '全部已订阅频道'
                : disabled
                  ? `${NEWS_GROUP_META[item.value].channels}（已在设置中关闭）`
                  : NEWS_GROUP_META[item.value].channels
            }
            onClick={() => onChange(item.value)}
          >
            {item.label}
            <span>{disabled ? '–' : count}</span>
          </button>
        );
      })}
    </nav>
  );
}

function percentTone(value: number): string {
  return value < 0 ? 'is-down' : 'is-up';
}

function marketMetrics(market: NewsMarketRef) {
  const price =
    market.priceUsd != null ? { label: '现价', value: formatPriceUsd(market.priceUsd) } : null;
  const change24h =
    market.change24hPct != null
      ? { label: '24h', value: formatSignedPercent(market.change24hPct), tone: percentTone(market.change24hPct) }
      : null;
  const funding =
    market.fundingRatePct != null
      ? { label: '资金费率', value: formatRatePercent(market.fundingRatePct) }
      : null;
  const oi = market.oiUsd != null ? { label: '持仓 OI', value: formatUsd(market.oiUsd) } : null;

  const metrics =
    market.signal === 'price'
      ? [
          price,
          market.change1hPct != null
            ? { label: '1h', value: formatSignedPercent(market.change1hPct), tone: percentTone(market.change1hPct) }
            : null,
          change24h,
          funding,
        ]
      : market.signal === 'oi'
        ? [
            market.oiChangePct != null
              ? { label: 'OI 变化', value: formatSignedPercent(market.oiChangePct), tone: percentTone(market.oiChangePct) }
              : null,
            oi,
            change24h,
            price,
          ]
        : market.signal === 'stock'
          ? [
              price,
              market.refPriceUsd != null
                ? { label: '昨收', value: formatPriceUsd(market.refPriceUsd) }
                : null,
              market.volumeUsd != null ? { label: '成交额', value: formatUsd(market.volumeUsd) } : null,
              market.indexLabel && market.indexPct != null
                ? { label: market.indexLabel, value: formatSignedPercent(market.indexPct), tone: percentTone(market.indexPct) }
                : null,
            ]
          : [price, change24h, oi, funding];

  return metrics.filter(
    (metric): metric is { label: string; value: string; tone?: string } => metric != null,
  );
}

function MarketMove({ market, featured }: { market: NewsMarketRef; featured: boolean }) {
  const DirectionIcon = market.direction === 'up' ? TrendingUp : TrendingDown;
  const metrics = marketMetrics(market);
  const subject = market.base ?? market.symbol;
  const context = [
    market.signal === 'stock' ? market.name : market.symbol !== subject ? market.symbol : undefined,
    market.venue,
  ].filter(Boolean);

  return (
    <section className="move-block" aria-label={`${subject} 行情异动`}>
      <h2 className={`move-headline ${featured ? 'is-featured' : ''}`}>
        <span className="move-symbol">{subject}</span>
        <span className={`move-delta ${percentTone(market.changePct)}`}>
          <DirectionIcon size={13} aria-hidden="true" />
          {formatSignedPercent(market.changePct)}
        </span>
        <span className="move-window">{market.windowLabel}</span>
        {market.stance && <span className="move-stance">{market.stance}</span>}
      </h2>
      {context.length > 0 && <p className="move-context">{context.join(' · ')}</p>}
      {metrics.length > 0 && (
        <dl className="trade-metrics news-metrics">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <dt>{metric.label}</dt>
              <dd className={metric.tone}>{metric.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

export function newsGrokContext(item: NewsItem): GrokChatContext {
  const channel = newsChannelMeta(item.channel).label;
  return {
    kind: 'news',
    eventId: item.id,
    symbol: item.market?.base ?? item.coins[0],
    name: item.market?.signal === 'stock' ? item.market.name : undefined,
    sourceLabel: `方程式 · ${channel}`,
    title: item.title,
    body: [item.body, item.original?.text].filter(Boolean).join('\n') || undefined,
  };
}

function newsLag(item: NewsItem): string | null {
  if (item.receivedAt === item.publishedAt) return null;
  const value = Date.parse(item.receivedAt) - Date.parse(item.publishedAt);
  if (!Number.isFinite(value) || value < 0) return null;
  return value >= 1_000 ? `到达 ${(value / 1_000).toFixed(1)}s` : `到达 ${value}ms`;
}

export function NewsCard({
  item,
  featured,
  currentTime,
  onOpen,
  onCopyCoin,
  onGrok,
}: {
  item: NewsItem;
  featured: boolean;
  currentTime: number;
  onOpen: (url: string) => void;
  onCopyCoin: (coin: string) => void;
  onGrok: (item: NewsItem) => void;
}) {
  const channel = newsChannelMeta(item.channel);
  const alsoIn = item.channels
    .filter((value) => value !== item.channel)
    .map((value) => newsChannelMeta(value).label);
  const fresh = currentTime - Date.parse(item.publishedAt) < FRESH_WINDOW_MS;
  const lag = newsLag(item);
  const canAskGrok = Boolean(item.market || item.coins.length);
  const hasDistinctSource = item.sourceUrl && item.sourceUrl !== item.pageUrl;

  return (
    <article
      className={`event-item news-item news-${item.group} ${featured ? 'is-featured' : ''}`}
      aria-label={`${channel.label}：${item.title}`}
    >
      <header className="news-head">
        <div className="news-identity">
          <span className="signal-chip news-channel">{channel.label}</span>
          <span className="news-source" title={item.source}>
            {item.source}
            {alsoIn.length > 0 && <small> · 同发{alsoIn.join('、')}</small>}
          </span>
          {fresh && <span className="fresh-chip">新</span>}
        </div>
        <div className="event-clock">
          <time dateTime={item.publishedAt}>{dayAwareClock(item.publishedAt, currentTime)}</time>
          <small>
            {relativeTime(item.publishedAt, currentTime)}
            {lag ? ` · ${lag}` : ''}
          </small>
        </div>
      </header>

      {item.market ? (
        <MarketMove market={item.market} featured={featured} />
      ) : (
        <>
          <h2 className="news-title">{item.title}</h2>
          {item.body && <p className="news-body">{item.body}</p>}
          {item.original && (
            <p className="news-original" lang={item.original.language.toLowerCase()}>
              <abbr title="原文语言">{item.original.language}</abbr>
              <span>{item.original.text}</span>
            </p>
          )}
        </>
      )}

      {item.coins.length > 0 && (
        <div className="news-coins" aria-label="相关币种">
          {item.coins.map((coin) => (
            <button
              key={coin}
              type="button"
              className="coin-chip"
              onClick={() => onCopyCoin(coin)}
              aria-label={`复制币种代码 ${coin}`}
              title="复制币种代码"
            >
              ${coin}
            </button>
          ))}
        </div>
      )}

      <footer className="event-actions news-actions">
        <div className="news-links">
          {hasDistinctSource && (
            <button className="source-link" type="button" onClick={() => onOpen(item.sourceUrl!)}>
              原文 <ExternalLink size={12} aria-hidden="true" />
            </button>
          )}
          <button className="source-link" type="button" onClick={() => onOpen(item.pageUrl)}>
            方程式 <ExternalLink size={12} aria-hidden="true" />
          </button>
          {item.telegramUrl && (
            <button
              className="source-link"
              type="button"
              onClick={() => onOpen(item.telegramUrl!)}
              aria-label="在 Telegram 打开"
            >
              <Send size={12} aria-hidden="true" /> TG
            </button>
          )}
        </div>
        {canAskGrok && (
          <button className="source-link grok-link" type="button" onClick={() => onGrok(item)}>
            <Sparkles size={13} aria-hidden="true" />
            问 Grok
          </button>
        )}
      </footer>
    </article>
  );
}

export const MERGED_SOURCE_LABELS: Record<MergedSource, string> = {
  signals: '听风',
  headline: '头条',
  notice: '公告',
  move: '异动',
  tradfi: '财经',
  social: '动态',
};

const MERGED_SOURCE_ORDER: MergedSource[] = ['signals', 'headline', 'notice', 'move', 'tradfi', 'social'];

export function MergedFilters({
  hidden,
  counts,
  disabledGroups,
  onToggle,
}: {
  hidden: MergedSource[];
  counts: Record<MergedSource, number>;
  disabledGroups: NewsGroup[];
  onToggle: (source: MergedSource) => void;
}) {
  return (
    <nav className="source-filters merged-filters" aria-label="合并视图包含的来源">
      {MERGED_SOURCE_ORDER.map((source) => {
        const unsubscribed = source !== 'signals' && disabledGroups.includes(source);
        const shown = !hidden.includes(source) && !unsubscribed;
        return (
          <button
            key={source}
            type="button"
            className={shown ? 'is-active' : ''}
            aria-pressed={shown}
            disabled={unsubscribed}
            title={
              unsubscribed
                ? '已在设置中关闭这个快讯分组'
                : shown
                  ? `合并视图中隐藏${MERGED_SOURCE_LABELS[source]}`
                  : `合并视图中显示${MERGED_SOURCE_LABELS[source]}`
            }
            onClick={() => onToggle(source)}
          >
            {MERGED_SOURCE_LABELS[source]}
            <span>{unsubscribed ? '–' : counts[source]}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function feedLayout(view: FeedView, splitAvailable: boolean): FeedLayout {
  if (view === 'merged') return 'merged';
  if (view === 'split' && splitAvailable) return 'split';
  return 'tabs';
}

export function NewsEmpty({
  enabled,
  connection,
  filtered,
  onOpenSettings,
  onShowAll,
}: {
  enabled: boolean;
  connection: NewsConnectionState;
  filtered: boolean;
  onOpenSettings: () => void;
  onShowAll: () => void;
}) {
  if (!enabled) {
    return (
      <div className="empty-feed">
        <Newspaper size={28} aria-hidden="true" />
        <strong>方程式快讯未开启</strong>
        <p>开启后，侧栏打开期间每秒同步 eqn.news 的公开快讯，不需要 Key。</p>
        <button type="button" className="empty-action" onClick={onOpenSettings}>
          去设置开启
        </button>
      </div>
    );
  }
  if (filtered) {
    return (
      <div className="empty-feed">
        <Newspaper size={28} aria-hidden="true" />
        <strong>这个分组暂时没有快讯</strong>
        <p>异动类频道很频繁；头条与公告通常几分钟到几小时才有一条。</p>
        <button type="button" className="empty-action" onClick={onShowAll}>
          查看全部
        </button>
      </div>
    );
  }
  const syncing = connection.phase === 'connecting' || connection.phase === 'reconnecting';
  return (
    <div className="empty-feed">
      <Newspaper size={28} aria-hidden="true" />
      <strong>{syncing ? '正在同步方程式快讯' : connection.phase === 'error' ? '快讯同步失败' : '快讯同步已暂停'}</strong>
      <p>{connection.message ?? '同步会自动重试，无需操作。'}</p>
    </div>
  );
}

export function NewsSettingsSection({
  draft,
  connection,
  onChange,
}: {
  draft: StreamConfig;
  connection: NewsConnectionState;
  onChange: (next: StreamConfig) => void;
}) {
  const toggle = (key: 'newsGroups' | 'newsSoundGroups', group: NewsGroup) => {
    const current = draft[key];
    const next = current.includes(group)
      ? current.filter((value) => value !== group)
      : NEWS_GROUPS.filter((value) => value === group || current.includes(value));
    onChange({ ...draft, [key]: next });
  };

  return (
    <section className="settings-section">
      <h2>方程式快讯</h2>
      <label className="switch-row is-first">
        <input
          type="checkbox"
          checked={draft.newsEnabled}
          onChange={(event) => onChange({ ...draft, newsEnabled: event.target.checked })}
        />
        <span>
          <strong>接入方程式快讯</strong>
          <small>侧栏或分栏窗口打开时每秒同步；全部关闭后暂停，重新打开时补齐期间的快讯</small>
        </span>
      </label>

      <div className={`news-group-list ${draft.newsEnabled ? '' : 'is-disabled'}`}>
        <div className="news-group-head" aria-hidden="true">
          <span>分组与频道</span>
          <span>显示</span>
          <span>提示音</span>
        </div>
        {NEWS_GROUPS.map((group) => {
          const shown = draft.newsGroups.includes(group);
          const sound = draft.newsSoundGroups.includes(group);
          return (
            <div className="news-group-row" key={group}>
              <span className="news-group-name">
                <strong>{NEWS_GROUP_META[group].label}</strong>
                <small>{NEWS_GROUP_META[group].channels}</small>
              </span>
              <button
                type="button"
                className="toggle-chip"
                aria-pressed={shown}
                aria-label={`${shown ? '隐藏' : '显示'}${NEWS_GROUP_META[group].label}快讯`}
                disabled={!draft.newsEnabled}
                onClick={() => toggle('newsGroups', group)}
              >
                {shown ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
              </button>
              <button
                type="button"
                className="toggle-chip"
                aria-pressed={sound && shown}
                aria-label={`${sound ? '关闭' : '开启'}${NEWS_GROUP_META[group].label}提示音`}
                disabled={!draft.newsEnabled || !shown}
                onClick={() => toggle('newsSoundGroups', group)}
              >
                {sound && shown ? <Bell size={14} aria-hidden="true" /> : <BellOff size={14} aria-hidden="true" />}
              </button>
            </div>
          );
        })}
      </div>
      <p className="field-help">异动类频道每小时可达数十条，默认只显示不响铃。提示音受页头总开关控制。</p>

      <div className="fixed-endpoint">
        <span>快讯接口 · 失败时回退官方 MCP</span>
        <code>{EQN_NEWS_ENDPOINT}</code>
      </div>
      <div className={`session-row news-session phase-${connection.phase}`}>
        <span className="status-lamp" />
        <div>
          <strong>
            {connection.phase === 'live'
              ? '快讯同步正常'
              : connection.phase === 'offline'
                ? '快讯同步已暂停'
                : connection.phase === 'error'
                  ? '快讯同步失败'
                  : '正在同步快讯'}
          </strong>
          <small>
            {connection.lastPollAt ? `最近同步 ${dayAwareClock(connection.lastPollAt, Date.now())}` : '尚未同步'}
            {connection.failures ? ` · 连续失败 ${connection.failures} 次` : ''}
            {connection.message ? ` · ${connection.message}` : ''}
          </small>
        </div>
      </div>
    </section>
  );
}
