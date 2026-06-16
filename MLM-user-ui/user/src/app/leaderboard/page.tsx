"use client";

import {
  Award,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Star,
  TrendingUp,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Badge as UIBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { H1, H2, H3, Text } from "@/components/ui/Heading";
import { TD, TH, THead, TR, Table } from "@/components/ui/Table";
import { Tabs } from "@/components/ui/Tabs";
import { getTopEarners, getMyPosition, type LeaderboardItem, type UserPosition } from "@/lib/api/leaderboard";
import { getUserFriendlyError } from "@/lib/api/errors";

type SortConfig = {
  key: string;
  direction: "asc" | "desc";
} | null;

export default function Leaderboard() {
  const [category, setCategory] = useState<"spot" | "monthly_royalty" | "all_income">("all_income");
  const [period, setPeriod] = useState<"week" | "month" | "all">("week");
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  
  // API states
  const [leaderboardItems, setLeaderboardItems] = useState<LeaderboardItem[]>([]);
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dataLoadedRef = useRef(false); // Track if data has been successfully loaded

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(async () => {
    console.log('Fetching leaderboard for category:', category, 'period:', period);
    setIsLoading(true);
    setError(null);
    // Clear old data when fetching new category or period
    setLeaderboardItems([]);
    try {
      const [topEarners, myPos] = await Promise.all([
        getTopEarners({ limit: 50, offset: 0, period, category }),
        getMyPosition({ period }),
      ]);
      
      console.log('Leaderboard data received:', {
        category,
        period,
        itemsCount: topEarners?.items?.length || 0,
        firstItemBalance: topEarners?.items?.[0]?.wallet_balance,
      });
      
      // Always update with new data if we got valid response
      if (topEarners && topEarners.items && Array.isArray(topEarners.items)) {
        setLeaderboardItems(topEarners.items);
        dataLoadedRef.current = true; // Mark data as loaded
      }
      
      if (myPos) {
        setUserPosition(myPos);
      }
    } catch (err: unknown) {
      const errorMessage = getUserFriendlyError(err) || 'Failed to load leaderboard';
      setError(errorMessage);
      console.error('Failed to fetch leaderboard:', err);
    } finally {
      setIsLoading(false);
    }
  }, [category, period]);

  useEffect(() => {
    // Fetch when category or period changes
    fetchLeaderboard();
  }, [category, period, fetchLeaderboard]); // Fetch when category or period changes

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedCard(null);
      }
    };
    if (selectedCard !== null) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [selectedCard]);

  // Get user's rank from API data
  const userRank = useMemo(() => {
    if (!userPosition?.leaderboards?.top_earners) {
      return {
        rank: null,
        points: 0,
        pointsToNext: 0,
        nextRank: null,
      };
    }
    const topEarners = userPosition.leaderboards.top_earners;
    const nextRank = topEarners.rank ? topEarners.rank - 1 : null;
    return {
      rank: topEarners.rank,
      points: topEarners.value || 0,
      pointsToNext: 0, // API doesn't provide this, calculate if needed
      nextRank: nextRank,
    };
  }, [userPosition]);

  // Map level number/name to display format for badges
  const getLevelBadgeText = (level: number | undefined, levelName: string | undefined): string => {
    if (level === undefined && !levelName) return "Direct (0)";
    
    // Extract level number from level_name if level is not provided
    let levelNum = level;
    if (levelNum === undefined && levelName) {
      const match = levelName.match(/LEVEL\s*(\d+)/i);
      if (match) {
        levelNum = parseInt(match[1], 10);
      } else if (levelName.toUpperCase().includes("DIRECT")) {
        levelNum = 0;
      }
    }
    
    // Map level to display name
    const levelMap: Record<number, string> = {
      0: "Direct",
      1: "Field Worker",
      2: "C.R Company Representative Rank",
      3: "Area Manager",
      4: "City Manager",
      5: "District Manager",
      6: "Division Manager",
      7: "State Manager",
      8: "Regional Manager",
      9: "King",
    };
    
    const levelDisplayName = levelMap[levelNum ?? 0] || levelName || "Direct";
    
    // Format based on level
    if (levelNum === 0) {
      return "Direct (0)";
    } else if (levelNum === 1) {
      return `Field Worker (1)`;
    } else if (levelNum && levelNum >= 2) {
      return `${levelDisplayName} (L${levelNum})`;
    }
    
    return levelDisplayName;
  };

  // Get top 3 members from leaderboard
  const TOP_MEMBERS = useMemo(() => {
    return leaderboardItems.slice(0, 3).map((item, index) => ({
      id: item.user_id,
      rank: item.rank,
      name: item.name || `User ${item.display_id || item.user_id}`,
      display_title: item.display_title ?? null,
      display_title_icon_url: item.display_title_icon_url ?? null,
      avatar: item.profile_photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || item.display_id || 'User')}&background=3b82f6&color=fff`,
      earning: item.wallet_balance || 0,
      level: item.level_name || "LEVEL 0",
      badges: [getLevelBadgeText(item.level, item.level_name)],
    }));
  }, [leaderboardItems]);

  // Get remaining rows (rank 4+) - memoized to prevent unnecessary recalculations
  const ROWS = useMemo(() => {
    // Ensure we have valid data before processing
    if (!leaderboardItems || !Array.isArray(leaderboardItems)) {
      return []; // Return empty if invalid data
    }
    
    // If we have 3 or fewer items, no rows to show (only top 3 cards)
    if (leaderboardItems.length <= 3) {
      return [];
    }
    
    // Create rows from items starting from index 3 (rank 4+)
    const rows = leaderboardItems.slice(3).map((item) => {
      if (!item || !item.user_id) {
        return null; // Skip invalid items
      }
      return {
        id: item.user_id,
        rank: item.rank || 0,
        name: item.name || `User ${item.display_id || item.user_id}`,
        display_title: item.display_title ?? null,
        display_title_icon_url: item.display_title_icon_url ?? null,
        userId: item.display_id || item.user_id,
        avatar: item.profile_photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || item.display_id || 'User')}&background=3b82f6&color=fff`,
        points: item.total_commissions || 0,
        badge: getLevelBadgeText(item.level, item.level_name),
        earning: item.wallet_balance || 0,
        level: item.level_name || "LEVEL 0",
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null); // Remove any null entries with proper type guard
    
    return rows;
  }, [leaderboardItems]);

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig?.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const sortedRows = useMemo(() => {
    // Always return ROWS if no sort config or if ROWS is empty
    if (!sortConfig || !ROWS || ROWS.length === 0) {
      return ROWS || [];
    }

    return [...ROWS].sort((a, b) => {
      const aValue = a[sortConfig.key as keyof typeof a];
      const bValue = b[sortConfig.key as keyof typeof b];

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortConfig.direction === "asc"
          ? aValue - bValue
          : bValue - aValue;
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortConfig.direction === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return 0;
    });
  }, [sortConfig, ROWS]);

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey) {
      return (
        <ChevronUp className="w-4 h-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
      );
    }
    return sortConfig.direction === "asc" ? (
      <ChevronUp className="w-4 h-4 text-blue-600" />
    ) : (
      <ChevronDown className="w-4 h-4 text-blue-600" />
    );
  };

  // Name + optional display title badge (same as dashboard)
  const NameWithTitleBadge = ({
    name,
    display_title,
    display_title_icon_url,
    compact = false,
  }: {
    name: string;
    display_title?: string | null;
    display_title_icon_url?: string | null;
    compact?: boolean;
  }) => (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <span className="truncate">{name}</span>
      {display_title && (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-500/90 dark:bg-emerald-600 text-white whitespace-nowrap shrink-0 ${compact ? "pl-2 pr-1 py-0.5 text-[10px] font-semibold" : "pl-2.5 pr-1.5 py-1 text-xs font-semibold"}`}>
          {display_title}
          {display_title_icon_url && (
            <img
              src={display_title_icon_url}
              alt=""
              width={compact ? 20 : 48}
              height={compact ? 20 : 48}
              className={compact ? "h-5 w-5 object-contain rounded-md shrink-0 bg-white/25 ring-1 ring-white/40" : "h-12 w-12 object-contain rounded-lg shrink-0 bg-white/30 ring-2 ring-white/50 shadow-md"}
              style={compact ? undefined : { transform: "translateZ(0)", backfaceVisibility: "hidden" } as React.CSSProperties}
              referrerPolicy="no-referrer"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          )}
        </span>
      )}
    </span>
  );

  // Format amount in lakhs if >= 6 digits
  const formatAmount = (amount: number): string => {
    if (amount >= 100000) {
      const lakhs = amount / 100000;
      return `${lakhs.toFixed(4)} lakh`;
    }
    return amount.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  return (
    <>
      <div
        className="w-full max-w-[1300px] mx-auto p-4 md:p-6 flex flex-col gap-4 md:gap-6 lg:gap-7 overflow-x-hidden"
      >
        {/* Header */}
        <div className="flex flex-col gap-3 md:gap-4">
        <div className="flex flex-col gap-3 md:gap-4 sm:flex-row sm:items-center sm:justify-between">
          <H1>Leaderboard</H1>
          </div>
          
          {/* Category Tabs */}
          <div className="-mx-2 px-2 overflow-x-auto sm:overflow-visible">
            <div className="min-w-max sm:min-w-0">
              <Tabs
                value={category}
                onChange={(v) => setCategory(v as "spot" | "monthly_royalty" | "all_income")}
                size="sm"
                items={[
                  { value: "spot", label: "SPOT" },
                  { value: "monthly_royalty", label: "Monthly Royalty" },
                  { value: "all_income", label: "All Income" },
                ]}
              />
            </div>
          </div>
          
          {/* Period Tabs */}
          <div className="-mx-2 px-2 overflow-x-auto sm:overflow-visible">
            <div className="min-w-max sm:min-w-0">
              <Tabs
                value={period}
                onChange={(v) => setPeriod(v as "week" | "month" | "all")}
                size="sm"
                items={[
                  { value: "week", label: "This Week" },
                  { value: "month", label: "This Month" },
                  { value: "all", label: "All Time" },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Your Rank Section */}
        <Card className="bg-linear-to-r from-blue-500 to-purple-600 text-white p-4 md:p-6 hover:shadow-xl transition-shadow duration-300">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
            <div className="flex-1 w-full md:w-auto">
              <Text
                className="text-xs md:text-sm uppercase tracking-wide"
                style={{ color: "white" }}
              >
                Your Current Rank
              </Text>
              <H2
                className="mt-1 mb-2 text-2xl md:text-3xl"
                style={{ color: "white" }}
              >
                {userRank.rank ? `#${userRank.rank}` : "Not Ranked"}
              </H2>
              {userRank.rank && userPosition?.leaderboards?.top_earners && (
                <div className="flex items-center gap-2 mt-3">
                  <Text
                    className="text-xs md:text-sm font-semibold"
                    style={{ color: "white" }}
                  >
                    Wallet Balance: ₹{userPosition.leaderboards.top_earners.value.toFixed(2)}
                  </Text>
                </div>
              )}
            </div>
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/20 flex items-center justify-center border-4 border-white/30 shadow-lg shrink-0">
              <span
                className="text-2xl md:text-3xl font-bold"
                style={{ color: "white" }}
              >
                {userRank.rank || "—"}
              </span>
            </div>
          </div>
        </Card>

        {/* Loading State */}
        {isLoading ? (
          <Card className="p-12 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--brand-blue)]" />
          </Card>
        ) : error ? (
          <Card className="p-12 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 font-medium mb-2">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchLeaderboard}>
              Retry
            </Button>
          </Card>
        ) : (
          <>
            {/* Top members grid - 1st in center (bigger), 2nd and 3rd on sides (smaller) */}
            <div className="relative grid grid-cols-1 md:grid-cols-3 gap-0 items-center perspective-1000">
              {/* 2nd Rank - Left */}
              {TOP_MEMBERS[1] && (
            <Card
              key={`top-member-${TOP_MEMBERS[1].id}-${TOP_MEMBERS[1].rank}`}
              onClick={() => setSelectedCard(1)}
              className="group relative p-5 md:p-7 cursor-pointer animate-in fade-in slide-in-from-bottom-4 overflow-hidden md:z-0 md:scale-[0.93] md:opacity-90 md:mr-[-40px] transform-gpu transition-all duration-500 ease-out"
              style={{ 
                animationDelay: "100ms",
                background: "linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(99, 102, 241, 0.25) 50%, rgba(139, 92, 246, 0.2) 100%)",
                backdropFilter: "blur(20px)",
                border: "2px solid rgba(147, 197, 253, 0.3)",
                boxShadow: "0 8px 32px rgba(59, 130, 246, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
                transformStyle: "preserve-3d",
              }}
              onMouseMove={(e) => {
                const card = e.currentTarget;
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const rotateX = (y - centerY) / 20;
                const rotateY = (centerX - x) / 20;
                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(0.93) translateZ(20px)`;
              }}
              onMouseLeave={(e) => {
                const card = e.currentTarget;
                card.style.transform = "perspective(1000px) rotateX(0) rotateY(0) scale(0.93) translateZ(0)";
              }}
            >
              {/* Animated Gradient Background */}
              <div className="absolute inset-0 opacity-30">
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-500 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-gradient-to-tr from-cyan-400 via-blue-500 to-indigo-500 rounded-full blur-2xl animate-pulse" style={{ animationDelay: "1s" }} />
              </div>
              
              {/* Animated Border Glow */}
              <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500 blur-xl animate-pulse" />
              </div>
              
              {/* Shimmer Effect */}
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
              
              {/* Rank Medal - Top Center with 3D Effect and Crown */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 transform-gpu" style={{ transform: "translateZ(30px)" }}>
                <div className="relative">
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20">
                    <div className="text-2xl md:text-3xl animate-pulse" style={{ filter: "drop-shadow(0 0 10px rgba(59, 130, 246, 0.8))" }}>👑</div>
                  </div>
                  <span className="text-3xl md:text-4xl drop-shadow-2xl filter brightness-110 animate-bounce relative z-10" style={{ animationDuration: "2s", textShadow: "0 0 20px rgba(147, 197, 253, 0.8)" }}>🥈</span>
                  <div className="absolute inset-0 text-3xl md:text-4xl blur-md opacity-50">🥈</div>
                </div>
              </div>
              
              {/* Achievement Badge - Geometric Outline */}
              <div className="absolute top-16 left-1/2 -translate-x-1/2 z-5 w-20 h-20 md:w-24 md:h-24">
                <div className="absolute inset-0 border-4 border-blue-400/60 rounded-lg rotate-45 animate-pulse" style={{ boxShadow: "0 0 30px rgba(59, 130, 246, 0.6), inset 0 0 20px rgba(59, 130, 246, 0.3)" }} />
                <div className="absolute inset-2 border-2 border-indigo-400/40 rounded-lg rotate-12" />
              </div>

              {/* Content - Centered Vertical Layout */}
              <div className="flex flex-col items-center text-center pt-6">
                {/* Avatar/Character - Enhanced 3D with Floating Effect */}
                <div className="mb-3 relative transform-gpu animate-float" style={{ transform: "translateZ(40px)" }}>
                  {/* Multiple Glow Layers for Character Effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-500 rounded-full blur-2xl opacity-70 animate-pulse scale-125" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-cyan-400 via-blue-500 to-indigo-500 rounded-full blur-xl opacity-50 animate-pulse scale-110" style={{ animationDelay: "0.5s" }} />
                  
                  {/* Character Container with 3D Effect */}
                  <div className="relative z-10 transform-gpu hover:scale-110 transition-transform duration-300" style={{ transform: "translateZ(20px) rotateY(5deg)" }}>
                    <div className="absolute -inset-2 bg-gradient-to-br from-blue-300/50 via-indigo-400/50 to-purple-400/50 rounded-full blur-lg" />
                    <Avatar
                      src={TOP_MEMBERS[1].avatar}
                      alt={TOP_MEMBERS[1].name}
                      size={80}
                      className="md:!w-[90px] md:!h-[90px] border-4 border-white/50 dark:border-white/40 shadow-2xl relative z-10 ring-4 ring-blue-400/40 hover:ring-blue-300/60 transition-all duration-300"
                      ring={false}
                      style={{ 
                        boxShadow: "0 0 30px rgba(59, 130, 246, 0.6), 0 0 60px rgba(99, 102, 241, 0.4), inset 0 0 20px rgba(255, 255, 255, 0.1)",
                        filter: "brightness(1.1) contrast(1.05)"
                      }}
                    />
                    {/* Character Glow Ring */}
                    <div className="absolute inset-0 rounded-full border-2 border-blue-300/60 animate-pulse" style={{ animationDelay: "0.3s" }} />
                  </div>
                  
                  {/* Floating Particles around Character */}
                  <div className="absolute -top-2 -left-2 w-3 h-3 bg-blue-400 rounded-full blur-sm animate-ping opacity-60" style={{ animationDelay: "0s" }} />
                  <div className="absolute -top-2 -right-2 w-2 h-2 bg-indigo-400 rounded-full blur-sm animate-ping opacity-60" style={{ animationDelay: "0.3s" }} />
                  <div className="absolute -bottom-2 -left-2 w-2.5 h-2.5 bg-purple-400 rounded-full blur-sm animate-ping opacity-60" style={{ animationDelay: "0.6s" }} />
                  <div className="absolute -bottom-2 -right-2 w-2 h-2 bg-cyan-400 rounded-full blur-sm animate-ping opacity-60" style={{ animationDelay: "0.9s" }} />
                </div>

                {/* Name - Uppercase Bold with Metallic Glow Effect */}
                <H3 className="text-lg md:text-xl font-bold uppercase tracking-wide mb-1 relative z-10 transform-gpu" style={{ 
                  transform: "translateZ(20px)", 
                  background: "linear-gradient(180deg, #ffffff 0%, #e0e7ff 50%, #c7d2fe 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  textShadow: "0 0 20px rgba(147, 197, 253, 0.8), 0 0 40px rgba(99, 102, 241, 0.6), 0 2px 4px rgba(0, 0, 0, 0.3)",
                  filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))"
                }}>
                  {TOP_MEMBERS[1].name}
                </H3>

                {/* Display title badge - same style as Area Manager for clarity */}
                {TOP_MEMBERS[1].display_title && (
                  <div className="mb-2 relative z-10 transform-gpu" style={{ transform: "translateZ(20px)" }}>
                    <UIBadge
                      tone="blue"
                      className="inline-flex items-center gap-1.5 text-[10px] md:text-xs bg-gradient-to-r from-blue-500/30 via-indigo-500/30 to-purple-500/30 text-white border border-blue-400/50 shadow-lg px-2.5 py-1"
                      style={{ boxShadow: "0 0 15px rgba(59, 130, 246, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)" }}
                    >
                      {TOP_MEMBERS[1].display_title_icon_url && (
                        <img src={TOP_MEMBERS[1].display_title_icon_url} alt="" width={20} height={20} className="h-5 w-5 object-contain shrink-0" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ transform: "translateZ(0)" }} />
                      )}
                      <span className="font-semibold">{TOP_MEMBERS[1].display_title}</span>
                    </UIBadge>
                  </div>
                )}

                {/* Designation/Rank */}
                <Text className="text-xs md:text-sm text-white/80 mb-3">
                  Rank #{TOP_MEMBERS[1].rank}
                </Text>

                {/* Monetary Value - Prominent with Glow */}
                <div className="mb-3 relative z-10 transform-gpu" style={{ transform: "translateZ(25px)" }}>
                  <Text className="text-[10px] md:text-xs text-white/70 mb-1">
                    Earnings
                  </Text>
                  <div className="text-lg md:text-xl font-bold text-white drop-shadow-lg" style={{ textShadow: "0 0 15px rgba(147, 197, 253, 0.9), 0 0 30px rgba(99, 102, 241, 0.7)" }}>
                    ₹{formatAmount(TOP_MEMBERS[1].earning)}
                  </div>
                </div>

                {/* Additional Info */}
                <div className="w-full space-y-1.5 mt-2">
                  <div className="flex items-center justify-center gap-2 text-[10px] md:text-xs text-white/80">
                    <span>Level: {TOP_MEMBERS[1].level}</span>
                  </div>
                </div>

                {/* Badges with Glow Effect */}
                <div className="mt-3 flex flex-wrap justify-center gap-1.5 relative z-10 transform-gpu" style={{ transform: "translateZ(20px)" }}>
                  {TOP_MEMBERS[1].badges.map((b) => (
              <UIBadge
                      key={b}
                tone="blue"
                      className="inline-flex items-center gap-1 text-[10px] md:text-xs bg-gradient-to-r from-blue-500/30 via-indigo-500/30 to-purple-500/30 text-white border border-blue-400/50 shadow-lg hover:shadow-blue-500/50 transition-all duration-300 hover:scale-110"
                      style={{ boxShadow: "0 0 15px rgba(59, 130, 246, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)" }}
              >
                      <Award className="h-2.5 w-2.5 drop-shadow-lg" /> {b}
              </UIBadge>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* 1st Rank - Center (Bigger) */}
          {TOP_MEMBERS[0] && (
            <Card
              key={`top-member-${TOP_MEMBERS[0].id}-${TOP_MEMBERS[0].rank}`}
              onClick={() => setSelectedCard(0)}
              className="group relative p-7 md:p-9 lg:p-11 cursor-pointer animate-in fade-in slide-in-from-bottom-4 overflow-hidden md:z-10 md:scale-[0.9] transform-gpu transition-all duration-500 ease-out"
              style={{ 
                animationDelay: "0ms",
                background: "linear-gradient(135deg, rgba(251, 191, 36, 0.25) 0%, rgba(236, 72, 153, 0.3) 25%, rgba(168, 85, 247, 0.3) 50%, rgba(59, 130, 246, 0.3) 75%, rgba(34, 197, 94, 0.2) 100%)",
                backdropFilter: "blur(25px)",
                border: "3px solid rgba(251, 191, 36, 0.4)",
                boxShadow: "0 20px 60px rgba(251, 191, 36, 0.3), 0 0 40px rgba(236, 72, 153, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 -1px 0 rgba(0, 0, 0, 0.1)",
                transformStyle: "preserve-3d",
              }}
              onMouseMove={(e) => {
                const card = e.currentTarget;
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const rotateX = (y - centerY) / 15;
                const rotateY = (centerX - x) / 15;
                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(0.9) translateZ(40px)`;
              }}
              onMouseLeave={(e) => {
                const card = e.currentTarget;
                card.style.transform = "perspective(1000px) rotateX(0) rotateY(0) scale(0.9) translateZ(0)";
              }}
            >
              {/* Animated Gradient Background - More Intense for 1st */}
              <div className="absolute inset-0 opacity-40">
                <div className="absolute -top-32 -right-32 w-96 h-96 bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-500 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-gradient-to-tr from-purple-500 via-blue-500 to-cyan-400 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "0.5s" }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-400 rounded-full blur-3xl opacity-30 animate-pulse" style={{ animationDelay: "1s" }} />
              </div>
              
              {/* Animated Border Glow - Stronger for 1st */}
              <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-yellow-400 via-pink-500 via-purple-500 to-blue-500 blur-2xl animate-pulse" />
                <div className="absolute inset-[2px] rounded-lg bg-gradient-to-br from-yellow-400/20 via-pink-500/20 to-purple-500/20" />
              </div>
              
              {/* Shimmer Effect - More Prominent */}
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12" />
              
              {/* Enhanced Particle Effect Overlay - More Particles */}
              <div className="absolute inset-0 opacity-30 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-3 h-3 bg-yellow-400 rounded-full animate-ping blur-sm" style={{ animationDelay: "0s", boxShadow: "0 0 10px rgba(251, 191, 36, 0.8)" }} />
                <div className="absolute top-1/3 right-1/4 w-2 h-2 bg-pink-400 rounded-full animate-ping blur-sm" style={{ animationDelay: "0.3s", boxShadow: "0 0 10px rgba(236, 72, 153, 0.8)" }} />
                <div className="absolute bottom-1/4 left-1/3 w-2.5 h-2.5 bg-purple-400 rounded-full animate-ping blur-sm" style={{ animationDelay: "0.6s", boxShadow: "0 0 10px rgba(168, 85, 247, 0.8)" }} />
                <div className="absolute bottom-1/3 right-1/3 w-2 h-2 bg-blue-400 rounded-full animate-ping blur-sm" style={{ animationDelay: "0.9s", boxShadow: "0 0 10px rgba(59, 130, 246, 0.8)" }} />
                <div className="absolute top-1/2 left-1/5 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping blur-sm" style={{ animationDelay: "1.2s", boxShadow: "0 0 8px rgba(34, 211, 238, 0.8)" }} />
                <div className="absolute top-2/3 right-1/5 w-2 h-2 bg-yellow-300 rounded-full animate-ping blur-sm" style={{ animationDelay: "1.5s", boxShadow: "0 0 10px rgba(253, 224, 71, 0.8)" }} />
              </div>
              
              {/* Floating Achievement Stars */}
              <div className="absolute inset-0 opacity-40 pointer-events-none">
                <div className="absolute top-1/5 left-1/6 text-yellow-300 animate-pulse" style={{ animationDelay: "0s", filter: "drop-shadow(0 0 5px rgba(251, 191, 36, 0.8))" }}>⭐</div>
                <div className="absolute top-3/4 right-1/6 text-pink-300 animate-pulse" style={{ animationDelay: "0.5s", filter: "drop-shadow(0 0 5px rgba(236, 72, 153, 0.8))" }}>✨</div>
                <div className="absolute bottom-1/5 left-2/3 text-purple-300 animate-pulse" style={{ animationDelay: "1s", filter: "drop-shadow(0 0 5px rgba(168, 85, 247, 0.8))" }}>⭐</div>
              </div>
              
              {/* Rank Medal - Top Center with 3D Effect, Glow, and Crown */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 transform-gpu" style={{ transform: "translateZ(50px)" }}>
                <div className="relative">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
                    <div className="text-4xl md:text-5xl lg:text-6xl animate-pulse" style={{ filter: "drop-shadow(0 0 20px rgba(251, 191, 36, 1)) drop-shadow(0 0 40px rgba(236, 72, 153, 0.8))" }}>👑</div>
                  </div>
                  <span className="text-5xl md:text-6xl lg:text-7xl drop-shadow-2xl filter brightness-125 animate-bounce relative z-10" style={{ animationDuration: "2s", textShadow: "0 0 30px rgba(251, 191, 36, 0.8), 0 0 60px rgba(236, 72, 153, 0.6)" }}>🥇</span>
                  <div className="absolute inset-0 text-5xl md:text-6xl lg:text-7xl blur-2xl opacity-60">🥇</div>
                </div>
              </div>
              
              {/* Achievement Badge - Geometric Outline for 1st Place */}
              <div className="absolute top-20 left-1/2 -translate-x-1/2 z-5 w-32 h-32 md:w-40 md:h-40">
                <div className="absolute inset-0 border-4 border-yellow-400/70 rounded-lg rotate-45 animate-pulse" style={{ boxShadow: "0 0 40px rgba(251, 191, 36, 0.8), inset 0 0 30px rgba(236, 72, 153, 0.5)" }} />
                <div className="absolute inset-2 border-3 border-pink-400/50 rounded-lg rotate-12 animate-pulse" style={{ animationDelay: "0.5s" }} />
                <div className="absolute inset-4 border-2 border-purple-400/40 rounded-lg -rotate-12" />
              </div>
              
              {/* Spotlight Effect from Top */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200%] h-[200%] bg-radial-gradient from-white/10 via-transparent to-transparent rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(251, 191, 36, 0.15) 0%, rgba(236, 72, 153, 0.1) 30%, transparent 70%)" }} />
              </div>

              {/* Content - Centered Vertical Layout */}
              <div className="flex flex-col items-center text-center pt-10 md:pt-12">
                {/* Avatar/Character - Enhanced 3D with Floating Effect for 1st Place */}
                <div className="mb-5 md:mb-6 relative transform-gpu animate-float" style={{ transform: "translateZ(60px)" }}>
                  {/* Multiple Glow Layers for Character Effect - More Intense */}
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 via-pink-500 via-purple-500 to-blue-500 rounded-full blur-3xl opacity-80 animate-pulse scale-150" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-yellow-300 via-pink-400 to-purple-400 rounded-full blur-2xl opacity-60 animate-pulse scale-130" style={{ animationDelay: "0.5s" }} />
                  <div className="absolute inset-0 bg-gradient-to-bl from-cyan-300 via-blue-400 to-indigo-500 rounded-full blur-xl opacity-50 animate-pulse scale-120" style={{ animationDelay: "1s" }} />
                  
                  {/* Character Container with Strong 3D Effect */}
                  <div className="relative z-10 transform-gpu hover:scale-110 transition-transform duration-300" style={{ transform: "translateZ(30px) rotateY(8deg)" }}>
                    <div className="absolute -inset-4 bg-gradient-to-br from-yellow-300/60 via-pink-400/60 to-purple-400/60 rounded-full blur-xl" />
                    <div className="absolute -inset-2 bg-gradient-to-tr from-yellow-200/40 via-pink-300/40 to-purple-300/40 rounded-full blur-lg" />
                    <Avatar
                      src={TOP_MEMBERS[0].avatar}
                      alt={TOP_MEMBERS[0].name}
                      size={140}
                      className="md:!w-[160px] md:!h-[160px] lg:!w-[180px] lg:!h-[180px] border-4 border-white/60 dark:border-white/50 shadow-2xl relative z-10 ring-8 ring-yellow-400/50 hover:ring-yellow-300/70 transition-all duration-300"
                      ring={false}
                      style={{ 
                        boxShadow: "0 0 50px rgba(251, 191, 36, 0.8), 0 0 100px rgba(236, 72, 153, 0.6), 0 0 150px rgba(168, 85, 247, 0.4), inset 0 0 30px rgba(255, 255, 255, 0.2)",
                        filter: "brightness(1.15) contrast(1.1) saturate(1.1)"
                      }}
                    />
                    {/* Character Glow Rings - Multiple */}
                    <div className="absolute inset-0 rounded-full border-3 border-yellow-300/70 animate-pulse" style={{ animationDelay: "0s" }} />
                    <div className="absolute inset-2 rounded-full border-2 border-pink-300/50 animate-pulse" style={{ animationDelay: "0.5s" }} />
                    <div className="absolute inset-4 rounded-full border-2 border-purple-300/40 animate-pulse" style={{ animationDelay: "1s" }} />
                  </div>
                  
                  {/* Floating Particles around Character - More for 1st */}
                  <div className="absolute -top-3 -left-3 w-4 h-4 bg-yellow-400 rounded-full blur-sm animate-ping opacity-70" style={{ animationDelay: "0s", boxShadow: "0 0 15px rgba(251, 191, 36, 0.8)" }} />
                  <div className="absolute -top-3 -right-3 w-3 h-3 bg-pink-400 rounded-full blur-sm animate-ping opacity-70" style={{ animationDelay: "0.3s", boxShadow: "0 0 15px rgba(236, 72, 153, 0.8)" }} />
                  <div className="absolute -bottom-3 -left-3 w-3.5 h-3.5 bg-purple-400 rounded-full blur-sm animate-ping opacity-70" style={{ animationDelay: "0.6s", boxShadow: "0 0 15px rgba(168, 85, 247, 0.8)" }} />
                  <div className="absolute -bottom-3 -right-3 w-3 h-3 bg-blue-400 rounded-full blur-sm animate-ping opacity-70" style={{ animationDelay: "0.9s", boxShadow: "0 0 15px rgba(59, 130, 246, 0.8)" }} />
                  <div className="absolute top-1/2 -left-4 w-2.5 h-2.5 bg-cyan-400 rounded-full blur-sm animate-ping opacity-70" style={{ animationDelay: "1.2s", boxShadow: "0 0 12px rgba(34, 211, 238, 0.8)" }} />
                  <div className="absolute top-1/2 -right-4 w-2.5 h-2.5 bg-yellow-300 rounded-full blur-sm animate-ping opacity-70" style={{ animationDelay: "1.5s", boxShadow: "0 0 12px rgba(253, 224, 71, 0.8)" }} />
                </div>

                {/* Name - Uppercase Bold with Metallic Gold Effect */}
                <H3 className="text-2xl md:text-3xl lg:text-4xl font-bold uppercase tracking-wide mb-2 relative z-10 transform-gpu" style={{ 
                  transform: "translateZ(30px)", 
                  background: "linear-gradient(180deg, #fef3c7 0%, #fde68a 25%, #fcd34d 50%, #fbbf24 75%, #f59e0b 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  textShadow: "0 0 30px rgba(251, 191, 36, 1), 0 0 60px rgba(236, 72, 153, 0.8), 0 0 90px rgba(168, 85, 247, 0.6), 0 4px 8px rgba(0, 0, 0, 0.4)",
                  filter: "drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4))"
                }}>
                  {TOP_MEMBERS[0].name}
                </H3>

                {/* Display title badge - same style as Area Manager (L3) for clarity */}
                {TOP_MEMBERS[0].display_title && (
                  <div className="mb-3 relative z-10 transform-gpu" style={{ transform: "translateZ(30px)" }}>
                    <UIBadge
                      tone="blue"
                      className="inline-flex items-center gap-1.5 text-sm md:text-base bg-gradient-to-r from-yellow-500/40 via-pink-500/40 to-purple-500/40 text-white border-2 border-yellow-400/60 shadow-xl px-3 py-1.5"
                      style={{ boxShadow: "0 0 20px rgba(251, 191, 36, 0.6), 0 0 40px rgba(236, 72, 153, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)" }}
                    >
                      {TOP_MEMBERS[0].display_title_icon_url && (
                        <img src={TOP_MEMBERS[0].display_title_icon_url} alt="" width={24} height={24} className="h-6 w-6 object-contain shrink-0" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ transform: "translateZ(0)" }} />
                      )}
                      <span className="font-semibold">{TOP_MEMBERS[0].display_title}</span>
                    </UIBadge>
                  </div>
                )}

                {/* Designation/Rank */}
                <Text className="text-base md:text-lg text-white/80 mb-5">
                  Rank #{TOP_MEMBERS[0].rank}
                  </Text>

                {/* Monetary Value - Prominent with Strong Glow */}
                <div className="mb-5 relative z-10 transform-gpu" style={{ transform: "translateZ(35px)" }}>
                  <Text className="text-xs md:text-sm text-white/70 mb-2">
                    Earnings
                  </Text>
                  <div className="text-2xl md:text-3xl lg:text-4xl font-bold text-white drop-shadow-lg" style={{ textShadow: "0 0 25px rgba(251, 191, 36, 1), 0 0 50px rgba(236, 72, 153, 0.8), 0 0 75px rgba(168, 85, 247, 0.6)" }}>
                    ₹{formatAmount(TOP_MEMBERS[0].earning)}
                </div>
              </div>

                {/* Additional Info */}
                <div className="w-full space-y-2.5 mt-3">
                  <div className="flex items-center justify-center gap-2 text-sm md:text-base text-white/80">
                    <span>Level: {TOP_MEMBERS[0].level}</span>
                  </div>
                </div>

                {/* Badges with Enhanced Glow Effect */}
                <div className="mt-5 flex flex-wrap justify-center gap-2 relative z-10 transform-gpu" style={{ transform: "translateZ(30px)" }}>
                  {TOP_MEMBERS[0].badges.map((b) => (
                  <UIBadge
                    key={b}
                    tone="blue"
                      className="inline-flex items-center gap-1 text-sm md:text-base bg-gradient-to-r from-yellow-500/40 via-pink-500/40 to-purple-500/40 text-white border-2 border-yellow-400/60 shadow-xl hover:shadow-yellow-500/60 transition-all duration-300 hover:scale-110"
                      style={{ boxShadow: "0 0 20px rgba(251, 191, 36, 0.6), 0 0 40px rgba(236, 72, 153, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)" }}
                  >
                      <Award className="h-4 w-4 drop-shadow-lg" /> {b}
                  </UIBadge>
                ))}
                </div>
              </div>
            </Card>
          )}

          {/* 3rd Rank - Right */}
          {TOP_MEMBERS[2] && (
            <Card
              key={`top-member-${TOP_MEMBERS[2].id}-${TOP_MEMBERS[2].rank}`}
              onClick={() => setSelectedCard(2)}
              className="group relative p-5 md:p-7 cursor-pointer animate-in fade-in slide-in-from-bottom-4 overflow-hidden md:z-0 md:scale-[0.93] md:opacity-90 md:ml-[-40px] transform-gpu transition-all duration-500 ease-out"
              style={{ 
                animationDelay: "200ms",
                background: "linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(249, 115, 22, 0.25) 50%, rgba(251, 146, 60, 0.2) 100%)",
                backdropFilter: "blur(20px)",
                border: "2px solid rgba(251, 146, 60, 0.3)",
                boxShadow: "0 8px 32px rgba(245, 158, 11, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
                transformStyle: "preserve-3d",
              }}
              onMouseMove={(e) => {
                const card = e.currentTarget;
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const rotateX = (y - centerY) / 20;
                const rotateY = (centerX - x) / 20;
                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(0.93) translateZ(20px)`;
              }}
              onMouseLeave={(e) => {
                const card = e.currentTarget;
                card.style.transform = "perspective(1000px) rotateX(0) rotateY(0) scale(0.93) translateZ(0)";
              }}
            >
              {/* Animated Gradient Background */}
              <div className="absolute inset-0 opacity-30">
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-gradient-to-tr from-yellow-400 via-amber-500 to-orange-500 rounded-full blur-2xl animate-pulse" style={{ animationDelay: "1s" }} />
              </div>
              
              {/* Animated Border Glow */}
              <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 blur-xl animate-pulse" />
              </div>
              
              {/* Shimmer Effect */}
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
              
              {/* Rank Medal - Top Center with 3D Effect and Crown */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 transform-gpu" style={{ transform: "translateZ(30px)" }}>
                <div className="relative">
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20">
                    <div className="text-xl md:text-2xl animate-pulse opacity-70" style={{ filter: "drop-shadow(0 0 10px rgba(245, 158, 11, 0.8))" }}>👑</div>
                  </div>
                  <span className="text-3xl md:text-4xl drop-shadow-2xl filter brightness-110 animate-bounce relative z-10" style={{ animationDuration: "2s", textShadow: "0 0 20px rgba(251, 146, 60, 0.8)" }}>🥉</span>
                  <div className="absolute inset-0 text-3xl md:text-4xl blur-md opacity-50">🥉</div>
                </div>
              </div>
              
              {/* Achievement Badge - Geometric Outline */}
              <div className="absolute top-16 left-1/2 -translate-x-1/2 z-5 w-20 h-20 md:w-24 md:h-24">
                <div className="absolute inset-0 border-4 border-amber-400/60 rounded-lg rotate-45 animate-pulse" style={{ boxShadow: "0 0 30px rgba(245, 158, 11, 0.6), inset 0 0 20px rgba(249, 115, 22, 0.3)" }} />
                <div className="absolute inset-2 border-2 border-orange-400/40 rounded-lg rotate-12" />
              </div>

              {/* Content - Centered Vertical Layout */}
              <div className="flex flex-col items-center text-center pt-6">
                {/* Avatar/Character - Enhanced 3D with Floating Effect */}
                <div className="mb-3 relative transform-gpu animate-float" style={{ transform: "translateZ(40px)" }}>
                  {/* Multiple Glow Layers for Character Effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-full blur-2xl opacity-70 animate-pulse scale-125" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-yellow-400 via-amber-500 to-orange-500 rounded-full blur-xl opacity-50 animate-pulse scale-110" style={{ animationDelay: "0.5s" }} />
                  
                  {/* Character Container with 3D Effect */}
                  <div className="relative z-10 transform-gpu hover:scale-110 transition-transform duration-300" style={{ transform: "translateZ(20px) rotateY(-5deg)" }}>
                    <div className="absolute -inset-2 bg-gradient-to-br from-amber-300/50 via-orange-400/50 to-red-400/50 rounded-full blur-lg" />
                    <Avatar
                      src={TOP_MEMBERS[2].avatar}
                      alt={TOP_MEMBERS[2].name}
                      size={80}
                      className="md:!w-[90px] md:!h-[90px] border-4 border-white/50 dark:border-white/40 shadow-2xl relative z-10 ring-4 ring-amber-400/40 hover:ring-amber-300/60 transition-all duration-300"
                      ring={false}
                      style={{ 
                        boxShadow: "0 0 30px rgba(245, 158, 11, 0.6), 0 0 60px rgba(249, 115, 22, 0.4), inset 0 0 20px rgba(255, 255, 255, 0.1)",
                        filter: "brightness(1.1) contrast(1.05)"
                      }}
                    />
                    {/* Character Glow Ring */}
                    <div className="absolute inset-0 rounded-full border-2 border-amber-300/60 animate-pulse" style={{ animationDelay: "0.3s" }} />
                  </div>
                  
                  {/* Floating Particles around Character */}
                  <div className="absolute -top-2 -left-2 w-3 h-3 bg-amber-400 rounded-full blur-sm animate-ping opacity-60" style={{ animationDelay: "0s" }} />
                  <div className="absolute -top-2 -right-2 w-2 h-2 bg-orange-400 rounded-full blur-sm animate-ping opacity-60" style={{ animationDelay: "0.3s" }} />
                  <div className="absolute -bottom-2 -left-2 w-2.5 h-2.5 bg-red-400 rounded-full blur-sm animate-ping opacity-60" style={{ animationDelay: "0.6s" }} />
                  <div className="absolute -bottom-2 -right-2 w-2 h-2 bg-yellow-400 rounded-full blur-sm animate-ping opacity-60" style={{ animationDelay: "0.9s" }} />
                </div>

                {/* Name - Uppercase Bold with Metallic Bronze Effect */}
                <H3 className="text-lg md:text-xl font-bold uppercase tracking-wide mb-1 relative z-10 transform-gpu" style={{ 
                  transform: "translateZ(20px)", 
                  background: "linear-gradient(180deg, #fef3c7 0%, #fed7aa 30%, #fdba74 60%, #fb923c 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  textShadow: "0 0 20px rgba(251, 146, 60, 0.8), 0 0 40px rgba(245, 158, 11, 0.6), 0 2px 4px rgba(0, 0, 0, 0.3)",
                  filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))"
                }}>
                  {TOP_MEMBERS[2].name}
                </H3>

                {/* Display title badge - same style as Area Manager for clarity */}
                {TOP_MEMBERS[2].display_title && (
                  <div className="mb-2 relative z-10 transform-gpu" style={{ transform: "translateZ(20px)" }}>
                    <UIBadge
                      tone="blue"
                      className="inline-flex items-center gap-1.5 text-[10px] md:text-xs bg-white/20 text-white border border-white/30 px-2.5 py-1"
                    >
                      {TOP_MEMBERS[2].display_title_icon_url && (
                        <img src={TOP_MEMBERS[2].display_title_icon_url} alt="" width={20} height={20} className="h-5 w-5 object-contain shrink-0" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ transform: "translateZ(0)" }} />
                      )}
                      <span className="font-semibold">{TOP_MEMBERS[2].display_title}</span>
                    </UIBadge>
                  </div>
                )}

                {/* Designation/Rank */}
                <Text className="text-xs md:text-sm text-white/80 mb-3">
                  Rank #{TOP_MEMBERS[2].rank}
                </Text>

                {/* Monetary Value - Prominent with Glow */}
                <div className="mb-3 relative z-10 transform-gpu" style={{ transform: "translateZ(25px)" }}>
                  <Text className="text-[10px] md:text-xs text-white/70 mb-1">
                    Earnings
                  </Text>
                  <div className="text-lg md:text-xl font-bold text-white drop-shadow-lg" style={{ textShadow: "0 0 15px rgba(251, 146, 60, 0.9), 0 0 30px rgba(245, 158, 11, 0.7)" }}>
                    ₹{formatAmount(TOP_MEMBERS[2].earning)}
                  </div>
                </div>

                {/* Additional Info */}
                <div className="w-full space-y-1.5 mt-2">
                  <div className="flex items-center justify-center gap-2 text-[10px] md:text-xs text-white/80">
                    <span>Level: {TOP_MEMBERS[2].level}</span>
                  </div>
                </div>

                {/* Badges */}
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {TOP_MEMBERS[2].badges.map((b) => (
                    <UIBadge
                      key={b}
                      tone="blue"
                      className="inline-flex items-center gap-1 text-[10px] md:text-xs bg-white/20 text-white border border-white/30"
                    >
                      <Award className="h-2.5 w-2.5" /> {b}
                    </UIBadge>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Ranking table - Desktop table, Mobile cards */}
        <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300 animate-in fade-in">
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
            <div className="min-w-full inline-block align-middle p-4 md:p-6">
              <Table className="w-full">
                <THead>
                  <tr>
                    {[
                      { key: "rank", label: "Rank" },
                      { key: "name", label: "User" },
                      { key: "badge", label: "Badges" },
                      { key: "level", label: "Level" },
                      { key: "earning", label: "Earnings" },
                    ].map((h) => (
                      <TH
                        key={h.key}
                        className="group cursor-pointer select-none hover:bg-[var(--sidebar-hover)] transition-colors duration-200"
                        onClick={() => handleSort(h.key)}
                      >
                        <div className="flex items-center gap-2">
                          {h.label}
                          <SortIcon columnKey={h.key} />
                        </div>
                      </TH>
                    ))}
                  </tr>
                </THead>
                <tbody>
                  {sortedRows.length === 0 ? (
                    <TR>
                      <TD colSpan={5} className="text-center py-8 text-[var(--text-muted)]">
                        No more users to display. Only top 3 are shown above.
                      </TD>
                    </TR>
                  ) : (
                    sortedRows.map((r, index) => (
                      <TR
                        key={r.id}
                        className="hover:bg-[var(--sidebar-active-bg)] transition-colors duration-200 animate-in fade-in"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <TD className="text-center font-semibold text-[var(--text-muted)]">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--sidebar-hover)] text-sm">
                            {r.rank}
                          </span>
                        </TD>
                        <TD>
                          <div className="flex items-center gap-3">
                            <Avatar
                              src={r.avatar}
                              alt={r.name}
                              size={40}
                              className="shrink-0"
                            />
                            <div className="flex flex-col min-w-0">
                              <NameWithTitleBadge name={r.name} display_title={r.display_title} display_title_icon_url={r.display_title_icon_url} compact />
                              <span className="text-xs text-[var(--text-muted)] truncate">
                                {r.userId}
                              </span>
                            </div>
                          </div>
                        </TD>
                        <TD>
                          <UIBadge tone="blue" className="text-[11px]">
                            {r.badge}
                          </UIBadge>
                        </TD>
                        <TD className="text-purple-600 font-semibold text-sm">
                          {r.level}
                        </TD>
                        <TD className="text-cyan-600 font-semibold text-sm">
                          ₹{r.earning.toLocaleString('en-IN')}
                        </TD>
                      </TR>
                    ))
                  )}
                </tbody>
              </Table>
            </div>
          </div>

          {/* Mobile/Tablet Card View */}
          <div className="lg:hidden p-4 space-y-3">
            {sortedRows.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-muted)]">
                {leaderboardItems.length <= 3 
                  ? "Only top 3 users are displayed above. More users will appear here as they join."
                  : "No data available"}
              </div>
            ) : (
              sortedRows.map((r, index) => (
              <div
                key={r.id}
                className="p-4 border border-[var(--border)] rounded-lg hover:bg-[var(--sidebar-active-bg)] transition-colors duration-200 animate-in fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--sidebar-hover)] text-sm font-semibold text-[var(--text-muted)] shrink-0">
                      {r.rank}
                    </span>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Avatar
                        src={r.avatar}
                        alt={r.name}
                        size={40}
                        className="shrink-0"
                      />
                      <div className="flex flex-col min-w-0 flex-1">
                        <NameWithTitleBadge name={r.name} display_title={r.display_title} display_title_icon_url={r.display_title_icon_url} compact />
                        <span className="text-xs text-[var(--text-muted)] truncate">
                          {r.userId}
                        </span>
                      </div>
                    </div>
                  </div>
                  <UIBadge tone="blue" className="text-[11px] shrink-0">
                    {r.badge}
                  </UIBadge>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[var(--border)]">
                  <div className="flex flex-col">
                    <span className="text-xs text-[var(--text-muted)] mb-1">
                      Level
                    </span>
                    <span className="text-sm font-semibold text-purple-600">
                      {r.level}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-[var(--text-muted)] mb-1">
                      Earnings
                    </span>
                    <span className="text-sm font-semibold text-cyan-600">
                      ₹{r.earning.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            ))
            )}
          </div>
        </Card>

        {/* Modal Overlay for Selected Card */}
        {selectedCard !== null && (
          <div
            className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
            onClick={() => setSelectedCard(null)}
          >
            <div
              className="relative w-full max-w-md transform transition-all duration-300 scale-105"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedCard(null)}
                className="absolute -top-12 right-0 z-10 p-2 rounded-full bg-[var(--card-bg)]/90 hover:bg-[var(--card-bg)] text-[var(--text-body)] hover:text-[var(--text-strong)] shadow-lg transition-all duration-200"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

            {/* Enlarged Card */}
            <Card
              className={`relative p-8 md:p-10 shadow-2xl transform transition-all duration-300 overflow-hidden ${
                selectedCard === 0
                  ? "bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-blue-500/20 dark:from-pink-500/10 dark:via-purple-500/10 dark:to-blue-500/10 backdrop-blur-md border border-white/20 dark:border-white/10"
                  : selectedCard === 1
                    ? "bg-gradient-to-br from-purple-500/20 via-blue-500/20 to-indigo-500/20 dark:from-purple-500/10 dark:via-blue-500/10 dark:to-indigo-500/10 backdrop-blur-md border border-white/20 dark:border-white/10"
                    : selectedCard === 2
                      ? "bg-gradient-to-br from-indigo-500/20 via-blue-500/20 to-purple-500/20 dark:from-indigo-500/10 dark:via-blue-500/10 dark:to-purple-500/10 backdrop-blur-md border border-white/20 dark:border-white/10"
                      : ""
              }`}
            >
              {/* Rank Medal - Top Center */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
                {selectedCard === 0 && (
                  <span className="text-5xl md:text-6xl drop-shadow-lg">🥇</span>
                )}
                {selectedCard === 1 && (
                  <span className="text-5xl md:text-6xl drop-shadow-lg">🥈</span>
                )}
                {selectedCard === 2 && (
                  <span className="text-5xl md:text-6xl drop-shadow-lg">🥉</span>
                )}
              </div>

              {/* Content - Centered Vertical Layout */}
              <div className="flex flex-col items-center text-center pt-12">
                {/* Avatar - Centered and Larger */}
                <div className="mb-6">
                <Avatar
                  src={TOP_MEMBERS[selectedCard].avatar}
                  alt={TOP_MEMBERS[selectedCard].name}
                    size={160}
                    className="md:!w-[160px] md:!h-[160px] border-4 border-white/30 dark:border-white/20 shadow-xl"
                    ring={false}
                  />
                </div>

                {/* Name - Uppercase Bold */}
                <H3 className="text-2xl md:text-3xl font-bold uppercase tracking-wide text-white drop-shadow-md mb-2">
                  {TOP_MEMBERS[selectedCard].name}
                </H3>

                {/* Display title badge - same style as Area Manager (L3) for clarity */}
                {TOP_MEMBERS[selectedCard].display_title && (
                  <div className="mb-4">
                    <UIBadge
                      tone="blue"
                      className="inline-flex items-center gap-1.5 text-sm md:text-base px-4 py-2 bg-white/20 text-white border border-white/30"
                    >
                      {TOP_MEMBERS[selectedCard].display_title_icon_url && (
                        <img src={TOP_MEMBERS[selectedCard].display_title_icon_url} alt="" width={24} height={24} className="h-6 w-6 object-contain shrink-0" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = "none"; }} style={{ transform: "translateZ(0)" }} />
                      )}
                      <span className="font-semibold">{TOP_MEMBERS[selectedCard].display_title}</span>
                    </UIBadge>
                  </div>
                )}

                {/* Designation/Rank */}
                <Text className="text-base md:text-lg text-white/80 mb-6">
                  Rank #{TOP_MEMBERS[selectedCard].rank}
                  </Text>

                {/* Monetary Value - Prominent */}
                <div className="mb-6">
                  <Text className="text-xs md:text-sm text-white/70 mb-2">
                    Earnings
                  </Text>
                  <div className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">
                    ₹{formatAmount(TOP_MEMBERS[selectedCard].earning)}
                </div>
              </div>

                {/* Additional Info */}
                <div className="w-full space-y-3 mt-4">
                  <div className="flex items-center justify-center gap-2 text-sm md:text-base text-white/80">
                    <span>Level: {TOP_MEMBERS[selectedCard].level}</span>
                  </div>
                  <Text className="text-sm md:text-base text-white/80">
                    ID: {TOP_MEMBERS[selectedCard].id}
                  </Text>
                </div>

                {/* Badges */}
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                {TOP_MEMBERS[selectedCard].badges.map((b) => (
                  <UIBadge
                    key={b}
                    tone="blue"
                      className="inline-flex items-center gap-1 text-sm md:text-base px-4 py-2 bg-white/20 text-white border border-white/30"
                  >
                    <Award className="h-4 w-4 md:h-5 md:w-5" /> {b}
                  </UIBadge>
                ))}
                </div>
              </div>
            </Card>
          </div>
        </div>
        )}
          </>
        )}
      </div>
    </>
  );
}

function Pill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded bg-white/15 px-3 py-2 text-[14px] font-medium">
      {icon}
      <span className="truncate max-w-32 md:max-w-none">{label}</span>
    </span>
  );
}

// Old mock data removed - now using API data via useMemo hooks above
const _OLD_TOP_MEMBERS = [
  {
    id: "U1001",
    rank: 1,
    name: "AlexR_21",
    avatar:
      "https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg",
    ids: 12,
    earning: 1520,
    streak: 15,
    level: "DIRECT",
    badges: ["Diamond"],
  },
  {
    id: "U1002",
    rank: 2,
    name: "LoanWithMitra",
    avatar: "https://images.pexels.com/photos/837358/pexels-photo-837358.jpeg",
    ids: 9,
    earning: 1540,
    streak: 18,
    level: "LEVEL-1",
    badges: ["Platinum"],
  },
  {
    id: "U1003",
    rank: 3,
    name: "CoduJunkie",
    avatar:
      "https://images.pexels.com/photos/39866/entrepreneur-startup-start-up-man-39866.jpeg",
    ids: 10,
    earning: 1120,
    streak: 16,
    level: "LEVEL-2",
    badges: ["Gold"],
  },
];

// Old mock data removed - now using API data via useMemo hooks above
const _OLD_ROWS = [
  {
    id: "U1011",
    rank: 4,
    name: "DesignGuru",
    userId: "U1011",
    avatar: "https://images.pexels.com/photos/845457/pexels-photo-845457.jpeg",
    points: 980,
    streak: 8,
    badge: "Gold",
    ids: 12,
    earning: 1200,
    level: "LEVEL-3",
  },
  {
    id: "U1012",
    rank: 5,
    name: "MohitMaster",
    userId: "U1012",
    avatar:
      "https://images.pexels.com/photos/5950123/pexels-photo-5950123.jpeg",
    points: 890,
    streak: 7,
    badge: "Silver",
    ids: 10,
    earning: 1000,
    level: "LEVEL-4",
  },
  {
    id: "U1013",
    rank: 6,
    name: "GrowthHacker",
    userId: "U1013",
    avatar:
      "https://images.pexels.com/photos/5950004/pexels-photo-5950004.jpeg",
    points: 832,
    streak: 6,
    badge: "Bronze",
    ids: 9,
    earning: 900,
    level: "LEVEL-5",
  },
  {
    id: "U1014",
    rank: 7,
    name: "DevWizard",
    userId: "U1014",
    avatar:
      "https://images.pexels.com/photos/4963367/pexels-photo-4963367.jpeg",
    points: 795,
    streak: 7,
    badge: "Bronze",
    ids: 8,
    earning: 850,
    level: "LEVEL-6",
  },
  {
    id: "U1015",
    rank: 8,
    name: "UIUXExplorer",
    userId: "U1015",
    avatar:
      "https://images.pexels.com/photos/5950004/pexels-photo-5950004.jpeg",
    points: 760,
    streak: 4,
    badge: "Silver",
    ids: 7,
    earning: 800,
    level: "LEVEL-7",
  },
  {
    id: "U1016",
    rank: 9,
    name: "TechInnovator",
    userId: "U1016",
    avatar:
      "https://images.pexels.com/photos/4963367/pexels-photo-4963367.jpeg",
    points: 710,
    streak: 5,
    badge: "Gold",
    ids: 6,
    earning: 750,
    level: "LEVEL-8",
  },
  {
    id: "U1017",
    rank: 10,
    name: "ContentCreator",
    userId: "U1017",
    avatar:
      "https://images.pexels.com/photos/5534419/pexels-photo-5534419.jpeg",
    points: 680,
    streak: 3,
    badge: "Bronze",
    ids: 5,
    earning: 700,
    level: "LEVEL-9",
  },
];
