"use client";

import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/Badge";

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
  variant?: "default" | "highlight";
  className?: string;
}

export function MetricCard({
  label,
  value,
  change,
  changeLabel,
  trend = "neutral",
  icon,
  variant = "default",
  className,
}: MetricCardProps) {
  const trendColors = {
    up: "text-green-400",
    down: "text-red-400",
    neutral: "text-gray-500",
  };

  const trendIcons = {
    up: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ),
    down: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    ),
    neutral: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
      </svg>
    ),
  };

  return (
    <div
      className={cn(
        "rounded-xl border p-6 transition-all duration-200",
        variant === "default" && "bg-navy-800/50 border-navy-600 hover:border-navy-500",
        variant === "highlight" && "bg-cyan-500/10 border-cyan-500/30",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-400 truncate">{label}</p>
          <p className="mt-2 text-2xl lg:text-3xl font-semibold text-white tabular-nums">{value}</p>
          {(change !== undefined || changeLabel) && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className={cn("text-sm font-medium flex items-center gap-1", trendColors[trend])}>
                {trend !== "neutral" && trendIcons[trend]}
                {change !== undefined && (change >= 0 ? "+" : "")}{change?.toFixed(1)}%
              </span>
              {changeLabel && <span className="text-sm text-gray-500">{changeLabel}</span>}
            </div>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 ml-4 w-12 h-12 rounded-xl bg-navy-700/50 flex items-center justify-center text-gray-400">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: "cyan" | "green" | "amber" | "red" | "purple";
  trend?: { value: number; label: string };
  className?: string;
}

const colorStyles = {
  cyan: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  green: "bg-green-500/15 text-green-400 border-green-500/30",
  amber: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  red: "bg-red-500/15 text-red-400 border-red-500/30",
  purple: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

export function StatCard({ label, value, icon, color, trend, className }: StatCardProps) {
  return (
    <div className={cn("rounded-xl border p-6", colorStyles[color], className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-400">{label}</p>
          <p className="mt-2 text-2xl lg:text-3xl font-semibold text-white tabular-nums">{value}</p>
          {trend && (
            <div className="mt-2 flex items-center gap-1.5 text-sm font-medium text-gray-400">
              <span className={trend.value >= 0 ? "text-green-400" : "text-red-400"}>
                {trend.value >= 0 ? "+" : ""}{trend.value.toFixed(1)}%
              </span>
              <span>{trend.label}</span>
            </div>
          )}
        </div>
        <div className="flex-shrink-0 ml-4 w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
          <span className={cn("text-xl", `text-${color}-400`)}>{icon}</span>
        </div>
      </div>
    </div>
  );
}

interface KPIRowProps {
  metrics: MetricCardProps[];
  className?: string;
}

export function KPIRow({ metrics, className }: KPIRowProps) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4", className)}>
      {metrics.map((metric, index) => (
        <MetricCard key={index} {...metric} />
      ))}
    </div>
  );
}