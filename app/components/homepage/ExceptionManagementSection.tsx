"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/Badge";
import { StepProgress } from "@/components/ui/ProgressBar";

interface ExceptionManagementSectionProps {
  className?: string;
}

export function ExceptionManagementSection({ className }: ExceptionManagementSectionProps) {
  const [stage, setStage] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setStage(1);
            setTimeout(() => setStage(2), 800);
            setTimeout(() => setStage(3), 1600);
            setTimeout(() => setStage(4), 2400);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -100px 0px" }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const exception = {
    internal: { id: "ORD-10482", amount: "₹700.00", date: "17 Sep", status: "COMPLETED" },
    external: { id: "TXN-88321", amount: "₹650.00", date: "17 Sep", status: "SUCCESS" },
    difference: 50,
  };

  const lifecycle = [
    { label: "OPEN", description: "Exception created and queued for review", step: 1 },
    { label: "ASSIGNED", description: "Assigned to finance analyst", step: 2 },
    { label: "UNDER REVIEW", description: "Investigation in progress", step: 3 },
    { label: "RESOLVED", description: "Mismatch explained and closed", step: 4 },
  ];

  return (
    <section
      ref={sectionRef}
      className={cn("py-24 lg:py-32 px-6 bg-navy-800/30", className)}
      aria-labelledby="exception-heading"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 id="exception-heading" className="text-3xl lg:text-4xl font-semibold text-white text-balance">
            When automation stops, investigation begins.
          </h2>
          <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            Structured exception workflow with full context and audit trail.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-16">
          <div className={cn(
            "p-6 rounded-2xl bg-navy-800/50 border border-navy-600 transition-all duration-700",
            stage >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}>
            <h3 className="text-lg font-semibold text-white mb-4">Transaction Mismatch</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm text-blue-400 uppercase tracking-wide mb-2">INTERNAL ORDER</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">ID</span><code className="font-mono text-white">{exception.internal.id}</code></div>
                  <div className="flex justify-between"><span className="text-gray-400">Amount</span><span className="font-semibold text-white">{exception.internal.amount}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Date</span><span className="text-gray-300">{exception.internal.date}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Status</span><StatusBadge status={exception.internal.status} size="sm" /></div>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-sm text-amber-400 uppercase tracking-wide mb-2">PAYMENT GATEWAY</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">ID</span><code className="font-mono text-white">{exception.external.id}</code></div>
                  <div className="flex justify-between"><span className="text-gray-400">Amount</span><span className="font-semibold text-white">{exception.external.amount}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Date</span><span className="text-gray-300">{exception.external.date}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Status</span><StatusBadge status={exception.external.status} size="sm" /></div>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <div className="flex items-center justify-between">
                <span className="text-sm text-red-400 font-medium">Amount Difference</span>
                <span className="text-2xl font-semibold text-red-400 tabular-nums">₹{exception.difference}</span>
              </div>
            </div>
          </div>

          <div className={cn(
            "p-6 rounded-2xl bg-navy-800/50 border border-navy-600 transition-all duration-700",
            stage >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}>
            <h3 className="text-lg font-semibold text-white mb-4">Exception Lifecycle</h3>
            <StepProgress
              steps={lifecycle.map((l) => ({ label: l.label, completed: stage >= l.step + 1, active: stage === l.step }))}
            />
            <div className="mt-6 space-y-3">
              {lifecycle.map((item, index) => (
                <div
                  key={item.label}
                  className={cn(
                    "p-4 rounded-xl border transition-all duration-500",
                    stage >= item.step
                      ? "bg-green-500/10 border-green-500/30"
                      : "bg-navy-900/50 border-navy-600"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <StatusBadge status={item.label} size="sm" />
                    <span className="text-sm text-gray-400">{item.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={cn(
          "p-6 rounded-2xl bg-navy-800/50 border border-navy-600 transition-all duration-700",
          stage >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        )}>
          <h3 className="text-lg font-semibold text-white mb-4">Investigation Panel</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-400">Assigned To</h4>
              <div className="flex items-center gap-3 p-3 bg-navy-900/50 rounded-xl border border-navy-600">
                <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-medium">AM</div>
                <div>
                  <p className="text-white font-medium">Arjun Mehta</p>
                  <p className="text-xs text-gray-500">Finance Analyst</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-400">Priority</h4>
              <StatusBadge status="HIGH" size="md" />
            </div>
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-400">Created</h4>
              <p className="text-white">17 Sep 2026, 14:12</p>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-navy-600">
            <h4 className="text-sm font-medium text-gray-400 mb-3">Investigation Notes</h4>
            <div className="bg-navy-900/50 rounded-xl border border-navy-600 p-4">
              <p className="text-gray-300 text-sm">Amount difference of ₹50. Gateway shows ₹650 vs internal ₹700. Possible partial refund or fee deduction. Checking with gateway reconciliation report.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}