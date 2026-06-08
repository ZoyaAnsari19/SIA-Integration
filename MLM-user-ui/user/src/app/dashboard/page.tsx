"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { H3 } from "@/components/ui/Heading";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { Carousel } from "@/components/ui/Carousel";
import { EnhancedStatCard } from "@/components/ui/EnhancedStatCard";
import { ActionCard } from "@/components/ui/ActionCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CountdownTimer } from "@/components/ui/CountdownTimer";
import { useAppSelector } from "@/redux/hooks";
import { 
  getWalletBalance, 
  getDashboardStats, 
  getTeamBusinessBreakdown,
  getCommissionTrend,
  getDashboardNotices,
  getDashboardBanners,
  type DashboardStatsResponse,
  type TeamBusinessBreakdownResponse,
  type CommissionTrendResponse,
  type NoticeItem,
  type BannerItem,
} from "@/lib/api/dashboard";
import { getUserFriendlyError } from "@/lib/api/errors";
import { getMaxQualifiedLevel } from "@/lib/api/users";
import { getMyPosition } from "@/lib/api/leaderboard";
import { getMyPackages } from "@/lib/api/packages";
import { getUserProfile } from "@/lib/api/kyc";
import { Avatar } from "@/components/ui/Avatar";
import type { PackagePurchase } from "@/lib/api/types";
import { checkPackageAlerts, getPackageAlertMessage } from "@/lib/utils/packageAlerts";
import { getWithdrawalRequests } from "@/lib/api/withdrawal";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import {
  User,
  Wallet,
  Users,
  Globe,
  CreditCard,
  Bell,
  ArrowDownToLine,
  BarChart3,
  LineChart,
  Sparkles,
  Award,
  Target,
  Calculator,
  AlertCircle,
  CheckCircle,
  X,
  ExternalLink,
  TrendingUp,
  BookOpen,
  GraduationCap,
  Calendar,
} from "lucide-react";

type TeamBusinessData = {
  category: string;
  spot_income: number;
  monthly_royalty: number;
};

type CommissionData = {
  date: string;
  commission: number;
};

type MessageType = "renew" | "welcome" | "info" | "warning";

interface DashboardMessage {
  id: string;
  type: MessageType;
  title: string;
  message: string;
  linkText?: string;
  linkUrl?: string;
  invoiceId?: string;
  dismissible?: boolean;
}

// Level (0-9) → rank icon path (same as path-rank page)
const getLevelRankIcon = (level: number): string =>
  level === 0 ? "/ranks/Direct.png" : `/ranks/Level -${level}.png`;

export default function Dashboard() {
  const [teamLevel, setTeamLevel] = useState<"Direct" | "Level-1" | "Level-2" | "Level-3">("Direct");
  const [dismissedMessages, setDismissedMessages] = useState<Set<string>>(
    new Set(),
  );
  const user = useAppSelector((state) => state.auth.user);
  const [titleIconError, setTitleIconError] = useState(false);

  // Reset icon error when user or icon URL changes
  useEffect(() => {
    setTitleIconError(false);
  }, [user?.display_title_icon_url]);

  // API Data States
  const [walletBalance, setWalletBalance] = useState<{
    balance: number;
    spot_balance: number;
    other_balance: number;
    team_royalty_balance?: number;
    main_locked_hold?: number;
    available_main_balance?: number;
    spot_team_withdraw_limit?: number;
    spot_team_withdraw_used?: number;
    spot_team_withdraw_remaining?: number;
    spot_team_withdraw_multiplier?: number;
    spot_team_limit_reached_at?: string | null;
    spot_team_flush_active?: boolean;
    spot_locked_hold?: number;
    available_spot_balance?: number;
  } | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStatsResponse | null>(null);
  const [teamBusinessData, setTeamBusinessData] = useState<Record<"Direct" | "Level-1" | "Level-2" | "Level-3", TeamBusinessData[]>>({
    "Direct": [],
    "Level-1": [],
    "Level-2": [],
    "Level-3": [],
  });
  const [commissionTrendData, setCommissionTrendData] = useState<CommissionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maxLevel, setMaxLevel] = useState<{ title: string; level: number } | null>(null);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [packages, setPackages] = useState<PackagePurchase[]>([]);
  const [totalInvestment, setTotalInvestment] = useState<number>(0);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [mainWalletWithdrawals, setMainWalletWithdrawals] = useState<number>(0);
  const [spotWalletWithdrawals, setSpotWalletWithdrawals] = useState<number>(0);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch all dashboard data in parallel
        const [wallet, stats, teamBusiness, commissionTrend, noticesData, bannersData] = await Promise.all([
          getWalletBalance(),
          getDashboardStats(),
          getTeamBusinessBreakdown(4), // Last 4 months
          getCommissionTrend(30), // Last 30 days
          getDashboardNotices().catch(() => ({ items: [] })), // Fetch notices, fallback to empty if fails
          getDashboardBanners().catch(() => ({ items: [] })), // Fetch banners, fallback to empty if fails
        ]);
        
        // Total = spot + other + team_royalty (all three wallets)
        const calculatedBalance =
          (wallet.spot_balance || 0) +
          (wallet.other_balance || 0) +
          (wallet.team_royalty_balance ?? 0);
        setWalletBalance({
          balance: calculatedBalance,
          spot_balance: wallet.spot_balance,
          other_balance: wallet.other_balance,
          team_royalty_balance: wallet.team_royalty_balance ?? 0,
          main_locked_hold: wallet.main_locked_hold ?? 0,
          available_main_balance: wallet.available_main_balance ?? wallet.other_balance,
          spot_team_withdraw_limit: wallet.spot_team_withdraw_limit,
          spot_team_withdraw_used: wallet.spot_team_withdraw_used,
          spot_team_withdraw_remaining: wallet.spot_team_withdraw_remaining,
          spot_team_withdraw_multiplier: wallet.spot_team_withdraw_multiplier,
          spot_team_limit_reached_at: wallet.spot_team_limit_reached_at ?? null,
          spot_team_flush_active: wallet.spot_team_flush_active ?? false,
          spot_locked_hold: wallet.spot_locked_hold ?? 0,
          available_spot_balance: wallet.available_spot_balance ?? wallet.spot_balance,
        });
        setDashboardStats(stats);
        
        // Transform team business breakdown data
        const transformedTeamBusiness: Record<"Direct" | "Level-1" | "Level-2" | "Level-3", TeamBusinessData[]> = {
          "Direct": teamBusiness.levels["Direct"] || [],
          "Level-1": teamBusiness.levels["Level-1"] || [],
          "Level-2": teamBusiness.levels["Level-2"] || [],
          "Level-3": teamBusiness.levels["Level-3"] || [],
        };
        setTeamBusinessData(transformedTeamBusiness);
        
        // Transform commission trend data
        setCommissionTrendData(commissionTrend.data);
        
        // Set notices from API
        setNotices(noticesData.items || []);
        
        // Set banners from API
        setBanners(bannersData.items || []);
      } catch (err: any) {
        const errorMessage = getUserFriendlyError(err);
        setError(errorMessage);
        console.error('Dashboard data fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Fetch total withdrawals from Main (other) wallet and SPOT wallet using withdrawal requests API
  useEffect(() => {
    const fetchWalletWithdrawals = async () => {
      try {
        let page = 1;
        const limit = 100;
        let totalPages = 1;
        let mainTotal = 0;
        let spotTotal = 0;

        // Paginate through all approved + processing withdrawal requests
        while (page <= totalPages) {
          const response = await getWithdrawalRequests({
            page,
            limit,
            status: undefined, // include all statuses
            // withdraw_type not filtered here so we can aggregate both wallet types
          });

          // Sum only approved + processing amounts
          response.items.forEach((item) => {
            if (item.status === "approved" || item.status === "processing") {
              if (item.withdraw_type === "wallet") {
                mainTotal += item.amount || 0;
              }
              if (item.withdraw_type === "spot") {
                spotTotal += item.amount || 0;
              }
            }
          });

          totalPages = response.total_pages || 1;
          page += 1;
        }

        setMainWalletWithdrawals(mainTotal);
        setSpotWalletWithdrawals(spotTotal);
      } catch (err) {
        console.error("Error fetching wallet withdrawals:", err);
        // Keep KPI values as 0 if API fails
      }
    };

    fetchWalletWithdrawals();
  }, []);

  // Fetch packages for Global IDs, 2x progress, and total investment
  // Use same logic as My Packages: fetch all, hide upgraded-expired, then sum (so dashboard Total Investment matches My Packages)
  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const packagesData = await getMyPackages();
        const allItems = packagesData.items;
        // Filter only active packages for carousel / 2x progress
        const activePackages = allItems.filter(pkg => pkg.is_active);
        setPackages(activePackages);
        // Total investment = sum of "visible" packages (same as My Packages: exclude expired that were upgraded)
        const visibleForInvestment = allItems.filter(pkg => {
          if (pkg.is_active) return true;
          const wasUpgraded = allItems.some(
            other => other.is_active && other.previous_purchase_id != null && String(other.previous_purchase_id) === String(pkg.id)
          );
          return !wasUpgraded;
        });
        const total = visibleForInvestment.reduce((sum, p) => sum + (p.amount || 0), 0);
        setTotalInvestment(total);
      } catch (err: any) {
        console.error('Error fetching packages:', err);
        // Don't set error, just log it
      }
    };
    fetchPackages();
  }, []);

  // Check for package alerts and add to messages
  const [packageAlert, setPackageAlert] = useState<{ hasAlert: boolean; message: string }>({ hasAlert: false, message: '' });
  
  // State for expired package countdown (30 days FOMO timer)
  const [expiredPackageCountdown, setExpiredPackageCountdown] = useState<{
    show: boolean;
    targetDate: Date | null;
  }>({ show: false, targetDate: null });
  
  // Phase 1: Account-level FOMO banner (no active package)
  const [showNoActivePackageWarning, setShowNoActivePackageWarning] = useState(false);
  
  useEffect(() => {
    const checkPackages = async () => {
      try {
        const packagesData = await getMyPackages();
        const alert = checkPackageAlerts(packagesData.items);
        
        // Check for expired packages and renewal window first (needed for both countdown and packageAlert)
        // Package is expired if: is_active is false (API sets is_active=false when income >= 2x amount)
        // IMPORTANT: Filter out expired packages that were upgraded (same logic as My Packages page)
        const expiredPackages = packagesData.items.filter(pkg => {
          // Always include active packages (for other checks)
          if (pkg.is_active) return false; // Not expired
          
          // For expired packages, check if they were upgraded using exact previous_purchase_id match
          // This ensures countdown doesn't show for upgraded expired packages
          const wasUpgraded = packagesData.items.some(otherPkg => {
            if (!otherPkg.is_active) return false;
            if (!otherPkg.previous_purchase_id) return false;
            
            // Compare as strings to ensure exact match
            const match = String(otherPkg.previous_purchase_id) === String(pkg.id);
            
            if (match) {
              console.log(`🔍 Dashboard: Match found - Active package ${otherPkg.id} has previous_purchase_id=${otherPkg.previous_purchase_id} matching expired package ${pkg.id}`);
            }
            
            return match;
          });
          
          if (wasUpgraded) {
            console.log(`🚫 Dashboard: Excluding expired package ${pkg.id} from countdown - upgraded to active package (previous_purchase_id match)`);
            return false; // Don't include upgraded expired packages
          }
          
          return true; // Include non-upgraded expired packages
        });
        
        // Check if user has any active packages (is_active === true)
        const hasActivePackages = packagesData.items.some(pkg => pkg.is_active === true);
        
        // Check if user has any expired package with an active renewal window (has renewal_countdown in future)
        const hasRenewableExpired = expiredPackages.some(pkg => {
          if (!pkg.renewal_countdown?.renewal_deadline) return false;
          const deadlineTime = new Date(pkg.renewal_countdown.renewal_deadline).getTime();
          return deadlineTime > Date.now();
        });
        
        // Phase 1: Show account-level warning ONLY when:
        // - User has NO active packages
        // - AND user has NO renewable expired packages (no active renewal window)
        setShowNoActivePackageWarning(!hasActivePackages && !hasRenewableExpired);
        
        // Package renewal alert on dashboard: only when renewal window is still open OR high progress
        // (If countdown complete / renew window closed, do not show on dashboard)
        const showRenewalAlert = (alert.hasExpired && hasRenewableExpired) || alert.hasHighProgress;
        if (showRenewalAlert) {
          const message = getPackageAlertMessage(alert);
          setPackageAlert({ hasAlert: true, message });
        } else {
          setPackageAlert({ hasAlert: false, message: '' });
        }
        
        console.log('🔍 Package countdown check:', {
          totalPackages: packagesData.items.length,
          expiredPackages: expiredPackages.length,
          hasActivePackages,
          allPackages: packagesData.items.map(p => ({
            id: p.id,
            is_active: p.is_active,
            status: p.status,
            previous_purchase_id: p.previous_purchase_id,
            // active_until removed - expiry is ONLY based on 2x income
            purchased_at: p.purchased_at,
          })),
          expiredPackagesDetails: expiredPackages.map(p => ({
            id: p.id,
            is_active: p.is_active,
            status: p.status,
            previous_purchase_id: p.previous_purchase_id,
            // active_until removed - expiry is ONLY based on 2x income
            purchased_at: p.purchased_at,
          })),
          note: 'Expired packages that were upgraded (have matching previous_purchase_id in active packages) are excluded from countdown'
        });
        
        // Show countdown if user has at least one expired package
        // Use renewal_countdown.renewal_deadline from API (same as My Packages page)
        if (expiredPackages.length > 0) {
          // Find expired package with renewal_countdown (prefer most recent)
          // Sort by purchased_at desc to get most recent first
          const sortedExpired = [...expiredPackages].sort((a, b) => {
            const dateA = new Date(a.purchased_at).getTime();
            const dateB = new Date(b.purchased_at).getTime();
            return dateB - dateA;
          });

          // Find first expired package that has renewal_countdown
          let renewalDeadline: Date | null = null;
          let selectedPackage = null;

          for (const pkg of sortedExpired) {
            if (pkg.renewal_countdown?.renewal_deadline) {
              renewalDeadline = new Date(pkg.renewal_countdown.renewal_deadline);
              selectedPackage = pkg;
              break;
            }
          }

          if (renewalDeadline) {
            const now = new Date();
            const nowTime = now.getTime();
            const deadlineTime = renewalDeadline.getTime();
            const daysRemaining = Math.ceil((deadlineTime - nowTime) / (1000 * 60 * 60 * 24));
            const isRenewWindowOpen = deadlineTime > nowTime;
            
            if (process.env.NODE_ENV === 'development') {
              console.log('📅 Dashboard countdown (using API renewal_deadline):', {
                selectedPackage: {
                  id: selectedPackage?.id,
                  package_name: selectedPackage?.package_name,
                },
                renewal_deadline: renewalDeadline.toISOString(),
                now: now.toISOString(),
                daysRemaining,
                isRenewWindowOpen,
              });
            }
            
            // Show countdown ONLY when renewal window is still open (deadline in future)
            // Once "Time's Up" / countdown complete, do not show on dashboard
            if (isRenewWindowOpen) {
              setExpiredPackageCountdown({
                show: true,
                targetDate: renewalDeadline,
              });
              console.log('✅ Countdown timer WILL BE SHOWN (synced with My Packages)', {
                renewalDeadline: renewalDeadline.toISOString(),
                daysRemaining,
              });
            } else {
              setExpiredPackageCountdown({ show: false, targetDate: null });
              console.log('❌ Countdown hidden - renew window closed (Time\'s Up)', {
                renewalDeadline: renewalDeadline.toISOString(),
              });
            }
          } else {
            // No renewal_countdown found in API response (shouldn't happen, but handle gracefully)
            console.warn('⚠️ No renewal_countdown found in expired packages', {
              expiredPackages: expiredPackages.map(p => ({
                id: p.id,
                has_renewal_countdown: !!p.renewal_countdown,
              })),
            });
            setExpiredPackageCountdown({ show: false, targetDate: null });
          }
        } else {
          // No expired packages, hide countdown
          setExpiredPackageCountdown({ show: false, targetDate: null });
          console.log('❌ Countdown hidden - no expired packages', {
            expiredPackagesCount: expiredPackages.length,
            hasActivePackages,
          });
        }
      } catch (err) {
        console.error('Error checking package alerts:', err);
      }
    };
    checkPackages();
  }, []);

  // Fetch max qualified level, rank, and profile photo
  useEffect(() => {
    const fetchUserData = async () => {
      if (user?.id) {
        try {
          // Fetch level, rank, and profile in parallel
          const [levelInfo, position, profile] = await Promise.all([
            getMaxQualifiedLevel(user.id).catch(() => null),
            getMyPosition().catch(() => null),
            getUserProfile().catch(() => null),
          ]);
          
          setMaxLevel(levelInfo);
          
          // Get rank from top_earners leaderboard
          if (position?.leaderboards?.top_earners?.rank) {
            setUserRank(position.leaderboards.top_earners.rank);
          }
          
          // Set profile photo and update localStorage with user-specific key
          if (profile?.profile?.profile_photo_url) {
            const photoUrl = profile.profile.profile_photo_url;
            setProfilePhotoUrl(photoUrl);
            if (typeof window !== "undefined" && user?.id) {
              localStorage.setItem(`profilePhoto_${user.id}`, photoUrl);
            }
          }
        } catch (err) {
          console.error('Error fetching user data:', err);
          setMaxLevel(null);
          setUserRank(null);
        }
      }
    };
    fetchUserData();
  }, [user?.id]);

  // Convert API notices to DashboardMessage format
  const messages: DashboardMessage[] = useMemo(() => {
    const noticeMessages = notices.map((notice) => {
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
      
      return {
        id: `notice-${notice.id}`,
        type,
        title: notice.title,
        message: messageText,
        linkText,
        linkUrl,
      dismissible: true,
      };
    });

    // Add package renewal alert if needed
    if (packageAlert.hasAlert) {
      noticeMessages.unshift({
        id: 'package-renewal-alert',
        type: 'renew',
        title: 'Package Renewal Required',
        message: packageAlert.message,
        linkText: 'Go to My Packages',
        linkUrl: '/my-course',
        dismissible: true,
      });
    }

    return noticeMessages;
  }, [notices, packageAlert]);

  const visibleMessages = messages.filter(
    (msg) => !dismissedMessages.has(msg.id),
  );

  const handleDismiss = (messageId: string) => {
    setDismissedMessages((prev) => new Set(prev).add(messageId));
  };

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

  // Team Business Breakdown data from API (already fetched in useEffect)

  // Commission Trend data from API (already fetched in useEffect)

  const currentTeamData = teamBusinessData[teamLevel];

  // Calculate Expected Amount: (Global + Self) / 10000
  const globalAmount = dashboardStats?.commission_by_type.GLOBAL_HELPING || 0;
  const selfAmount = (dashboardStats?.commission_by_type.SELF || 0) + 
                     (dashboardStats?.commission_by_type.SPOT || 0) + 
                     (dashboardStats?.direct_referral_commission || 0);
  const expectedAmount = (globalAmount + selfAmount) / 10000;
  const targetAmount = 10000; // Target amount to complete
  const currentTotal = globalAmount + selfAmount;
  const remainingAmount = Math.max(0, targetAmount - currentTotal);
  const progressPercentage = Math.min(100, (currentTotal / targetAmount) * 100);

  // Calculate expected days to complete (based on average daily growth)
  // Mock: Assuming average daily growth of ₹50-100
  const averageDailyGrowth = 75; // This can be calculated from historical data
  const expectedDaysToComplete =
    remainingAmount > 0 ? Math.ceil(remainingAmount / averageDailyGrowth) : 0;

  // Calculate target date for countdown (based on expected days)
  const targetDate = useMemo(() => {
    if (remainingAmount <= 0) return null;
    const date = new Date();
    date.setDate(date.getDate() + expectedDaysToComplete);
    return date;
  }, [remainingAmount, expectedDaysToComplete]);

  const colors = {
    spot_income: "#10b981", // emerald-500 (green)
    monthly_royalty: "#2563eb", // blue-600 (primary)
  };

  // Transform banners for carousel (use API data if available, otherwise fallback to empty)
  const carouselItems = banners.length > 0
    ? banners.map(banner => ({
        image_url: banner.image_url,
        link: banner.link,
      }))
    : [];

  // Format currency
  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Calculate monetary loss for IDs that joined after cap
  // Formula: new_ids_after_cap * GLOBAL_MONTHLY_PER_ID * (days since cap exceeded / days in current month)
  const calculateCapExceedLoss = (
    newIdsAfterCap: number,
    capExceedLoss: number | null | undefined,
    purchasedAt: string
  ): number => {
    // If backend already calculated loss, use it
    if (capExceedLoss !== null && capExceedLoss !== undefined && capExceedLoss > 0) {
      return capExceedLoss;
    }

    // Calculate loss on UI side if backend didn't calculate it
    const GLOBAL_MONTHLY_PER_ID = 6.25; // ₹6.25 per ID per month
    
    // Get days in current month
    const today = new Date();
    const daysInCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    
    // Calculate days since purchase (as proxy for days since cap exceeded)
    const purchaseDate = new Date(purchasedAt);
    const daysSincePurchase = Math.max(1, Math.floor(
      (today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24)
    ));
    
    // Calculate daily rate per ID
    const dailyPerId = GLOBAL_MONTHLY_PER_ID / daysInCurrentMonth;
    
    // Total loss = new_ids_after_cap * daily_per_id * days_since_purchase
    const calculatedLoss = newIdsAfterCap * dailyPerId * daysSincePurchase;
    
    return Math.round(calculatedLoss);
  };

  const stats = useMemo(() => {
    const globalHelping = dashboardStats?.commission_by_type.GLOBAL_HELPING || 0;
    // Total SELF commission across all packages (backend aggregates it)
    const selfCommissionAllPackages = dashboardStats?.commission_by_type.SELF || 0;
    // Total amount withdrawn from MAIN (other) wallet
    // Prefer value computed from withdrawal requests API; fall back to dashboard stats field if needed
    const mainWalletWithdrawalsValue =
      mainWalletWithdrawals || dashboardStats?.main_wallet_withdrawals || 0;
    // Total amount withdrawn from SPOT wallet (computed from withdrawal requests API)
    const spotWalletWithdrawalsValue = spotWalletWithdrawals || 0;
    // Total withdrawals from both wallets (overall work withdrawals)
    const totalWorkWithdrawalsValue =
      mainWalletWithdrawalsValue + spotWalletWithdrawalsValue;
    const teamIncomeMonthlyRoyalty = dashboardStats?.commission_by_type.MONTHLY || 0;
    const globalHelpingTeam = dashboardStats?.global_helping_team || { current: 0, total: 0 };
    const spotCommission = dashboardStats?.commission_by_type.SPOT || 0;
    const directReferral = dashboardStats?.direct_referral_commission || 0;
    const directMembers = dashboardStats?.team_stats?.direct_referrals || 0;
    const teamMembersAll = dashboardStats?.team_stats?.total_team_size || 0;
    const activeMembersAll = dashboardStats?.team_stats?.active_members || 0;
    const inactiveMembersAll = Math.max(0, teamMembersAll - activeMembersAll);

    return [
      {
        label: "Self Commission (All Packages)",
        value: formatCurrency(selfCommissionAllPackages),
        accent: "blue" as const,
        icon: Target,
        trend: "+8.2%", // TODO: Calculate from historical data
        trendUp: true,
      },
      {
        label: "Global Helping Commission (All Packages)",
        value: formatCurrency(globalHelping),
        accent: "blue" as const,
        icon: Globe,
        trend: "+12.5%", // TODO: Calculate from historical data
        trendUp: true,
      },
      {
        label: "Self+Global Withdrwals",
        value: formatCurrency(mainWalletWithdrawalsValue),
        accent: "blue" as const,
        icon: Wallet,
        trend: "+8.2%", // TODO: Calculate from historical data
        trendUp: true,
      },
      {
        label: "Team & Direct monthly royalties",
        value: formatCurrency(teamIncomeMonthlyRoyalty),
        accent: "blue" as const,
        icon: Wallet,
        trend: "+5.1%", // TODO: Calculate from historical data
        trendUp: true,
      },
      {
        label: "Spot Commission (Direct & Level)",
        value: formatCurrency(spotCommission),
        accent: "blue" as const,
        icon: Sparkles,
        trend: "+5.1%", // TODO: Calculate from historical data
        trendUp: true,
      },
      {
        label: "Spot Wallet Withdrawals",
        value: formatCurrency(spotWalletWithdrawalsValue),
        accent: "blue" as const,
        icon: ArrowDownToLine,
        trend: "+3.4%", // TODO: Calculate from historical data or history
        trendUp: true,
      },
      {
        label: "Direct Members (All)",
        value: directMembers.toLocaleString("en-IN"),
        accent: "blue" as const,
        icon: Users,
        trend: "+0.0%", // TODO: Calculate from historical data (e.g., new directs)
        trendUp: true,
      },
      {
        label: "Team Members (All)",
        value: teamMembersAll.toLocaleString("en-IN"),
        accent: "blue" as const,
        icon: Users,
        trend: "+0.0%", // TODO: Calculate from historical data
        trendUp: true,
      },
      {
        label: "Active Members (All)",
        value: activeMembersAll.toLocaleString("en-IN"),
        accent: "blue" as const,
        icon: Users,
        trend: "+0.0%", // TODO: Calculate from historical data
        trendUp: true,
      },
      {
        label: "Inactive Members (All)",
        value: inactiveMembersAll.toLocaleString("en-IN"),
        accent: "red" as const,
        icon: Users,
        trend: "+0.0%", // TODO: Calculate from historical data
        trendUp: false,
      },
      {
        label: "Total Work Withdrawals",
        value: formatCurrency(totalWorkWithdrawalsValue),
        accent: "blue" as const,
        icon: ArrowDownToLine,
        trend: "+0.0%", // TODO: Calculate from historical data
        trendUp: true,
      },
    ];
  }, [dashboardStats, mainWalletWithdrawals, spotWalletWithdrawals]);

  const actionCards = [
    {
      title: "Buy More",
      text: "Grow your portfolio by investing in new packages and unlock higher earning potential.",
      btn: "Buy More",
      variant: "primary" as const,
      icon: CreditCard,
      gradient: "from-blue-500 to-blue-600",
      href: "/add-balance",
    },
    {
      title: "New Notice",
      text: "Click to view notice details.",
      btn: "View Notice Details",
      variant: "warning" as const,
      icon: Bell,
      gradient: "from-amber-400 to-amber-500",
      badge: "New",
      href: "/notifications",
    },
    {
      title: "Withdrawal Commission",
      text: "Start the process to withdraw your available balance.",
      btn: "Withdraw Now",
      variant: "danger" as const,
      icon: ArrowDownToLine,
      gradient: "from-red-500 to-red-600",
      href: "/withdraw/spot-withdraw-request?new=1",
    },
  ];

  // Show loading state
  if (isLoading) {
    return (
      <div className="max-w-[1300px] mx-auto p-4 md:p-5 animate-in fade-in duration-200 bg-(--content-bg) min-h-screen transition-colors">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="max-w-[1300px] mx-auto p-4 md:p-5 animate-in fade-in duration-200 bg-(--content-bg) min-h-screen transition-colors">
        <Card className="p-6 border-red-200 bg-red-50">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Error loading dashboard</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[1300px] mx-auto p-4 md:p-5 animate-in fade-in duration-200 bg-(--content-bg) min-h-screen transition-colors">
      {/* Phase 1: Account-level FOMO banner when user has NO active or renewable packages */}
      {showNoActivePackageWarning && (
        <Card className="mb-4 border-2 border-amber-500 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                  <h3 className="text-lg font-bold text-amber-700">
                    ⚠️ No Active Package
                  </h3>
                </div>
                <p className="text-sm text-[var(--text-muted)] mb-3">
                  Aapke paas abhi koi active package nahi hai. Naya package purchase karke hi aapki earnings aur benefits continue rahenge.
                  Jaldi se package khariden aur apna account fully active rakhein.
                </p>
                <div className="flex items-center gap-2">
                  <Link
                    href="/my-course"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-colors shadow-md"
                  >
                    <CreditCard className="h-4 w-4" />
                    Buy Package Now
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}
      
      {/* Expired Package Countdown Timer - Show at top if package expired */}
      {expiredPackageCountdown.show && expiredPackageCountdown.targetDate && (
        <Card className="mb-4 border-2 border-red-500 bg-gradient-to-r from-red-500/10 via-red-500/5 to-red-500/10 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                  <h3 className="text-lg font-bold text-red-600">
                    ⚠️ Package Expired - Renew Now!
                  </h3>
                </div>
                <p className="text-sm text-[var(--text-muted)] mb-3">
                  Aapka package expire ho gaya hai. 30 din ke andar renew karein warna aapke benefits loss ho sakte hain. 
                  Jaldi se package renew karke apni earnings continue rakhein!
                </p>
                <div className="flex items-center gap-2">
                  <Link
                    href="/my-course"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors shadow-md"
                  >
                    <CreditCard className="h-4 w-4" />
                    Renew Package Now
                  </Link>
                </div>
              </div>
              <div className="shrink-0">
                <CountdownTimer
                  targetDate={expiredPackageCountdown.targetDate}
                  label="Time Remaining to Renew"
                  format="full"
                  showIcon={true}
                  className="min-w-[280px]"
                />
              </div>
            </div>
          </div>
        </Card>
      )}
      
      {/* Dashboard Messages */}
      {visibleMessages.length > 0 && (
        <div className="mb-4 space-y-2">
          {visibleMessages.map((msg) => {
            const styles = getMessageStyles(msg.type);
            const Icon = styles.icon;
            return (
              <Card
                key={msg.id}
                className={`${styles.bg} border-l-4 ${styles.text} p-3 relative`}
              >
                {msg.dismissible && (
                  <button
                    onClick={() => handleDismiss(msg.id)}
                    className="absolute top-2 right-2 text-(--text-muted) hover:text-(--text-strong) transition-colors duration-200"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <div className="flex items-start gap-2 pr-6">
                  <Icon
                    className={`h-4 w-4 ${styles.iconColor} mt-0.5 shrink-0`}
                  />
                  <div className="flex-1">
                    <h4 className="font-bold text-sm mb-0.5">{msg.title}</h4>
                    <p className="text-xs leading-relaxed mb-2">
                      {msg.message}
                      {msg.invoiceId && (
                        <span
                          className={
                            msg.type === "renew"
                              ? "text-red-600 dark:text-red-400"
                              : styles.text
                          }
                        >
                          {" "}
                          (Invoice ID: {msg.invoiceId})
                        </span>
                      )}
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
      )}

      {/* Header and ID/Credit */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 md:gap-5 mb-7">
        <Card className="p-5 hover:shadow-md transition-shadow duration-300 group overflow-hidden bg-gradient-to-br from-(--card-bg) via-(--card-bg) to-blue-500/5">
          <div className="flex items-center gap-4 flex-wrap">
            {profilePhotoUrl ? (
              <Avatar
                src={profilePhotoUrl}
                alt={user?.name || "User"}
                size={56}
                className="border-2 border-blue-500/30 shadow-md group-hover:scale-105 transition-transform shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 border-2 border-blue-500/30 flex items-center justify-center font-extrabold text-white shadow-md group-hover:scale-105 transition-transform shrink-0">
                <User className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap gap-y-1">
                <h2 className="m-0 text-xl font-extrabold text-blue-600 truncate">
                  {user?.display_id || (user?.id ? `SIA${String(parseInt(user.id) || 0).padStart(5, '0')}` : 'SIA00000')}
                </h2>
                {userRank != null && (
                  <span className="rounded-full bg-blue-500 px-2.5 py-0.5 text-xs font-bold text-white whitespace-nowrap shrink-0">
                    Rank #{userRank}
                  </span>
                )}
                {maxLevel && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 pl-1.5 pr-2.5 py-0.5 text-xs font-bold text-zinc-900 dark:text-zinc-900 whitespace-nowrap shrink-0">
                    <img
                      src={getLevelRankIcon(maxLevel.level)}
                      alt=""
                      width={20}
                      height={20}
                      className="h-5 w-5 object-contain shrink-0"
                    />
                    {maxLevel.title} (Level {maxLevel.level})
                  </span>
                )}
              </div>
              <p className="m-0 mt-0.5 text-sm font-medium text-(--text-strong) flex items-center gap-2 flex-wrap min-w-0">
                <span className="min-w-0 truncate">{user?.name || "N/A"}</span>
                {user?.display_title && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border-2 border-emerald-400/80 bg-emerald-500/95 dark:bg-emerald-600 pl-2 pr-2.5 py-1.5 text-xs font-semibold text-white shadow-md max-w-full min-w-0 overflow-hidden" style={{ boxShadow: "0 0 12px rgba(16, 185, 129, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)" }}>
                    <span className="font-semibold truncate min-w-0" title={user.display_title}>{user.display_title}</span>
                    {(user?.display_title_icon_url && !titleIconError) ? (
                      <img
                        src={user.display_title_icon_url}
                        alt=""
                        width={24}
                        height={24}
                        className="h-5 w-5 sm:h-6 sm:w-6 object-contain shrink-0 rounded"
                        style={{ transform: "translateZ(0)" }}
                        referrerPolicy="no-referrer"
                        onError={() => setTitleIconError(true)}
                      />
                    ) : user?.display_title_icon_url && titleIconError ? (
                      <span className="h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center shrink-0 text-[10px] bg-white/25 rounded" title="Icon could not load">◆</span>
                    ) : null}
                  </span>
                )}
              </p>
              {totalInvestment > 0 && (
                <p className="m-0 mt-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400">
                  Total Investment: {formatCurrency(totalInvestment)}
                </p>
              )}
            </div>
          </div>
          {dashboardStats?.team_stats && (
            <div className="mt-4 pt-4 border-t border-(--border)">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-(--text-muted) mb-2">
                At a glance
              </p>
              <div className="flex rounded-lg bg-(--sidebar-bg) dark:bg-black/20 p-3 gap-0">
                <div className="flex-1 text-center min-w-0">
                  <p className="text-2xl font-bold text-(--text-strong) tabular-nums m-0">{dashboardStats.team_stats.direct_referrals ?? 0}</p>
                  <p className="text-[10px] uppercase text-(--text-muted) m-0 mt-0.5">Direct</p>
                </div>
                <div className="w-px bg-(--border) shrink-0" />
                <div className="flex-1 text-center min-w-0">
                  <p className="text-2xl font-bold text-(--text-strong) tabular-nums m-0">{dashboardStats.team_stats.total_team_size ?? 0}</p>
                  <p className="text-[10px] uppercase text-(--text-muted) m-0 mt-0.5">Team</p>
                </div>
                <div className="w-px bg-(--border) shrink-0" />
                <div className="flex-1 text-center min-w-0">
                  <p className="text-2xl font-bold text-(--text-strong) tabular-nums m-0">{dashboardStats.team_stats.active_members ?? 0}</p>
                  <p className="text-[10px] uppercase text-(--text-muted) m-0 mt-0.5">Active</p>
                </div>
              </div>
            </div>
          )}
        </Card>
        <Card className="flex flex-col min-h-[110px] p-6 bg-linear-to-br from-(--card-bg) via-blue-500/10 to-blue-500/20 border-l-4 border-l-blue-600 hover:shadow-md transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full -mr-10 -mt-10"></div>
          <p className="uppercase text-[12px] font-bold tracking-[.06em] text-(--text-muted) mb-1">
            Total Balance
          </p>
          <p className="text-[26px] font-black text-green-500">
            {walletBalance ? formatCurrency(walletBalance.balance) : "₹0.00"}
          </p>
          {walletBalance && (
            <div className="mt-4 w-full space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-(--text-muted) border-b border-(--border) pb-1.5">
                Wallet breakdown
              </p>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-(--text-muted)">SPOT</span>
                  <span className="font-semibold text-(--text-strong) tabular-nums">{formatCurrency(walletBalance.spot_balance)}</span>
                </div>
                {(walletBalance.spot_locked_hold ?? 0) > 0 && (
                  <div className="rounded-lg bg-amber-500/15 dark:bg-amber-500/20 border border-amber-400/40 px-2.5 py-2 text-xs text-amber-700 dark:text-amber-200">
                    <span className="font-medium">10-day hold:</span> {formatCurrency(walletBalance.spot_locked_hold ?? 0)} locked.{" "}
                    <span className="font-semibold">
                      Withdrawable: {formatCurrency(walletBalance.available_spot_balance ?? 0)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center gap-2">
                  <span className="text-(--text-muted)">Main</span>
                  <span className="font-semibold text-(--text-strong) tabular-nums">{formatCurrency(walletBalance.other_balance)}</span>
                </div>
                {(walletBalance.main_locked_hold ?? 0) > 0 && (
                  <div className="rounded-lg bg-amber-500/15 dark:bg-amber-500/20 border border-amber-400/40 px-2.5 py-2 text-xs text-amber-700 dark:text-amber-200">
                    <span className="font-medium">90-day lock (Reinvestment SELF + Global):</span> {formatCurrency(walletBalance.main_locked_hold ?? 0)} locked.{" "}
                    <span className="font-semibold">
                      Withdrawable: {formatCurrency(walletBalance.available_main_balance ?? walletBalance.other_balance)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center gap-2">
                  <span className="text-(--text-muted)">Team Royalty</span>
                  <span className="font-semibold text-(--text-strong) tabular-nums">{formatCurrency(walletBalance.team_royalty_balance ?? 0)}</span>
                </div>
              </div>
              {typeof walletBalance.spot_team_withdraw_limit === "number" && walletBalance.spot_team_withdraw_limit > 0 && (
                <div className="pt-2 mt-2 border-t border-(--border) border-dashed text-xs">
                  <p className="text-(--text-muted) mb-0.5">{walletBalance.spot_team_withdraw_multiplier ?? 10}× withdrawal limit</p>
                  <p className="font-medium">
                    <span className="text-red-400 dark:text-red-400">{formatCurrency(walletBalance.spot_team_withdraw_remaining ?? 0)}</span>
                    <span className="text-(--text-muted)"> remaining of </span>
                    <span className="text-(--text-strong)">{formatCurrency(walletBalance.spot_team_withdraw_limit)}</span>
                  </p>
                </div>
              )}
              {((walletBalance.spot_team_withdraw_limit ?? 0) === 0 && (walletBalance.spot_team_withdraw_remaining ?? 0) === 0) &&
                ((walletBalance.spot_balance ?? 0) > 0 || (walletBalance.team_royalty_balance ?? 0) > 0) && (
                <div className="pt-2 mt-2 border-t border-(--border) border-dashed">
                  <div className="rounded-lg bg-amber-500/15 dark:bg-amber-500/20 border border-amber-400/40 px-2.5 py-2 text-xs text-amber-700 dark:text-amber-200">
                    <p className="font-semibold mb-0.5">Spot / Team Royalty withdraw ke liye</p>
                    <p className="mb-0">Active package zaroori hai. Aapka package expire ho chuka hai — <strong>My Packages</strong> se renew karein, tab hi Spot/Team Royalty se withdraw kar paayenge.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Carousel */}
      {carouselItems.length > 0 && (
        <div className="mb-7">
          <Carousel items={carouselItems} autoPlayInterval={5000} />
        </div>
      )}

      {/* Commission Payout Schedule – withdrawal dates + 10× limit & flush note */}
      <Card className="mb-7 p-6 hover:shadow-lg transition-shadow duration-300 bg-linear-to-br from-(--card-bg) via-slate-500/5 to-slate-500/10 border-l-4 border-l-slate-500">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-linear-to-br from-slate-500 to-slate-600 flex items-center justify-center shadow-lg">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <H3 className="mb-0 text-slate-600 dark:text-slate-400">Commission Payout Schedule</H3>
        </div>
        <p className="text-sm text-(--text-muted) mb-4">
          SPOT &amp; Team Royalty: 10th, 20th and 30th of each month (28th in February). Main wallet: 30th of each month (28th in February).
        </p>
        {typeof walletBalance?.spot_team_withdraw_limit === "number" && walletBalance.spot_team_withdraw_limit > 0 && (
          <div className="space-y-3">
            {(walletBalance.spot_team_withdraw_remaining ?? 0) === 0 && !walletBalance.spot_team_flush_active && (
              <div className="p-3 bg-red-500/10 border border-red-400/30 rounded-lg text-sm text-red-200">
                <p className="font-semibold mb-1">⚠️ 10× Limit Exhausted</p>
                <p className="mb-1">{walletBalance.spot_team_withdraw_multiplier ?? 10}× limit poora use ho gaya. Spot/Team Royalty se aur withdraw nahi kar sakte.</p>
                <p className="mb-1">
                  <strong>15 din ke andar upgrade nahi kiya to:</strong> 15 din ke baad aane wali saari nayi Spot/Team Royalty income wallet balance mei add nahi hogi (flush mode). Jo abhi Spot/Team Royalty wallet mei amount hai, wo safe rahega lekin withdraw sirf upgrade ke baad possible hoga.
                </p>
                <CountdownTimer
                  targetDate={new Date(
                    (walletBalance.spot_team_limit_reached_at
                      ? new Date(walletBalance.spot_team_limit_reached_at)
                      : new Date()
                    ).getTime() +
                      15 * 24 * 60 * 60 * 1000
                  )}
                  label="Flush mode start hone tak bacha hua time"
                  format="compact"
                  showIcon={false}
                  className="mt-1"
                  textClassName="text-red-200 text-base font-semibold"
                />
                <p className="text-xs mt-1">Package upgrade karein taake naya 10× cycle start ho aur Spot/Team Royalty withdraw phir se allow ho.</p>
              </div>
            )}
            {(walletBalance.spot_team_withdraw_remaining ?? 0) > 0 && (walletBalance.spot_team_withdraw_remaining ?? 0) < 1000 && (
              <div className="p-3 bg-amber-500/10 border border-amber-400/30 rounded-lg text-sm text-amber-200">
                <p className="font-semibold mb-1">⚠️ Limit Almost Exhausted</p>
                <p className="text-xs">
                  Limit khatam hone ke baad agar 15 din ke andar upgrade nahi kiya to 15 din ke baad aane wali saari nayi Spot/Team Royalty income wallet mei add nahi hogi, jab tak upgrade nahi karte.
                </p>
              </div>
            )}
          </div>
        )}
        {((walletBalance?.spot_team_withdraw_limit ?? 0) === 0) &&
          ((walletBalance?.spot_balance ?? 0) > 0 || (walletBalance?.team_royalty_balance ?? 0) > 0) && (
          <div className="p-3 bg-amber-500/10 border border-amber-400/30 rounded-lg text-sm text-amber-200">
            <p className="font-semibold mb-1">⚠️ Spot/Team Royalty withdraw ke liye active package zaroori</p>
            <p className="mb-0 text-xs">Aapka package expire ho chuka hai, isliye Spot aur Team Royalty se ab withdraw nahi ho sakta. <strong>My Packages</strong> se package renew karein — renew ke baad naya 10× cycle start hoga aur aap in wallets se withdraw kar paayenge.</p>
          </div>
        )}
      </Card>

      {/* Courses Redirect Card */}
      <Card className="mb-7 p-6 hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-blue-500/10 border-l-4 border-l-purple-600 cursor-pointer group" onClick={() => window.open('https://app.secureinfiniteassociation.com/', '_blank')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-purple-600 mb-1 group-hover:text-purple-700 transition-colors">
                Access Your Courses
              </h3>
              <p className="text-sm text-[var(--text-muted)] mb-2">
                Click here to access all your enrolled courses and start learning
              </p>
              <div className="flex items-center gap-2 text-purple-600 font-semibold text-sm">
                <span>Go to Courses</span>
                <ExternalLink className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
              </div>
            </div>
          </div>
          <div className="hidden md:block">
            <BookOpen className="w-12 h-12 text-purple-500/30 group-hover:text-purple-500/50 transition-colors" />
          </div>
        </div>
      </Card>

      {/* KPI Grid */}
      <div className="grid gap-4 md:gap-5 mb-7 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat, i) => (
          <EnhancedStatCard
            key={i}
            label={stat.label}
            value={stat.value}
            accent={stat.accent}
            icon={stat.icon}
            trend={stat.trend}
            trendUp={stat.trendUp}
          />
        ))}
      </div>

      {/* Global Helping Team & 2x Progress Card */}
      <Card className="mb-7 p-6 hover:shadow-lg transition-shadow duration-300 bg-linear-to-br from-(--card-bg) via-blue-500/10 to-blue-500/20 border-l-4 border-l-blue-600">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
            <Target className="w-5 h-5 text-white" />
          </div>
          <H3 className="mb-0 text-blue-500">Package Progress</H3>
        </div>

        {packages.length === 0 ? (
          <div className="text-center py-8 text-(--text-muted)">
            <p>No active packages found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {packages.map((pkg) => {
              const globalIdsInfo = pkg.global_ids_info;
              const twoXTarget = pkg.amount * 2;
              const currentIncome = pkg.income || 0;
              const remainingFor2x = Math.max(0, twoXTarget - currentIncome);
              const progress2x = twoXTarget > 0 ? (currentIncome / twoXTarget) * 100 : 0;
              
              // Calculate estimated days to 2x (assuming average daily income from self + global helping)
              // Rough estimate: if package earns ~0.5% daily, it would take ~200 days for 2x
              // But we'll calculate based on actual daily rate if available
              const estimatedDailyRate = pkg.amount * 0.005; // Rough estimate: 0.5% daily
              const estimatedDaysTo2x = estimatedDailyRate > 0 ? Math.ceil(remainingFor2x / estimatedDailyRate) : 0;

              return (
                <div
                  key={pkg.id}
                  className="p-4 rounded-lg border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-bold text-base text-(--text-strong) mb-1">
                        {pkg.package_name || `Package #${pkg.package_id}`}
                      </h4>
                      <p className="text-xs text-(--text-muted)">
                        Purchased: {new Date(pkg.purchased_at).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
              })}
            </p>
          </div>
                    <Badge tone={pkg.is_active ? "green" : "red"} className="text-xs">
                      {pkg.is_active ? "Active" : "Expired"}
                    </Badge>
          </div>

                  {/* Global IDs Info */}
                  {globalIdsInfo && (
                    <div className={`mb-3 p-3 rounded border ${
                      globalIdsInfo.is_cap_reached
                        ? 'bg-amber-500/10 border-amber-500/20'
                        : 'bg-emerald-500/10 border-emerald-500/20'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-emerald-600" />
                        <span className={`text-sm font-semibold ${
                          globalIdsInfo.is_cap_reached
                            ? 'text-amber-700 dark:text-amber-300'
                            : 'text-emerald-700 dark:text-emerald-300'
                        }`}>
                          Global Helping Team
                        </span>
        </div>
                      {globalIdsInfo.is_cap_reached ? (
                        <div className="text-xs space-y-1 text-amber-700 dark:text-amber-300">
                          <div>
                            Used: <span className="font-bold">{globalIdsInfo.used_ids}</span> / {globalIdsInfo.package_cap}
                          </div>
                          <div className="text-red-600 dark:text-red-400 font-semibold">
                            Today inactive: {globalIdsInfo.inactive_global_contributors ?? 0}
                          </div>
                          <div className="font-semibold text-red-600 dark:text-red-400">
                            Cap Reached
                            {globalIdsInfo.new_ids_after_cap !== null && globalIdsInfo.new_ids_after_cap !== undefined && (
                              <div>
                                Loss: ID-{globalIdsInfo.new_ids_after_cap}/Income({calculateCapExceedLoss(globalIdsInfo.new_ids_after_cap, globalIdsInfo.cap_exceed_loss, pkg.purchased_at)})
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs space-y-1 text-emerald-700 dark:text-emerald-300">
                          <div>
                            Used: <span className="font-bold">{globalIdsInfo.used_ids}</span> / {globalIdsInfo.package_cap}
                          </div>
                          <div>
                            Remaining: <span className="font-bold">{globalIdsInfo.remaining_ids}</span> IDs
                          </div>
                          <div className="text-red-600 dark:text-red-400 font-semibold">
                            Today inactive: {globalIdsInfo.inactive_global_contributors ?? 0}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2x Progress */}
                  <div className="p-3 rounded bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                        2x Income Progress
              </span>
            </div>
                    <div className="mb-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-(--text-muted)">
                          Current: {formatCurrency(currentIncome)}
                        </span>
                        <span className="text-(--text-muted)">
                          Target: {formatCurrency(twoXTarget)}
                        </span>
                      </div>
                      <ProgressBar
                        value={currentIncome}
                        max={twoXTarget}
                        showValue={false}
                        size="sm"
                        color="blue"
                        className="mb-1"
            />
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-600 font-semibold">
                          {progress2x.toFixed(1)}% Complete
                        </span>
                        {remainingFor2x > 0 && (
                          <span className="text-(--text-muted)">
                            Remaining: {formatCurrency(remainingFor2x)}
                          </span>
                        )}
          </div>
            </div>
                    {progress2x >= 100 && (
                      <div className="mt-2 text-xs text-emerald-600 font-semibold">
                        ✅ 2x Target Reached!
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Charts */}
      <div className="grid gap-5 md:gap-7 mb-10 grid-cols-1 lg:grid-cols-2">
        <Card className="min-h-[300px] md:min-h-[350px] p-4 md:p-7 hover:shadow-lg transition-shadow duration-300">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            <H3 className="mb-0">Team Business Breakdown</H3>
          </div>
          <div className="mb-3">
            <Tabs
              value={teamLevel}
              onChange={(v) =>
                setTeamLevel(v as "Direct" | "Level-1" | "Level-2" | "Level-3")
              }
              items={[
                { value: "Direct", label: "Direct" },
                { value: "Level-1", label: "Level-1" },
                { value: "Level-2", label: "Level-2" },
                { value: "Level-3", label: "Level-3" },
              ]}
            />
          </div>
          <div className="mt-4 h-[200px] md:h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={currentTeamData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="category"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `₹${value}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  }}
                  formatter={(value: number) => [
                    `₹${value.toLocaleString("en-IN")}`,
                    "",
                  ]}
                  labelStyle={{
                    color: "#1e293b",
                    fontWeight: 600,
                    marginBottom: "4px",
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: "10px" }}
                  iconType="square"
                  formatter={(value) => {
                    if (value === "spot_income") return "Spot Income";
                    if (value === "monthly_royalty") return "Monthly Royalty";
                    return value.charAt(0).toUpperCase() + value.slice(1);
                  }}
                />
                <Bar
                  dataKey="spot_income"
                  stackId="a"
                  fill={colors.spot_income}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="monthly_royalty"
                  stackId="a"
                  fill={colors.monthly_royalty}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="min-h-[300px] md:min-h-[350px] p-4 md:p-7 hover:shadow-lg transition-shadow duration-300">
          <div className="flex items-center gap-2 mb-4">
            <LineChart className="w-5 h-5 text-purple-600" />
            <H3 className="mb-0 text-base md:text-lg">Self Commission Trend</H3>
          </div>
          <div className="flex border-b-2 border-[var(--border)] mb-3 transition-colors duration-200">
            <span className="px-3 md:px-4 py-2 text-sm md:text-[15px] font-semibold text-(--text-strong) bg-[var(--accent-blue-bg)] rounded-t-lg transition-colors duration-200">
              Last 30 Days Trend
            </span>
          </div>
          <div className="mt-4 h-[200px] md:h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={commissionTrendData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="commissionGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#9333ea" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#9333ea" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `₹${value}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  }}
                  formatter={(value: number) => [
                    `₹${value.toLocaleString("en-IN")}`,
                    "Commission",
                  ]}
                  labelStyle={{
                    color: "#1e293b",
                    fontWeight: 600,
                    marginBottom: "4px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="commission"
                  stroke="#9333ea"
                  strokeWidth={2.5}
                  fill="url(#commissionGradient)"
                  dot={{ fill: "#9333ea", r: 3 }}
                  activeDot={{ r: 5, fill: "#9333ea" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Action Strip */}
      <div className="grid gap-4 md:gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {actionCards.map((action, i) => (
          <ActionCard
            key={i}
            title={action.title}
            text={action.text}
            btn={action.btn}
            variant={action.variant}
            icon={action.icon}
            gradient={action.gradient}
            badge={action.badge}
            href={action.href}
          />
        ))}
      </div>
    </div>
  );
}
