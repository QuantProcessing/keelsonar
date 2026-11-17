export function formatUsd(value: number): string {
  const amount = Math.max(0, value);
  if (amount >= 1_000_000_000_000) return `$${(amount / 1_000_000_000_000).toFixed(1)}T`;
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}

export function formatPriceUsd(value: number): string {
  const price = Math.max(0, value);
  if (price === 0) return '$0';
  if (price >= 1) {
    return `$${price.toLocaleString('en-US', { maximumFractionDigits: price >= 100 ? 2 : 4 })}`;
  }
  const decimals = Math.min(10, Math.max(4, Math.ceil(-Math.log10(price)) + 3));
  return `$${price.toFixed(decimals).replace(/\.?0+$/, '')}`;
}

export function formatSignedPercent(value: number): string {
  const digits = Math.abs(value) >= 10 ? 1 : 2;
  const fixed = Math.abs(value).toFixed(digits);
  return `${value < 0 ? '−' : '+'}${fixed}%`;
}

export function formatRatePercent(value: number): string {
  const fixed = Math.abs(value).toFixed(4).replace(/\.?0+$/, '');
  return `${value < 0 ? '−' : ''}${fixed}%`;
}

export function relativeTime(value: string, current: number): string {
  const seconds = Math.max(0, Math.floor((current - Date.parse(value)) / 1_000));
  if (seconds < 8) return '刚刚';
  if (seconds < 60) return `${seconds} 秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

export function clockTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '--:--:--';
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

/** Clock for feeds that can span days: same-day items keep seconds, older ones show the date. */
export function dayAwareClock(value: string, current: number): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '--:--';
  if (date.toDateString() === new Date(current).toDateString()) return clockTime(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const time = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `${month}-${day} ${time}`;
}
