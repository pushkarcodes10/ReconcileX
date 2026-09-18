"use client";

import { forwardRef, ReactNode, useMemo } from "react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  minWidth?: string;
  maxWidth?: string;
  align?: "left" | "center" | "right";
  render?: (row: T, index: number) => ReactNode;
  sortable?: boolean;
  sticky?: boolean;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedRows?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  selectable?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  stickyHeader?: boolean;
  className?: string;
}

function TableHeader<T>({
  columns,
  sortColumn,
  sortDirection,
  onSort,
  selectable,
  allSelected,
  onSelectAll,
}: {
  columns: Column<T>[];
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (key: string) => void;
  selectable?: boolean;
  allSelected?: boolean;
  onSelectAll?: () => void;
}) {
  return (
    <thead className="bg-navy-800/50 border-b border-navy-600 sticky top-0 z-10">
      <tr>
        {selectable && (
          <th
            className="px-4 py-3 w-12"
            style={{ minWidth: "48px", maxWidth: "48px" }}
          >
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onSelectAll}
              className="w-4 h-4 rounded border-navy-500 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
              aria-label="Select all rows"
            />
          </th>
        )}
        {columns.map((column) => (
          <th
            key={column.key}
            className={cn(
              "px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider",
              "whitespace-nowrap",
              column.sortable && "cursor-pointer hover:text-white select-none",
              column.align === "center" && "text-center",
              column.align === "right" && "text-right",
              column.sticky && "sticky left-0 bg-navy-800/50 z-10"
            )}
            style={{
              width: column.width,
              minWidth: column.minWidth,
              maxWidth: column.maxWidth,
            }}
            onClick={() => column.sortable && onSort?.(column.key)}
          >
            <div className="flex items-center gap-1.5">
              {column.header}
              {column.sortable && sortColumn === column.key && (
                <span className="inline-flex">
                  {sortDirection === "asc" ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </span>
              )}
            </div>
          </th>
        ))}
      </tr>
    </thead>
  );
}

function TableBody<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  selectedRows,
  onSelectionChange,
  selectable,
  emptyMessage = "No data available",
}: {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedRows?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  selectable?: boolean;
  emptyMessage?: string;
}) {
  if (data.length === 0) {
    return (
      <tbody>
        <tr>
          <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-12 text-center text-gray-500">
            {emptyMessage}
          </td>
        </tr>
      </tbody>
    );
  }

  return (
    <tbody className="divide-y divide-navy-600/50">
      {data.map((row, rowIndex) => {
        const rowKey = keyExtractor(row);
        const isSelected = selectedRows?.has(rowKey);

        return (
          <tr
            key={rowKey}
            className={cn(
              "transition-colors duration-150",
              onRowClick && "cursor-pointer hover:bg-navy-700/50",
              isSelected && "bg-cyan-500/5"
            )}
            onClick={() => onRowClick?.(row)}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            {selectable && (
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    e.stopPropagation();
                    const newSelected = new Set(selectedRows);
                    if (e.target.checked) {
                      newSelected.add(rowKey);
                    } else {
                      newSelected.delete(rowKey);
                    }
                    onSelectionChange?.(newSelected);
                  }}
                  className="w-4 h-4 rounded border-navy-500 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                  aria-label={`Select row ${rowIndex + 1}`}
                />
              </td>
            )}
            {columns.map((column) => (
              <td
                key={column.key}
                className={cn(
                  "px-4 py-3 text-sm text-gray-200",
                  "whitespace-nowrap",
                  column.align === "center" && "text-center",
                  column.align === "right" && "text-right",
                  column.sticky && "sticky left-0 bg-navy-900/50 z-10"
                )}
                style={{
                  width: column.width,
                  minWidth: column.minWidth,
                  maxWidth: column.maxWidth,
                }}
              >
                {column.render ? column.render(row, rowIndex) : String((row as Record<string, unknown>)[column.key] ?? "")}
              </td>
            ))}
          </tr>
        );
      })}
    </tbody>
  );
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  selectedRows,
  onSelectionChange,
  selectable = false,
  loading = false,
  emptyMessage = "No data available",
  stickyHeader = true,
  className,
}: TableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | undefined>();
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const sortedData = useMemo(() => {
    if (!sortColumn) return data;
    return [...data].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortColumn];
      const bVal = (b as Record<string, unknown>)[sortColumn];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDirection === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [data, sortColumn, sortDirection]);

  const handleSort = (key: string) => {
    if (sortColumn === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(key);
      setSortDirection("asc");
    }
  };

  const allSelected = data.length > 0 && data.every((row) => selectedRows?.has(keyExtractor(row)));
  const handleSelectAll = () => {
    if (allSelected) {
      onSelectionChange?.(new Set());
    } else {
      onSelectionChange?.(new Set(data.map(keyExtractor)));
    }
  };

  return (
    <div className={cn("overflow-hidden rounded-xl border border-navy-600 bg-navy-800", className)}>
      {loading && (
        <div className="absolute inset-0 bg-navy-800/80 flex items-center justify-center z-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-cyan-500 border-t-transparent" />
        </div>
      )}
      <table className="w-full text-sm" role="grid">
        <TableHeader
          columns={columns}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
          selectable={selectable}
          allSelected={allSelected}
          onSelectAll={handleSelectAll}
        />
        <TableBody
          columns={columns}
          data={sortedData}
          keyExtractor={keyExtractor}
          onRowClick={onRowClick}
          selectedRows={selectedRows}
          onSelectionChange={onSelectionChange}
          selectable={selectable}
          emptyMessage={emptyMessage}
        />
      </table>
    </div>
  );
}

import { useState } from "react";