"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ArchitectureSectionProps {
  className?: string;
}

export function ArchitectureSection({ className }: ArchitectureSectionProps) {
  const [stage, setStage] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setStage(1);
            setTimeout(() => setStage(2), 400);
            setTimeout(() => setStage(3), 800);
            setTimeout(() => setStage(4), 1200);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -100px 0px" }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  interface LayerItem {
    name: string;
    color: string;
    icon?: string;
  }

  interface Layer {
    name: string;
    items?: LayerItem[];
    subLayers?: { name: string; color: string }[];
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
      items: [{ name: "Reconciliation Engine", color: "text-green-400" }],
    },
    {
      name: "INFRASTRUCTURE",
      items: [
        { name: "PostgreSQL", color: "text-blue-400" },
        { name: "Redis", color: "text-red-400" },
      ],
    },
    {
      name: "DASHBOARD",
      items: [{ name: "Analytics & Operations", color: "text-cyan-400" }],
    },
  ];

  return (
    <section
      ref={sectionRef}
      className={cn("py-24 lg:py-32 px-6", className)}
      aria-labelledby="architecture-heading"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 id="architecture-heading" className="text-3xl lg:text-4xl font-semibold text-white text-balance">
            Built for more than a spreadsheet.
          </h2>
          <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            Enterprise-grade architecture designed for scale, reliability, and security.
          </p>
        </div>

        <div className="relative">
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-navy-500 to-transparent -translate-x-1/2 hidden lg:block" />

          <div className="space-y-8">
            {layers.map((layer, layerIndex) => (
              <div
                key={layer.name}
                className={cn(
                  "relative flex items-center justify-center gap-4 transition-all duration-700",
                  stage > layerIndex ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                )}
              >
                <div className={cn(
                  "flex-shrink-0 w-48 lg:w-56 text-center transition-all duration-500",
                  stage > layerIndex ? "opacity-100" : "opacity-50"
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

        <div className="mt-16 grid md:grid-cols-3 gap-6">
          {[
            { title: "Modular Monolith", description: "Clean module boundaries. Easy to extract services when scale demands it." },
            { title: "Async by Default", description: "Large reconciliations process in background workers. API never blocks." },
            { title: "Observability Built-in", description: "Structured logs, metrics, and traces from day one via OpenTelemetry." },
          ].map((item) => (
            <div key={item.title} className="p-6 rounded-2xl bg-navy-800/50 border border-navy-600">
              <h4 className="text-lg font-semibold text-white mb-2">{item.title}</h4>
              <p className="text-gray-400">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}