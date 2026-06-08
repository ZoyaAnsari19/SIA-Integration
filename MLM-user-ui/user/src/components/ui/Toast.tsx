"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle, XCircle, Info, AlertTriangle, X } from "lucide-react";
import { Card } from "./Card";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose?: () => void;
}

export function Toast({
  message,
  type = "info",
  duration = 5000,
  onClose,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose?.(), 300); // Wait for animation
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose?.(), 300);
  };

  const getIcon = () => {
    const iconClass = "h-5 w-5 shrink-0";
    switch (type) {
      case "success":
        return <CheckCircle className={`${iconClass} text-emerald-600`} />;
      case "error":
        return <XCircle className={`${iconClass} text-red-600`} />;
      case "warning":
        return <AlertTriangle className={`${iconClass} text-amber-600`} />;
      default:
        return <Info className={`${iconClass} text-blue-600`} />;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case "success":
        return "bg-emerald-50 border-emerald-200";
      case "error":
        return "bg-red-50 border-red-200";
      case "warning":
        return "bg-amber-50 border-amber-200";
      default:
        return "bg-blue-50 border-blue-200";
    }
  };

  const getTextColor = () => {
    switch (type) {
      case "success":
        return "text-emerald-900";
      case "error":
        return "text-red-900";
      case "warning":
        return "text-amber-900";
      default:
        return "text-blue-900";
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-50 animate-in slide-in-from-top-5 fade-in duration-300`}
      role="alert"
      aria-live="polite"
    >
      <Card className={`${getBgColor()} shadow-lg border-l-4 min-w-[300px] max-w-[400px]`}>
        <div className="flex items-start gap-3 p-4">
          {getIcon()}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${getTextColor()}`}>
              {message}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors shrink-0"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </Card>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<ToastProps | null>(null);

  const showToast = (
    message: string,
    type: ToastType = "info",
    duration: number = 5000,
  ) => {
    setToast({ message, type, duration });
  };

  const ToastComponent = toast ? (
    <Toast
      {...toast}
      onClose={() => setToast(null)}
    />
  ) : null;

  return { showToast, ToastComponent };
}

