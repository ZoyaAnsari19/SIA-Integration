"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCircle, Info, AlertTriangle, X, ExternalLink } from "lucide-react";

export type NotificationType = "success" | "info" | "warning" | "error";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  linkText?: string;
  linkUrl?: string;
}

interface NotificationPopupProps {
  notifications: Notification[];
  viewAllLink?: string;
  position?: "left" | "right";
  maxHeight?: string;
}

export function NotificationPopup({
  notifications,
  viewAllLink = "/notifications",
  position = "right",
  maxHeight = "max-h-80",
}: NotificationPopupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popupRef.current && !popupRef.current.contains(target)) {
        setIsOpen(false);
      }
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case "success":
        return (
          <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        );
      case "info":
        return <Info className="h-4 w-4 text-[var(--brand-blue)]" />;
      case "warning":
        return (
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        );
      case "error":
        return (
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
        );
      default:
        return <Info className="h-4 w-4 text-[var(--text-muted)]" />;
    }
  };

  return (
    <div ref={popupRef} className="relative shrink-0">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((v) => !v);
        }}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--hover-bg)] hover:border-[var(--hover-border)] transition-colors"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="h-5 w-5 text-[var(--text-body)]" />
        {notifications.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {notifications.length > 99 ? "99+" : notifications.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          className={`absolute ${position === "right" ? "right-0" : "left-0"} mt-2 w-96 max-w-[90vw] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card-bg)] shadow-lg z-50 animate-in fade-in zoom-in-95 duration-200`}
        >
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between bg-[var(--hover-bg)]">
            <span className="text-sm font-semibold text-[var(--text-strong)]">
              Notifications
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors p-1"
              aria-label="Close notifications"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ul className={`${maxHeight} overflow-auto`}>
            {notifications.length === 0 ? (
              <li className="px-4 py-8 text-center">
                <Bell className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-2" />
                <p className="text-sm text-[var(--text-muted)]">
                  No new notifications
                </p>
              </li>
            ) : (
              notifications.map((n) => (
                <li
                  key={n.id}
                  className="px-4 py-3 hover:bg-[var(--hover-bg)] transition-colors border-b border-[var(--border)] last:border-b-0"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 shrink-0">{getIcon(n.type)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-sm font-medium text-[var(--text-strong)] truncate">
                          {n.title}
                        </p>
                        <span className="text-[11px] text-[var(--text-muted)] shrink-0 whitespace-nowrap">
                          {n.time}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-body)] line-clamp-2 mb-2">
                        {n.message}
                      </p>
                      {n.linkUrl && n.linkText && (
                        <a
                          href={n.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors shadow-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span>{n.linkText}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-[var(--border)] text-center bg-[var(--hover-bg)]">
              <Link
                href={viewAllLink}
                className="text-sm text-[var(--brand-blue)] hover:text-[var(--hover-text)] hover:underline font-medium transition-colors"
                onClick={() => setIsOpen(false)}
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
