"use client";

import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-12 lg:py-16 px-4", className)}>
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-navy-700 flex items-center justify-center text-gray-500 mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {description && (
        <p className="mt-2 text-gray-400 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

interface LoadingStateProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingState({ message, size = "md", className }: LoadingStateProps) {
  const sizes = {
    sm: "w-6 h-6 border-2",
    md: "w-8 h-8 border-2",
    lg: "w-12 h-12 border-3",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center py-12 lg:py-16 px-4", className)}>
      <div
        className={cn(
          "rounded-full border-cyan-500 border-t-transparent animate-spin",
          sizes[size]
        )}
        role="status"
        aria-label="Loading"
      />
      {message && <p className="mt-4 text-sm text-gray-400">{message}</p>}
    </div>
  );
}

interface InlineLoadingProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function InlineLoading({ size = "md", className }: InlineLoadingProps) {
  const sizes = {
    sm: "w-4 h-4 border-2",
    md: "w-5 h-5 border-2",
    lg: "w-6 h-6 border-2",
  };

  return (
    <div
      className={cn("rounded-full border-cyan-500 border-t-transparent animate-spin", sizes[size], className)}
      role="status"
      aria-label="Loading"
    />
  );
}

interface ErrorStateProps {
  title: string;
  message?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function ErrorState({ title, message, action, icon, className }: ErrorStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-12 lg:py-16 px-4", className)}>
      {icon || (
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-400 mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
      )}
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {message && <p className="mt-2 text-gray-400 max-w-sm">{message}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function TableEmptyState({ columns = 5, rows = 3 }: { columns?: number; rows?: number }) {
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
              <tr key={rowIndex}>
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <td key={colIndex} className="px-4 py-3">
                    <Skeleton variant="text" width={colIndex === 0 ? "100%" : "70%"} height="14px" />
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

export function CardGridEmptyState({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="rectangular" className="aspect-square" />
      ))}
    </div>
  );
}