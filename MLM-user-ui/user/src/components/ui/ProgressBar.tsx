import React from "react";

type ProgressBarProps = {
  value: number; // 0-100
  max?: number; // Optional max value for custom calculations
  label?: string;
  showLabel?: boolean;
  showValue?: boolean;
  size?: "sm" | "md" | "lg";
  color?: "blue" | "green" | "emerald" | "purple" | "amber" | "red";
  variant?: "default" | "gradient";
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
  // For custom display (e.g., "₹5,000 / ₹10,000")
  customValue?: React.ReactNode;
  customLabel?: React.ReactNode;
};

const sizeMap = {
  sm: "h-1.5",
  md: "h-2",
  lg: "h-2.5",
};

const colorMap = {
  blue: "bg-blue-600 dark:bg-blue-500",
  green: "bg-green-600 dark:bg-green-500",
  emerald: "bg-emerald-500 dark:bg-emerald-400",
  purple: "bg-purple-600 dark:bg-purple-500",
  amber: "bg-amber-500 dark:bg-amber-400",
  red: "bg-red-600 dark:bg-red-500",
};

const gradientMap = {
  blue: "bg-gradient-to-r from-blue-500 to-blue-600",
  green: "bg-gradient-to-r from-green-500 to-green-600",
  emerald: "bg-gradient-to-r from-emerald-500 to-emerald-600",
  purple: "bg-gradient-to-r from-purple-500 to-purple-600",
  amber: "bg-gradient-to-r from-amber-500 to-amber-600",
  red: "bg-gradient-to-r from-red-500 to-red-600",
};

export function ProgressBar({
  value,
  max = 100,
  label,
  showLabel = true,
  showValue = true,
  size = "md",
  color = "blue",
  variant = "default",
  className = "",
  labelClassName = "",
  valueClassName = "",
  customValue,
  customLabel,
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const colorClass =
    variant === "gradient" ? gradientMap[color] : colorMap[color];

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {(showLabel || label) && (
        <div className="flex items-center justify-between text-xs">
          <span className={labelClassName || `text-[var(--text-muted)]`}>
            {customLabel || label || "Progress"}
          </span>
          {showValue && (
            <span
              className={valueClassName || `font-semibold ${colorMap[color]}`}
            >
              {customValue || `${percentage.toFixed(1)}%`}
            </span>
          )}
        </div>
      )}
      <div
        className={`w-full bg-[var(--hover-bg)] rounded-full overflow-hidden transition-colors duration-200 ${sizeMap[size]}`}
      >
        <div
          className={`${colorClass} rounded-full transition-all duration-500 ${sizeMap[size]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
