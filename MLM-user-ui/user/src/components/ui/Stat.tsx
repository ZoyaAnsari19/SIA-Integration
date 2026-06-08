import React from "react";
import { Card } from "./Card";

type StatProps = {
  label: string;
  value: React.ReactNode;
  accent?: "blue" | "green" | "amber" | "red" | "zinc";
  right?: React.ReactNode;
  className?: string;
};

const accentMap: Record<NonNullable<StatProps["accent"]>, string> = {
  blue: "text-[var(--accent-blue-text)]",
  green: "text-[var(--accent-green-text)]",
  amber: "text-[var(--accent-amber-text)]",
  red: "text-[var(--accent-red-text)]",
  zinc: "text-[var(--text-strong)]",
};

export function StatCard({
  label,
  value,
  accent = "zinc",
  right,
  className = "",
}: StatProps) {
  return (
    <Card
      className={[
        "flex min-h-[100px] flex-col justify-between",
        className,
      ].join(" ")}
    >
      <p className="mb-1 text-sm font-medium text-zinc-600">{label}</p>
      <div className="flex items-center justify-between">
        <span
          className={[
            "text-[28px] font-extrabold leading-none",
            accentMap[accent],
          ].join(" ")}
        >
          {value}
        </span>
        {right}
      </div>
    </Card>
  );
}

export default StatCard;
