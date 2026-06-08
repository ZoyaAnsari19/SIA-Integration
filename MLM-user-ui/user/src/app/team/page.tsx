"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { H1, Text, H3 } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { EnhancedStatCard } from "@/components/ui/EnhancedStatCard";
import { Avatar } from "@/components/ui/Avatar";
import { TreeHierarchy, TreeNode } from "@/components/TreeHierarchy";
import {
  Users,
  TrendingUp,
  DollarSign,
  UserPlus,
  Download,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { PayFirstModal } from "@/components/ui/me/PayFirstModal";
import {
  getTeam,
  getTeamStats,
  getReferrals,
  getTeamTree,
  type TeamResponse,
  type TeamStatsResponse,
  type TeamTreeResponse,
} from "@/lib/api/team";
import { getRoyaltyTrend, type RoyaltyTrendResponse } from "@/lib/api/dashboard";
import { getUserFriendlyError } from "@/lib/api/errors";
import { useAppSelector } from "@/redux/hooks";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  Cell,
} from "recharts";

type TeamStatus = "Active" | "Inactive" | "Pending";
type TeamCategory = "direct" | "level1" | "level2" | "level3" | "all" | "tree";

interface TeamMember {
  // Numeric user ID from backend (for keys, internal logic)
  id: string;
  // Human-friendly referral/display code to show in UI (e.g. SIA02047)
  displayId: string;
  name: string;
  joinedAt: string; // yyyy-mm-dd
  spotAmount: number;
  pendingSpotAmount?: number;
  lastMonthRoyalty: number;
  status: TeamStatus;
  package: "Gold" | "Platinum" | "Silver" | "Bronze" | "Basic";
  /** Total investment (sum of purchase amounts) - from API, shown on card instead of package label */
  totalInvestment?: number;
  // Tree depth relative to current user (1 = direct, 2 = level-2, etc.)
  depth: number;
  category: Exclude<TeamCategory, "all">;
}

/**
 * TODO: MOCK DATA - Replace with actual API call
 *
 * Endpoint: GET /api/team/members
 * Method: GET
 * Headers: { Authorization: "Bearer <token>" }
 * Query Parameters (optional):
 *   - category: "direct" | "level1" | "level2" | "level3" | "all"
 *   - status: "Active" | "Inactive" | "Pending" | ""
 *   - search: string (name or ID)
 *   - dateFilter: "last30" | "last90" | "thisyear" | ""
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "members": [
 *       {
 *         "id": "SIA00561",
 *         "name": "Ramesh Kumar",
 *         "joinedAt": "2025-10-30",
 *         "spotAmount": 2500,
 *         "lastMonthRoyalty": 1200,
 *         "status": "Active",
 *         "package": "Gold",
 *         "category": "direct"
 *       }
 *     ],
 *     "statistics": {
 *       "totalMembers": 10,
 *       "activeMembers": 6,
 *       "totalSpotAmount": 12000,
 *       "totalRoyalty": 6000,
 *       "newThisMonth": 2
 *     }
 *   }
 * }
 *
 * Tree Hierarchy Endpoint: GET /api/team/tree
 * Method: GET
 * Headers: { Authorization: "Bearer <token>" }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "tree": {
 *       "id": "SIA00001",
 *       "name": "You",
 *       "isCurrentUser": true,
 *       "children": [...]
 *     }
 *   }
 * }
 */
const MOCK: TeamMember[] = [
  {
    id: "SIA00561",
    displayId: "SIA00561",
    name: "Ramesh Kumar",
    joinedAt: "2025-10-30",
    spotAmount: 2500,
    lastMonthRoyalty: 1200,
    status: "Active",
    package: "Gold",
    depth: 1,
    category: "direct",
  },
  {
    id: "SIA00562",
    displayId: "SIA00562",
    name: "Priya Sharma",
    joinedAt: "2025-09-15",
    spotAmount: 1100,
    lastMonthRoyalty: 600,
    status: "Inactive",
    package: "Basic",
    depth: 2,
    category: "level1",
  },
  {
    id: "SIA00563",
    displayId: "SIA00563",
    name: "Amit Singh",
    joinedAt: "2025-11-01",
    spotAmount: 800,
    lastMonthRoyalty: 450,
    status: "Pending",
    package: "Silver",
    depth: 3,
    category: "level2",
  },
  {
    id: "SIA00564",
    displayId: "SIA00564",
    name: "Geeta Devi",
    joinedAt: "2025-10-10",
    spotAmount: 3200,
    lastMonthRoyalty: 1500,
    status: "Active",
    package: "Platinum",
    depth: 4,
    category: "level3",
  },
  {
    id: "SIA00565",
    displayId: "SIA00565",
    name: "Vikas Taneja",
    joinedAt: "2025-08-22",
    spotAmount: 500,
    lastMonthRoyalty: 250,
    status: "Inactive",
    package: "Bronze",
    depth: 1,
    category: "direct",
  },
  {
    id: "SIA00566",
    displayId: "SIA00566",
    name: "Sneha Gupta",
    joinedAt: "2025-10-25",
    spotAmount: 1050,
    lastMonthRoyalty: 520,
    status: "Active",
    package: "Silver",
    depth: 1,
    category: "direct",
  },
  {
    id: "SIA00567",
    displayId: "SIA00567",
    name: "Rajesh Patel",
    joinedAt: "2025-09-20",
    spotAmount: 1800,
    lastMonthRoyalty: 900,
    status: "Active",
    package: "Gold",
    depth: 2,
    category: "level1",
  },
  {
    id: "SIA00568",
    displayId: "SIA00568",
    name: "Meera Joshi",
    joinedAt: "2025-10-05",
    spotAmount: 2200,
    lastMonthRoyalty: 1100,
    status: "Active",
    package: "Platinum",
    depth: 3,
    category: "level2",
  },
  {
    id: "SIA00569",
    displayId: "SIA00569",
    name: "Kiran Desai",
    joinedAt: "2025-08-10",
    spotAmount: 600,
    lastMonthRoyalty: 300,
    status: "Inactive",
    package: "Basic",
    depth: 4,
    category: "level3",
  },
  {
    id: "SIA00570",
    displayId: "SIA00570",
    name: "Anjali Shah",
    joinedAt: "2025-11-05",
    spotAmount: 1500,
    lastMonthRoyalty: 750,
    status: "Pending",
    package: "Silver",
    depth: 1,
    category: "direct",
  },
];

// Helper function to generate avatar URL based on user ID
const getAvatarUrl = (userId: string): string => {
  // Use a deterministic avatar service based on user ID
  // Using UI Avatars or DiceBear for consistent avatars
  const seed = userId.replace(/[^a-zA-Z0-9]/g, "");
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
};

// Mock tree data - Current user is at level 1 (root)
const TREE_DATA: TreeNode = {
  id: "SIA00001",
  name: "You",
  isCurrentUser: true,
  children: [
    {
      id: "SIA00002",
      name: "User 1",
      avatar: getAvatarUrl("SIA00002"),
      children: [
        {
          id: "SIA00005",
          name: "User 1.1",
          avatar: getAvatarUrl("SIA00005"),
          children: [
            {
              id: "SIA00011",
              name: "User 1.1.1",
              avatar: getAvatarUrl("SIA00011"),
            },
            {
              id: "SIA00012",
              name: "User 1.1.2",
              avatar: getAvatarUrl("SIA00012"),
            },
          ],
        },
        {
          id: "SIA00006",
          name: "User 1.2",
          avatar: getAvatarUrl("SIA00006"),
          children: [
            {
              id: "SIA00013",
              name: "User 1.2.1",
              avatar: getAvatarUrl("SIA00013"),
            },
            {
              id: "SIA00014",
              name: "User 1.2.2",
              avatar: getAvatarUrl("SIA00014"),
            },
          ],
        },
      ],
    },
    {
      id: "SIA00003",
      name: "User 2",
      avatar: getAvatarUrl("SIA00003"),
      children: [
        {
          id: "SIA00007",
          name: "User 2.1",
          avatar: getAvatarUrl("SIA00007"),
          children: [
            {
              id: "SIA00015",
              name: "User 2.1.1",
              avatar: getAvatarUrl("SIA00015"),
            },
            {
              id: "SIA00016",
              name: "User 2.1.2",
              avatar: getAvatarUrl("SIA00016"),
            },
          ],
        },
        {
          id: "SIA00008",
          name: "User 2.2",
          avatar: getAvatarUrl("SIA00008"),
          children: [
            {
              id: "SIA00017",
              name: "User 2.2.1",
              avatar: getAvatarUrl("SIA00017"),
            },
            {
              id: "SIA00018",
              name: "User 2.2.2",
              avatar: getAvatarUrl("SIA00018"),
            },
          ],
        },
      ],
    },
    {
      id: "SIA00004",
      name: "User 3",
      avatar: getAvatarUrl("SIA00004"),
      children: [
        {
          id: "SIA00009",
          name: "User 3.1",
          avatar: getAvatarUrl("SIA00009"),
          children: [
            {
              id: "SIA00019",
              name: "User 3.1.1",
              avatar: getAvatarUrl("SIA00019"),
            },
            {
              id: "SIA00020",
              name: "User 3.1.2",
              avatar: getAvatarUrl("SIA00020"),
            },
          ],
        },
        {
          id: "SIA00010",
          name: "User 3.2",
          avatar: getAvatarUrl("SIA00010"),
          children: [
            {
              id: "SIA00021",
              name: "User 3.2.1",
              avatar: getAvatarUrl("SIA00021"),
            },
            {
              id: "SIA00022",
              name: "User 3.2.2",
              avatar: getAvatarUrl("SIA00022"),
            },
          ],
        },
      ],
    },
  ],
};

const COLORS = {
  Active: "#10b981",
  Inactive: "#ef4444",
  Pending: "#f59e0b",
  Gold: "#fbbf24",
  Platinum: "#a855f7",
  Silver: "#94a3b8",
  Bronze: "#cd7f32",
  Basic: "#64748b",
};

export default function Team() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TeamCategory>("direct");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | TeamStatus>("");
  const [dateFilter, setDateFilter] = useState<
    "" | "last30" | "last90" | "thisyear"
  >("");
  const [levelFilter, setLevelFilter] = useState<number | "">("");
  const [showPayFirstModal, setShowPayFirstModal] = useState(false);
  
  // API states
  const [teamData, setTeamData] = useState<TeamResponse | null>(null);
  const [teamStats, setTeamStats] = useState<TeamStatsResponse | null>(null);
  const [teamTree, setTeamTree] = useState<TeamTreeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useAppSelector((state) => state.auth.user);

  // Fetch team data
  const fetchTeamData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [team, stats, tree] = await Promise.all([
        getTeam({ max_depth: 9 }),
        getTeamStats(),
        getTeamTree(),
      ]);
      setTeamData(team);
      setTeamStats(stats);
      setTeamTree(tree);
    } catch (err: any) {
      const errorMessage = getUserFriendlyError(err);
      setError(errorMessage);
      console.error('Failed to fetch team data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
  }, []);

  // Get chart colors from CSS variables
  // Tooltip always light for better readability
  const [chartColors, setChartColors] = useState({
    grid: "#e5e7eb",
    axis: "#64748b",
    tooltipBg: "#ffffff",
    tooltipBorder: "#e5e7eb",
    tooltipText: "#1e293b",
  });

  useEffect(() => {
    const updateChartColors = () => {
      const root = document.documentElement;
      const computedStyle = getComputedStyle(root);
      setChartColors({
        grid:
          computedStyle.getPropertyValue("--chart-grid").trim() || "#e5e7eb",
        axis:
          computedStyle.getPropertyValue("--chart-axis").trim() || "#64748b",
        // Tooltip always light for better readability
        tooltipBg: "#ffffff",
        tooltipBorder: "#e5e7eb",
        tooltipText: "#1e293b",
      });
    };

    updateChartColors();

    // Listen for theme changes
    const observer = new MutationObserver(updateChartColors);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  // Convert API team data to UI format
  const allTeamMembers = useMemo(() => {
    if (!teamData) return [];
    
    const members: TeamMember[] = [];
    Object.values(teamData.levels).forEach((level) => {
      level.members.forEach((member) => {
        // Determine category based on depth:
        // depth 1 => Direct
        // depth 2 => Team Level-1
        // depth 3 => Team Level-2
        // depth 4+ => Team Level-3 (group remaining deeper levels)
        let category: Exclude<TeamCategory, "all"> = "level3";
        if (level.level === 1) category = "direct";
        else if (level.level === 2) category = "level1";
        else if (level.level === 3) category = "level2";
        else category = "level3";
        
        const creditedSpot = (member as any).spot_amount || 0;
        const pendingSpot = (member as any).pending_spot_amount || 0;
        const lastMonthRoyalty = (member as any).last_month_royalty || 0;
        members.push({
          id: member.id,
          displayId: (member as any).display_id || member.id,
          name: member.name || `User ${member.id}`,
          joinedAt: new Date(member.created_at).toISOString().split('T')[0],
          spotAmount: creditedSpot,
          pendingSpotAmount: pendingSpot,
          lastMonthRoyalty: lastMonthRoyalty,
          status: (member.has_active_package ? "Active" : "Inactive") as TeamStatus,
          package: "Basic" as TeamMember["package"], // Kept for type; display uses totalInvestment
          totalInvestment: (member as any).total_investment ?? 0,
          depth: level.level,
          category,
        });
      });
    });
    return members;
  }, [teamData]);

  const filtered = useMemo(() => {
    const inDate = (d: string) => {
      if (!dateFilter) return true;
      const dt = new Date(d);
      const now = new Date();
      if (dateFilter === "thisyear")
        return dt.getFullYear() === now.getFullYear();
      const diffDays = (now.getTime() - dt.getTime()) / 86400000;
      if (dateFilter === "last30") return diffDays <= 30;
      if (dateFilter === "last90") return diffDays <= 90;
      return true;
    };

    return allTeamMembers.filter((m) => {
      // Level filter takes priority over tab filter
      let matchesLevel = true;
      if (levelFilter !== "" && levelFilter !== null) {
        // Level 0 = Direct (depth 1), Level 1 = Level 1 (depth 2), etc.
        // So levelFilter N maps to depth N+1
        matchesLevel = m.depth === (levelFilter as number) + 1;
      } else {
        // Fall back to tab filtering if no level filter is set
        const matchesTab =
          activeTab === "all"
            ? true
            : activeTab === "tree"
              ? false
              : activeTab === "direct"
                ? m.depth === 1
                : activeTab === "level1"
                  ? m.depth === 2
                  : activeTab === "level2"
                    ? m.depth === 3
                    : activeTab === "level3"
                      ? m.depth >= 4
                      : false;
        matchesLevel = matchesTab;
      }
      
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.displayId.toLowerCase().includes(q);
      const matchesStatus = !statusFilter || m.status === statusFilter;
      return matchesLevel && matchesSearch && matchesStatus && inDate(m.joinedAt);
    });
  }, [activeTab, search, statusFilter, dateFilter, levelFilter, allTeamMembers]);

  // Calculate statistics (prefer aggregated API stats when available)
  const stats = useMemo(() => {
    const dataToUse = activeTab === "tree" ? allTeamMembers : filtered;

    // Fallback calculations based on members list
    const fallbackTotalMembers = dataToUse.length;
    const fallbackActiveMembers = dataToUse.filter(
      (m) => m.status === "Active",
    ).length;
    const newThisMonth = dataToUse.filter((m) => {
      const dt = new Date(m.joinedAt);
      const now = new Date();
      return (
        dt.getMonth() === now.getMonth() &&
        dt.getFullYear() === now.getFullYear()
      );
    }).length;

    if (teamStats) {
      const totalMembers = teamStats.total_team_size;
      const activeMembers = teamStats.active_members;
      const totalBusinessVolume = teamStats.total_business_volume;
      const directReferrals = teamStats.direct_referrals;
      const avgBusinessPerMember =
        totalMembers > 0
          ? Math.round(totalBusinessVolume / totalMembers)
          : 0;

      return {
        totalMembers,
        activeMembers,
        totalBusinessVolume,
        directReferrals,
        avgBusinessPerMember,
        newThisMonth,
      };
    }

    // Fallback: no aggregated stats from API
    return {
      totalMembers: fallbackTotalMembers,
      activeMembers: fallbackActiveMembers,
      totalBusinessVolume: 0,
      directReferrals: 0,
      avgBusinessPerMember: 0,
      newThisMonth,
    };
  }, [filtered, activeTab, allTeamMembers, teamStats]);

  // Team growth data (last 6 months)
  const growthData = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString("en-IN", { month: "short" });
      const count = allTeamMembers.filter((m) => {
        const joined = new Date(m.joinedAt);
        return (
          joined.getMonth() === date.getMonth() &&
          joined.getFullYear() === date.getFullYear()
        );
      }).length;
      months.push({ month: monthName, members: count });
    }
    return months;
  }, [allTeamMembers]);

  // Team Level Status - Active vs Inactive by level
  const teamLevelStatusData = useMemo(() => {
    const levelData: Record<number, { active: number; inactive: number }> = {};
    
    // Initialize levels 1-5
    for (let i = 1; i <= 5; i++) {
      levelData[i] = { active: 0, inactive: 0 };
    }
    
    // Count active and inactive members by level
    allTeamMembers.forEach((m) => {
      const level = m.depth;
      if (level >= 1 && level <= 5) {
        if (m.status === "Active") {
          levelData[level].active++;
        } else {
          levelData[level].inactive++;
        }
      }
    });
    
    // Map depth to display labels: depth 1 = Direct, depth 2 = Level 1, etc.
    const levelLabels: Record<number, string> = {
      1: "Direct",
      2: "Level 1",
      3: "Level 2",
      4: "Level 3",
      5: "Level 4",
    };
    
    // Convert to array format for chart
    return Object.entries(levelData).map(([level, counts]) => ({
      level: levelLabels[Number(level)] || `Level ${level}`,
      "Active Members": counts.active,
      "Inactive Members": counts.inactive,
    }));
  }, [allTeamMembers]);

  // Status distribution - always use allTeamMembers for accurate stats
  const statusData = useMemo(() => {
    const statusCount: Record<string, number> = {};
    allTeamMembers.forEach((m) => {
      statusCount[m.status] = (statusCount[m.status] || 0) + 1;
    });
    return Object.entries(statusCount).map(([name, value]) => ({
      name,
      value,
    }));
  }, [allTeamMembers]);

  // Royalty trend (last 6 months) - Fetch from API
  const [royaltyTrendData, setRoyaltyTrendData] = useState<Array<{ month: string; royalty: number }>>([]);
  
  useEffect(() => {
    const fetchRoyaltyTrend = async () => {
      try {
        const response = await getRoyaltyTrend();
        setRoyaltyTrendData(response.data || []);
      } catch (error) {
        console.error('Failed to fetch royalty trend:', error);
        // Fallback to empty data if API fails
        setRoyaltyTrendData([]);
    }
    };
    fetchRoyaltyTrend();
  }, []);

  // Build tree structure from API data
  const buildTreeFromAPI = useMemo((): TreeNode | null => {
    if (!teamTree || !user) return null;

    // Helper to get avatar URL
    const getAvatarUrl = (userId: string, name: string | null) => {
      const seed = name || userId;
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(seed)}&background=3b82f6&color=fff`;
    };

    // Build nodes map keyed by numeric user id
    const nodesById = new Map<string, TreeNode>();

    const ensureNode = (numericId: string, displayId: string | null, name: string | null, isCurrent = false): TreeNode => {
      let node = nodesById.get(numericId);
      if (!node) {
        node = {
          id: numericId,
          name: name || `User ${numericId}`,
          avatar: getAvatarUrl(numericId, name),
          isCurrentUser: isCurrent,
        children: [],
          referralCode: displayId || numericId,
        };
        nodesById.set(numericId, node);
      } else {
        // Update basic info if coming later from API
        node.name = name || node.name;
        node.avatar = getAvatarUrl(numericId, name || node.name);
        node.referralCode = displayId || node.referralCode;
        if (isCurrent) node.isCurrentUser = true;
          }
      return node;
    };

    // Root node (current user)
    const root = ensureNode(
      user.id,
      (user as any).display_id ?? null,
      user.name || "You",
      true,
    );

    // Attach downline members using referrer_user_id as parent
    Object.values(teamTree.downline.levels).forEach((level) => {
      level.members.forEach((member) => {
        const child = ensureNode(
          member.id,
          member.display_id ?? null,
          member.name || `User ${member.id}`,
        );
        const parentId = member.referrer_user_id || user.id;
        const parent = nodesById.get(parentId) || ensureNode(parentId, null, null, parentId === user.id);

        parent.children = parent.children || [];
        if (!parent.children.find((c) => c.id === child.id)) {
          parent.children.push(child);
        }
      });
    });

    return root;
  }, [teamTree, user]);

  const statusBadge = (s: TeamStatus) => {
    if (s === "Active")
      return (
        <Badge tone="green" soft className="status">
          Active
        </Badge>
      );
    if (s === "Inactive")
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

  const formatCurrency = (amount: number) =>
    "₹" + amount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const totalInvestmentBadge = (totalInvestment: number | undefined) => {
    const value = totalInvestment ?? 0;
    return (
      <Badge tone="blue" className="whitespace-nowrap">
        Investment: {formatCurrency(value)}
      </Badge>
    );
  };

  const handleExportPDF = () => {
    setShowPayFirstModal(true);
  };

  const hasActiveFilters = search || statusFilter || dateFilter || (levelFilter !== "" && levelFilter !== null);

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-6 animate-in fade-in duration-500 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-2 sm:gap-4">
        <H1>User Management</H1>
        <div className="flex items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Button
            className="w-full sm:w-auto min-h-[44px]"
            variant="outline"
            onClick={handleExportPDF}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Export PDF
          </Button>
          <Button
            className="w-full sm:w-auto min-h-[44px]"
            onClick={() => router.push("/new-join")}
          >
            <UserPlus className="h-4 w-4 mr-1.5" />
            Add New User
          </Button>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid gap-4 md:gap-5 mb-7 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <EnhancedStatCard
          label="Total Members"
          value={stats.totalMembers}
          accent="blue"
          icon={Users}
          trend={
            stats.newThisMonth > 0
              ? `+${stats.newThisMonth} this month`
              : undefined
          }
          trendUp={stats.newThisMonth > 0}
        />
        <EnhancedStatCard
          label="Active Members"
          value={stats.activeMembers}
          accent="green"
          icon={TrendingUp}
          trend={`${
            stats.totalMembers > 0
              ? Math.round((stats.activeMembers / stats.totalMembers) * 100)
              : 0
          }% active`}
          trendUp={true}
        />
        <EnhancedStatCard
          label="Total Business Volume"
          value={`₹${stats.totalBusinessVolume.toLocaleString("en-IN", {
            maximumFractionDigits: 0,
          })}`}
          accent="blue"
          icon={DollarSign}
        />
        <EnhancedStatCard
          label="Direct Referrals"
          value={stats.directReferrals}
          accent="blue"
          icon={UserPlus}
        />
        <EnhancedStatCard
          label="Avg. Business / Member"
          value={`₹${stats.avgBusinessPerMember.toLocaleString("en-IN")}`}
          accent="amber"
          icon={TrendingUp}
        />
      </div>

      {/* Charts Section */}
      <div className="grid gap-7 mb-7 grid-cols-1 lg:grid-cols-2">
        {/* Team Growth Chart */}
        <Card className="min-h-[320px] p-4 md:p-6 hover:shadow-lg transition-shadow duration-300">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <H3 className="mb-0 text-base md:text-lg">Team Growth Trend</H3>
          </div>
          <div className="h-[200px] md:h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={growthData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="growthGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={chartColors.grid}
                />
                <XAxis
                  dataKey="month"
                  stroke={chartColors.axis}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke={chartColors.axis}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: chartColors.tooltipBg,
                    border: `1px solid ${chartColors.tooltipBorder}`,
                    borderRadius: "8px",
                    padding: "8px 12px",
                    boxShadow:
                      "0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)",
                    color: chartColors.tooltipText,
                  }}
                  formatter={(value: number) => [`${value} members`, ""]}
                  labelStyle={{
                    color: chartColors.tooltipText,
                    fontWeight: 600,
                    marginBottom: "4px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="members"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fill="url(#growthGradient)"
                  dot={{ fill: "#2563eb", r: 4 }}
                  activeDot={{ r: 6, fill: "#2563eb" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Team Level Status */}
        <Card className="min-h-[320px] p-4 md:p-6 hover:shadow-lg transition-shadow duration-300">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-purple-600" />
            <H3 className="mb-0 text-base md:text-lg">Team Level Status: Active vs Inactive</H3>
          </div>
          <div className="h-[200px] md:h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={teamLevelStatusData}
                margin={{ top: 10, right: 10, left: 35, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={chartColors.grid}
                />
                <XAxis
                  dataKey="level"
                  stroke={chartColors.axis}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke={chartColors.axis}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: "Number of Users", angle: -90, position: "insideLeft", offset: 5, style: { textAnchor: 'middle' } }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: chartColors.tooltipBg,
                    border: `1px solid ${chartColors.tooltipBorder}`,
                    borderRadius: "8px",
                    padding: "8px 12px",
                    boxShadow:
                      "0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)",
                    color: chartColors.tooltipText,
                  }}
                  formatter={(value: number) => [`${value} users`, ""]}
                  labelStyle={{
                    color: chartColors.tooltipText,
                    fontWeight: 600,
                    marginBottom: "4px",
                  }}
                />
                <Legend
                  wrapperStyle={{
                    paddingTop: "10px",
                  }}
                />
                <Bar
                  dataKey="Active Members"
                  stackId="a"
                  fill={COLORS.Active}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="Inactive Members"
                  stackId="a"
                  fill={COLORS.Inactive}
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Status Distribution */}
        <Card className="min-h-[320px] p-4 md:p-6 hover:shadow-lg transition-shadow duration-300">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-emerald-600" />
            <H3 className="mb-0 text-base md:text-lg">Status Distribution</H3>
          </div>
          <div className="h-[200px] md:h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={statusData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={chartColors.grid}
                />
                <XAxis
                  dataKey="name"
                  stroke={chartColors.axis}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke={chartColors.axis}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: chartColors.tooltipBg,
                    border: `1px solid ${chartColors.tooltipBorder}`,
                    borderRadius: "8px",
                    padding: "8px 12px",
                    boxShadow:
                      "0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)",
                    color: chartColors.tooltipText,
                  }}
                  formatter={(value: number) => [`${value} members`, ""]}
                  labelStyle={{
                    color: chartColors.tooltipText,
                    fontWeight: 600,
                    marginBottom: "4px",
                  }}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {statusData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        COLORS[entry.name as keyof typeof COLORS] || "#64748b"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Royalty Trend */}
        <Card className="min-h-[320px] p-4 md:p-6 hover:shadow-lg transition-shadow duration-300">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <H3 className="mb-0 text-base md:text-lg">Royalty Trend</H3>
          </div>
          <div className="h-[200px] md:h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={royaltyTrendData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={chartColors.grid}
                />
                <XAxis
                  dataKey="month"
                  stroke={chartColors.axis}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke={chartColors.axis}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `₹${value}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: chartColors.tooltipBg,
                    border: `1px solid ${chartColors.tooltipBorder}`,
                    borderRadius: "8px",
                    padding: "8px 12px",
                    boxShadow:
                      "0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)",
                    color: chartColors.tooltipText,
                  }}
                  formatter={(value: number) => [
                    `₹${value.toLocaleString("en-IN")}`,
                    "Royalty",
                  ]}
                  labelStyle={{
                    color: chartColors.tooltipText,
                    fontWeight: 600,
                    marginBottom: "4px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="royalty"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ fill: "#10b981", r: 4 }}
                  activeDot={{ r: 6, fill: "#10b981" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-(--border) mb-5 flex gap-4 md:gap-6 overflow-x-auto -mx-2 px-2 sm:overflow-visible">
        {(
          [
            { v: "direct", l: "Direct Team" },
            { v: "level1", l: "Team Level-1" },
            { v: "level2", l: "Team Level-2" },
            { v: "level3", l: "Team Level-3" },
            { v: "all", l: "All" },
            { v: "tree", l: "Tree Hierarchy" },
          ] as { v: TeamCategory; l: string }[]
        ).map((t) => (
          <button
            key={t.v}
            className={[
              "relative px-2 md:px-1 py-3 text-sm md:text-[16px] font-medium whitespace-nowrap transition-colors min-h-[44px]",
              activeTab === t.v
                ? "text-(--brand-blue)"
                : "text-(--text-muted) hover:text-(--text-strong)",
            ].join(" ")}
            onClick={() => setActiveTab(t.v)}
          >
            {t.l}
            {activeTab === t.v && (
              <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-blue-600 dark:bg-blue-400" />
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card className="mb-6 p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-center gap-2 flex-1 rounded-lg border border-(--border) bg-(--card-bg) px-3 py-2 min-h-[44px] shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-(--text-muted)"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by User ID or Name..."
              className="w-full bg-transparent outline-none text-[15px] text-(--text-strong) placeholder:text-(--text-muted)"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-(--text-muted) hover:text-(--text-strong) transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <select
            className="w-full md:w-auto rounded-lg border border-(--border) px-3 py-2 bg-(--card-bg) text-(--text-strong) text-sm md:text-[15px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Pending">Pending</option>
          </select>
          <select
            className="w-full md:w-auto rounded-lg border border-(--border) px-3 py-2 bg-(--card-bg) text-(--text-strong) text-sm md:text-[15px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
          >
            <option value="">All Joined Dates</option>
            <option value="last30">Last 30 Days</option>
            <option value="last90">Last 90 Days</option>
            <option value="thisyear">This Year</option>
          </select>
          <select
            className="w-full md:w-auto rounded-lg border border-(--border) px-3 py-2 bg-(--card-bg) text-(--text-strong) text-sm md:text-[15px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value === "" ? "" : Number(e.target.value))}
          >
            <option value="">All Levels</option>
            <option value="0">Level 0 (Direct)</option>
            <option value="1">Level 1</option>
            <option value="2">Level 2</option>
            <option value="3">Level 3</option>
            <option value="4">Level 4</option>
            <option value="5">Level 5</option>
            <option value="6">Level 6</option>
            <option value="7">Level 7</option>
            <option value="8">Level 8</option>
            <option value="9">Level 9</option>
          </select>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              className="w-full md:w-auto min-h-[44px]"
              onClick={() => {
                setSearch("");
                setStatusFilter("");
                setDateFilter("");
                setLevelFilter("");
              }}
            >
              <X className="h-4 w-4 mr-1.5" />
              Clear
            </Button>
          )}
        </div>
      </Card>

      {/* Tree Hierarchy */}
      {activeTab === "tree" && (
        <Card className="mb-6 p-0 overflow-hidden">
          <div
            className="w-full overflow-auto"
            style={{ maxHeight: "calc(100vh - 300px)", minHeight: "400px" }}
          >
            <div className="p-4 md:p-6 min-w-max flex justify-center">
              <TreeHierarchy treeData={buildTreeFromAPI || TREE_DATA} />
            </div>
          </div>
        </Card>
      )}

      {/* Grid */}
      {activeTab !== "tree" && (
        <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => (
            <Card
              key={m.id}
              className="p-5 relative hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="m-0 text-[18px] font-bold text-(--text-strong) truncate">
                    {m.name}
                  </h3>
                  <span className="mt-1 inline-block text-[14px] font-semibold text-(--brand-blue) truncate">
                    {m.displayId}
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  {statusBadge(m.status)}
                  {totalInvestmentBadge(m.totalInvestment)}
                </div>
              </div>

              <div className="border-t border-(--border) pt-3 space-y-2.5">
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-(--text-muted)">Joined At:</span>
                  <span className="font-semibold text-(--text-strong)">
                    {m.joinedAt}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-(--text-muted)">Spot Amount:</span>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {m.spotAmount > 0 ? (
                      // If credited amount exists, show only credited (green)
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    ₹{m.spotAmount.toLocaleString("en-IN")}
                  </span>
                    ) : m.pendingSpotAmount && m.pendingSpotAmount > 0 ? (
                      // If no credited amount, show pending (red with Scheduled)
                      <span 
                        className="font-semibold text-red-600 dark:text-red-400 relative group cursor-help"
                        title="Level qualify hone pe credit hoga"
                      >
                        ₹{m.pendingSpotAmount.toLocaleString("en-IN")} <span className="text-xs">(Scheduled)</span>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 dark:bg-gray-800 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                          Level qualify hone pe credit hoga
                        </div>
                      </span>
                    ) : (
                      // No credited, no pending
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        ₹0
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-(--text-muted)">
                    Monthly Royalty (This Month):
                  </span>
                  <span className="font-semibold text-(--brand-blue)">
                    ₹{m.lastMonthRoyalty.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab !== "tree" && filtered.length === 0 && (
        <Card className="mt-6 p-12 text-center">
          <Users className="h-16 w-16 text-(--text-muted) mx-auto mb-4" />
          <Text className="text-(--text-muted) text-lg mb-2">
            No users match your filters.
          </Text>
          <Text className="text-(--text-muted) text-sm mb-4">
            Try adjusting your search or filter criteria.
          </Text>
          {hasActiveFilters && (
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setStatusFilter("");
                setDateFilter("");
                setLevelFilter("");
              }}
            >
              <X className="h-4 w-4 mr-1.5" />
              Clear All Filters
            </Button>
          )}
        </Card>
      )}

      {/* Pay First Modal */}
      <PayFirstModal
        isOpen={showPayFirstModal}
        onClose={() => setShowPayFirstModal(false)}
      />
    </div>
  );
}
