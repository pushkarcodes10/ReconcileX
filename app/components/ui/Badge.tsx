"use client";

import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "neutral";
  size?: "sm" | "md";
  dot?: boolean;
}

export function Badge({
  className,
  variant = "default",
  size = "md",
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const variants = {
    default: "bg-navy-600 text-gray-200",
    success: "bg-green-500/15 text-green-400 border border-green-500/30",
    warning: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    danger: "bg-red-500/15 text-red-400 border border-red-500/30",
    info: "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30",
    neutral: "bg-gray-500/15 text-gray-400 border border-gray-500/30",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full border",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />}
      {children}
    </span>
  );
}

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config: Record<string, { variant: BadgeProps["variant"]; label: string; dot: boolean }> = {
    MATCHED: { variant: "success", label: "Matched", dot: true },
    POTENTIAL_MATCH: { variant: "warning", label: "Potential Match", dot: true },
    UNMATCHED: { variant: "danger", label: "Unmatched", dot: true },
    EXCEPTION: { variant: "danger", label: "Exception", dot: true },
    RESOLVED: { variant: "success", label: "Resolved", dot: true },
    OPEN: { variant: "danger", label: "Open", dot: true },
    ASSIGNED: { variant: "info", label: "Assigned", dot: true },
    UNDER_REVIEW: { variant: "warning", label: "Under Review", dot: true },
    ESCALATED: { variant: "danger", label: "Escalated", dot: true },
    COMPLETED: { variant: "success", label: "Completed", dot: true },
    PROCESSING: { variant: "info", label: "Processing", dot: true },
    QUEUED: { variant: "neutral", label: "Queued", dot: true },
    FAILED: { variant: "danger", label: "Failed", dot: true },
    RETRY: { variant: "warning", label: "Retry", dot: true },
    READY: { variant: "success", label: "Ready", dot: true },
    VALIDATING: { variant: "info", label: "Validating", dot: true },
    NORMALIZING: { variant: "info", label: "Normalizing", dot: true },
    UPLOADING: { variant: "info", label: "Uploading", dot: true },
    DUPLICATE_DETECTION: { variant: "info", label: "Duplicate Detection", dot: true },
    IMPORTED: { variant: "neutral", label: "Imported", dot: true },
    VALIDATED: { variant: "info", label: "Validated", dot: true },
  };

  const cfg = config[status] || { variant: "default", label: status, dot: false };

  return <Badge variant={cfg.variant} size={size} dot={cfg.dot}>{cfg.label}</Badge>;
}