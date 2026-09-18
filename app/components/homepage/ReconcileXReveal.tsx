"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ReconcileXRevealProps {
  className?: string;
}

export function ReconcileXReveal({ className }: ReconcileXRevealProps) {
  const [stage, setStage] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setStage(1);
            setTimeout(() => setStage(2), 500);
            setTimeout(() => setStage(3), 1000);
            setTimeout(() => setStage(4), 1500);
            setTimeout(() => setStage(5), 2000);
            setTimeout(() => setStage(6), 2500);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -100px 0px" }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const steps = [
    { label: "IMPORT", description: "Bring transaction records from independent sources", icon: "📥" },
    { label: "VALIDATE", description: "Detect invalid or incomplete records", icon: "✅" },
    { label: "NORMALIZE", description: "Convert different formats into a common structure", icon: "🔄" },
    { label: "MATCH", description: "Compare transaction attributes using explainable rules", icon: "🔗" },
    { label: "EXCEPTIONS", description: "Send uncertain records for human investigation", icon: "🔍" },
    { label: "RESOLVE", description: "Resolve issues while maintaining a complete audit history", icon: "✍️" },
  ];

  return (
    <section
      ref={sectionRef}
      className={cn("py-24 lg:py-32 px-6", className)}
      aria-labelledby="reconciler-heading"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 id="reconciler-heading" className="text-3xl lg:text-4xl font-semibold text-white text-balance">
            Meet ReconcileX.
          </h2>
          <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            Scattered records converge into one intelligent system.
          </p>
        </div>

        <div className="relative">
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-cyan-500/30 to-transparent -translate-x-1/2 hidden lg:block" />

          <div className="space-y-8">
            {steps.map((step, index) => {
              const isLeft = index % 2 === 0;
              const visible = stage > index;
              const active = stage > index + 1;

              return (
                <div
                  key={step.label}
                  className={cn(
                    "relative flex gap-8 transition-all duration-700",
                    visible ? "opacity-100 translate-x-0" : "opacity-0",
                    isLeft ? visible ? "translate-x-0" : "-translate-x-8" : visible ? "translate-x-0" : "translate-x-8"
                  )}
                  style={{ willChange: "transform, opacity" }}
                >
                  <div className={cn(
                    "flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center relative z-10 transition-all duration-500",
                    active ? "bg-cyan-500 border-cyan-500" : "bg-navy-700 border-navy-600",
                    "border-2"
                  )}>
                    <span className={cn("text-2xl transition-colors", active ? "text-navy-900" : "text-gray-300")} aria-hidden="true">
                      {step.icon}
                    </span>
                    <div
                      className={cn(
                        "absolute -inset-1 rounded-2xl border-2 transition-all duration-500",
                        active ? "border-cyan-500/50 scale-110" : "border-transparent scale-100"
                      )}
                    />
                  </div>

                  <div className={cn(
                    "flex-1 p-6 rounded-2xl border transition-all duration-500",
                    active ? "bg-cyan-500/10 border-cyan-500/30" : "bg-navy-800/50 border-navy-600"
                  )}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-mono font-semibold text-cyan-400 tracking-widest">{step.label}</span>
                      {active && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-cyan-500 text-navy-900 rounded">ACTIVE</span>
                      )}
                    </div>
                    <p className="text-gray-400">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}