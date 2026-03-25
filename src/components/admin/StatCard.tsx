'use client';

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  prefix?: string;
  loading?: boolean;
}

export default function StatCard({ label, value, trend, prefix, loading }: StatCardProps) {
  if (loading) {
    return (
      <div className="bg-dark-800 border border-white/5 rounded-xl p-5 animate-pulse">
        <div className="h-3 w-20 bg-white/5 rounded mb-3" />
        <div className="h-7 w-28 bg-white/5 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-dark-800 border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
      <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-1.5">
        {label}
      </p>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-semibold text-white">
          {prefix && <span className="text-white/60 text-lg">{prefix}</span>}
          {value}
        </p>
        {trend && (
          <span
            className={`text-xs font-medium px-1.5 py-0.5 rounded mb-0.5 ${
              trend.isPositive
                ? 'text-emerald-400 bg-emerald-400/10'
                : 'text-red-400 bg-red-400/10'
            }`}
          >
            {trend.isPositive ? '+' : ''}
            {trend.value}%
          </span>
        )}
      </div>
    </div>
  );
}
