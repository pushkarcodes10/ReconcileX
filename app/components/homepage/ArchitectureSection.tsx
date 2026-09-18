"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface ArchitectureSectionProps {
  className?: string;
}

interface LayerItem {
  name: string;
  color: string;
  icon: string;
}

interface SubLayer {
  name: string;
  color: string;
}

interface Layer {
  name: string;
  items?: LayerItem[];
  subLayers?: SubLayer[];
}

const layers: Layer[] = [
  {
    name: "DATA SOURCES",
    items: [
      { name: "Bank", icon: "🏦", color: "text-cyan-400" },
      { name: "Payment Gateway", icon: "💳", color: "text-amber-400" },
      { name: "Order System", icon: "📦", color: "text-blue-400" },
      { name: "Accounting", icon: "📊", color: "text-purple-400" },
    ],
  },
  {
    name: "RECONCILEX",
    subLayers: [
      { name: "Frontend", color: "text-cyan-400" },
      { name: "API", color: "text-white" },
      { name: "Processing", color: "text-amber-400" },
    ],
  },
  {
    name: "BACKGROUND WORKERS",
    items: [{ name: "Reconciliation Engine", color: "text-green-400", icon: "⚙️" }],
  },
  {
    name: "INFRASTRUCTURE",
    items: [
      { name: "PostgreSQL", color: "text-blue-400", icon: "🗄️" },
      { name: "Redis", color: "text-red-400", icon: "🔴" },
    ],
  },
  {
    name: "DASHBOARD",
    items: [{ name: "Analytics & Operations", color: "text-cyan-400", icon: "📊" }],
  },
];

export function ArchitectureSection({ className }: { className?: string }) {
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

      // Layer cards stagger
      gsap.fromTo(
        section.querySelectorAll(".layer-card"),
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.2,
          scrollTrigger: {
            trigger: section.querySelector(".layers-container"),
            start: "top 80%",
            end: "bottom 20%",
            toggleActions: "play none none reverse",
          },
        }
      );

      // Feature cards
      gsap.fromTo(
        section.querySelectorAll(".arch-feature-card"),
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.15,
          scrollTrigger: {
            trigger: section.querySelector(".arch-features-grid"),
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
      className={cn("py-24 lg:py-32 px-6")}
      aria-labelledby="architecture-heading"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 id="architecture-heading" className="section-title text-3xl lg:text-4xl font-semibold text-white text-balance">
            Built for more than a spreadsheet.
          </h2>
          <p className="section-subtitle mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            Enterprise-grade architecture designed for scale, reliability, and security.
          </p>
        </div>

        <div className="relative">
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-navy-500 to-transparent -translate-x-1/2 hidden lg:block" />

          <div className="layers-container space-y-8">
            {layers.map((layer, layerIndex) => (
              <div
                key={layer.name}
                className={cn(
                  "relative flex items-center justify-center gap-4 transition-all duration-700",
                  "layer-card"
                )}
              >
                <div className={cn(
                  "flex-shrink-0 w-48 lg:w-56 text-center transition-all duration-500"
                )}>
                  <span className="text-xs font-mono font-semibold text-gray-500 uppercase tracking-widest">{layer.name}</span>
                  {layer.subLayers && (
                    <div className="mt-3 space-y-2">
                      {layer.subLayers.map((sub) => (
                        <div key={sub.name} className="px-3 py-1.5 rounded-lg bg-navy-800/50 border border-navy-600 text-sm font-medium" style={{ color: sub.color }}>
                          {sub.name}
                        </div>
                      ))}
                    </div>
                  )}
                  {layer.items && (
                    <div className="mt-3 space-y-2">
                      {layer.items.map((item) => (
                        <div key={item.name} className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-navy-800/50 border border-navy-600">
                          <span className="text-lg" aria-hidden="true">{item.icon}</span>
                          <span className="text-sm font-medium" style={{ color: item.color }}>{item.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {layerIndex < layers.length - 1 && (
                  <div className="hidden lg:flex flex-col items-center gap-2 flex-1">
                    <svg className="w-6 h-6 text-navy-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="arch-features-grid mt-16 grid md:grid-cols-3 gap-6">
          {[
            { title: "Modular Monolith", description: "Clean module boundaries. Easy to extract services when scale demands it." },
            { title: "Async by Default", description: "Large reconciliations process in background workers. API never blocks." },
            { title: "Observability Built-in", description: "Structured logs, metrics, and traces from day one via OpenTelemetry." },
          ].map((item) => (
            <div key={item.title} className="arch-feature-card p-6 rounded-2xl bg-navy-800/50 border border-navy-600">
              <h4 className="text-lg font-semibold text-white mb-2">{item.title}</h4>
              <p className="text-gray-400">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}