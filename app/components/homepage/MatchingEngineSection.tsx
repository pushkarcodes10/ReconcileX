"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";

interface MatchingEngineSectionProps {
  className?: string;
}

const examples = [
  {
    title: "Exact Match",
    internal: { id: "ORD-10482", amount: "₹1,000.00", date: "17 Sep", ref: "ORD-10482" },
    external: { id: "TXN-88321", amount: "₹1,000.00", date: "17 Sep", ref: "ORD-10482" },
    checks: [
      { label: "Amount", match: true },
      { label: "Date", match: true },
      { label: "Reference", match: true },
      { label: "Currency", match: true },
    ],
    result: "MATCHED",
    confidence: 100,
    reason: "Exact reference + exact amount + matching date",
  },
  {
    title: "Potential Match",
    internal: { id: "ORD-10483", amount: "₹12,500.00", date: "16 Sep", ref: "ORD-10483" },
    external: { id: "BNK-283822", amount: "₹12,500.00", date: "17 Sep", ref: "BNK-283822" },
    checks: [
      { label: "Amount", match: true },
      { label: "Date", match: false, detail: "1 day difference" },
      { label: "Reference", match: false },
      { label: "Currency", match: true },
    ],
    result: "POTENTIAL_MATCH",
    confidence: 75,
    reason: "Amount match, date within ±2 day tolerance, reference differs",
  },
  {
    title: "Exception",
    internal: { id: "ORD-10484", amount: "₹42,000.00", date: "15 Sep", ref: "ORD-10484" },
    external: { id: "TXN-892341", amount: "₹41,950.00", date: "15 Sep", ref: "ORD-10485" },
    checks: [
      { label: "Amount", match: false, detail: "₹50 difference" },
      { label: "Date", match: true },
      { label: "Reference", match: false },
      { label: "Currency", match: true },
    ],
    result: "EXCEPTION",
    confidence: 45,
    reason: "Amount mismatch ₹50, reference differs, requires investigation",
  },
];

export function MatchingEngineSection({ className }: MatchingEngineSectionProps) {
  const [activeExample, setActiveExample] = useState(0);
  const [animStep, setAnimStep] = useState(0);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runAnimation = () => {
    setAnimStep(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
    const steps = examples[activeExample].checks.length + 2;
    let current = 0;
    intervalRef.current = setInterval(() => {
      setAnimStep(current);
      current++;
      if (current >= steps) clearInterval(intervalRef.current!);
    }, 600);
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            runAnimation();
          } else {
            setAnimStep(0);
          }
        });
      },
      { threshold: 0.2, rootMargin: "0px 0px -100px 0px" }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      runAnimation();
    }, 0);
    return () => clearTimeout(timer);
  }, [activeExample, runAnimation]);

  const example = examples[activeExample];

  return (
    <section
      ref={sectionRef}
      className={cn("py-24 lg:py-32 px-6", className)}
      aria-labelledby="matching-heading"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 id="matching-heading" className="text-3xl lg:text-4xl font-semibold text-white text-balance">
            Every match should have a reason.
          </h2>
          <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            Deterministic rules. Explainable decisions. No black boxes.
          </p>
        </div>

        <div className="flex justify-center gap-4 mb-12">
          {examples.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveExample(index)}
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-medium transition-all duration-300",
                activeExample === index
                  ? "bg-cyan-500 text-navy-900"
                  : "bg-navy-800 text-gray-300 hover:bg-navy-700 hover:text-white"
              )}
              aria-pressed={activeExample === index}
            >
              {examples[index].title}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <TransactionCard
            label="INTERNAL ORDER"
            data={example.internal}
            accentColor="blue"
            animStep={animStep}
            totalSteps={example.checks.length + 2}
          />
          <TransactionCard
            label="PAYMENT GATEWAY"
            data={example.external}
            accentColor="amber"
            animStep={animStep}
            totalSteps={example.checks.length + 2}
            isExternal
          />
          <div className="lg:col-span-3">
            <div className="bg-navy-800/50 border border-navy-600 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Matching Analysis</h3>
                <ProgressBar value={example.confidence} max={100} showLabel label="Confidence" variant="default" size="lg" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {example.checks.map((check, index) => (
                  <div
                    key={check.label}
                    className={cn(
                      "p-4 rounded-xl bg-navy-900/50 border transition-all duration-500",
                      animStep > index + 1
                        ? check.match
                          ? "border-green-500/30 bg-green-500/10"
                          : "border-red-500/30 bg-red-500/10"
                        : animStep === index + 1
                        ? "border-cyan-500/50 bg-cyan-500/10 ring-2 ring-cyan-500/20"
                        : "border-navy-600"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("w-2 h-2 rounded-full", check.match ? "bg-green-500" : "bg-red-500")} />
                      <span className="text-sm font-medium text-white">{check.label}</span>
                    </div>
                    {check.detail && (
                      <p className="text-xs text-gray-400">{check.detail}</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-navy-600">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Classification</p>
                    <StatusBadge status={example.result} size="md" />
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Confidence</p>
                    <p className="text-2xl font-semibold text-white tabular-nums">{example.confidence}%</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-gray-400 bg-navy-900/50 p-3 rounded-lg border border-navy-600">
                  <strong className="text-white">Reason:</strong> {example.reason}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface TransactionCardProps {
  label: string;
  data: { id: string; amount: string; date: string; ref: string };
  accentColor: "blue" | "amber" | "green" | "red";
  animStep: number;
  totalSteps: number;
  isExternal?: boolean;
}

function TransactionCard({ label, data, accentColor, animStep, totalSteps, isExternal }: TransactionCardProps) {
  const colors = {
    blue: "bg-blue-500/10 border-blue-500/20",
    amber: "bg-amber-500/10 border-amber-500/20",
    green: "bg-green-500/10 border-green-500/20",
    red: "bg-red-500/10 border-red-500/20",
  };

  return (
    <div className={cn("p-6 rounded-2xl border h-full", colors[accentColor])}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-navy-900/50 flex items-center justify-center">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
        <span className="text-sm font-medium text-gray-400 uppercase tracking-wide">{label}</span>
      </div>

      <div className="space-y-3">
        <FieldRow label="Transaction ID" value={data.id} step={0} animStep={animStep} totalSteps={totalSteps} />
        <FieldRow label="Amount" value={data.amount} step={1} animStep={animStep} totalSteps={totalSteps} highlight />
        <FieldRow label="Date" value={data.date} step={2} animStep={animStep} totalSteps={totalSteps} />
        <FieldRow label="Reference" value={data.ref} step={3} animStep={animStep} totalSteps={totalSteps} highlight />
      </div>
    </div>
  );
}

interface FieldRowProps {
  label: string;
  value: string;
  step: number;
  animStep: number;
  totalSteps: number;
  highlight?: boolean;
}

function FieldRow({ label, value, step, animStep, totalSteps, highlight }: FieldRowProps) {
  const visible = animStep > step || animStep >= totalSteps - 1;
  const active = animStep === step + 1;

  return (
    <div className={cn(
      "transition-all duration-300",
      visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
    )}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
        <code className={cn(
          "font-mono text-sm transition-colors",
          highlight ? "text-white" : "text-gray-300",
          active && "ring-2 ring-cyan-500/50 rounded px-1"
        )}>
          {value}
        </code>
      </div>
    </div>
  );
}