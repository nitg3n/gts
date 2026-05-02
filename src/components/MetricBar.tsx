import type { SchoolMetricKey } from "@/lib/types";
import { metricLabel } from "@/lib/utils";

export function MetricBar({
  metric,
  value,
}: {
  metric: SchoolMetricKey;
  value: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-bold text-zinc-600">
        <span>{metricLabel(metric)}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#0f766e,#2563eb)]"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
