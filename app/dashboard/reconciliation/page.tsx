"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Table, Column } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { ProgressBar, StepProgress } from "@/components/ui/ProgressBar";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { mockReconciliationRuns, mockTransactions } from "@/lib/mock-data";
import { RefreshCwIcon, PlayIcon, SearchIcon } from "@/components/dashboard/Icons";

const runColumns: Column<typeof mockReconciliationRuns[0]>[] = [
  { key: "id", header: "Run ID", minWidth: "160px" },
  { key: "sourceA", header: "Source A", minWidth: "140px", render: (row) => <span className="capitalize text-gray-300">{row.sourceA.toLowerCase().replace("_", " ")}</span> },
  { key: "sourceB", header: "Source B", minWidth: "140px", render: (row) => <span className="capitalize text-gray-300">{row.sourceB.toLowerCase().replace("_", " ")}</span> },
  { key: "dateRange", header: "Date Range", minWidth: "160px", render: (row) => <span className="text-gray-300">{row.dateRange.start} → {row.dateRange.end}</span> },
  { key: "totalTransactions", header: "Transactions", minWidth: "120px", align: "right", render: (row) => <span className="tabular-nums text-white">{row.totalTransactions.toLocaleString()}</span> },
  { key: "matchRate", header: "Match Rate", minWidth: "110px", align: "right", render: (row) => <span className="tabular-nums text-white">{row.matchRate.toFixed(1)}%</span> },
  { key: "exceptions", header: "Exceptions", minWidth: "110px", align: "right", render: (row) => <span className="tabular-nums text-red-400">{row.exceptions.toLocaleString()}</span> },
  { key: "status", header: "Status", minWidth: "120px", align: "center", render: (row) => <StatusBadge status={row.status} size="sm" /> },
];

const processingRun = mockReconciliationRuns.find((r) => r.status === "PROCESSING");

export default function ReconciliationPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRun, setSelectedRun] = useState<typeof mockReconciliationRuns[0] | null>(null);
  const [formData, setFormData] = useState({
    sourceA: "INTERNAL_ORDERS",
    sourceB: "PAYMENT_GATEWAY",
    dateRange: { start: "2026-09-01", end: "2026-09-18" },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Create reconciliation:", formData);
    setShowCreateModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold text-white">Reconciliation</h1>
          <p className="mt-1 text-gray-400">Manage and monitor reconciliation runs.</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
          <PlusIcon className="w-5 h-5" />
          Create Reconciliation
        </Button>
      </div>

      {processingRun && (
        <Card className="mb-6 border-cyan-500/30 bg-cyan-500/5">
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <RefreshCwIcon className="w-6 h-6 text-cyan-400 animate-spin" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{processingRun.id}</h3>
                  <p className="text-sm text-gray-400">{processingRun.sourceA} ↔ {processingRun.sourceB} • {processingRun.dateRange.start} to {processingRun.dateRange.end}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-3xl font-semibold text-white tabular-nums">{processingRun.progress}%</p>
                  <p className="text-xs text-gray-400">Complete</p>
                </div>
                <ProgressBar value={processingRun.progress} max={100} size="lg" className="w-64" />
                <div className="text-center">
                  <p className="text-2xl font-semibold text-white tabular-nums">{processingRun.totalTransactions.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">Total Records</p>
                </div>
                <Button variant="outline" onClick={() => setSelectedRun(processingRun)}>View Details</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <div className="p-6 border-b border-navy-600 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-white">Reconciliation Runs</h3>
          </div>
        </div>
        <Table
          columns={runColumns}
          data={mockReconciliationRuns.filter((r) => r.status !== "PROCESSING")}
          keyExtractor={(row) => row.id}
          onRowClick={setSelectedRun}
          selectable
          emptyMessage="No reconciliation runs found."
        />
      </Card>

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Reconciliation"
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Source A"
              value={formData.sourceA}
              onChange={(e) => setFormData({ ...formData, sourceA: e.target.value })}
              options={[
                { value: "INTERNAL_ORDERS", label: "Internal Orders" },
                { value: "PAYMENT_GATEWAY", label: "Payment Gateway" },
                { value: "BANK", label: "Bank Statements" },
                { value: "ACCOUNTING", label: "Accounting System" },
              ]}
            />
            <Select
              label="Source B"
              value={formData.sourceB}
              onChange={(e) => setFormData({ ...formData, sourceB: e.target.value })}
              options={[
                { value: "INTERNAL_ORDERS", label: "Internal Orders" },
                { value: "PAYMENT_GATEWAY", label: "Payment Gateway" },
                { value: "BANK", label: "Bank Statements" },
                { value: "ACCOUNTING", label: "Accounting System" },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={formData.dateRange.start}
              onChange={(e) => setFormData({ ...formData, dateRange: { ...formData.dateRange, start: e.target.value } })}
            />
            <Input
              label="End Date"
              type="date"
              value={formData.dateRange.end}
              onChange={(e) => setFormData({ ...formData, dateRange: { ...formData.dateRange, end: e.target.value } })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-navy-600">
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button type="submit">Create Reconciliation</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!selectedRun}
        onClose={() => setSelectedRun(null)}
        title="Reconciliation Details"
        size="xl"
      >
        {selectedRun && <ReconciliationDetailModal run={selectedRun} onClose={() => setSelectedRun(null)} />}
      </Modal>
    </div>
  );
}

function ReconciliationDetailModal({ run, onClose }: { run: typeof mockReconciliationRuns[0]; onClose: () => void }) {
  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1"><p className="text-xs text-gray-500 uppercase tracking-wide">Run ID</p><code className="font-mono text-lg text-white">{run.id}</code></div>
        <div className="space-y-1"><p className="text-xs text-gray-500 uppercase tracking-wide">Sources</p><p className="text-white">{run.sourceA} ↔ {run.sourceB}</p></div>
        <div className="space-y-1"><p className="text-xs text-gray-500 uppercase tracking-wide">Date Range</p><p className="text-white">{run.dateRange.start} to {run.dateRange.end}</p></div>
        <div className="space-y-1"><p className="text-xs text-gray-500 uppercase tracking-wide">Status</p><StatusBadge status={run.status} size="md" /></div>
        <div className="space-y-1"><p className="text-xs text-gray-500 uppercase tracking-wide">Started</p><p className="text-white">{new Date(run.startedAt).toLocaleString()}</p></div>
        <div className="space-y-1"><p className="text-xs text-gray-500 uppercase tracking-wide">Completed</p><p className="text-white">{run.completedAt ? new Date(run.completedAt).toLocaleString() : "In progress"}</p></div>
        <div className="space-y-1"><p className="text-xs text-gray-500 uppercase tracking-wide">Duration</p><p className="text-white">{run.duration ? `${Math.floor(run.duration / 60)}m ${run.duration % 60}s` : "—"}</p></div>
        <div className="space-y-1"><p className="text-xs text-gray-500 uppercase tracking-wide">Progress</p><ProgressBar value={run.progress} max={100} showLabel size="lg" /></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total" value={run.totalTransactions.toLocaleString()} icon={<RefreshCwIcon />} color="cyan" />
        <StatCard label="Matched" value={run.matched.toLocaleString()} icon={<CheckCircleIcon />} color="green" />
        <StatCard label="Potential" value={run.potentialMatches.toLocaleString()} icon={<AlertCircleIcon />} color="amber" />
        <StatCard label="Exceptions" value={run.exceptions.toLocaleString()} icon={<AlertCircleIcon />} color="red" />
      </div>

      <StepProgress
        steps={[
          { label: "Imported", completed: true, active: false },
          { label: "Validated", completed: true, active: false },
          { label: "Normalized", completed: true, active: false },
          { label: "Duplicate Detection", completed: true, active: false },
          { label: "Matching", completed: run.status === "COMPLETED", active: run.status === "PROCESSING" },
          { label: "Exception Generation", completed: run.status === "COMPLETED", active: false },
          { label: "Completed", completed: run.status === "COMPLETED", active: false },
        ]}
      />

      {run.status === "COMPLETED" && (
        <div className="pt-4 border-t border-navy-600">
          <h3 className="text-lg font-semibold text-white mb-4">Results</h3>
          <div className="flex gap-4 overflow-x-auto">
            {[
              { label: "Matched", count: run.matched, status: "MATCHED" as const },
              { label: "Potential Matches", count: run.potentialMatches, status: "POTENTIAL_MATCH" as const },
              { label: "Unmatched", count: run.unmatched, status: "UNMATCHED" as const },
              { label: "Duplicates", count: run.duplicates, status: "MATCHED" as const },
              { label: "Errors", count: run.errors, status: "EXCEPTION" as const },
            ].map((item) => (
              <Button key={item.label} variant="outline" className="whitespace-nowrap flex flex-col items-start gap-1">
                <span className="text-xs text-gray-400">{item.label}</span>
                <span className="text-lg font-semibold text-white tabular-nums">{item.count.toLocaleString()}</span>
                <StatusBadge status={item.status} size="sm" />
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ReactNode; color: "cyan" | "green" | "amber" | "red" }) {
  const colors = {
    cyan: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    green: "bg-green-500/15 text-green-400 border-green-500/30",
    amber: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    red: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  return (
    <div className={cn("rounded-xl border p-4", colors[color])}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="mt-1 text-xl font-semibold text-white tabular-nums">{value}</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">{Icon}</div>
      </div>
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
}

function CheckCircleIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}

function AlertCircleIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
}