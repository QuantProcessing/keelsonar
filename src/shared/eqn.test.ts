import { describe, expect, it } from 'vitest';
import { EQN_SAMPLE_ITEMS } from './eqn.fixture';
import { parseMcpNewsItem, parseNewsItem, parseNewsPage } from './eqn';

const NOW = new Date('2026-11-17T03:00:00.000Z');

function sample(no: number): Record<string, unknown> {
  const item = EQN_SAMPLE_ITEMS.find((entry) => entry.no === no);
  if (!item) throw new Error(`missing sample ${no}`);
  return item;
}

describe('parseNewsItem', () => {
  it('maps a main-feed headline, strips t.co links and keeps the English original', () => {
    const item = parseNewsItem(sample(15339), NOW);
    expect(item).toMatchObject({
      id: 'eqn:15339',
      channel: 'main',
      group: 'headline',
      source: 'AggrNews',
      title: 'CFTC批准Backpack成为首个采用区块链技术的DCO和DCM',
      pageUrl: 'https://eqn.news/main/15339',
      telegramUrl: 'https://t.me/BWEnews/16630',
      sourceUrl: 'https://x.com/AggrNews/status/2122455337076662282',
    });
    expect(item?.original?.language).toBe('EN');
    expect(item?.original?.text).not.toContain('t.co');
    expect(item?.receivedAt).toBe(NOW.toISOString());
  });

  it('prefers main as the display channel when a story is cross-posted', () => {
    const item = parseNewsItem(sample(14273), NOW);
    expect(item?.channel).toBe('main');
    expect(item?.channels).toEqual(['main', 'korea']);
    expect(item?.original?.language).toBe('KO');
    expect(item?.coins).toEqual(['DNA']);
  });

  it('extracts price move metrics and removes the base coin from the coin list', () => {
    const item = parseNewsItem(sample(15381), NOW);
    expect(item?.group).toBe('move');
    expect(item?.market).toMatchObject({
      signal: 'price',
      symbol: 'BLESSUSDT',
      base: 'BLESS',
      direction: 'up',
      windowLabel: '10 秒内',
      venue: 'Binance 永续',
    });
    expect(item?.market?.changePct).toBeCloseTo(5.68, 1);
    expect(item?.market?.change24hPct).toBeCloseTo(80.16, 1);
    expect(item?.coins).toEqual([]);
  });

  it('describes OI moves by quadrant', () => {
    const item = parseNewsItem(sample(15254), NOW);
    expect(item?.market).toMatchObject({ signal: 'oi', direction: 'down', stance: '空头进场' });
    expect(item?.market?.oiChangePct).toBeCloseTo(9.03, 1);
  });

  it('maps US stock moves against the previous close', () => {
    const item = parseNewsItem(sample(15294), NOW);
    expect(item?.group).toBe('tradfi');
    expect(item?.market).toMatchObject({
      signal: 'stock',
      symbol: 'TSM',
      direction: 'down',
      windowLabel: '较昨收',
      indexLabel: 'QQQ',
    });
  });

  it('splits multi-line stories into title and body', () => {
    const item = parseNewsItem(sample(15384), NOW);
    expect(item?.title).toBe('英伟达员工考虑在园区举行示威活动以支持黄仁勋：华尔街日报');
    expect(item?.body?.split('\n')).toHaveLength(3);
  });

  it('rejects malformed items and unsafe links', () => {
    expect(parseNewsItem(null)).toBeNull();
    expect(parseNewsItem({ no: 1, published_ts: 1, i18n: {} })).toBeNull();
    const item = parseNewsItem({
      ...sample(15198),
      url: 'javascript:alert(1)',
      path: '//evil.example/1',
    });
    expect(item?.sourceUrl).toBeUndefined();
    expect(item?.pageUrl).toBe('https://eqn.news/15198');
  });
});

describe('parseNewsPage', () => {
  it('sorts newest first and keeps the paging cursor', () => {
    const page = parseNewsPage({ items: EQN_SAMPLE_ITEMS, next_cursor: '1-2' }, NOW, {
      historical: true,
    });
    expect(page.items).toHaveLength(EQN_SAMPLE_ITEMS.length);
    expect(page.nextCursor).toBe('1-2');
    expect(page.items[0].no).toBe(15384);
    expect(page.items.every((item) => item.receivedAt === item.publishedAt)).toBe(true);
  });
});

describe('parseMcpNewsItem', () => {
  it('accepts the MCP list_news fallback shape', () => {
    const item = parseMcpNewsItem(
      {
        no: 15382,
        time: '2026-11-17T02:28:18.140Z',
        channels: ['tier3'],
        source: 'Mexc Announcements',
        zh: 'MEXC调整4和MAV期货的Tick Size',
        coins: ['MAV'],
        url: 'https://eqn.news/monitor/15382',
        source_url: 'https://www.mexc.com/announcements/article/1',
      },
      NOW,
    );
    expect(item).toMatchObject({
      id: 'eqn:15382',
      group: 'notice',
      coins: ['MAV'],
      pageUrl: 'https://eqn.news/monitor/15382',
    });
  });
});
