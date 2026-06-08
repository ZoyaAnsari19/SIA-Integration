"use client";

import React from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { TH } from "./Table";

type SortableTableHeaderProps = {
  columnKey: string;
  label: string;
  sortConfig: { key: string; direction: "asc" | "desc" } | null;
  onSort: (key: string) => void;
  className?: string;
};

export function SortableTableHeader({
  columnKey,
  label,
  sortConfig,
  onSort,
  className = "",
}: SortableTableHeaderProps) {
  const isActive = sortConfig?.key === columnKey;
  const direction = isActive ? sortConfig.direction : null;

  return (
    <TH
      className={`group cursor-pointer select-none hover:bg-[var(--sidebar-hover)] transition-colors duration-200 ${className}`}
      onClick={() => onSort(columnKey)}
    >
      <div className="flex items-center gap-2">
        {label}
        <div className="relative w-4 h-4">
          <ChevronUp
            className={`absolute w-4 h-4 transition-opacity ${
              isActive && direction === "asc"
                ? "text-blue-600 opacity-100"
                : "text-[var(--text-muted)] opacity-0 group-hover:opacity-100"
            }`}
          />
          <ChevronDown
            className={`absolute w-4 h-4 transition-opacity ${
              isActive && direction === "desc"
                ? "text-blue-600 opacity-100"
                : "text-[var(--text-muted)] opacity-0 group-hover:opacity-100"
            }`}
          />
        </div>
      </div>
    </TH>
  );
}

export default SortableTableHeader;
