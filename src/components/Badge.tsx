interface BadgeProps {
  kind: 'severity' | 'status';
  value: string;
}

const COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-800 border-slate-400',
  medium: 'bg-yellow-100 text-yellow-900 border-yellow-500',
  high: 'bg-orange-100 text-orange-900 border-orange-500',
  critical: 'bg-red-100 text-red-900 border-red-600',
  open: 'bg-blue-100 text-blue-900 border-blue-500',
  investigating: 'bg-purple-100 text-purple-900 border-purple-500',
  resolved: 'bg-green-100 text-green-900 border-green-600',
  closed: 'bg-gray-200 text-gray-800 border-gray-500',
};

export function Badge({ kind, value }: BadgeProps): JSX.Element {
  const color = COLORS[value] ?? 'bg-gray-100 text-gray-800 border-gray-400';
  return (
    <span
      data-kind={kind}
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${color}`}
    >
      {value}
    </span>
  );
}
