import React from "react";
import { Card } from "./Card";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { LucideIcon } from "lucide-react";

type EnhancedStatCardProps = {
  label: string;
  value: React.ReactNode;
  accent?: "blue" | "green" | "amber" | "red" | "zinc";
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean | null;
  className?: string;
  onClick?: () => void;
};

const accentMap: Record<
  NonNullable<EnhancedStatCardProps["accent"]>,
  { text: string; bg: string }
> = {
  blue: {
    text: "text-[var(--accent-blue-text)]",
    bg: "bg-[var(--accent-blue-bg)]",
  },
  green: {
    text: "text-[var(--accent-green-text)]",
    bg: "bg-[var(--accent-green-bg)]",
  },
  amber: {
    text: "text-[var(--accent-amber-text)]",
    bg: "bg-[var(--accent-amber-bg)]",
  },
  red: {
    text: "text-[var(--accent-red-text)]",
    bg: "bg-[var(--accent-red-bg)]",
  },
  zinc: { text: "text-[var(--brand-blue)]", bg: "bg-[var(--accent-blue-bg)]" }, // Use brand blue for neutral too
};

export function EnhancedStatCard({
  label,
  value,
  accent = "zinc",
  icon: Icon,
  trend,
  trendUp = null,
  className = "",
  onClick,
}: EnhancedStatCardProps) {
  const accentStyles = accentMap[accent];

  return (
    <Card
      className={`flex min-h-[120px] flex-col justify-between p-5 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group ${
        onClick ? "cursor-pointer" : ""
      } ${className}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-lg ${accentStyles.bg} ${accentStyles.text} group-hover:scale-110 transition-transform duration-300`}
          >
            <Icon className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-[var(--text-body)] leading-tight transition-colors duration-200">
            {label}
          </p>
        </div>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <span
            className={`text-[28px] font-extrabold leading-none ${accentStyles.text}`}
          >
            {value}
          </span>
          {trend && trendUp !== null && (
            <div
              className={`flex items-center gap-1 mt-1.5 text-xs font-semibold ${
                trendUp ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {trendUp ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              <span>{trend}</span>
            </div>
          )}
        </div>
        {onClick && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <ArrowRight className="w-5 h-5 text-[var(--text-muted)] transition-colors duration-200" />
          </div>
        )}
      </div>
    </Card>
  );
}

export default EnhancedStatCard;
