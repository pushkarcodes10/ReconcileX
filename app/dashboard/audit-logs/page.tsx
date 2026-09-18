"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Table, Column } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { mockAuditLogs, formatDateTime } from "@/lib/mock-data";
import Link from "next/link";
import { SearchIcon, FilterIcon, DownloadIcon } from "@/components/dashboard/Icons";

const auditColumns: Column<typeof mockAuditLogs[0]>[] = [
  { key: "timestamp", header: "Timestamp", minWidth: "170px", render: (row) => <span className="font-mono text-sm text-white">{formatDateTime(row.timestamp)}</span> },
  { key: "userName", header: "User", minWidth: "140px" },
  { key: "action", header: "Action", minWidth: "180px", render: (row) => <span className="px-2 py-0.5 text-xs font-medium bg-navy-700 text-gray-300 rounded">{row.action}</span> },
  { key: "entityType", header: "Entity", minWidth: "120px", render: (row) => <code className="font-mono text-sm text-white">{row.entityType}</code> },
  { key: "entityId", header: "Entity ID", minWidth: "140px", render: (row) => <code className="font-mono text-sm text-white">{row.entityId}</code> },
  { key: "previousState", header: "Previous State", minWidth: "200px", render: (row) => row.previousState ? <pre className="text-xs text-gray-400 max-w-xs overflow-auto">{JSON.stringify(row.previousState, null, 2)}</pre> : <span className="text-gray-500">—</span> },
  { key: "newState", header: "New State", minWidth: "200px", render: (row) => row.newState ? <pre className="text-xs text-green-400 max-w-xs overflow-auto">{JSON.stringify(row.newState, null, 2)}</pre> : <span className="text-gray-500">—</span> },
  { key: "ipAddress", header: "IP Address", minWidth: "140px", render: (row) => <span className="font-mono text-sm text-gray-400">{row.ipAddress}</span> },
];

export default function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [dateRange, setDateRange] = useState("7d");
  const [viewMode, setViewMode] = useState<"table" | "timeline">("table");

  const actions = [...new Set(mockAuditLogs.map((a) => a.action))];
  const entities = [...new Set(mockAuditLogs.map((a) => a.entityType))];

  const filteredLogs = mockAuditLogs.filter((log) => {
    const matchesSearch = log.userName.toLowerCase().includes(search.toLowerCase()) ||
      log.entityId.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase());
    const matchesAction = !actionFilter || log.action === actionFilter;
    const matchesEntity = !entityFilter || log.entityType === entityFilter;
    return matchesSearch && matchesAction && matchesEntity;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold text-white">Audit Logs</h1>
          <p className="mt-1 text-gray-400">Immutable record of all important system and user actions.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="#">
            <Button variant="outline">
              <DownloadIcon className="mr-2" />
              Export CSV
            </Button>
          </Link>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Search audit logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-navy-800 border border-navy-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                options={[{ value: "", label: "All Actions" }, ...actions.map((a) => ({ value: a, label: a.replace("_", " ") }))]}
                placeholder="Action"
                className="w-56"
              />
              <Select
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
                options={[{ value: "", label: "All Entities" }, ...entities.map((e) => ({ value: e, label: e.replace("_", " ") }))]}
                placeholder="Entity"
                className="w-56"
              />
              <Select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                options={[
                  { value: "1d", label: "Last 24 hours" },
                  { value: "7d", label: "Last 7 days" },
                  { value: "30d", label: "Last 30 days" },
                  { value: "90d", label: "Last 90 days" },
                ]}
                placeholder="Date Range"
                className="w-56"
              />
              <div className="flex items-center gap-2 border-l border-navy-600 pl-4">
                <span className="text-sm text-gray-400">View:</span>
                <Button variant={viewMode === "table" ? "primary" : "ghost"} size="sm" onClick={() => setViewMode("table")}>Table</Button>
                <Button variant={viewMode === "timeline" ? "primary" : "ghost"} size="sm" onClick={() => setViewMode("timeline")}>Timeline</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {viewMode === "table" ? (
        <Table
          columns={auditColumns}
          data={filteredLogs}
          keyExtractor={(row) => row.id}
          selectable
          emptyMessage="No audit logs found matching your criteria."
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {filteredLogs.map((log) => (
                <div key={log.id} className="flex gap-4 p-4 rounded-xl bg-navy-800/50 border border-navy-600 hover:border-navy-500 transition-colors">
                  <div className="flex-shrink-0 w-16 text-center">
                    <div className="w-2 h-2 rounded-full bg-cyan-500 mx-auto mb-2" />
                    <span className="text-xs font-mono text-gray-400">{formatDateTime(log.timestamp)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-medium text-white">{log.userName}</span>
                      <span className="px-2 py-0.5 text-xs font-medium bg-navy-700 text-gray-300 rounded">{log.action.replace("_", " ")}</span>
                      <span className="text-sm text-gray-400">{log.entityType}</span>
                      <code className="font-mono text-sm text-cyan-400">{log.entityId}</code>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Previous State</p>
                        <pre className="text-xs text-gray-400 max-h-32 overflow-auto">{log.previousState ? JSON.stringify(log.previousState, null, 2) : "—"}</pre>
                      </div>
                      <div>
                        <p className="text-gray-500">New State</p>
                        <pre className="text-xs text-green-400 max-h-32 overflow-auto">{log.newState ? JSON.stringify(log.newState, null, 2) : "—"}</pre>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">IP: {log.ipAddress}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}