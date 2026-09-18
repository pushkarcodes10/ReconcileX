"use client";

import { cn } from "@/lib/utils";
import { MetricCard, KPIRow, StatCard } from "@/components/dashboard/MetricCard";
import { ChartCard, LineChart, BarChart, DonutChart } from "@/components/dashboard/ChartCard";
import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { mockKPIMetrics, chartData } from "@/lib/mock-data";
import {
  HomeIcon,
  DatabaseIcon,
  AlertTriangleIcon,
  TrendingUpIcon,
  ClockIcon,
} from "@/components/dashboard/Icons";

const recentRuns = [
  { id: "RUN-20260917-001", source: "Internal Orders ↔ Payment Gateway", period: "Sep 1–17", transactions: "125,420", matched: "119,823", exceptions: "2,176", duration: "45m 00s", status: "COMPLETED" },
  { id: "RUN-20260916-001", source: "Internal Orders ↔ Bank", period: "Sep 1–16", transactions: "98,750", matched: "94,231", exceptions: "1,629", duration: "38m 00s", status: "COMPLETED" },
  { id: "RUN-20260915-001", source: "Payment Gateway ↔ Bank", period: "Sep 1–15", transactions: "87,340", matched: "83,102", exceptions: "1,671", duration: "35m 00s", status: "COMPLETED" },
  { id: "RUN-20260914-001", source: "Internal Orders ↔ Accounting", period: "Sep 1–14", transactions: "65,200", matched: "62,100", exceptions: "1,210", duration: "28m 00s", status: "COMPLETED" },
  { id: "RUN-20260918-001", source: "Internal Orders ↔ Payment Gateway", period: "Sep 1–18", transactions: "142,000", matched: "—", exceptions: "—", duration: "—", status: "PROCESSING" },
];

const activity = [
  { time: "14:32", event: "Exception resolved", detail: "EXC-10294 marked as resolved", type: "success" },
  { time: "14:29", event: "Comment added", detail: "Arjun Mehta on EXC-10291", type: "info" },
  { time: "14:24", event: "Investigation started", detail: "EXC-10293 assigned to Arjun Mehta", type: "info" },
  { time: "10:45", event: "Reconciliation completed", detail: "RUN-20260917-001 finished with 95.5% match rate", type: "success" },
  { time: "10:00", event: "Reconciliation started", detail: "RUN-20260918-001 queued for processing", type: "processing" },
  { time: "09:15", event: "Import completed", detail: "Bank statement (52,000 rows) validated", type: "success" },
];

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold text-white">Overview</h1>
          <p className="mt-1 text-gray-400">Monitor your reconciliation operations.</p>
        </div>
        <Link href="/dashboard/reconciliation">
          <Button>Create Reconciliation</Button>
        </Link>
      </div>

      <KPIRow metrics={mockKPIMetrics} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Reconciliation Volume" description="Daily transaction processing and match rates">
          <LineChart
            data={chartData.reconciliationVolume}
            xKey="date"
            yKeys={[
              { key: "transactions", label: "Transactions", color: "#3B82F6" },
              { key: "matched", label: "Matched", color: "#10B981" },
              { key: "exceptions", label: "Exceptions", color: "#EF4444" },
            ]}
            height={320}
          />
        </ChartCard>

        <ChartCard title="Match Rate Trend" description="7-day rolling match rate percentage">
          <LineChart
            data={chartData.matchRate}
            xKey="date"
            yKeys={[
              { key: "rate", label: "Match Rate %", color: "#00D4AA" },
            ]}
            height={320}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
<ChartCard title="Exception Breakdown" description="Exceptions by type across all reconciliations">
            <DonutChart
              data={chartData.exceptionBreakdown.map((e) => ({ label: e.type, value: e.count, color: e.type === "Amount Mismatch" ? "#EF4444" : e.type === "Missing Record" ? "#F59E0B" : e.type === "Date Mismatch" ? "#3B82F6" : e.type === "Reference Mismatch" ? "#8B5CF6" : e.type === "Duplicate" ? "#10B981" : "#EF4444" }))}
              size={280}
              strokeWidth={20}
            />
          </ChartCard>

        <ChartCard title="Processing Activity" description="Hourly import, reconciliation, and exception activity">
          <BarChart
            data={chartData.processingActivity.map((d) => ({ label: d.hour, value: d.imports + d.reconciliations + d.exceptions, color: "#00D4AA" }))}
            height={280}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="p-6 border-b border-navy-600 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Recent Reconciliation Runs</h3>
<Link href="/dashboard/reconciliation">
            <Button variant="ghost" size="sm">View All</Button>
          </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-navy-800/50 border-b border-navy-600">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Run ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Period</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Transactions</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Matched</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Exceptions</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-600/50">
                {recentRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-navy-700/50 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-mono text-white">{run.id}</td>
                    <td className="px-4 py-3 text-gray-300 max-w-xs truncate">{run.source}</td>
                    <td className="px-4 py-3 text-gray-400">{run.period}</td>
                    <td className="px-4 py-3 text-white tabular-nums">{run.transactions}</td>
                    <td className="px-4 py-3 text-green-400 tabular-nums">{run.matched}</td>
                    <td className="px-4 py-3 text-red-400 tabular-nums">{run.exceptions}</td>
                    <td className="px-4 py-3 text-gray-400">{run.duration}</td>
                    <td className="px-4 py-3"><StatusBadge status={run.status} size="sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className="p-6 border-b border-navy-600 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
          </div>
          <div className="divide-y divide-navy-600/50">
            {activity.map((item) => (
              <div key={item.time} className="p-4 flex items-start gap-4 hover:bg-navy-700/50 transition-colors">
                <div className="flex-shrink-0 w-16 text-right text-sm font-mono text-gray-500">{item.time}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{item.event}</span>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-navy-700 text-gray-400 uppercase tracking-wide">{item.type}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-400">{item.detail}</p>
                </div>
                <div className={cn("w-2 h-2 rounded-full mt-2 flex-shrink-0",
                  item.type === "success" && "bg-green-500",
                  item.type === "info" && "bg-cyan-500",
                  item.type === "processing" && "bg-amber-500 animate-pulse"
                )} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}