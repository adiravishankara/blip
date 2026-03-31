interface MatchScoreBadgeProps {
  score?: number | null;
  size?: 'xs' | 'sm' | 'md';
  stale?: boolean;
}

export function MatchScoreBadge({ score, size = 'sm', stale = false }: MatchScoreBadgeProps) {
  if (score == null) return null;

  const rounded = Math.round(score);
  const isSmall = size === 'sm';

  let colorClass: string;
  if (rounded >= 70) {
    colorClass = 'bg-emerald-100 text-emerald-700 border-emerald-200';
  } else if (rounded >= 40) {
    colorClass = 'bg-amber-100 text-amber-700 border-amber-200';
  } else {
    colorClass = 'bg-red-100 text-red-700 border-red-200';
  }

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold border rounded-full ${colorClass} ${
        size === 'xs' ? 'text-[9px] px-1 py-0' :
        isSmall ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
      }`}
      title={stale ? 'Match score may be stale. Re-run match to refresh it.' : 'Match score against your profile'}
    >
      <span className={isSmall ? 'text-[10px]' : 'text-xs'}>{stale ? '!' : '⚡'}</span>
      {rounded}%
    </span>
  );
}
