"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
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

export function WorkflowSection({ className }: { className?: string }) {
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

      // Steps stagger animation
      gsap.fromTo(
        section.querySelectorAll(".workflow-card"),
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.15,
          scrollTrigger: {
            trigger: section.querySelector(".workflow-grid"),
            start: "top 80%",
            end: "bottom 20%",
            toggleActions: "play none none reverse",
          },
        }
      );
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className={cn("py-24 lg:py-32 px-6 bg-navy-800/30")}
      aria-labelledby="workflow-heading"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 id="workflow-heading" className="section-title text-3xl lg:text-4xl font-semibold text-white text-balance">
            How It Works
          </h2>
          <p className="section-subtitle mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            A transparent, deterministic workflow from raw data to resolved reconciliation.
          </p>
        </div>

        <div className="relative">
          <div className="workflow-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workflowSteps.map((step, index) => (
              <article
                key={step.number}
                className="workflow-card relative p-6 rounded-2xl border bg-navy-800/50 border-navy-600 hover:border-navy-500 transition-all duration-500"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl font-mono font-semibold text-cyan-400">{step.number}</span>
                  <span className="px-3 py-1 text-xs font-medium bg-navy-700 text-gray-300 rounded-full uppercase tracking-wide">
                    {step.label}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-gray-400 text-sm">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}