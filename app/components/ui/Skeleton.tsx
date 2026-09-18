"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export function Skeleton({
  className,
  variant = "text",
  width,
  height,
  lines = 1,
  ...props
}: SkeletonProps) {
  if (variant === "circular") {
    return (
      <div
        className={cn("rounded-full bg-navy-600 animate-pulse", className)}
        style={{ width, height }}
        {...props}
      />
    );
  }

  if (variant === "rectangular") {
    return (
      <div
        className={cn("rounded-lg bg-navy-600 animate-pulse", className)}
        style={{ width, height }}
        {...props}
      />
    );
  }

  return (
    <div className={cn("space-y-2", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn("rounded bg-navy-600 animate-pulse h-4", i === lines - 1 && "w-3/4")}
          style={{ width: i === lines - 1 ? undefined : width }}
        />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-navy-600 bg-navy-800">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-navy-800/50 border-b border-navy-600">
            <tr>
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="px-4 py-3 text-left">
                  <Skeleton variant="text" width="80%" height="12px" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-600/50">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex} className="animate-pulse">
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <td key={colIndex} className="px-4 py-3">
                    <Skeleton
                      variant="text"
                      width={colIndex === 0 ? "100%" : "70%"}
                      height="14px"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-navy-600 bg-navy-800/50 p-6 animate-pulse space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton variant="text" width="40%" height="24px" />
        <Skeleton variant="circular" width="40px" height="40px" />
      </div>
      <Skeleton variant="text" width="60%" height="16px" />
      <div className="grid grid-cols-3 gap-4 pt-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton variant="text" width="50%" height="12px" />
            <Skeleton variant="text" width="80%" height="28px" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton variant="text" width="30%" height="32px" />
          <Skeleton variant="text" width="50%" height="16px" />
        </div>
        <Skeleton variant="rectangular" width="160px" height="40px" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <CardSkeleton />
    </div>
  );
}