"use client";

import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";

interface ChartCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export function ChartCard({ title, description, children, className, action }: ChartCardProps) {
  return (
    <Card className={cn("h-full", className)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            {description && (
              <p className="mt-1 text-sm text-gray-400">{description}</p>
            )}
          </div>
          {action && <div className="flex-shrink-0 ml-4">{action}</div>}
        </div>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

interface LineChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  yKeys: { key: string; label: string; color: string }[];
  height?: number;
  showGrid?: boolean;
  showTooltip?: boolean;
  className?: string;
}

export function LineChart({
  data,
  xKey,
  yKeys,
  height = 280,
  showGrid = true,
  showTooltip = true,
  className,
  ariaLabel,
}: LineChartProps & { ariaLabel?: string }) {
  if (data.length === 0) {
    return (
      <div className={cn("h-[280px] flex items-center justify-center", className)}>
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  const maxValue = Math.max(...data.flatMap((d) => yKeys.map((k) => (d[k.key] as number) || 0)));
  const minValue = Math.min(...data.flatMap((d) => yKeys.map((k) => (d[k.key] as number) || 0)));
  const range = maxValue - minValue || 1;
  const padding = 20;
  const chartWidth = "100%";
  const chartHeight = height - padding * 2;

  const getX = (index: number) => padding + (index / (data.length - 1 || 1)) * (height - padding * 2);
  const getY = (value: number) => height - padding - ((value - minValue) / range) * chartHeight;

  const points = yKeys.map((yKey) =>
    data
      .map((d, i) => `${getX(i)},${getY((d[yKey.key] as number) || 0)}`)
      .join(" ")
  );

  return (
    <div className={cn("relative", className)} style={{ height }}>
      <svg viewBox={`0 0 ${height} ${height}`} className="w-full h-full" role="img" aria-label={ariaLabel}>
        {showGrid && (
          <g stroke="currentColor" strokeWidth="0.5" opacity="0.1">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
              <line
                key={ratio}
                x1={padding}
                y1={height - padding - ratio * chartHeight}
                x2={height - padding}
                y2={height - padding - ratio * chartHeight}
              />
            ))}
            {data.map((_, i) => (
              <line
                key={i}
                x1={getX(i)}
                y1={padding}
                x2={getX(i)}
                y2={height - padding}
              />
            ))}
          </g>
        )}

        {yKeys.map((yKey, keyIndex) => (
          <polyline
            key={yKey.key}
            fill="none"
            stroke={yKey.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points[keyIndex]}
            className="transition-opacity duration-200"
          />
        ))}

        {data.map((d, i) => (
          <g key={i} className="chart-tooltip-trigger">
            <circle
              cx={getX(i)}
              cy={getY((d[yKeys[0].key] as number) || 0)}
              r={showTooltip ? 4 : 0}
              fill="transparent"
              stroke="transparent"
              className="hover:fill-cyan-500 hover:stroke-cyan-500 hover:r-3 transition-all duration-150"
            />
          </g>
        ))}
      </svg>

      <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 pb-2 text-xs text-gray-500">
        {data.map((d, i) =>
          i % Math.ceil(data.length / 6) === 0 || i === data.length - 1 ? (
            <span key={i} className="text-center" style={{ left: `${(i / (data.length - 1 || 1)) * 100}%` }}>
              {String(d[xKey])}
            </span>
          ) : null
        )}
      </div>

      <div className="absolute top-4 right-4 flex gap-4 text-xs">
        {yKeys.map((yKey) => (
          <div key={yKey.key} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: yKey.color }} />
            <span className="text-gray-400">{yKey.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  showValues?: boolean;
  maxValue?: number;
  className?: string;
}

export function BarChart({ data, height = 200, showValues = true, maxValue, className }: BarChartProps) {
  if (data.length === 0) {
    return <div className={cn("h-[200px] flex items-center justify-center", className)}><p className="text-gray-500">No data</p></div>;
  }

  const max = maxValue || Math.max(...data.map((d) => d.value));
  const barWidth = 100 / data.length / 1.5;

  return (
    <div className={cn("relative h-full flex items-end justify-center gap-2 px-2", className)} style={{ height }}>
      {data.map((item, index) => (
        <div key={index} className="flex flex-col items-center flex-1 h-full relative">
          <div
            className="w-full rounded-t transition-all duration-500 ease-out bg-gradient-to-t"
            style={{
              height: `${(item.value / max) * 100}%`,
              backgroundColor: item.color || "#00D4AA",
              minHeight: item.value > 0 ? "4px" : "0",
            }}
          >
            {showValues && item.value > 0 && (
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium text-gray-300 whitespace-nowrap">
                {item.value.toLocaleString()}
              </span>
            )}
          </div>
          <span className="mt-2 text-xs text-gray-500 text-center whitespace-nowrap">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
  strokeWidth?: number;
  showLegend?: boolean;
  className?: string;
}

export function DonutChart({ data, size = 200, strokeWidth = 16, showLegend = true, className }: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = data.map((item, index) => {
    const percentage = item.value / total;
    const dashLength = percentage * circumference;
    const prevTotal = data.slice(0, index).reduce((sum, d) => sum + d.value, 0);
    const prevPercentage = prevTotal / total;
    const offset = circumference - prevPercentage * circumference - dashLength;

    return (
      <circle
        key={index}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="transparent"
        stroke={item.color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${dashLength} ${circumference - dashLength}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-500 ease-out"
      />
    );
  });

  return (
    <div className={cn("flex items-center justify-center gap-6", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
          {segments}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-2xl font-semibold text-white tabular-nums">{total.toLocaleString()}</p>
            <p className="text-xs text-gray-400">Total</p>
          </div>
        </div>
      </div>

      {showLegend && (
        <div className="flex flex-col gap-2 text-sm">
          {data.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
              <span className="text-gray-300 flex-1 truncate">{item.label}</span>
              <span className="text-white font-medium tabular-nums">
                {((item.value / total) * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}