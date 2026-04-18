export function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'N/A';
  const d = new Date(iso);
  return d.toLocaleDateString('en-AU', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatRelativeDate(iso: string | null | undefined): string {
  if (!iso) return 'N/A';
  const now = Date.now();
  const target = new Date(iso).getTime();
  const diffMs = target - now;
  const absDiff = Math.abs(diffMs);
  const minutes = Math.floor(absDiff / 60000);
  const hours = Math.floor(absDiff / 3600000);
  const days = Math.floor(absDiff / 86400000);

  const suffix = diffMs < 0 ? 'ago' : '';
  const prefix = diffMs >= 0 ? 'in ' : '';

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${prefix}${minutes}m${suffix ? ' ' + suffix : ''}`;
  if (hours < 24) return `${prefix}${hours}h${suffix ? ' ' + suffix : ''}`;
  if (days < 30) return `${prefix}${days}d${suffix ? ' ' + suffix : ''}`;
  return formatDate(iso);
}

export function isOverdue(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}
