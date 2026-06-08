"use client";

import React from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  helperText?: string;
};

export function Input({
  label,
  error,
  helperText,
  className = "",
  ...props
}: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-[var(--text-body)]">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        className={`w-full px-4 py-2.5 border rounded-lg transition-colors bg-[var(--card-bg)] text-[var(--text-strong)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
          error
            ? "border-red-300 focus:ring-red-500"
            : "border-[var(--border)] hover:border-[var(--hover-border)]"
        } ${className}`}
        {...props}
      />
      {error && <span className="text-sm text-red-600">{error}</span>}
      {helperText && !error && (
        <span className="text-sm text-[var(--text-muted)]">{helperText}</span>
      )}
    </div>
  );
}
