"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface ReconcileXRevealProps {
  className?: string;
}

export function ReconcileXReveal({ className }: { className?: string }) {
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

      // Steps animation
      gsap.fromTo(
        section.querySelectorAll(".step-card"),
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.2,
          scrollTrigger: {
            trigger: section.querySelector(".steps-container"),
            start: "top 80%",
            end: "bottom 20%",
            toggleActions: "play none none reverse",
          },
        }
      );
    }, section);

    return () => ctx.revert();
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
      className={cn("py-24 lg:py-32 px-6")}
      aria-labelledby="reconciler-heading"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 id="reconciler-heading" className="section-title text-3xl lg:text-4xl font-semibold text-white text-balance">
            Meet ReconcileX.
          </h2>
          <p className="section-subtitle mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            Scattered records converge into one intelligent system.
          </p>
        </div>

        <div className="relative">
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-cyan-500/30 to-transparent -translate-x-1/2 hidden lg:block" />

          <div className="steps-container space-y-8">
            {steps.map((step, index) => {
              const isLeft = index % 2 === 0;

              return (
                <div
                  key={step.label}
                  className={cn(
                    "relative flex gap-8",
                    isLeft ? "flex-row" : "flex-row-reverse"
                  )}
                >
                  <div className={cn(
                    "flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center relative z-10 transition-all duration-500",
                    "bg-navy-700 border-2 border-navy-600"
                  )}>
                    <span className="text-2xl text-gray-300" aria-hidden="true">
                      {step.icon}
                    </span>
                  </div>

                  <div className={cn(
                    "flex-1 p-6 rounded-2xl border",
                    "bg-navy-800/50 border-navy-600"
                  )}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-mono font-semibold text-cyan-400 tracking-widest">{step.label}</span>
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