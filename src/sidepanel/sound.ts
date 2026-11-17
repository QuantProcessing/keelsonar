import type { SoundTier } from '../shared/alert';

export interface ToneSpec {
  /** Offset from the sound start, seconds. */
  at: number;
  freq: number;
  /** Time until the envelope is silent, seconds. */
  duration: number;
  wave: OscillatorType;
  /** Peak gain of the envelope. */
  gain: number;
  attack: number;
  /** Softens square waves so the panel never sounds like an alarm. */
  lowpass?: number;
  /** Inharmonic overtones (ratio to `freq`) that make a sine read as a bell. */
  partials?: Array<{ ratio: number; gain: number }>;
}

const BELL_PARTIALS = [
  { ratio: 2.76, gain: 0.22 },
  { ratio: 5.4, gain: 0.07 },
];

/**
 * Wind signals = filtered square pulses; eqn.news = bell/sine. Two pulses mean
 * "look now", one means "when free". Trade rises, major news falls, so even
 * the two-pulse sounds differ in direction as well as timbre.
 */
export const ALERT_SOUNDS: Record<SoundTier, ToneSpec[]> = {
  'signal-trade': [
    { at: 0, freq: 660, duration: 0.09, wave: 'square', gain: 0.09, attack: 0.006, lowpass: 2_600 },
    { at: 0.11, freq: 990, duration: 0.11, wave: 'square', gain: 0.1, attack: 0.006, lowpass: 2_600 },
  ],
  'signal-social': [
    { at: 0, freq: 740, duration: 0.08, wave: 'square', gain: 0.045, attack: 0.006, lowpass: 2_000 },
  ],
  'news-major': [
    { at: 0, freq: 1_046.5, duration: 0.42, wave: 'sine', gain: 0.12, attack: 0.004, partials: BELL_PARTIALS },
    { at: 0.18, freq: 784, duration: 0.6, wave: 'sine', gain: 0.12, attack: 0.004, partials: BELL_PARTIALS },
  ],
  'news-minor': [
    { at: 0, freq: 1_318.5, duration: 0.12, wave: 'sine', gain: 0.04, attack: 0.003 },
  ],
};

export function soundDuration(tier: SoundTier): number {
  return Math.max(...ALERT_SOUNDS[tier].map((tone) => tone.at + tone.duration));
}

const SILENT = 0.0001;

/** Schedules one tier on any audio context, so it can also be rendered offline. */
export function scheduleAlertSound(
  context: BaseAudioContext,
  tier: SoundTier,
  startAt = context.currentTime,
  destination: AudioNode = context.destination,
): void {
  for (const tone of ALERT_SOUNDS[tier]) {
    const begin = startAt + tone.at;
    const end = begin + tone.duration;

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(SILENT, begin);
    envelope.gain.exponentialRampToValueAtTime(tone.gain, begin + tone.attack);
    envelope.gain.exponentialRampToValueAtTime(SILENT, end);

    if (tone.lowpass) {
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = tone.lowpass;
      filter.Q.value = 0.7;
      envelope.connect(filter);
      filter.connect(destination);
    } else {
      envelope.connect(destination);
    }

    for (const voice of [{ ratio: 1, gain: 1 }, ...(tone.partials ?? [])]) {
      const oscillator = context.createOscillator();
      oscillator.type = tone.wave;
      oscillator.frequency.setValueAtTime(tone.freq * voice.ratio, begin);
      if (voice.gain === 1) {
        oscillator.connect(envelope);
      } else {
        const level = context.createGain();
        level.gain.value = voice.gain;
        oscillator.connect(level);
        level.connect(envelope);
      }
      oscillator.start(begin);
      oscillator.stop(end + 0.02);
    }
  }
}

let sharedContext: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (sharedContext && sharedContext.state !== 'closed') return sharedContext;
  const AudioContextClass =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  sharedContext = new AudioContextClass();
  return sharedContext;
}

/** Plays one tier through a single shared context (one per page, not per beep). */
export function playAlertSound(tier: SoundTier): void {
  const context = audioContext();
  if (!context) return;
  const start = () => scheduleAlertSound(context, tier, context.currentTime + 0.01);
  if (context.state === 'suspended') {
    void context.resume().then(start, () => undefined);
  } else {
    start();
  }
}
