"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Table, Column } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/Badge";
import { Drawer } from "@/components/ui/Drawer";
import { Card, CardContent } from "@/components/ui/Card";
import { formatCurrency, formatDate, mockTransactions, getStatusColor } from "@/lib/mock-data";
import { SearchIcon, FilterIcon, ChevronDownIcon, DownloadIcon } from "@/components/dashboard/Icons";
import Link from "next/link";

const columns: Column<typeof mockTransactions[0]>[] = [
  { key: "id", header: "Transaction ID", minWidth: "160px" },
  { key: "externalId", header: "External Ref", minWidth: "160px" },
  { key: "source", header: "Source", minWidth: "140px", render: (row) => <span className="capitalize text-gray-300">{row.source.toLowerCase().replace("_", " ")}</span> },
  { key: "amount", header: "Amount", minWidth: "120px", align: "right", render: (row) => <span className="font-mono tabular-nums text-white">{formatCurrency(row.amount, row.currency)}</span> },
  { key: "currency", header: "Currency", minWidth: "90px", align: "center" },
  { key: "date", header: "Date", minWidth: "110px", render: (row) => <span className="text-gray-300">{formatDate(row.date)}</span> },
  { key: "status", header: "Match Status", minWidth: "140px", align: "center", render: (row) => <StatusBadge status={row.status} size="sm" /> },
  { key: "reconciliationRunId", header: "Reconciliation", minWidth: "160px", render: (row) => row.reconciliationRunId ? <code className="text-sm font-mono text-gray-400">{row.reconciliationRunId}</code> : <span className="text-gray-500">—</span> },
];

export default function TransactionsPage() {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState<typeof mockTransactions[0] | null>(null);

  const filteredTransactions = mockTransactions.filter((txn) => {
    const matchesSearch = txn.id.toLowerCase().includes(search.toLowerCase()) ||
      txn.externalId.toLowerCase().includes(search.toLowerCase());
    const matchesSource = !sourceFilter || txn.source === sourceFilter;
    const matchesStatus = !statusFilter || txn.status === statusFilter;
    return matchesSearch && matchesSource && matchesStatus;
  });

  const sources = ["BANK", "PAYMENT_GATEWAY", "INTERNAL_ORDERS", "ACCOUNTING"] as const;
  const statuses = ["MATCHED", "POTENTIAL_MATCH", "UNMATCHED", "EXCEPTION", "RESOLVED"] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold text-white">Transactions</h1>
          <p className="mt-1 text-gray-400">Search and explore transaction records.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/imports">
            <Button variant="outline">
              <DownloadIcon className="mr-2" />
              Export
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
                placeholder="Search transactions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-navy-800 border border-navy-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                options={[{ value: "", label: "All Sources" }, ...sources.map((s) => ({ value: s, label: s.replace("_", " ") }))]}
                placeholder="Source"
                className="w-48"
              />
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[{ value: "", label: "All Statuses" }, ...statuses.map((s) => ({ value: s, label: s.replace("_", " ") }))]}
                placeholder="Status"
                className="w-48"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Table
        columns={columns}
        data={filteredTransactions}
        keyExtractor={(row) => row.id}
        onRowClick={setSelectedTransaction}
        selectable
        emptyMessage="No transactions found matching your criteria."
      />

      <Drawer
        isOpen={!!selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        title="Transaction Details"
        size="lg"
      >
        {selectedTransaction && <TransactionDetailDrawer transaction={selectedTransaction} onClose={() => setSelectedTransaction(null)} />}
      </Drawer>
    </div>
  );
}

function TransactionDetailDrawer({ transaction, onClose }: { transaction: typeof mockTransactions[0]; onClose: () => void }) {
  const relatedRecords = [
    { source: "INTERNAL_ORDERS" as const, id: "ORD-10482", amount: "₹1,000.00", date: "17 Sep 2026", status: "COMPLETED", reference: "ORD-10482", fields: { amount: { value: "₹1,000.00", matched: true }, date: { value: "17 Sep 2026", matched: true }, reference: { value: "ORD-10482", matched: true } } },
    { source: "PAYMENT_GATEWAY" as const, id: "TXN-88321", amount: "₹1,000.00", date: "17 Sep 2026", status: "SUCCESS", reference: "ORD-10482", fields: { amount: { value: "₹1,000.00", matched: true }, date: { value: "17 Sep 2026", matched: true }, reference: { value: "ORD-10482", matched: true } } },
    { source: "BANK" as const, id: "BNK-283821", amount: "₹1,000.00", date: "18 Sep 2026", status: "SETTLED", reference: "BNK-283821", fields: { amount: { value: "₹1,000.00", matched: true }, date: { value: "18 Sep 2026", matched: false }, reference: { value: "BNK-283821", matched: false } } },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Transaction ID</p>
          <code className="font-mono text-lg text-white">{transaction.id}</code>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide">External Reference</p>
          <code className="font-mono text-lg text-white">{transaction.externalId}</code>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Source</p>
          <p className="capitalize text-white">{transaction.source.toLowerCase().replace("_", " ")}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Amount</p>
          <p className="text-2xl font-semibold text-white tabular-nums">{formatCurrency(transaction.amount, transaction.currency)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Currency</p>
          <p className="text-white">{transaction.currency}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Date</p>
          <p className="text-white">{formatDate(transaction.date)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Match Status</p>
          <StatusBadge status={transaction.status} size="md" />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Reconciliation Run</p>
          <p className="text-white">{transaction.reconciliationRunId || "—"}</p>
        </div>
      </div>

      <div className="pt-6 border-t border-navy-600">
        <h3 className="text-lg font-semibold text-white mb-4">Related Records</h3>
        <div className="space-y-4">
          {relatedRecords.map((record) => (
            <Card key={record.id} variant="outlined" padding="md">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-400 uppercase tracking-wide">{record.source}</span>
                <StatusBadge status={record.status} size="sm" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Transaction ID</p>
                  <code className="font-mono text-sm text-white">{record.id}</code>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Amount</p>
                  <p className="font-mono text-white">{record.amount}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Date</p>
                  <p className="text-gray-300">{record.date}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Reference</p>
                  <code className="font-mono text-sm text-white">{record.reference}</code>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {transaction.matchReason && (
        <div className="pt-6 border-t border-navy-600">
          <h3 className="text-lg font-semibold text-white mb-4">Why this matched</h3>
          <p className="text-gray-300 bg-navy-800/50 p-4 rounded-xl border border-navy-600">{transaction.matchReason}</p>
        </div>
      )}
    </div>
  );
}