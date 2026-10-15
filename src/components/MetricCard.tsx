import type { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  children?: ReactNode;
}

export function MetricCard({ label, value, children }: MetricCardProps): JSX.Element {
  return (
    <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-medium text-gray-700">{label}</h3>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {children}
    </div>
  );
}
