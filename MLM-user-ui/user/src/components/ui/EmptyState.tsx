"use client";

import React from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "./Button";
import { Card } from "./Card";
import { H3, Text } from "./Heading";

type EmptyStateProps = {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  iconClassName?: string;
};

export function EmptyState({
  icon: Icon,
  title = "No data found",
  description = "There are no items to display at the moment.",
  actionLabel,
  onAction,
  className = "",
  iconClassName = "",
}: EmptyStateProps) {
  return (
    <Card className={`p-12 text-center ${className}`}>
      {Icon && (
        <Icon
          className={`h-16 w-16 text-[var(--text-muted)] mx-auto mb-4 ${iconClassName}`}
        />
      )}
      <H3 className="text-[var(--text-strong)] text-lg mb-2">{title}</H3>
      <Text className="text-[var(--text-body)] text-sm mb-4">
        {description}
      </Text>
      {actionLabel && onAction && (
        <Button variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Card>
  );
}

export default EmptyState;
