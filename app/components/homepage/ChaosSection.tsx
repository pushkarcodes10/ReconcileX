"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/Badge";

interface ChaosSectionProps {
  className?: string;
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

export function ChaosSection({ className }: ChaosSectionProps) {
  const [scale, setScale] = useState(0);
  const [transactionCount, setTransactionCount] = useState(10);
  const [showLabels, setShowLabels] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setScale(1);
            setTimeout(() => setTransactionCount(1000), 300);
            setTimeout(() => setTransactionCount(100000), 800);
            setTimeout(() => setShowLabels(true), 1300);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -100px 0px" }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const visibleRows = mockRows.slice(0, Math.min(transactionCount === 10 ? 3 : 12, mockRows.length));

  return (
    <section
      ref={sectionRef}
      className={cn("py-24 lg:py-32 px-6 bg-navy-800/30", className)}
      aria-labelledby="chaos-heading"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 id="chaos-heading" className="text-3xl lg:text-4xl font-semibold text-white text-balance">
            At scale, manual reconciliation breaks down.
          </h2>
          <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            What works for 10 transactions fails catastrophically at 100,000+.
          </p>
        </div>

        <div className="mb-16">
          <div className="flex items-center justify-center gap-8 md:gap-16 mb-12">
            <div className={cn(
              "text-center transition-all duration-700 ease-out",
              scale === 1 ? "opacity-100 scale-100" : "opacity-0 scale-90"
            )}>
              <div className="text-4xl lg:text-6xl font-semibold text-white tabular-nums">{transactionCount.toLocaleString()}</div>
              <div className="text-gray-400 mt-2">Transactions</div>
            </div>
            <div className="w-px h-16 bg-navy-600" />
            <div className="text-center">
              <div className="text-4xl lg:text-6xl font-semibold text-white tabular-nums">2.1K+</div>
              <div className="text-gray-400 mt-2">Exceptions</div>
            </div>
            <div className="w-px h-16 bg-navy-600" />
            <div className="text-center">
              <div className="text-4xl lg:text-6xl font-semibold text-white tabular-nums">94%</div>
              <div className="text-gray-400 mt-2">Match Rate</div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-navy-600 bg-navy-800">
            <table className="w-full text-sm">
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
                {visibleRows.map((row, index) => (
                  <tr key={row.id} className={cn("transition-all duration-300", index < 3 ? "opacity-100" : "opacity-70")}>
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

        <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-6", showLabels ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8", "transition-all duration-700 delay-500")}>
          {[
            { label: "TIME CONSUMING", description: "Hours of manual matching per reconciliation run", icon: "⏱️", color: "text-amber-400" },
            { label: "ERROR PRONE", description: "Human fatigue leads to missed mismatches", icon: "⚠️", color: "text-red-400" },
            { label: "DIFFICULT TO TRACK", description: "No audit trail for manual decisions", icon: "🔍", color: "text-blue-400" },
          ].map((item) => (
            <div key={item.label} className="p-6 rounded-xl bg-navy-800/50 border border-navy-600">
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