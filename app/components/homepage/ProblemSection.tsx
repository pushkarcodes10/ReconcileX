"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/Badge";

interface ProblemSectionProps {
  className?: string;
}

export function ProblemSection({ className }: ProblemSectionProps) {
  const [visibleCards, setVisibleCards] = useState<Set<number>>(new Set());
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setTimeout(() => {
              setVisibleCards((prev) => new Set([...prev, 0]));
            }, 100);
            setTimeout(() => {
              setVisibleCards((prev) => new Set([...prev, 1]));
            }, 300);
            setTimeout(() => {
              setVisibleCards((prev) => new Set([...prev, 2]));
            }, 500);
            setTimeout(() => {
              setVisibleCards((prev) => new Set([...prev, 3]));
            }, 700);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -100px 0px" }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const sources = [
    { key: "bank", name: "Bank", icon: "🏦", color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20", records: ["BNK-283821", "BNK-283822", "BNK-283823"] },
    { key: "gateway", name: "Payment Gateway", icon: "💳", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", records: ["TXN-88321", "TXN-88322", "TXN-88323"] },
    { key: "orders", name: "Internal Orders", icon: "📦", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", records: ["ORD-10482", "ORD-10483", "ORD-10484"] },
    { key: "accounting", name: "Accounting", icon: "📊", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", records: ["REC-2026-0917", "REC-2026-0918", "REC-2026-0919"] },
  ];

  return (
    <section
      ref={sectionRef}
      className={cn("py-24 lg:py-32 px-6", className)}
      aria-labelledby="problem-heading"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 id="problem-heading" className="text-3xl lg:text-4xl font-semibold text-white text-balance">
            Your transaction data doesn&apos;t live in one place.
          </h2>
          <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            Every system speaks a different language. ReconcileX translates them all.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {sources.map((source, index) => (
            <div
              key={source.key}
              className={cn(
                "rounded-2xl border p-6 transition-all duration-500",
                source.bg,
                visibleCards.has(index)
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              )}
              style={{ willChange: "transform, opacity" }}
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl" aria-hidden="true">{source.icon}</span>
                <h3 className="text-lg font-semibold text-white">{source.name}</h3>
              </div>
              <div className="space-y-2">
                {source.records.map((record) => (
                  <div key={record} className="flex items-center justify-between px-3 py-2 bg-navy-900/50 rounded-lg border border-navy-600">
                    <code className="text-sm font-mono text-gray-300">{record}</code>
                    <span className="text-xs text-gray-500">₹{Math.floor(Math.random() * 50000 + 1000).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <svg className="w-full h-32 text-navy-600" viewBox="0 0 800 128" preserveAspectRatio="none">
              <path
                d="M100 64 L150 64 L150 20 L350 20 L350 64 L400 64"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeDasharray="8 4"
                opacity="0.5"
              />
              <path
                d="M400 64 L450 64 L450 108 L350 108 L350 64"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeDasharray="8 4"
                opacity="0.5"
              />
              <circle cx="250" cy="20" r="8" fill="currentColor" opacity="0.5" />
              <circle cx="250" cy="108" r="8" fill="currentColor" opacity="0.5" />
              <circle cx="400" cy="64" r="12" fill="#00D4AA" />
              <text x="400" y="64" textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#0A0F14" fontWeight="bold" fontFamily="monospace">RX</text>
            </svg>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
            {[
              { label: "Different IDs", description: "Each system generates its own transaction identifiers" },
              { label: "Different formats", description: "Amounts, dates, and references structured differently" },
              { label: "Different timestamps", description: "Settlement delays create date mismatches across sources" },
            ].map((item, index) => (
              <div
                key={item.label}
                className={cn(
                  "text-center p-6 rounded-xl bg-navy-800/50 border border-navy-600 transition-all duration-500",
                  visibleCards.has(index + 4)
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-8"
                )}
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">{item.label}</h4>
                <p className="text-gray-400">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}