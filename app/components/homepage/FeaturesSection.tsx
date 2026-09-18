"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const features = [
  { name: "Automated Matching", description: "Deterministic rules match transactions across sources with explainable confidence scores", icon: "🔗" },
  { name: "Exception Management", description: "Structured workflow for investigating and resolving mismatches with full context", icon: "🔍" },
  { name: "Transaction Explorer", description: "Search, filter, and paginate millions of transactions with advanced queries", icon: "🔎" },
  { name: "Data Validation", description: "Comprehensive validation catches malformed data before it enters the system", icon: "✅" },
  { name: "Data Normalization", description: "Automatic format conversion for amounts, dates, currencies, and references", icon: "🔄" },
  { name: "Duplicate Detection", description: "Identifies potential duplicates while preserving legitimate repeated transactions", icon: "📋" },
  { name: "Background Processing", description: "Asynchronous job processing with progress tracking and retry logic", icon: "⚙️" },
  { name: "Audit Trail", description: "Immutable logs of every system and user action for compliance", icon: "📝" },
  { name: "Role-Based Access", description: "Four roles with granular permissions: Admin, Manager, Analyst, Auditor", icon: "👥" },
  { name: "Multi-Tenant Architecture", description: "Complete organization-level data isolation with shared infrastructure", icon: "🏢" },
  { name: "Reports", description: "Generate reconciliation, exception, and mismatch reports in CSV and PDF", icon: "📊" },
  { name: "Notifications", description: "In-app and email alerts for reconciliation completion, exceptions, and failures", icon: "🔔" },
];

export function FeaturesSection({ className }: { className?: string }) {
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

      // Feature cards stagger animation
      gsap.fromTo(
        section.querySelectorAll(".feature-card"),
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.08,
          scrollTrigger: {
            trigger: section.querySelector(".features-grid"),
            start: "top 80%",
            end: "bottom 20%",
            toggleActions: "play none none reverse",
          },
        }
      );
    }, section);

    return () => ctx.revert();
  }, []);

  const features = [
    { name: "Automated Matching", description: "Deterministic rules match transactions across sources with explainable confidence scores", icon: "🔗" },
    { name: "Exception Management", description: "Structured workflow for investigating and resolving mismatches with full context", icon: "🔍" },
    { name: "Transaction Explorer", description: "Search, filter, and paginate millions of transactions with advanced queries", icon: "🔎" },
    { name: "Data Validation", description: "Comprehensive validation catches malformed data before it enters the system", icon: "✅" },
    { name: "Data Normalization", description: "Automatic format conversion for amounts, dates, currencies, and references", icon: "🔄" },
    { name: "Duplicate Detection", description: "Identifies potential duplicates while preserving legitimate repeated transactions", icon: "📋" },
    { name: "Background Processing", description: "Asynchronous job processing with progress tracking and retry logic", icon: "⚙️" },
    { name: "Audit Trail", description: "Immutable logs of every system and user action for compliance", icon: "📝" },
    { name: "Role-Based Access", description: "Four roles with granular permissions: Admin, Manager, Analyst, Auditor", icon: "👥" },
    { name: "Multi-Tenant Architecture", description: "Complete organization-level data isolation with shared infrastructure", icon: "🏢" },
    { name: "Reports", description: "Generate reconciliation, exception, and mismatch reports in CSV and PDF", icon: "📊" },
    { name: "Notifications", description: "In-app and email alerts for reconciliation completion, exceptions, and failures", icon: "🔔" },
  ];

  return (
    <section
      ref={sectionRef}
      className={cn("py-24 lg:py-32 px-6 bg-navy-800/30")}
      aria-labelledby="features-heading"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 id="features-heading" className="section-title text-3xl lg:text-4xl font-semibold text-white text-balance">
            Product Capabilities
          </h2>
          <p className="section-subtitle mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            Everything finance teams need to reconcile with confidence.
          </p>
        </div>

        <div className="features-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, index) => (
            <article
              key={feature.name}
              className="feature-card group p-6 rounded-2xl border transition-all duration-500 hover:translate-y-[-4px] bg-navy-800/50 border-navy-600 hover:border-cyan-500/30"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-2xl">
                  {feature.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-white group-hover:text-cyan-300 transition-colors">{feature.name}</h3>
                  <p className="mt-1 text-sm text-gray-400">{feature.description}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}