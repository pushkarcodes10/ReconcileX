"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Table, Column } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { ProgressBar, StepProgress } from "@/components/ui/ProgressBar";
import { Drawer } from "@/components/ui/Drawer";
import { mockImportJobs, formatDateTime } from "@/lib/mock-data";
import { UploadIcon, DownloadIcon, XIcon, CheckCircleIcon, AlertCircleIcon, ClockIcon } from "@/components/dashboard/Icons";

const importColumns: Column<typeof mockImportJobs[0]>[] = [
  { key: "id", header: "Import ID", minWidth: "160px" },
  { key: "dataSource", header: "Source", minWidth: "140px", render: (row) => <span className="capitalize text-gray-300">{row.dataSource.toLowerCase().replace("_", " ")}</span> },
  { key: "fileName", header: "File Name", minWidth: "200px" },
  { key: "status", header: "Status", minWidth: "140px", align: "center", render: (row) => <StatusBadge status={row.status} size="sm" /> },
  { key: "progress", header: "Progress", minWidth: "160px", render: (row) => <ProgressBar value={row.progress} max={100} showLabel size="sm" /> },
  { key: "rowCount", header: "Rows", minWidth: "100px", align: "right", render: (row) => <span className="tabular-nums text-white">{row.rowCount.toLocaleString()}</span> },
  { key: "validRows", header: "Valid", minWidth: "100px", align: "right", render: (row) => <span className="tabular-nums text-green-400">{row.validRows.toLocaleString()}</span> },
  { key: "invalidRows", header: "Invalid", minWidth: "100px", align: "right", render: (row) => <span className="tabular-nums text-red-400">{row.invalidRows.toLocaleString()}</span> },
  { key: "createdAt", header: "Created", minWidth: "160px", render: (row) => <span className="text-gray-300">{formatDateTime(row.createdAt)}</span> },
];

export default function ImportsPage() {
  const [dragActive, setDragActive] = useState(false);
  const [selectedImport, setSelectedImport] = useState<typeof mockImportJobs[0] | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) {
      // Handle file upload
      console.log("File dropped:", e.dataTransfer.files[0].name);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold text-white">Import Data</h1>
          <p className="mt-1 text-gray-400">Upload transaction files for reconciliation.</p>
        </div>
      </div>

      <Card className={cn("border-2 border-dashed transition-colors", dragActive && "border-cyan-500 bg-cyan-500/5")} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>
        <CardContent className="pt-6 pb-12">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
              <UploadIcon className="w-8 h-8 text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Drop CSV file here</h3>
            <p className="text-gray-400 mb-6">or click to browse</p>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              id="file-upload"
              onChange={(e) => { console.log("File selected:", e.target.files?.[0]?.name); }}
            />
            <Button variant="outline" onClick={() => document.getElementById("file-upload")?.click()}>
              Choose File
            </Button>
            <p className="mt-4 text-sm text-gray-500">Supports CSV files up to 100MB. Headers: Transaction ID, Amount, Date, Currency, Reference</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {[
          { label: "Total Imports", value: mockImportJobs.length, icon: UploadIcon, color: "text-cyan-400" },
          { label: "Pending Validation", value: mockImportJobs.filter((j) => j.status !== "READY").length, icon: ClockIcon, color: "text-amber-400" },
          { label: "Ready for Reconciliation", value: mockImportJobs.filter((j) => j.status === "READY").length, icon: CheckCircleIcon, color: "text-green-400" },
        ].map((stat) => (
          <Card key={stat.label} padding="md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">{stat.label}</p>
                <p className="mt-1 text-2xl font-semibold text-white tabular-nums">{stat.value}</p>
              </div>
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", `${stat.color}/10 border border-current/20`)}>
                <stat.icon className={cn("w-6 h-6", stat.color.replace("/10", ""))} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Table
        columns={importColumns}
        data={mockImportJobs}
        keyExtractor={(row) => row.id}
        onRowClick={setSelectedImport}
        selectable
        emptyMessage="No import jobs found."
      />

      <Drawer
        isOpen={!!selectedImport}
        onClose={() => setSelectedImport(null)}
        title="Import Details"
        size="lg"
      >
        {selectedImport && <ImportDetailDrawer importJob={selectedImport} onClose={() => setSelectedImport(null)} />}
      </Drawer>
    </div>
  );
}

function ImportDetailDrawer({ importJob, onClose }: { importJob: typeof mockImportJobs[0]; onClose: () => void }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1"><p className="text-xs text-gray-500 uppercase tracking-wide">Import ID</p><code className="font-mono text-lg text-white">{importJob.id}</code></div>
        <div className="space-y-1"><p className="text-xs text-gray-500 uppercase tracking-wide">Source</p><p className="capitalize text-white">{importJob.dataSource.toLowerCase().replace("_", " ")}</p></div>
        <div className="space-y-1"><p className="text-xs text-gray-500 uppercase tracking-wide">File Name</p><p className="text-white truncate">{importJob.fileName}</p></div>
        <div className="space-y-1"><p className="text-xs text-gray-500 uppercase tracking-wide">File Size</p><p className="text-white">{(importJob.fileSize / 1024 / 1024).toFixed(2)} MB</p></div>
        <div className="space-y-1"><p className="text-xs text-gray-500 uppercase tracking-wide">Status</p><StatusBadge status={importJob.status} size="md" /></div>
        <div className="space-y-1"><p className="text-xs text-gray-500 uppercase tracking-wide">Progress</p><ProgressBar value={importJob.progress} max={100} showLabel size="lg" /></div>
        <div className="space-y-1"><p className="text-xs text-gray-500 uppercase tracking-wide">Total Rows</p><p className="text-white tabular-nums">{importJob.rowCount.toLocaleString()}</p></div>
        <div className="space-y-1"><p className="text-xs text-gray-500 uppercase tracking-wide">Valid Rows</p><p className="text-green-400 tabular-nums">{importJob.validRows.toLocaleString()}</p></div>
        <div className="space-y-1"><p className="text-xs text-gray-500 uppercase tracking-wide">Invalid Rows</p><p className="text-red-400 tabular-nums">{importJob.invalidRows.toLocaleString()}</p></div>
        <div className="space-y-1"><p className="text-xs text-gray-500 uppercase tracking-wide">Duplicates</p><p className="text-amber-400 tabular-nums">{importJob.duplicateRows.toLocaleString()}</p></div>
        <div className="space-y-1"><p className="text-xs text-gray-500 uppercase tracking-wide">Created</p><p className="text-white">{formatDateTime(importJob.createdAt)}</p></div>
        <div className="space-y-1"><p className="text-xs text-gray-500 uppercase tracking-wide">Completed</p><p className="text-white">{importJob.completedAt ? formatDateTime(importJob.completedAt) : "—"}</p></div>
      </div>

      <StepProgress
        steps={[
          { label: "Uploading", completed: true, active: false },
          { label: "Validating", completed: importJob.status !== "UPLOADING", active: importJob.status === "VALIDATING" },
          { label: "Normalizing", completed: ["NORMALIZING", "DUPLICATE_DETECTION", "READY"].includes(importJob.status), active: importJob.status === "NORMALIZING" },
          { label: "Duplicate Detection", completed: ["DUPLICATE_DETECTION", "READY"].includes(importJob.status), active: importJob.status === "DUPLICATE_DETECTION" },
          { label: "Ready", completed: importJob.status === "READY", active: false },
        ]}
      />

      {importJob.errors.length > 0 && (
        <div className="pt-6 border-t border-navy-600">
          <h3 className="text-lg font-semibold text-white mb-4">Validation Errors</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-navy-800/50 border-b border-navy-600">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Row</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Field</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Error</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-600/50">
                {importJob.errors.map((error) => (
                  <tr key={`${error.row}-${error.field}`}>
                    <td className="px-4 py-3 font-mono text-gray-300">{error.row}</td>
                    <td className="px-4 py-3 text-white">{error.field}</td>
                    <td className="px-4 py-3 text-red-400">{error.error}</td>
                    <td className="px-4 py-3 font-mono text-gray-400">{error.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}