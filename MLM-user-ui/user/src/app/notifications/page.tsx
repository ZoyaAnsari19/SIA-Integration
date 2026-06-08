"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { H1 } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import {
  CheckCircle,
  Info,
  AlertTriangle,
  Bell,
  Filter,
  X,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import {
  Notification,
  NotificationType,
} from "@/components/ui/me/NotificationPopup";
import { getDashboardNotices, type NoticeItem } from "@/lib/api/dashboard";

// Extended notification type with actual date for filtering
interface NotificationWithDate extends Notification {
  actualDate: Date;
}

type TimeFilter = "all" | "today" | "week" | "month" | "older";
type TypeFilter = "all" | NotificationType;
type MessageType = "renew" | "welcome" | "info" | "warning";

interface DashboardMessage {
  id: string;
  type: MessageType;
  title: string;
  message: string;
  linkText?: string;
  linkUrl?: string;
  actualDate: Date;
}

export default function NotificationsPage() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch notifications from API
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        const noticesData = await getDashboardNotices();
        setNotices(noticesData.items || []);
      } catch (err) {
        console.error("Error fetching notifications:", err);
        setNotices([]);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  // Convert API notices to DashboardMessage format (same as dashboard)
  const messages: DashboardMessage[] = useMemo(() => {
    return notices.map((notice) => {
      // Use link field directly from API (not from markdown parsing)
      const linkUrl = notice.link || undefined;
      const linkText = linkUrl ? "Click here" : undefined;
      const messageText = notice.content || '';
      
      // Determine message type based on title or content keywords
      let type: MessageType = "info";
      const titleLower = notice.title.toLowerCase();
      const contentLower = messageText.toLowerCase();
      
      if (titleLower.includes("renew") || contentLower.includes("renew")) {
        type = "renew";
      } else if (titleLower.includes("welcome") || contentLower.includes("welcome")) {
        type = "welcome";
      } else if (titleLower.includes("warning") || contentLower.includes("warning")) {
        type = "warning";
      }

      const noticeDate = new Date(notice.created_at);
      
      return {
        id: `notice-${notice.id}`,
        type,
        title: notice.title,
        message: messageText,
        linkText,
        linkUrl,
        actualDate: noticeDate,
      };
    });
  }, [notices]);

  const getMessageStyles = (type: MessageType) => {
    switch (type) {
      case "renew":
        return {
          bg: "bg-[var(--accent-red-bg)] border-red-500/30",
          text: "text-[var(--accent-red-text)]",
          link: "text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300",
          icon: AlertCircle,
          iconColor: "text-red-600 dark:text-red-400",
        };
      case "welcome":
        return {
          bg: "bg-[var(--accent-green-bg)] border-emerald-500/30",
          text: "text-[var(--accent-green-text)]",
          link: "text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300",
          icon: CheckCircle,
          iconColor: "text-emerald-600 dark:text-emerald-400",
        };
      case "info":
        return {
          bg: "bg-[var(--accent-blue-bg)] border-blue-500/30",
          text: "text-[var(--accent-blue-text)]",
          link: "text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300",
          icon: Bell,
          iconColor: "text-blue-600 dark:text-blue-400",
        };
      case "warning":
        return {
          bg: "bg-[var(--accent-amber-bg)] border-amber-500/30",
          text: "text-[var(--accent-amber-text)]",
          link: "text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300",
          icon: AlertCircle,
          iconColor: "text-amber-600 dark:text-amber-400",
        };
    }
  };

  const matchesTimeFilter = (message: DashboardMessage): boolean => {
    if (timeFilter === "all") return true;

    const messageDate = message.actualDate;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    switch (timeFilter) {
      case "today":
        return messageDate >= today;
      case "week":
        return messageDate >= weekAgo;
      case "month":
        return messageDate >= monthAgo;
      case "older":
        return messageDate < monthAgo;
      default:
        return true;
    }
  };

  const filteredMessages = useMemo(() => {
    return messages.filter((message) => {
      // Map MessageType to NotificationType for filtering
      let notificationType: NotificationType = "info";
      if (message.type === "welcome") notificationType = "success";
      else if (message.type === "warning" || message.type === "renew") notificationType = "warning";
      else if (message.type === "info") notificationType = "info";
      
      const typeMatch = typeFilter === "all" || notificationType === typeFilter;
      const timeMatch = matchesTimeFilter(message);
      return typeMatch && timeMatch;
    });
  }, [messages, typeFilter, timeFilter]);

  const getTypeLabel = (type: TypeFilter) => {
    switch (type) {
      case "all":
        return "All Types";
      case "success":
        return "Success";
      case "info":
        return "Info";
      case "warning":
        return "Warning";
      case "error":
        return "Error";
      default:
        return type;
    }
  };

  const getTimeLabel = (time: TimeFilter) => {
    switch (time) {
      case "all":
        return "All Time";
      case "today":
        return "Today";
      case "week":
        return "This Week";
      case "month":
        return "This Month";
      case "older":
        return "Older";
      default:
        return time;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <H1>Notifications</H1>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--hover-bg)] transition-colors text-sm font-medium text-[var(--text-strong)]"
        >
          <Filter className="h-4 w-4" />
          Filters
          {(typeFilter !== "all" || timeFilter !== "all") && (
            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-600 text-white text-xs font-bold">
              {
                [typeFilter !== "all", timeFilter !== "all"].filter(Boolean)
                  .length
              }
            </span>
          )}
        </button>
      </div>

      {showFilters && (
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text-strong)]">
                Filter Notifications
              </h3>
              <button
                onClick={() => setShowFilters(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors"
                aria-label="Close filters"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-body)] mb-2">
                  Type
                </label>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      "all",
                      "success",
                      "info",
                      "warning",
                      "error",
                    ] as TypeFilter[]
                  ).map((type) => (
                    <button
                      key={type}
                      onClick={() => setTypeFilter(type)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        typeFilter === type
                          ? "bg-blue-600 text-white"
                          : "bg-[var(--hover-bg)] text-[var(--text-body)] hover:bg-[var(--hover-bg)]"
                      }`}
                    >
                      {getTypeLabel(type)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-body)] mb-2">
                  Time Period
                </label>
                <div className="flex flex-wrap gap-2">
                  {(
                    ["all", "today", "week", "month", "older"] as TimeFilter[]
                  ).map((time) => (
                    <button
                      key={time}
                      onClick={() => setTimeFilter(time)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        timeFilter === time
                          ? "bg-blue-600 text-white"
                          : "bg-[var(--hover-bg)] text-[var(--text-body)] hover:bg-[var(--hover-bg)]"
                      }`}
                    >
                      {getTimeLabel(time)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {(typeFilter !== "all" || timeFilter !== "all") && (
              <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  onClick={() => {
                    setTypeFilter("all");
                    setTimeFilter("all");
                  }}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline font-medium transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        </Card>
      )}

      {loading ? (
        <Card className="p-0 overflow-hidden">
          <div className="px-6 py-12 text-center">
            <Bell className="h-16 w-16 text-[var(--text-muted)] mx-auto mb-4 animate-pulse" />
            <h3 className="text-lg font-semibold text-[var(--text-strong)] mb-2">
              Loading notifications...
            </h3>
          </div>
        </Card>
      ) : filteredMessages.length === 0 ? (
        <Card className="p-0 overflow-hidden">
          <div className="px-6 py-12 text-center">
            <Bell className="h-16 w-16 text-[var(--text-muted)] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[var(--text-strong)] mb-2">
              No notifications found
            </h3>
            <p className="text-sm text-[var(--text-muted)]">
              {typeFilter !== "all" || timeFilter !== "all"
                ? "Try adjusting your filters to see more notifications."
                : "You don't have any notifications yet."}
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {filteredMessages.map((msg) => {
              const styles = getMessageStyles(msg.type);
              const Icon = styles.icon;
              const messageDate = msg.actualDate;
              const now = new Date();
              const diffMs = now.getTime() - messageDate.getTime();
              const diffMins = Math.floor(diffMs / 60000);
              const diffHours = Math.floor(diffMs / 3600000);
              const diffDays = Math.floor(diffMs / 86400000);

              let timeAgo = "";
              if (diffMins < 1) {
                timeAgo = "Just now";
              } else if (diffMins < 60) {
                timeAgo = `${diffMins}m ago`;
              } else if (diffHours < 24) {
                timeAgo = `${diffHours}h ago`;
              } else if (diffDays === 1) {
                timeAgo = "Yesterday";
              } else if (diffDays < 7) {
                timeAgo = `${diffDays} days ago`;
              } else {
                timeAgo = messageDate.toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                });
              }

              return (
                <Card
                  key={msg.id}
                  className={`${styles.bg} border-l-4 ${styles.text} p-4 relative`}
                >
                  <div className="flex items-start gap-3 pr-8">
                    <Icon
                      className={`h-5 w-5 ${styles.iconColor} mt-0.5 shrink-0`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="font-bold text-sm">{msg.title}</h4>
                        <span className="text-xs text-[var(--text-muted)] shrink-0 whitespace-nowrap">
                          {timeAgo}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed mb-2">
                        {msg.message}
                      </p>
                      {msg.linkUrl && (
                        <a
                          href={msg.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors shadow-sm"
                        >
                          <span>Click here</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {filteredMessages.length > 0 && (
            <div className="text-center text-sm text-[var(--text-muted)]">
              Showing {filteredMessages.length} of {messages.length}{" "}
              notifications
            </div>
          )}
        </>
      )}
    </div>
  );
}
