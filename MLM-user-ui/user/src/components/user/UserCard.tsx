"use client";

import React from "react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { H3, Text } from "@/components/ui/Heading";
import { MoreVertical } from "lucide-react";

type UserCardProps = {
  id: string;
  name: string;
  avatar?: string;
  rank?: number;
  badges?: string[];
  status?: "Active" | "Inactive" | "Pending";
  package?: string;
  level?: string;
  streak?: number;
  earning?: number;
  onClick?: () => void;
  onMenuClick?: () => void;
  showMenu?: boolean;
  className?: string;
};

export function UserCard({
  id,
  name,
  avatar,
  rank,
  badges = [],
  status,
  package: pkg,
  level,
  streak,
  earning,
  onClick,
  onMenuClick,
  showMenu = false,
  className = "",
}: UserCardProps) {
  const statusBadge = () => {
    if (!status) return null;
    if (status === "Active")
      return (
        <Badge tone="green" soft className="status">
          Active
        </Badge>
      );
    if (status === "Inactive")
      return (
        <Badge tone="red" soft className="status">
          Inactive
        </Badge>
      );
    return (
      <Badge tone="amber" soft className="status">
        Pending
      </Badge>
    );
  };

  const pkgBadge = () => {
    if (!pkg) return null;
    return <Badge tone="blue">{pkg}</Badge>;
  };

  return (
    <Card
      className={`p-5 relative hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group ${onClick ? "cursor-pointer" : ""} ${className}`}
      onClick={onClick}
    >
      {showMenu && (
        <button
          className="absolute right-3 top-3 text-[var(--text-muted)] hover:text-[var(--hover-text)] rounded-full hover:bg-[var(--hover-bg)] transition-all z-10 min-w-[44px] min-h-[44px] flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            if (onMenuClick) onMenuClick();
          }}
          aria-label="Row actions"
        >
          <MoreVertical className="h-5 w-5" />
        </button>
      )}

      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <H3 className="truncate text-[18px]">{name}</H3>
          <span className="mt-1 inline-block text-[14px] font-semibold text-[var(--brand-blue)] truncate">
            {id}
          </span>
        </div>
        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
          {statusBadge()}
          {pkgBadge()}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-3">
        {avatar && <Avatar src={avatar} alt={name} size={50} ring />}
        <div className="flex-1 min-w-0">
          {rank && (
            <Text className="text-xs text-[var(--text-muted)]">
              Rank: #{rank}
            </Text>
          )}
          {level && (
            <Text className="text-xs text-[var(--text-body)]">
              Level: {level}
            </Text>
          )}
          {streak !== undefined && (
            <Text className="text-xs text-emerald-600">
              Streak: {streak} days
            </Text>
          )}
        </div>
      </div>

      {badges.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {badges.map((badge, index) => (
            <Badge key={index} tone="blue" className="text-[12px]">
              {badge}
            </Badge>
          ))}
        </div>
      )}

      {earning !== undefined && (
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <Text className="text-sm font-semibold text-emerald-600">
            Earnings: ₹{earning.toLocaleString("en-IN")}
          </Text>
        </div>
      )}
    </Card>
  );
}

export default UserCard;
