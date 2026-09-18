"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const auditEvents = [
  { time: "14:12", user: "Arjun Mehta", action: "Exception assigned", entity: "EXC-10291", prev: "OPEN", next: "ASSIGNED" },
  { time: "14:24", user: "Arjun Mehta", action: "Investigation started", entity: "EXC-10291", prev: "ASSIGNED", next: "UNDER_REVIEW" },
  { time: "14:29", user: "Arjun Mehta", action: "Comment added", entity: "EXC-10291", prev: "—", next: "Amount difference of ₹50..." },
  { time: "14:32", user: "Arjun Mehta", action: "Exception resolved", entity: "EXC-10291", prev: "UNDER_REVIEW", next: "RESOLVED" },
  { time: "14:35", user: "System", action: "Audit log recorded", entity: "EXC-10291", prev: "—", next: "Immutable record created" },
];

export function AuditTrailSection({ className }: { className?: string }) {
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

      // Timeline events stagger
      gsap.fromTo(
        section.querySelectorAll(".timeline-event"),
        { x: -50, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.15,
          scrollTrigger: {
            trigger: section.querySelector(".timeline-container"),
            start: "top 80%",
            end: "bottom 20%",
            toggleActions: "play none none reverse",
          },
        }
      );

      // Feature cards
      gsap.fromTo(
        section.querySelectorAll(".feature-card"),
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.15,
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

  const auditEvents = [
    { time: "14:12", user: "Arjun Mehta", action: "Exception assigned", entity: "EXC-10291", prev: "OPEN", next: "ASSIGNED" },
    { time: "14:24", user: "Arjun Mehta", action: "Investigation started", entity: "EXC-10291", prev: "ASSIGNED", next: "UNDER_REVIEW" },
    { time: "14:29", user: "Arjun Mehta", action: "Comment added", entity: "EXC-10291", prev: "—", next: "Amount difference of ₹50..." },
    { time: "14:32", user: "Arjun Mehta", action: "Exception resolved", entity: "EXC-10291", prev: "UNDER_REVIEW", next: "RESOLVED" },
    { time: "14:35", user: "System", action: "Audit log recorded", entity: "EXC-10291", prev: "—", next: "Immutable record created" },
  ];

  return (
    <section
      ref={sectionRef}
      className={cn("py-24 lg:py-32 px-6")}
      aria-labelledby="audit-heading"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 id="audit-heading" className="section-title text-3xl lg:text-4xl font-semibold text-white text-balance">
            Every important action leaves a trail.
          </h2>
          <p className="section-subtitle mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            Immutable audit logs. Complete accountability. Regulatory readiness.
          </p>
        </div>

        <div className="relative">
          <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-navy-500 to-transparent" />

          <div className="timeline-container space-y-6 pl-16">
            {auditEvents.map((event, index) => (
              <div
                key={event.time}
                className="timeline-event relative transition-all duration-500"
              >
                <div className="absolute left-[-24px] top-2 w-4 h-4 rounded-full bg-navy-700 border-2 border-navy-500 flex items-center justify-center" />
                <div className="bg-navy-800/50 border border-navy-600 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-mono font-semibold text-cyan-400 tabular-nums">{event.time}</span>
                        <span className="text-sm font-medium text-white">{event.user}</span>
                        <span className="px-2 py-0.5 text-xs bg-navy-700 text-gray-300 rounded">{event.action}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-400 flex-wrap">
                        <span><strong className="text-white">Entity:</strong> {event.entity}</span>
                        <span><strong className="text-white">Prev:</strong> {event.prev}</span>
                        <span><strong className="text-white">Next:</strong> {event.next}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="features-grid mt-16 grid md:grid-cols-3 gap-6">
          {[
            { label: "Immutable Records", description: "Audit logs cannot be modified or deleted through normal interfaces", icon: "🔒" },
            { label: "Full Context", description: "Every log captures user, action, entity, timestamps, and state changes", icon: "📋" },
            { label: "Compliance Ready", description: "Export-ready trails for SOX, GDPR, and regulatory audits", icon: "✅" },
          ].map((item) => (
            <div key={item.label} className="feature-card p-6 rounded-2xl bg-navy-800/50 border border-navy-600">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl" aria-hidden="true">{item.icon}</span>
                <h4 className="text-lg font-semibold text-white">{item.label}</h4>
              </div>
              <p className="text-gray-400">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}