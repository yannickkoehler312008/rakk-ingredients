/**
 * "2h ago" / "Yesterday" / "3d ago" for the recently-scanned list (§4, Home).
 * `now` is injectable so it can be tested without freezing the clock.
 */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.round((now.getTime() - then) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  return weeks === 1 ? '1w ago' : `${weeks}w ago`;
}
