"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";

interface CTASectionProps {
  className?: string;
}

export function CTASection({ className }: CTASectionProps) {
  const buttonStyles =
    "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-900";

  const variants = {
    primary: "bg-cyan-500 text-navy-900 hover:bg-cyan-400 active:bg-cyan-600 shadow-sm",
    outline: "border border-navy-500 text-gray-200 hover:bg-navy-700 hover:border-navy-400 active:bg-navy-600",
  };

  const sizes = {
    lg: "px-6 py-3 text-base gap-2.5",
  };

  return (
    <section className={cn("py-24 lg:py-32 px-6 relative overflow-hidden", className)} aria-labelledby="cta-heading">
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-transparent" />

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <h2 id="cta-heading" className="text-3xl lg:text-4xl xl:text-5xl font-semibold text-white text-balance leading-[1.1]">
          From fragmented records to confident reconciliation.
        </h2>
        <p className="mt-6 text-lg lg:text-xl text-gray-300 max-w-2xl mx-auto text-pretty leading-relaxed">
          Bring transaction data together. Automate the repetitive work. Give your team a clear path to every exception.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className={cn(
              buttonStyles,
              variants.primary,
              sizes.lg
            )}
          >
            Open Dashboard
            <svg className="ml-2 w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <Link
            href="#workflow"
            className={cn(
              buttonStyles,
              variants.outline,
              sizes.lg
            )}
          >
            Explore Workflow
          </Link>
        </div>

        <div className="mt-16 flex items-center justify-center gap-8 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>No credit card required</span>
          </div>
          <div className="w-px h-6 bg-navy-600" />
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
            <span>14-day free trial</span>
          </div>
          <div className="w-px h-6 bg-navy-600" />
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span>Cancel anytime</span>
          </div>
        </div>
      </div>
    </section>
  );
}

const buttonStyles =
  "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-900";

const variants = {
  primary: "bg-cyan-500 text-navy-900 hover:bg-cyan-400 active:bg-cyan-600 shadow-sm",
  outline: "border border-navy-500 text-gray-200 hover:bg-navy-700 hover:border-navy-400 active:bg-navy-600",
};

const sizes = {
  lg: "px-6 py-3 text-base gap-2.5",
};