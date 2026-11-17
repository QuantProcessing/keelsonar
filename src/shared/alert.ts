import type { NewsGroup, NewsItem } from './eqn';
import type { WindEvent } from './protocol';

/**
 * Four sounds, two axes: pulse count = urgency (two = look now, one = when
 * free), timbre = source (square = Wind signals, bell/sine = eqn.news).
 * More than ~4 sounds stops being learnable without looking at the screen.
 */
export type SoundTier = 'signal-trade' | 'signal-social' | 'news-major' | 'news-minor';

export const SOUND_TIERS: SoundTier[] = ['signal-trade', 'signal-social', 'news-major', 'news-minor'];

export const DEFAULT_SOUND_TIERS: SoundTier[] = ['signal-trade', 'signal-social', 'news-major'];

export const SOUND_TIER_META: Record<
  SoundTier,
  { label: string; covers: string; signature: string }
> = {
  'signal-trade': {
    label: '听风 · 可交易',
    covers: '买卖、喊单、共识、币安上新，及任何带合约地址的信号',
    signature: '两声上扬',
  },
  'signal-social': {
    label: '听风 · 动态',
    covers: '其余推文、回复、关注、观点与资料变更',
    signature: '一声轻响',
  },
  'news-major': {
    label: '快讯 · 要闻',
    covers: '方程式头条、交易所公告与上新',
    signature: '钟声 叮—咚',
  },
  'news-minor': {
    label: '快讯 · 其他',
    covers: '价格与 OI 异动、财经、动态',
    signature: '一声轻点',
  },
};

/** When several alerts collide, the higher number wins. */
const PRIORITY: Record<SoundTier, number> = {
  'signal-trade': 4,
  'news-major': 3,
  'signal-social': 2,
  'news-minor': 1,
};

const PROFILE_ACTIONS = new Set([
  'follow',
  'unfollow',
  'photo',
  'banner',
  'description',
  'name',
  'handle',
  'pin',
  'unpin',
  'delete_post',
]);

const TRADE_ACTION = /(?:^|_)(?:buy|sell|swap|callout|consensus)$|^binance_new$/;

/**
 * Evidence-based: an explicit trade action or anything carrying a routable
 * contract is "tradable"; account/profile changes never are, even if the
 * upstream frame happens to include a contract.
 */
export function alertTierForEvent(event: WindEvent): SoundTier {
  const action = event.action?.toLowerCase() ?? '';
  if (PROFILE_ACTIONS.has(action)) return 'signal-social';
  if (TRADE_ACTION.test(action) || event.consensus || event.token) return 'signal-trade';
  return 'signal-social';
}

const MAJOR_NEWS_GROUPS: ReadonlySet<NewsGroup> = new Set(['headline', 'notice']);

export function alertTierForNews(item: Pick<NewsItem, 'group'>): SoundTier {
  return MAJOR_NEWS_GROUPS.has(item.group) ? 'news-major' : 'news-minor';
}

export function highestTier(tiers: Iterable<SoundTier>): SoundTier | null {
  let best: SoundTier | null = null;
  for (const tier of tiers) if (!best || PRIORITY[tier] > PRIORITY[best]) best = tier;
  return best;
}

export const ALERT_COALESCE_MS = 1_500;

/**
 * Leading-edge gate with upgrade: the first alert plays immediately (no added
 * latency); within the window, only a strictly more important tier plays.
 */
export function createAlertGate(windowMs = ALERT_COALESCE_MS) {
  let lastAt = Number.NEGATIVE_INFINITY;
  let lastTier: SoundTier | null = null;
  return (tier: SoundTier, now = Date.now()): boolean => {
    if (lastTier && now - lastAt < windowMs && PRIORITY[tier] <= PRIORITY[lastTier]) return false;
    lastAt = now;
    lastTier = tier;
    return true;
  };
}

/**
 * Reads the stored tier list. Configs saved by 0.5.0 only have per-group news
 * sound settings; translate those so upgrading keeps the user's choices.
 */
export function normalizeSoundTiers(value: unknown, legacyNewsSoundGroups?: unknown): SoundTier[] {
  if (Array.isArray(value)) return SOUND_TIERS.filter((tier) => value.includes(tier));
  if (Array.isArray(legacyNewsSoundGroups)) {
    const legacy = legacyNewsSoundGroups as unknown[];
    const has = (...groups: NewsGroup[]) => groups.some((group) => legacy.includes(group));
    return SOUND_TIERS.filter(
      (tier) =>
        tier === 'signal-trade' ||
        tier === 'signal-social' ||
        (tier === 'news-major' && has('headline', 'notice')) ||
        (tier === 'news-minor' && has('move', 'tradfi', 'social')),
    );
  }
  return DEFAULT_SOUND_TIERS;
}
