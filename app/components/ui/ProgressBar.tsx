"use client";

import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max?: number;
  showLabel?: boolean;
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "success" | "warning" | "danger";
  animated?: boolean;
  striped?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  showLabel = false,
  label,
  size = "md",
  variant = "default",
  animated = false,
  striped = false,
  className,
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const sizes = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-4",
  };

  const variants = {
    default: "bg-cyan-500",
    success: "bg-green-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
  };

  return (
    <div className="w-full" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      {(showLabel || label) && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-gray-300">{label || "Progress"}</span>
          {showLabel && <span className="text-sm font-mono text-gray-400 tabular-nums">{percentage.toFixed(0)}%</span>}
        </div>
      )}
      <div
        className={cn(
          "relative overflow-hidden rounded-full bg-navy-700 border border-navy-600",
          sizes[size]
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            variants[variant],
            striped && "bg-[linear-gradient(45deg,rgba(255,255,255,.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.15)_50%,rgba(255,255,255,.15)_75%,transparent_75%,transparent)] bg-[size:1rem_1rem]",
            animated && "animate-[progress-stripe_1s_linear_infinite]"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <style jsx global>{`
        @keyframes progress-stripe {
          0% { background-position: 0 0; }
          100% { background-position: 1rem 0; }
        }
      `}</style>
    </div>
  );
}

interface CircularProgressProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  variant?: "default" | "success" | "warning" | "danger";
  className?: string;
}

export function CircularProgress({
  value,
  max = 100,
  size = 48,
  strokeWidth = 4,
  showLabel = true,
  variant = "default",
  className,
}: CircularProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  const variants = {
    default: "text-cyan-500",
    success: "text-green-500",
    warning: "text-amber-500",
    danger: "text-red-500",
  };

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          className="text-navy-600"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={cn("transition-all duration-500 ease-out", variants[variant])}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      {showLabel && (
        <span className="absolute inset-0 flex items-center justify-center text-sm font-mono font-semibold tabular-nums text-white">
          {percentage.toFixed(0)}%
        </span>
      )}
    </div>
  );
}

interface StepProgressProps {
  steps: { label: string; completed?: boolean; active?: boolean; error?: boolean }[];
  className?: string;
}

export function StepProgress({ steps, className }: StepProgressProps) {
  return (
    <div className={cn("flex items-center", className)}>
      {steps.map((step, index) => (
        <div key={step.label} className="flex items-center">
          <div className="flex items-center justify-center">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300",
                step.error
                  ? "bg-red-500 text-white border-2 border-red-500"
                  : step.completed
                  ? "bg-green-500 text-white border-2 border-green-500"
                  : step.active
                  ? "bg-cyan-500 text-navy-900 border-2 border-cyan-500"
                  : "bg-navy-700 text-gray-500 border-2 border-navy-500"
              )}
            >
              {step.completed && !step.error ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : step.error ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                index + 1
              )}
            </div>
          </div>
          <div className="ml-2">
            <p className={cn("text-sm font-medium", step.active ? "text-white" : "text-gray-400")}>
              {step.label}
            </p>
          </div>
          {index < steps.length - 1 && (
            <div
              className={cn(
                "w-16 h-0.5 mx-2 relative",
                step.completed && !step.error ? "bg-green-500" : "bg-navy-600"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}