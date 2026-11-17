import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SOUND_TIERS,
  alertTierForEvent,
  alertTierForNews,
  createAlertGate,
  highestTier,
  normalizeSoundTiers,
} from './alert';
import type { WindEvent } from './protocol';

function event(patch: Partial<WindEvent>): WindEvent {
  return {
    id: 'e1',
    source: 'x',
    occurredAt: '2026-11-17T03:00:00.000Z',
    receivedAt: '2026-11-17T03:00:00.100Z',
    title: 'test',
    importance: 'normal',
    ...patch,
  };
}

const TOKEN = { chain: 'sol', address: 'So11111111111111111111111111111111111111112' };

describe('alertTierForEvent', () => {
  it('treats trade, callout, consensus and listing actions as tradable', () => {
    for (const action of [
      'fomo_buy',
      'fomo_sell',
      'fomo_swap',
      'pump_buy',
      'pump_sell',
      'pump_callout',
      'fomo_consensus',
      'binance_new',
    ]) {
      expect(alertTierForEvent(event({ action })), action).toBe('signal-trade');
    }
  });

  it('upgrades any other event that carries a contract address', () => {
    expect(alertTierForEvent(event({ action: 'tweet', token: TOKEN }))).toBe('signal-trade');
    expect(alertTierForEvent(event({ action: 'tweet' }))).toBe('signal-social');
  });

  it('keeps profile changes social even when a contract is attached', () => {
    for (const action of ['follow', 'unfollow', 'description', 'name', 'photo', 'pin', 'delete_post']) {
      expect(alertTierForEvent(event({ action, token: TOKEN })), action).toBe('signal-social');
    }
  });

  it('treats views, updates and wallet/tier changes without a contract as social', () => {
    for (const action of ['fomo_thesis', 'pump_update', 'fomo_cash', 'ansem_tier', 'reply', 'quote']) {
      expect(alertTierForEvent(event({ action })), action).toBe('signal-social');
    }
  });
});

describe('alertTierForNews', () => {
  it('splits headline and notices from monitors', () => {
    expect(alertTierForNews({ group: 'headline' })).toBe('news-major');
    expect(alertTierForNews({ group: 'notice' })).toBe('news-major');
    expect(alertTierForNews({ group: 'move' })).toBe('news-minor');
    expect(alertTierForNews({ group: 'tradfi' })).toBe('news-minor');
    expect(alertTierForNews({ group: 'social' })).toBe('news-minor');
  });
});

describe('highestTier', () => {
  it('ranks tradable signals over major news over the rest', () => {
    expect(highestTier(['news-minor', 'news-major', 'signal-social'])).toBe('news-major');
    expect(highestTier(['news-major', 'signal-trade'])).toBe('signal-trade');
    expect(highestTier([])).toBeNull();
  });
});

describe('createAlertGate', () => {
  it('plays the first alert, suppresses equal or lower tiers in the window, allows upgrades', () => {
    const gate = createAlertGate(1_500);
    expect(gate('news-major', 0)).toBe(true);
    expect(gate('news-major', 400)).toBe(false);
    expect(gate('news-minor', 800)).toBe(false);
    expect(gate('signal-trade', 900)).toBe(true);
    expect(gate('news-major', 1_200)).toBe(false);
    expect(gate('news-major', 2_500)).toBe(true);
  });
});

describe('normalizeSoundTiers', () => {
  it('defaults to everything except minor news', () => {
    expect(normalizeSoundTiers(undefined)).toEqual(DEFAULT_SOUND_TIERS);
    expect(DEFAULT_SOUND_TIERS).not.toContain('news-minor');
  });

  it('keeps known tiers in canonical order', () => {
    expect(normalizeSoundTiers(['news-minor', 'bogus', 'signal-trade'])).toEqual([
      'signal-trade',
      'news-minor',
    ]);
    expect(normalizeSoundTiers([])).toEqual([]);
  });

  it('migrates 0.5.0 per-group news sound settings', () => {
    expect(normalizeSoundTiers(undefined, ['headline', 'notice'])).toEqual([
      'signal-trade',
      'signal-social',
      'news-major',
    ]);
    expect(normalizeSoundTiers(undefined, ['move'])).toEqual([
      'signal-trade',
      'signal-social',
      'news-minor',
    ]);
    expect(normalizeSoundTiers(undefined, [])).toEqual(['signal-trade', 'signal-social']);
  });
});
