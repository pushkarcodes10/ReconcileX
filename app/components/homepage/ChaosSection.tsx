"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/Badge";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const mockRows = [
  { id: "TXN-100000", amount: "₹42,350.75", date: "15 Sep", status: "MATCHED" as const },
  { id: "TXN-100001", amount: "₹18,920.50", date: "14 Sep", status: "POTENTIAL" as const },
  { id: "TXN-100002", amount: "₹7,450.00", date: "13 Sep", status: "EXCEPTION" as const },
  { id: "TXN-100003", amount: "₹33,100.25", date: "12 Sep", status: "MATCHED" as const },
  { id: "TXN-100004", amount: "₹21,670.80", date: "11 Sep", status: "MATCHED" as const },
  { id: "TXN-100005", amount: "₹9,840.00", date: "10 Sep", status: "POTENTIAL" as const },
  { id: "TXN-100006", amount: "₹45,200.00", date: "09 Sep", status: "EXCEPTION" as const },
  { id: "TXN-100007", amount: "₹12,300.50", date: "08 Sep", status: "MATCHED" as const },
  { id: "TXN-100008", amount: "₹28,900.75", date: "07 Sep", status: "MATCHED" as const },
  { id: "TXN-100009", amount: "₹5,670.25", date: "06 Sep", status: "POTENTIAL" as const },
  { id: "TXN-100010", amount: "₹39,450.00", date: "05 Sep", status: "MATCHED" as const },
  { id: "TXN-100011", amount: "₹16,200.00", date: "04 Sep", status: "EXCEPTION" as const },
];

export function ChaosSection({ className }: { className?: string }) {
  const [scale, setScale] = useState(0);
  const [transactionCount, setTransactionCount] = useState(10);
  const [showLabels, setShowLabels] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      // Stats counter animation
      gsap.fromTo(
        section.querySelector(".stat-counter"),
        { scale: 0.9, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 1,
          ease: "power3.out",
        }
      );

      // Number counter
      const counter = section.querySelector(".counter-number");
      if (counter) {
        gsap.to(counter, {
          textContent: 100000,
          duration: 1.5,
          ease: "power2.out",
          snap: { textContent: 1 },
          scrollTrigger: {
            trigger: section.querySelector(".stats-grid"),
            start: "top 80%",
            onEnter: () => {
              setTransactionCount(1000);
              setTimeout(() => setTransactionCount(100000), 300);
              setTimeout(() => setShowLabels(true), 1300);
            }
          }
        });
      }

      // KPI cards stagger
      gsap.fromTo(
        section.querySelectorAll(".kpi-card"),
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.15,
          scrollTrigger: {
            trigger: section.querySelector(".stats-grid"),
            start: "top 80%",
            end: "bottom 20%",
            toggleActions: "play none none reverse",
          },
        }
      );

      // Table rows
      gsap.fromTo(
        section.querySelectorAll(".table-row"),
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          ease: "power3.out",
          stagger: 0.08,
          scrollTrigger: {
            trigger: section.querySelector(".data-table"),
            start: "top 80%",
            end: "bottom 20%",
            toggleActions: "play none none reverse",
          },
        }
      );

      // Label cards
      gsap.fromTo(
        section.querySelectorAll(".label-card"),
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.15,
          delay: 0.5,
          scrollTrigger: {
            trigger: section.querySelector(".labels-grid"),
            start: "top 80%",
            end: "bottom 20%",
            toggleActions: "play none none reverse",
          },
        }
      );
    }, section);

    return () => ctx.revert();
  }, []);

  const mockRows = [
    { id: "TXN-100000", amount: "₹42,350.75", date: "15 Sep", status: "MATCHED" as const },
    { id: "TXN-100001", amount: "₹18,920.50", date: "14 Sep", status: "POTENTIAL" as const },
    { id: "TXN-100002", amount: "₹7,450.00", date: "13 Sep", status: "EXCEPTION" as const },
    { id: "TXN-100003", amount: "₹33,100.25", date: "12 Sep", status: "MATCHED" as const },
    { id: "TXN-100004", amount: "₹21,670.80", date: "11 Sep", status: "MATCHED" as const },
    { id: "TXN-100005", amount: "₹9,840.00", date: "10 Sep", status: "POTENTIAL" as const },
    { id: "TXN-100006", amount: "₹45,200.00", date: "09 Sep", status: "EXCEPTION" as const },
    { id: "TXN-100007", amount: "₹12,300.50", date: "08 Sep", status: "MATCHED" as const },
    { id: "TXN-100008", amount: "₹28,900.75", date: "07 Sep", status: "MATCHED" as const },
    { id: "TXN-100009", amount: "₹5,670.25", date: "06 Sep", status: "POTENTIAL" as const },
    { id: "TXN-100010", amount: "₹39,450.00", date: "05 Sep", status: "MATCHED" as const },
    { id: "TXN-100011", amount: "₹16,200.00", date: "04 Sep", status: "EXCEPTION" as const },
  ];

  const visibleRows = mockRows.slice(0, Math.min(transactionCount === 10 ? 3 : 12, mockRows.length));

  return (
    <section
      ref={sectionRef}
      className={cn("py-24 lg:py-32 px-6 bg-navy-800/30")}
      aria-labelledby="chaos-heading"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 id="chaos-heading" className="section-title text-3xl lg:text-4xl font-semibold text-white text-balance">
            At scale, manual reconciliation breaks down.
          </h2>
          <p className="section-subtitle mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            What works for 10 transactions fails catastrophically at 100,000+.
          </p>
        </div>

        <div className="mb-16">
          <div className="stats-grid flex items-center justify-center gap-8 md:gap-16 mb-12">
            <div className="stat-counter text-center">
              <div className="counter-number text-4xl lg:text-6xl font-semibold text-white tabular-nums">{transactionCount.toLocaleString()}</div>
              <div className="text-gray-400 mt-2">Transactions</div>
            </div>
            <div className="w-px h-16 bg-navy-600" />
            <div className="kpi-card text-center">
              <div className="text-4xl lg:text-6xl font-semibold text-white tabular-nums">2.1K+</div>
              <div className="text-gray-400 mt-2">Exceptions</div>
            </div>
            <div className="w-px h-16 bg-navy-600" />
            <div className="kpi-card text-center">
              <div className="text-4xl lg:text-6xl font-semibold text-white tabular-nums">94%</div>
              <div className="text-gray-400 mt-2">Match Rate</div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-navy-600 bg-navy-800">
            <table className="data-table w-full text-sm">
              <thead className="bg-navy-800/50 border-b border-navy-600">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Transaction ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-600/50">
                {mockRows.map((row, index) => (
                  <tr key={row.id} className="table-row transition-all duration-300">
                    <td className="px-4 py-3 font-mono text-gray-300">{row.id}</td>
                    <td className="px-4 py-3 text-white">{row.amount}</td>
                    <td className="px-4 py-3 text-gray-400">{row.date}</td>
                    <td className="px-4 py-3"><StatusBadge status={row.status} size="sm" /></td>
                    <td className="px-4 py-3 text-gray-400">Internal Orders</td>
                    <td className="px-4 py-3 font-mono text-gray-500">ORD-{String(10482 + index).padStart(5, "0")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="labels-grid grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: "TIME CONSUMING", description: "Hours of manual matching per reconciliation run", icon: "⏱️", color: "text-amber-400" },
            { label: "ERROR PRONE", description: "Human fatigue leads to missed mismatches", icon: "⚠️", color: "text-red-400" },
            { label: "DIFFICULT TO TRACK", description: "No audit trail for manual decisions", icon: "🔍", color: "text-blue-400" },
          ].map((item) => (
            <div key={item.label} className="label-card p-6 rounded-xl bg-navy-800/50 border border-navy-600">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl" aria-hidden="true">{item.icon}</span>
                <h4 className={cn("font-semibold", item.color)}>{item.label}</h4>
              </div>
              <p className="text-gray-400">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}