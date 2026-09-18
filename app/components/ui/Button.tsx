"use client";

import { forwardRef, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-900 disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
      primary: "bg-cyan-500 text-navy-900 hover:bg-cyan-400 active:bg-cyan-600 shadow-sm",
      secondary: "bg-navy-700 text-gray-100 hover:bg-navy-600 active:bg-navy-800 border border-navy-500",
      ghost: "text-gray-300 hover:bg-navy-700 hover:text-white active:bg-navy-600",
      danger: "bg-red-500 text-white hover:bg-red-400 active:bg-red-600 shadow-sm",
      outline: "border border-navy-500 text-gray-200 hover:bg-navy-700 hover:border-navy-400 active:bg-navy-600",
    };

    const sizes = {
      sm: "px-3 py-1.5 text-sm gap-1.5",
      md: "px-4 py-2 text-sm gap-2",
      lg: "px-6 py-3 text-base gap-2.5",
    };

    const isDisabled = disabled || loading;

    const spinner = (
      <svg
        className="animate-spin h-4 w-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    );

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={isDisabled}
        {...props}
      >
        {loading && spinner}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";