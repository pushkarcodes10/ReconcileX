"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface BreadcrumbProps {
  items: { label: string; href?: string }[];
  className?: string;
  separator?: React.ReactNode;
}

function DefaultSeparator() {
  return (
    <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function SeparatorWrapper({ children }: { children: React.ReactNode }) {
  return <span aria-hidden="true">{children}</span>;
}

export function Breadcrumb({ items, className, separator }: BreadcrumbProps) {
  if (items.length === 0) return null;

  const Sep = separator ? () => <SeparatorWrapper>{separator}</SeparatorWrapper> : DefaultSeparator;

  return (
    <nav className={cn("flex items-center gap-2 text-sm", className)} aria-label="Breadcrumb">
      <ol className="flex items-center gap-2" role="list">
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center gap-2">
            {index > 0 && <Sep />}
            {item.href ? (
              <Link
                href={item.href}
                className={cn(
                  "transition-colors",
                  index === items.length - 1
                    ? "text-white font-medium"
                    : "text-gray-400 hover:text-white"
                )}
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  index === items.length - 1 ? "text-white font-medium" : "text-gray-400"
                )}
                aria-current={index === items.length - 1 ? "page" : undefined}
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

interface BreadcrumbItemProps {
  label: string;
  href?: string;
  isCurrent?: boolean;
  className?: string;
}

export function BreadcrumbItem({ label, href, isCurrent = false, className }: BreadcrumbItemProps) {
  return (
    <li className="flex items-center gap-2">
      {!isCurrent && (
        <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
      {href ? (
        <Link
          href={href}
          className={cn(
            "transition-colors text-sm",
            isCurrent ? "text-white font-medium" : "text-gray-400 hover:text-white",
            className
          )}
          aria-current={isCurrent ? "page" : undefined}
        >
          {label}
        </Link>
      ) : (
        <span className={cn("text-sm", isCurrent ? "text-white font-medium" : "text-gray-400", className)} aria-current={isCurrent ? "page" : undefined}>
          {label}
        </span>
      )}
    </li>
  );
}