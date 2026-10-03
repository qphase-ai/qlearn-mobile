/** Compact relative time for list rows ("5 min ago", "Yesterday"). */
export function relativeTime(then: number, now = Date.now()): string {
  const minutes = Math.round((now - then) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}
