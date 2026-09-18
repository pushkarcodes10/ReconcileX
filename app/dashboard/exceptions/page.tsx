"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Table, Column } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { mockExceptions, getPriorityColor, formatDate } from "@/lib/mock-data";
import { FilterIcon, SearchIcon, AlertTriangleIcon, ClockIcon, UserIcon, AlertCircleIcon } from "@/components/dashboard/Icons";

const exceptionColumns: Column<typeof mockExceptions[0]>[] = [
  { key: "id", header: "Exception ID", minWidth: "140px" },
  { key: "transactionId", header: "Transaction", minWidth: "140px", render: (row) => <code className="font-mono text-sm text-white">{row.transactionId}</code> },
  { key: "type", header: "Type", minWidth: "160px", render: (row) => <span className="text-sm text-gray-300">{row.type.replace("_", " ")}</span> },
  { key: "amountDifference", header: "Amount Diff", minWidth: "120px", align: "right", render: (row) => row.amountDifference ? <span className="font-mono tabular-nums text-red-400">₹{row.amountDifference.toLocaleString()}</span> : <span className="text-gray-500">—</span> },
  { key: "dateDifference", header: "Date Diff", minWidth: "100px", align: "right", render: (row) => row.dateDifference ? <span className="font-mono tabular-nums text-amber-400">{row.dateDifference} day(s)</span> : <span className="text-gray-500">—</span> },
  { key: "priority", header: "Priority", minWidth: "100px", align: "center", render: (row) => <span className={cn("px-2 py-1 text-xs font-medium rounded-full", getPriorityColor(row.priority))}>{row.priority}</span> },
  { key: "status", header: "Status", minWidth: "130px", align: "center", render: (row) => <StatusBadge status={row.status} size="sm" /> },
  { key: "assignedTo", header: "Assigned To", minWidth: "140px", render: (row) => row.assignedTo ? <span className="text-gray-300">{row.assignedTo}</span> : <span className="text-gray-500">Unassigned</span> },
  { key: "createdAt", header: "Created", minWidth: "140px", render: (row) => <span className="text-gray-300">{formatDate(row.createdAt)}</span> },
];

export default function ExceptionsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [selectedException, setSelectedException] = useState<typeof mockExceptions[0] | null>(null);

  const filteredExceptions = mockExceptions.filter((exc) => {
    const matchesSearch = exc.id.toLowerCase().includes(search.toLowerCase()) || exc.transactionId.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || exc.status === statusFilter;
    const matchesPriority = !priorityFilter || exc.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const statuses = ["OPEN", "ASSIGNED", "UNDER_REVIEW", "ESCALATED", "RESOLVED"] as const;
  const priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold text-white">Exceptions</h1>
          <p className="mt-1 text-gray-400">Investigate transactions that require attention.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Open", count: mockExceptions.filter((e) => e.status === "OPEN").length, icon: AlertCircleIcon, color: "text-red-400" },
          { label: "Under Review", count: mockExceptions.filter((e) => e.status === "UNDER_REVIEW").length, icon: AlertTriangleIcon, color: "text-amber-400" },
          { label: "Escalated", count: mockExceptions.filter((e) => e.status === "ESCALATED").length, icon: AlertTriangleIcon, color: "text-red-400" },
          { label: "Resolved", count: mockExceptions.filter((e) => e.status === "RESOLVED").length, icon: CheckCircleIcon, color: "text-green-400" },
        ].map((stat) => (
          <Card key={stat.label} padding="md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">{stat.label}</p>
                <p className="mt-1 text-2xl font-semibold text-white tabular-nums">{stat.count}</p>
              </div>
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", `${stat.color}/10 border border-current/20`)}>
                <stat.icon className={cn("w-6 h-6", stat.color.replace("/10", ""))} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Search exceptions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-navy-800 border border-navy-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[{ value: "", label: "All Statuses" }, ...statuses.map((s) => ({ value: s, label: s.replace("_", " ") }))]}
                placeholder="Status"
                className="w-48"
              />
              <Select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                options={[{ value: "", label: "All Priorities" }, ...priorities.map((s) => ({ value: s, label: s }))]}
                placeholder="Priority"
                className="w-48"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Table
        columns={exceptionColumns}
        data={filteredExceptions}
        keyExtractor={(row) => row.id}
        onRowClick={setSelectedException}
        selectable
        emptyMessage="No exceptions found matching your criteria."
      />

      <Drawer
        isOpen={!!selectedException}
        onClose={() => setSelectedException(null)}
        title={`Exception ${selectedException?.id}`}
        size="xl"
      >
        {selectedException && <ExceptionDetailDrawer exception={selectedException} onClose={() => setSelectedException(null)} />}
      </Drawer>
    </div>
  );
}

function ExceptionDetailDrawer({ exception, onClose }: { exception: typeof mockExceptions[0]; onClose: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <StatusBadge status={exception.status} size="md" />
            <span className={cn("px-2 py-1 text-xs font-medium rounded-full", getPriorityColor(exception.priority))}>{exception.priority}</span>
          </div>
          <p className="mt-1 text-sm text-gray-400">Exception ID: <code className="font-mono text-white">{exception.id}</code></p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-white">Transaction Comparison</h3>

          <div className="grid grid-cols-2 gap-4">
            <Card variant="outlined" padding="md">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-medium text-blue-400 uppercase tracking-wide">INTERNAL ORDER</span>
              </div>
              <div className="space-y-3">
                {Object.entries(exception.internalRecord.fields).map(([key, field]) => (
                  <div key={key} className={cn("flex items-center justify-between p-3 rounded-lg bg-navy-900/50 border", field.matched ? "border-green-500/30 bg-green-500/10" : "border-red-500/30 bg-red-500/10")}>
                    <span className="text-sm text-gray-400 capitalize">{key}</span>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-white">{field.value}</code>
                      {field.matched ? (
                        <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </span>
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card variant="outlined" padding="md">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-medium text-amber-400 uppercase tracking-wide">PAYMENT GATEWAY</span>
              </div>
              <div className="space-y-3">
                {exception.externalRecord && Object.entries(exception.externalRecord.fields).map(([key, field]) => (
                  <div key={key} className={cn("flex items-center justify-between p-3 rounded-lg bg-navy-900/50 border", field.matched ? "border-green-500/30 bg-green-500/10" : "border-red-500/30 bg-red-500/10")}>
                    <span className="text-sm text-gray-400 capitalize">{key}</span>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-white">{field.value}</code>
                      {field.matched ? (
                        <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </span>
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {exception.amountDifference !== undefined && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <div className="flex items-center justify-between">
                <span className="text-sm text-red-400 font-medium">Amount Difference</span>
                <span className="text-2xl font-semibold text-red-400 tabular-nums">₹{exception.amountDifference}</span>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-white">Exception Details</h3>

          <Card variant="outlined" padding="md">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-1"><p className="text-xs text-gray-500 uppercase tracking-wide">Assigned To</p><p className="text-white">{exception.assignedTo ? "Arjun Mehta" : "Unassigned"}</p></div>
              <div className="space-y-1"><p className="text-xs text-gray-500 uppercase tracking-wide">Type</p><p className="text-white capitalize">{exception.type.replace("_", " ")}</p></div>
              <div className="space-y-1"><p className="text-xs text-gray-500 uppercase tracking-wide">Priority</p><span className={cn("px-2 py-1 text-sm font-medium rounded-full", getPriorityColor(exception.priority))}>{exception.priority}</span></div>
              <div className="space-y-1"><p className="text-xs text-gray-500 uppercase tracking-wide">Created</p><p className="text-white">{formatDate(exception.createdAt)}</p></div>
            </div>

            <div className="pt-4 border-t border-navy-600">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Investigation Notes</h4>
              <div className="bg-navy-900/50 rounded-xl border border-navy-600 p-4 min-h-[120px] text-gray-300">
                {exception.resolutionNotes || "No notes added yet. Start investigating by adding a comment below."}
              </div>
            </div>

            <div className="pt-4 border-t border-navy-600">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Actions</h4>
              <div className="flex flex-wrap gap-3">
                {exception.status !== "ASSIGNED" && <Button variant="outline" size="sm">Assign to Me</Button>}
                {exception.status !== "UNDER_REVIEW" && <Button variant="outline" size="sm">Start Review</Button>}
                {exception.status !== "ESCALATED" && <Button variant="outline" size="sm" onClick={() => alert("Escalate")}>Escalate</Button>}
                {exception.status !== "RESOLVED" && <Button size="sm" onClick={() => alert("Resolve")}>Resolve</Button>}
                {exception.status === "RESOLVED" && <Button variant="outline" size="sm">Reopen</Button>}
              </div>
            </div>
          </Card>

          {exception.resolvedAt && (
            <Card variant="outlined" padding="md" className="bg-green-500/5 border-green-500/20">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircleIcon className="w-5 h-5 text-green-400" />
                <h4 className="font-medium text-green-400">Resolved</h4>
              </div>
              <div className="space-y-1 text-sm text-gray-300">
                <p><strong>Reason:</strong> {exception.resolutionReason}</p>
                <p><strong>Resolved by:</strong> Arjun Mehta</p>
                <p><strong>Resolved at:</strong> {formatDate(exception.resolvedAt!)}</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}