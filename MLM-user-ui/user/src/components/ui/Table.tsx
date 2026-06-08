import React from "react";

export function Table({
  className = "",
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={["w-full border-collapse", className].join(" ")}
      {...props}
    />
  );
}

export function THead({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={[
        "bg-[var(--sidebar-hover)] text-[var(--text-body)] transition-colors duration-200",
        className,
      ].join(" ")}
      {...props}
    />
  );
}

export function TH({
  className = "",
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={[
        "whitespace-nowrap px-3 md:px-5 py-2 md:py-3 text-left text-[13px] md:text-[14px] font-semibold border-b border-[var(--border)] transition-colors duration-200",
        className,
      ].join(" ")}
      {...props}
    />
  );
}

export function TR({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={[
        "hover:bg-[var(--sidebar-hover)] transition-colors duration-200",
        className,
      ].join(" ")}
      {...props}
    />
  );
}

export function TD({
  className = "",
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={[
        "px-3 md:px-5 py-2 md:py-3 text-[13px] md:text-[15px]",
        className,
      ].join(" ")}
      {...props}
    />
  );
}

export default { Table, THead, TH, TR, TD };
