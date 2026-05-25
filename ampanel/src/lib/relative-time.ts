const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;
const MONTH = 2592000;
const YEAR = 31536000;

export function relativeTime(dateStr: string | null): string {
  if (!dateStr) return '—';

  const date = new Date(dateStr);
  const now = Date.now();
  const diffSec = Math.round((now - date.getTime()) / 1000);

  if (diffSec < 0) {
    const absSec = Math.abs(diffSec);
    if (absSec < MINUTE) return 'in a few seconds';
    if (absSec < HOUR) return `in ${Math.floor(absSec / MINUTE)}m`;
    if (absSec < DAY) return `in ${Math.floor(absSec / HOUR)}h`;
    if (absSec < MONTH) return `in ${Math.floor(absSec / DAY)}d`;
    if (absSec < YEAR) return `in ${Math.floor(absSec / MONTH)}mo`;
    return `in ${Math.floor(absSec / YEAR)}y`;
  }

  if (diffSec < MINUTE) return 'just now';
  if (diffSec < HOUR) return `${Math.floor(diffSec / MINUTE)}m ago`;
  if (diffSec < DAY) return `${Math.floor(diffSec / HOUR)}h ago`;
  if (diffSec < MONTH) return `${Math.floor(diffSec / DAY)}d ago`;
  if (diffSec < YEAR) return `${Math.floor(diffSec / MONTH)}mo ago`;
  return `${Math.floor(diffSec / YEAR)}y ago`;
}
