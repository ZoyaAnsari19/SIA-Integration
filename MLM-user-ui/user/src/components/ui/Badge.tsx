import React from "react";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "blue" | "green" | "amber" | "red" | "purple";
  soft?: boolean;
  size?: "sm" | "md";
  rounded?: "md" | "lg" | "full";
};

export function Badge({
  className = "",
  tone = "neutral",
  soft = true,
  size = "md",
  rounded = "lg",
  ...props
}: BadgeProps) {
  const map: Record<string, { bg: string; text: string; ring?: string }> = {
    neutral: {
      bg: soft ? "bg-[var(--sidebar-hover)]" : "bg-[var(--hover-bg)]",
      text: "text-[var(--text-body)]",
    },
    blue: {
      bg: soft ? "bg-[var(--accent-blue-bg)]" : "bg-[var(--brand-blue)]",
      text: soft ? "text-[var(--accent-blue-text)]" : "text-white",
    },
    green: {
      bg: soft ? "bg-[var(--accent-green-bg)]" : "bg-emerald-600",
      text: soft ? "text-[var(--accent-green-text)]" : "text-white",
    },
    amber: {
      bg: soft ? "bg-[var(--accent-amber-bg)]" : "bg-amber-400",
      text: soft ? "text-[var(--accent-amber-text)]" : "text-zinc-900",
    },
    red: {
      bg: soft ? "bg-[var(--accent-red-bg)]" : "bg-red-600",
      text: soft ? "text-[var(--accent-red-text)]" : "text-white",
    },
    purple: {
      bg: soft ? "bg-purple-50 dark:bg-purple-900/30" : "bg-purple-600",
      text: soft ? "text-purple-600 dark:text-purple-300" : "text-white",
    },
  };
  const sizeMap = {
    sm: "text-xs px-2 py-0.5",
    md: "text-[13px] px-3 py-1",
  } as const;
  const roundedMap = {
    md: "rounded-md",
    lg: "rounded-lg",
    full: "rounded-full",
  } as const;

  const toneCls = map[tone];
  return (
    <span
      className={[
        "inline-flex items-center font-semibold transition-colors duration-200",
        sizeMap[size],
        roundedMap[rounded],
        toneCls.bg,
        toneCls.text,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}

export default Badge;
