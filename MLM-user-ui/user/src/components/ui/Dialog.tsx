"use client";

import React, { useEffect } from "react";
import { Card } from "./Card";
import { X } from "lucide-react";

type DialogProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
};

export function Dialog({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
}: DialogProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <Card
        className={`${sizeClasses[size]} w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-200`}
        onClick={(e) => e.stopPropagation()}
        padding="lg"
      >
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--border)]">
          <h2 className="text-xl font-semibold text-[var(--text-strong)]">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--sidebar-hover)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-strong)]"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </Card>
    </div>
  );
}
