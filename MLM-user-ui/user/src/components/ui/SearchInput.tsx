"use client";

import React from "react";
import { X, Search as SearchIcon } from "lucide-react";

type SearchInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  onClear?: () => void;
  showClearButton?: boolean;
  containerClassName?: string;
};

export function SearchInput({
  value,
  onChange,
  onClear,
  showClearButton = true,
  placeholder = "Search...",
  className = "",
  containerClassName = "",
  ...props
}: SearchInputProps) {
  const hasValue = value && String(value).length > 0;

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else if (onChange) {
      const event = {
        target: { value: "" },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(event);
    }
  };

  return (
    <div
      className={`relative flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 min-h-[44px] shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all ${containerClassName}`}
    >
      <SearchIcon className="h-4 w-4 text-[var(--text-muted)] flex-shrink-0" />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`flex-1 bg-transparent outline-none text-[15px] text-[var(--text-strong)] placeholder:text-[var(--text-muted)] ${className}`}
        {...props}
      />
      {showClearButton && hasValue && (
        <button
          type="button"
          onClick={handleClear}
          className="text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default SearchInput;
