"use client";

import React from "react";

type TabsProps = {
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string }[];
  size?: "sm" | "md";
};

export function Tabs({ value, onChange, items, size = "md" }: TabsProps) {
  return (
    <div className="inline-flex gap-1 rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-1 font-medium whitespace-nowrap shrink-0">
      {items.map((t) => (
        <button
          key={t.value}
          className={[
            "rounded-lg transition-all duration-200",
            size === "sm" ? "px-2.5 py-1.5 text-sm" : "px-4 py-2 text-sm",
            value === t.value
              ? // --- Active Tab: Light Mode | Dark Mode ---
                "bg-white text-(--brand-blue) shadow-sm ring-1 ring-black/5 dark:bg-zinc-800 dark:text-(--brand-blue) dark:ring-white/10 font-semibold"
              : // --- Inactive Tab: Light Mode | Dark Mode ---
                "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200",
          ].join(" ")}
          onClick={() => onChange(t.value)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default Tabs;
