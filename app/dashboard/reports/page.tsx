"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Table, Column } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { mockReports, formatDate } from "@/lib/mock-data";
import { FileTextIcon, DownloadIcon, SearchIcon, FilterIcon, ClockIcon, CheckCircleIcon } from "@/components/dashboard/Icons";

const reportColumns: Column<typeof mockReports[0]>[] = [
  { key: "name", header: "Report Name", minWidth: "250px" },
  { key: "type", header: "Type", minWidth: "160px", render: (row) => <span className="text-sm text-gray-300">{row.type.replace("_", " ")}</span> },
  { key: "dateRange", header: "Date Range", minWidth: "180px", render: (row) => <span className="text-gray-300">{formatDate(row.dateRange.start)} – {formatDate(row.dateRange.end)}</span> },
  { key: "status", header: "Status", minWidth: "120px", align: "center", render: (row) => <StatusBadge status={row.status === "GENERATING" ? "PROCESSING" : row.status === "READY" ? "COMPLETED" : "FAILED"} size="sm" /> },
  { key: "createdAt", header: "Created", minWidth: "140px", render: (row) => <span className="text-gray-300">{formatDate(row.createdAt)}</span> },
];

export default function ReportsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateRange, setDateRange] = useState("30d");
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [formData, setFormData] = useState({
    type: "DAILY_RECONCILIATION",
    dateRange: { start: "2026-09-01", end: "2026-09-18" },
    format: "PDF",
  });

  const types = ["DAILY_RECONCILIATION", "MONTHLY_RECONCILIATION", "EXCEPTION_SUMMARY", "MISMATCH_REPORT", "AUDIT_TRAIL"] as const;

  const filteredReports = mockReports.filter((report) => {
    const matchesSearch = report.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = !typeFilter || report.type === typeFilter;
    const matchesStatus = !statusFilter || report.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Generate report:", formData);
    setShowGenerateModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold text-white">Reports</h1>
          <p className="mt-1 text-gray-400">Generate and download reconciliation reports.</p>
        </div>
        <Button onClick={() => setShowGenerateModal(true)}>
          <FileTextIcon className="mr-2" />
          Generate Report
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Search reports..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-navy-800 border border-navy-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                options={[{ value: "", label: "All Types" }, ...types.map((t) => ({ value: t, label: t.replace("_", " ") }))]}
                placeholder="Type"
                className="w-56"
              />
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: "", label: "All Statuses" },
                  { value: "READY", label: "Ready" },
                  { value: "GENERATING", label: "Generating" },
                  { value: "FAILED", label: "Failed" },
                ]}
                placeholder="Status"
                className="w-56"
              />
              <Select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                options={[
                  { value: "7d", label: "Last 7 days" },
                  { value: "30d", label: "Last 30 days" },
                  { value: "90d", label: "Last 90 days" },
                ]}
                placeholder="Date Range"
                className="w-56"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Table
        columns={reportColumns}
        data={filteredReports}
        keyExtractor={(row) => row.id}
        selectable
        emptyMessage="No reports found matching your criteria."
      />

      <Modal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        title="Generate New Report"
        size="md"
      >
        <form onSubmit={handleGenerate} className="space-y-4">
          <Select
            label="Report Type"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as typeof formData.type })}
            options={types.map((t) => ({ value: t, label: t.replace("_", " ") }))}
          />
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
          <Select
            label="Format"
            value={formData.format}
            onChange={(e) => setFormData({ ...formData, format: e.target.value })}
            options={[
              { value: "PDF", label: "PDF" },
              { value: "CSV", label: "CSV" },
            ]}
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-navy-600">
            <Button type="button" variant="secondary" onClick={() => setShowGenerateModal(false)}>Cancel</Button>
            <Button type="submit">Generate Report</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}