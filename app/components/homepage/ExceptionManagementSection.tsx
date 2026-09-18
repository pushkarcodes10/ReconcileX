"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/Badge";
import { StepProgress } from "@/components/ui/ProgressBar";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface ExceptionManagementSectionProps {
  className?: string;
}

export function ExceptionManagementSection({ className }: { className?: string }) {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      // Title animation
      gsap.fromTo(
        section.querySelector(".section-title"),
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: "power3.out",
        }
      );

      // Subtitle animation
      gsap.fromTo(
        section.querySelector(".section-subtitle"),
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power3.out",
          delay: 0.2,
        }
      );

      // Transaction comparison cards stagger
      gsap.fromTo(
        section.querySelectorAll(".comparison-card"),
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.15,
          scrollTrigger: {
            trigger: section.querySelector(".comparison-grid"),
            start: "top 80%",
            end: "bottom 20%",
            toggleActions: "play none none reverse",
          },
        }
      );

      // Amount difference highlight
      gsap.fromTo(
        section.querySelector(".difference-highlight"),
        { scale: 0.8, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 0.8,
          ease: "back.out(1.7)",
          scrollTrigger: {
            trigger: section.querySelector(".difference-highlight"),
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        }
      );

      // Lifecycle cards stagger
      gsap.fromTo(
        section.querySelectorAll(".lifecycle-card"),
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.15,
          scrollTrigger: {
            trigger: section.querySelector(".lifecycle-container"),
            start: "top 80%",
            end: "bottom 20%",
            toggleActions: "play none none reverse",
          },
        }
      );

      // Investigation panel
      gsap.fromTo(
        section.querySelectorAll(".panel-card"),
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.15,
          scrollTrigger: {
            trigger: section.querySelector(".panel-grid"),
            start: "top 80%",
            end: "bottom 20%",
            toggleActions: "play none none reverse",
          },
        }
      );
}, section);

  return () => ctx.revert();
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
          <h2 id="exception-heading" className="section-title text-3xl lg:text-4xl font-semibold text-white text-balance">
            When automation stops, investigation begins.
          </h2>
          <p className="section-subtitle mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            Structured exception workflow with full context and audit trail.
          </p>
        </div>

        <div className="comparison-grid grid lg:grid-cols-2 gap-8 mb-16">
          <div className="comparison-card p-6 rounded-2xl bg-navy-800/50 border border-navy-600">
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
            <div className="difference-highlight p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <div className="flex items-center justify-between">
                <span className="text-sm text-red-400 font-medium">Amount Difference</span>
                <span className="text-2xl font-semibold text-red-400 tabular-nums">₹{exception.difference}</span>
              </div>
            </div>
          </div>

          <div className="lifecycle-container p-6 rounded-2xl bg-navy-800/50 border border-navy-600">
            <h3 className="text-lg font-semibold text-white mb-4">Exception Lifecycle</h3>
            <StepProgress
              steps={lifecycle.map((l) => ({ label: l.label, completed: true, active: false }))}
            />
            <div className="mt-6 lifecycle-container space-y-3">
              {lifecycle.map((item, index) => (
                <div
                  key={item.label}
                  className="lifecycle-card p-4 rounded-xl border bg-green-500/10 border-green-500/30"
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

        <div className="panel-grid grid md:grid-cols-3 gap-6">
          <div className="panel-card space-y-3">
            <h4 className="text-sm font-medium text-gray-400">Assigned To</h4>
            <div className="flex items-center gap-3 p-3 bg-navy-900/50 rounded-xl border border-navy-600">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-medium">AM</div>
              <div>
                <p className="text-white font-medium">Arjun Mehta</p>
                <p className="text-xs text-gray-500">Finance Analyst</p>
              </div>
            </div>
          </div>
          <div className="panel-card space-y-3">
            <h4 className="text-sm font-medium text-gray-400">Priority</h4>
            <StatusBadge status="HIGH" size="md" />
          </div>
          <div className="panel-card space-y-3">
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
    </section>
  );
}