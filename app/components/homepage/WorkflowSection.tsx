"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface WorkflowSectionProps {
  className?: string;
}

const workflowSteps = [
  {
    number: "01",
    label: "IMPORT",
    title: "Bring transaction records from independent sources",
    description: "Upload CSV files or connect via API from banks, payment gateways, order systems, and accounting platforms.",
  },
  {
    number: "02",
    label: "VALIDATE",
    title: "Detect invalid or incomplete records",
    description: "Automated validation catches malformed amounts, missing dates, unsupported currencies, and duplicate entries.",
  },
  {
    number: "03",
    label: "NORMALIZE",
    title: "Convert different formats into a common structure",
    description: "₹1,000.00, 1000, 1,000 INR → 1000.00. Dates standardized. References cleaned.",
  },
  {
    number: "04",
    label: "MATCH",
    title: "Compare transaction attributes using explainable rules",
    description: "Deterministic matching: exact reference + amount, amount + date window, multi-attribute scoring.",
  },
  {
    number: "05",
    label: "EXCEPTIONS",
    title: "Send uncertain records for human investigation",
    description: "Potential matches and unmatched transactions routed to analysts with full context.",
  },
  {
    number: "06",
    label: "RESOLVE",
    title: "Resolve issues while maintaining a complete audit history",
    description: "Every action tracked: assignments, comments, resolutions, reopens — immutable audit trail.",
  },
];

export function WorkflowSection({ className }: WorkflowSectionProps) {
  const [activeStep, setActiveStep] = useState(-1);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveStep(0);
            const interval = setInterval(() => {
              setActiveStep((prev) => (prev + 1) % workflowSteps.length);
            }, 800);
            return () => clearInterval(interval);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -100px 0px" }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className={cn("py-24 lg:py-32 px-6 bg-navy-800/30", className)}
      aria-labelledby="workflow-heading"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 id="workflow-heading" className="text-3xl lg:text-4xl font-semibold text-white text-balance">
            How It Works
          </h2>
          <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            A transparent, deterministic workflow from raw data to resolved reconciliation.
          </p>
        </div>

        <div className="relative">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workflowSteps.map((step, index) => (
              <article
                key={step.number}
                className={cn(
                  "relative p-6 rounded-2xl border transition-all duration-500",
                  activeStep === index
                    ? "bg-cyan-500/10 border-cyan-500/30 ring-2 ring-cyan-500/20"
                    : "bg-navy-800/50 border-navy-600 hover:border-navy-500"
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl font-mono font-semibold text-cyan-400">{step.number}</span>
                  <span className="px-3 py-1 text-xs font-medium bg-navy-700 text-gray-300 rounded-full uppercase tracking-wide">
                    {step.label}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-gray-400 text-sm">{step.description}</p>

                {activeStep === index && (
                  <div className="absolute inset-0 rounded-2xl border-cyan-500/50 animate-pulse pointer-events-none" />
                )}
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}