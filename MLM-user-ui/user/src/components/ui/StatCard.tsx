"use client";

import React from "react";
import { LucideIcon } from "lucide-react";
import { Card } from "./Card";

type StatCardProps = {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  trend?: string;
  trendUp?: boolean;
  className?: string;
  onClick?: () => void;
};

export function StatCard({
  label,
  value,
  icon: Icon,
  iconColor = "text-blue-600",
  iconBgColor = "bg-blue-100",
  trend,
  trendUp,
  className = "",
  onClick,
}: StatCardProps) {
  return (
    <Card
      className={`p-5 hover:shadow-md transition-shadow ${onClick ? "cursor-pointer" : ""} ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[var(--text-muted)] mb-1">{label}</p>
          <h3 className="text-2xl font-bold text-[var(--text-strong)]">
            {value}
          </h3>
          {trend && (
            <div
              className={`flex items-center gap-1 mt-1.5 text-xs font-semibold ${
                trendUp ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {trend}
            </div>
          )}
        </div>
        {Icon && (
          <div className={`p-3 ${iconBgColor} rounded-lg`}>
            <Icon className={`h-6 w-6 ${iconColor}`} />
          </div>
        )}
      </div>
    </Card>
  );
}

export default StatCard;
