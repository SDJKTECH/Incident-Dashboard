import type { Incident } from '../types/incident';
import type { Task } from '../types/task';
import { SEVERITIES } from '../lib/constants';
import {
  createdInLastDays,
  meanTimeToResolveMs,
  openBySeverity,
  taskCounts,
} from '../lib/metrics';
import { formatDuration } from '../lib/format';
import { MetricCard } from './MetricCard';

interface MetricsGridProps {
  incidents: readonly Incident[];
  tasks: readonly Task[];
  now?: Date | number;
}

function currentTime(): number {
  return Date.now();
}

export function MetricsGrid({ incidents, tasks, now = currentTime() }: MetricsGridProps): JSX.Element {
  const open = openBySeverity(incidents);
  const totalOpen = SEVERITIES.reduce((sum, s) => sum + open[s], 0);
  const { completed, pending } = taskCounts(tasks);
  return (
    <div
      role="region"
      aria-label="Metrics"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
    >
      <MetricCard label="Open incidents by severity" value={totalOpen}>
        <ul className="mt-2 space-y-1 text-sm text-gray-800">
          {[...SEVERITIES].reverse().map((s) => (
            <li key={s} className="flex justify-between gap-2">
              <span className="capitalize">{s}</span>
              <span data-testid={`open-${s}`}>{open[s]}</span>
            </li>
          ))}
        </ul>
      </MetricCard>
      <MetricCard label="MTTR" value={formatDuration(meanTimeToResolveMs(incidents))} />
      <MetricCard label="Tasks completed vs pending" value={`${completed} / ${pending}`}>
        <p className="mt-2 text-sm text-gray-800">
          {completed} completed, {pending} pending
        </p>
      </MetricCard>
      <MetricCard label="Created in last 7 days" value={createdInLastDays(incidents, now, 7)} />
    </div>
  );
}
