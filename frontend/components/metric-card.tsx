import { LucideIcon } from 'lucide-react';

export function MetricCard({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: number;
  hint: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-600">{title}</p>
        <span className="rounded-xl bg-blue-50 p-2 text-blue-700">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <strong className="mt-3 block text-3xl font-bold text-slate-950">{value}</strong>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}
