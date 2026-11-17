import { useEffect, useRef, useState } from 'react';
import { Play, Volume2 } from 'lucide-react';
import { SOUND_TIERS, SOUND_TIER_META, type SoundTier } from '../shared/alert';
import type { StreamConfig } from '../shared/protocol';
import { playAlertSound, soundDuration } from './sound';

export function SoundSettingsSection({
  draft,
  onChange,
}: {
  draft: StreamConfig;
  onChange: (next: StreamConfig) => void;
}) {
  const [previewing, setPreviewing] = useState<SoundTier | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const preview = (tier: SoundTier) => {
    playAlertSound(tier);
    setPreviewing(tier);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPreviewing(null), soundDuration(tier) * 1_000 + 150);
  };

  const toggle = (tier: SoundTier) => {
    const current = draft.soundTiers;
    const next = current.includes(tier)
      ? current.filter((value) => value !== tier)
      : SOUND_TIERS.filter((value) => value === tier || current.includes(value));
    onChange({ ...draft, soundTiers: next });
  };

  return (
    <section className="settings-section sound-section">
      <h2>提示音</h2>
      <label className="switch-row is-first">
        <input
          type="checkbox"
          checked={draft.soundEnabled}
          onChange={(event) => onChange({ ...draft, soundEnabled: event.target.checked })}
        />
        <span>
          <strong>新消息提示音</strong>
          <small>总开关，与页头铃铛同步；侧栏或分栏窗口打开时播放，同时打开多个视图只响一处</small>
        </span>
      </label>

      <ul className={`sound-tier-list ${draft.soundEnabled ? '' : 'is-muted'}`}>
        {SOUND_TIERS.map((tier) => {
          const meta = SOUND_TIER_META[tier];
          const enabled = draft.soundTiers.includes(tier);
          return (
            <li key={tier} className={`sound-tier tier-${tier}`}>
              <span className="sound-tier-text">
                <span className="sound-tier-title">
                  <strong>{meta.label}</strong>
                  <span className="sound-signature">{meta.signature}</span>
                </span>
                <small>{meta.covers}</small>
              </span>
              <button
                type="button"
                className={`sound-preview ${previewing === tier ? 'is-playing' : ''}`}
                aria-label={`试听${meta.label}提示音`}
                title="试听"
                onClick={() => preview(tier)}
              >
                {previewing === tier ? (
                  <Volume2 size={14} aria-hidden="true" />
                ) : (
                  <Play size={13} aria-hidden="true" />
                )}
              </button>
              <input
                type="checkbox"
                className="sound-tier-switch"
                role="switch"
                checked={enabled}
                disabled={!draft.soundEnabled}
                aria-label={`${meta.label}提示音`}
                onChange={() => toggle(tier)}
              />
            </li>
          );
        })}
      </ul>
      <p className="field-help">
        两声表示值得马上看，一声表示有空再看；方波来自听风，钟声来自方程式。1.5 秒内多条消息只响最重要的一档。
      </p>
    </section>
  );
}
