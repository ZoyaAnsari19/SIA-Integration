"use client";

import { useMemo, useState } from "react";
import { H1, H3, Text } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EnhancedStatCard } from "@/components/ui/EnhancedStatCard";
import { Dialog } from "@/components/ui/Dialog";
import {
  Megaphone,
  AlertTriangle,
  Info,
  Search,
  X,
  Calendar,
  User,
  Bell,
  BellOff,
  SortAsc,
  SortDesc,
} from "lucide-react";

type NoticeType = "urgent" | "announcement" | "info";
type SortOrder = "newest" | "oldest";

interface NoticeItem {
  id: string;
  title: string;
  body: string;
  date: string; // human date
  author: string;
  type: NoticeType;
  isNew?: boolean;
}

const NOTICES: NoticeItem[] = [
  {
    id: "n1",
    title: "URGENT: Server Maintenance Alert",
    body: "Dear Members, please note that our main server will undergo maintenance from 11 PM IST to 2 AM IST tonight. During this time, the platform may experience intermittent downtime. We apologize for any inconvenience caused and appreciate your patience during this maintenance window.",
    date: "November 5, 2025",
    author: "Admin",
    type: "urgent",
    isNew: true,
  },
  {
    id: "n2",
    title: "New Course Materials Uploaded!",
    body: "We are excited to announce the launch of new learning modules for the 'Advanced Credit' package. Please check the 'View Course' section to access the updated curriculum and videos. These new materials include advanced strategies, case studies, and interactive exercises to enhance your learning experience.",
    date: "October 28, 2025",
    author: "John Doe",
    type: "announcement",
  },
  {
    id: "n3",
    title: "UPI Deposit Account Change Notification",
    body: "Kindly note that our UPI ID has been updated for security reasons. Please use the new ID displayed on the 'Pay Manual' page for all future deposits. Transactions sent to the old ID may be delayed. If you have any questions, please contact our support team immediately.",
    date: "September 10, 2025",
    author: "Admin",
    type: "info",
  },
  {
    id: "n4",
    title: "Monthly Performance Review Available",
    body: "Your monthly performance report for October is now available in your dashboard. Review your progress, earnings, and team statistics. Keep up the excellent work!",
    date: "November 1, 2025",
    author: "System",
    type: "announcement",
    isNew: true,
  },
  {
    id: "n5",
    title: "Holiday Schedule Update",
    body: "Please be informed that our office will be closed on November 15th for a public holiday. All transactions and support requests will be processed on the next working day.",
    date: "October 20, 2025",
    author: "Admin",
    type: "info",
  },
];

export default function Notice() {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<NoticeType | "all">("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [selectedNotice, setSelectedNotice] = useState<NoticeItem | null>(null);
  const [readNotices, setReadNotices] = useState<Set<string>>(new Set());

  // Calculate statistics
  const stats = useMemo(() => {
    const total = NOTICES.length;
    const urgent = NOTICES.filter((n) => n.type === "urgent").length;
    const unread = NOTICES.filter((n) => !readNotices.has(n.id)).length;
    const newNotices = NOTICES.filter((n) => n.isNew).length;
    return { total, urgent, unread, newNotices };
  }, [readNotices]);

  const filtered = useMemo(() => {
    let filtered = NOTICES.filter((n) => {
      const matchesType = typeFilter === "all" || n.type === typeFilter;
      const q = query.toLowerCase();
      const matchesSearch = [n.title, n.body, n.author].some((t) =>
        t.toLowerCase().includes(q),
      );
      return matchesType && matchesSearch;
    });

    // Sort by date
    filtered.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  }, [query, typeFilter, sortOrder]);

  const markAsRead = (id: string) => {
    setReadNotices((prev) => new Set([...prev, id]));
  };

  const getLeftBorder = (t: NoticeType) =>
    t === "urgent"
      ? "border-l-red-500"
      : t === "announcement"
        ? "border-l-blue-600 dark:border-l-blue-400"
        : "border-l-[var(--border)]";

  const getIcon = (t: NoticeType) => {
    switch (t) {
      case "urgent":
        return (
          <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400" />
        );
      case "announcement":
        return (
          <Megaphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        );
      default:
        return <Info className="h-5 w-5 text-(--text-muted)" />;
    }
  };

  const hasActiveFilters = query || typeFilter !== "all";

  return (
    <div className="max-w-[1200px] mx-auto p-4 md:p-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="mb-6">
        <H1>Notice Board</H1>
        <Text className="text-(--text-muted) mt-2">
          Important updates and announcements from the Secure Investment Academy
          admin team.
        </Text>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:gap-5 mb-7 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <EnhancedStatCard
          label="Total Notices"
          value={stats.total}
          accent="blue"
          icon={Bell}
        />
        <EnhancedStatCard
          label="Urgent Notices"
          value={stats.urgent}
          accent="red"
          icon={AlertTriangle}
        />
        <EnhancedStatCard
          label="Unread"
          value={stats.unread}
          accent="amber"
          icon={BellOff}
        />
        <EnhancedStatCard
          label="New This Week"
          value={stats.newNotices}
          accent="green"
          icon={Megaphone}
        />
      </div>

      {/* Filters */}
      <Card className="mb-6 p-4">
        <div className="flex flex-col md:flex-row gap-3 items-center">
          {/* Search */}
          <div className="flex items-center gap-2 flex-1 rounded-lg border border-(--border) bg-(--card-bg) px-3 py-2 min-h-[44px] shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
            <Search className="h-4 w-4 text-(--text-muted) shrink-0" />
            <input
              type="text"
              className="w-full bg-transparent outline-none text-sm md:text-[15px] text-(--text-strong) placeholder:text-(--text-muted)"
              placeholder="Search notices by title, content, or author..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="text-(--text-muted) hover:text-(--text-strong) transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <div className="flex gap-2 flex-wrap">
            {[
              { value: "all", label: "All" },
              { value: "urgent", label: "Urgent" },
              { value: "announcement", label: "Announcement" },
              { value: "info", label: "Info" },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setTypeFilter(filter.value as any)}
                className={[
                  "px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-semibold transition-colors whitespace-nowrap min-h-[44px]",
                  typeFilter === filter.value
                    ? "bg-blue-600 text-white border border-blue-600"
                    : "bg-(--card-bg) text-(--text-muted) border border-(--border) hover:bg-(--hover-bg)",
                ].join(" ")}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <button
            onClick={() =>
              setSortOrder((prev) => (prev === "newest" ? "oldest" : "newest"))
            }
            className="px-3 md:px-4 py-2 rounded-lg border border-(--border) bg-(--card-bg) text-xs md:text-sm font-semibold text-(--text-strong) hover:bg-(--hover-bg) transition-colors flex items-center gap-2 min-h-[44px]"
          >
            {sortOrder === "newest" ? (
              <SortDesc className="h-4 w-4" />
            ) : (
              <SortAsc className="h-4 w-4" />
            )}
            {sortOrder === "newest" ? "Newest First" : "Oldest First"}
          </button>

          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery("");
                setTypeFilter("all");
              }}
            >
              <X className="h-4 w-4 mr-1.5" />
              Clear
            </Button>
          )}
        </div>
      </Card>

      {/* Notices List */}
      <div className="flex flex-col gap-4">
        {filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <Bell className="h-16 w-16 text-(--text-muted) mx-auto mb-4" />
            <Text className="text-(--text-muted) text-lg mb-2">
              No notices found matching your criteria.
            </Text>
            <Text className="text-(--text-muted) text-sm mb-4">
              Try adjusting your search or filter criteria.
            </Text>
            {hasActiveFilters && (
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setTypeFilter("all");
                }}
              >
                <X className="h-4 w-4 mr-1.5" />
                Clear Filters
              </Button>
            )}
          </Card>
        ) : (
          filtered.map((n) => {
            const isRead = readNotices.has(n.id);
            return (
              <Card
                key={n.id}
                className={[
                  "p-6 transition-all hover:shadow-lg hover:-translate-y-1 border-l-4",
                  getLeftBorder(n.type),
                  !isRead && "bg-blue-50/30 dark:bg-blue-500/10",
                ].join(" ")}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      {getIcon(n.type)}
                      <H3 className="m-0">{n.title}</H3>
                      {n.isNew && (
                        <Badge tone="amber" className="ml-1">
                          NEW
                        </Badge>
                      )}
                      {!isRead && (
                        <Badge tone="blue" soft>
                          UNREAD
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-(--text-muted) mb-3 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        {n.date}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <User className="h-4 w-4" />
                        {n.author}
                      </span>
                    </div>
                    <Text className="text-[15px] leading-6 text-(--text-body) mb-4">
                      {n.body.length > 200
                        ? `${n.body.substring(0, 200)}...`
                        : n.body}
                    </Text>
                    <div className="flex items-center gap-3">
                      <button
                        className="text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                        onClick={() => {
                          setSelectedNotice(n);
                          markAsRead(n.id);
                        }}
                      >
                        Read Full Notice
                      </button>
                      {!isRead && (
                        <button
                          className="text-(--text-muted) text-sm hover:text-(--text-strong) transition-colors"
                          onClick={() => markAsRead(n.id)}
                        >
                          Mark as Read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Notice Detail Modal */}
      <Dialog
        isOpen={selectedNotice !== null}
        onClose={() => setSelectedNotice(null)}
        title={selectedNotice?.title || ""}
        size="lg"
      >
        {selectedNotice && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm text-(--text-muted) pb-4 border-b border-(--border) flex-wrap">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {selectedNotice.date}
              </span>
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                {selectedNotice.author}
              </span>
              {getIcon(selectedNotice.type)}
              <Badge
                tone={
                  selectedNotice.type === "urgent"
                    ? "red"
                    : selectedNotice.type === "announcement"
                      ? "blue"
                      : "neutral"
                }
              >
                {selectedNotice.type.toUpperCase()}
              </Badge>
            </div>
            <Text className="text-[15px] leading-7 text-(--text-body) whitespace-pre-wrap">
              {selectedNotice.body}
            </Text>
            <div className="flex gap-3 pt-4">
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => {
                  markAsRead(selectedNotice.id);
                  setSelectedNotice(null);
                }}
              >
                Mark as Read
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setSelectedNotice(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
