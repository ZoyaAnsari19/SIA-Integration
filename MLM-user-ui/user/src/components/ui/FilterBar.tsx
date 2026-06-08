"use client";

import React from "react";
import { X } from "lucide-react";
import { SearchInput } from "./SearchInput";
import { Button } from "./Button";

type FilterOption = {
  value: string;
  label: string;
};

type FilterBarProps = {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: Array<{
    key: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: FilterOption[];
  }>;
  onClear?: () => void;
  showClearButton?: boolean;
  className?: string;
};

export function FilterBar({
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Search...",
  filters = [],
  onClear,
  showClearButton = true,
  className = "",
}: FilterBarProps) {
  const hasActiveFilters = searchValue || filters.some((f) => f.value);

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else {
      if (onSearchChange) onSearchChange("");
      filters.forEach((f) => f.onChange(""));
    }
  };

  return (
    <div
      className={`flex flex-col md:flex-row md:items-end gap-3 md:gap-4 ${className}`}
    >
      {onSearchChange && (
        <div className="flex-1 min-w-[200px]">
          <SearchInput
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            onClear={() => onSearchChange("")}
          />
        </div>
      )}

      {filters.map((filter) => (
        <div key={filter.key} className="min-w-[200px]">
          <label className="block text-sm font-medium text-[var(--text-body)] mb-1.5">
            {filter.label}
          </label>
          <select
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--card-bg)] text-[var(--text-strong)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all min-h-[44px]"
          >
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      {showClearButton && hasActiveFilters && (
        <div className="flex items-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="min-h-[44px]"
          >
            <X className="h-4 w-4 mr-1.5" />
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}

export default FilterBar;
