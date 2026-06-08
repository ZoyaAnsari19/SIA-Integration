"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Trophy,
  TrendingUp,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Users,
  DollarSign,
  Target,
  Award,
  Loader2,
} from "lucide-react";
import { H1 } from "@/components/ui/Heading";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { RankJourney } from "@/components/rank/RankJourney";
import { getPathRank, getPathRankEligibility, type PathRankLevel } from "@/lib/api/pathRank";
import { getUserFriendlyError } from "@/lib/api/errors";
import { useAppSelector } from "@/redux/hooks";

type Rank = {
  id: string;
  name: string;
  level: number;
  icon: string;
  color: string;
  requirements: {
    businessForAchievement: number;
    carryForward: number;
    spotCommission: number;
    monthlyRoyalty: number;
  };
  benefits: string[];
};

/**
 * TODO: MOCK DATA - Replace with actual API call
 *
 * Endpoint: GET /api/user/rank-details
 * Method: GET
 * Headers: { Authorization: "Bearer <token>" }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "ranks": [
 *       {
 *         "id": "bronze",
 *         "name": "Bronze",
 *         "level": 1,
 *         "icon": "🥉",
 *         "color": "amber",
 *         "requirements": {
 *           "directTeam": 0,
 *           "totalTeam": 0,
 *           "investment": 0,
 *           "monthlyIncome": 0
 *         },
 *         "benefits": ["Basic Support", "Access to Training Materials"]
 *       }
 *     ],
 *     "currentUserStats": {
 *       "currentRank": "silver",
 *       "directTeam": 8,
 *       "totalTeam": 35,
 *       "investment": 75000,
 *       "monthlyIncome": 15000
 *     }
 *   }
 * }
 *
 * Fields available in UI:
 * - Rank details: id, name, level, icon, color, requirements (businessForAchievement, carryForward, spotCommission, monthlyRoyalty), benefits
 * - Current user stats: currentRank, businessForAchievement, carryForward, spotCommission, monthlyRoyalty
 */
const ranks: Rank[] = [
  {
    id: "direct",
    name: "Direct",
    level: 0,
    icon: "/ranks/Direct.png",
    color: "amber",
    requirements: {
      businessForAchievement: 0,
      carryForward: 0,
      spotCommission: 0,
      monthlyRoyalty: 0,
    },
    benefits: [
      "Entry level rank",
      "Direct joining without any business requirement",
      "Base royalty eligibility (0.50% - 1%)",
    ],
  },
  {
    id: "level-1",
    name: "Filed Worker",
    level: 1,
    icon: "/ranks/Level -1.png",
    color: "zinc",
    requirements: {
      businessForAchievement: 0,
      carryForward: 0,
      spotCommission: 0,
      monthlyRoyalty: 0,
    },
    benefits: ["4 legs (min ₹7,500 each), total ₹2.15L business", "First leadership gift on achievement"],
  },
  {
    id: "level-2",
    name: "C.R Company Representative",
    level: 2,
    icon: "/ranks/Level -2.png",
    color: "yellow",
    requirements: {
      businessForAchievement: 1500000, // ₹15L
      carryForward: 1125000, // ₹11.25L
      spotCommission: 37500,
      monthlyRoyalty: 4500,
    },
    benefits: [
      "Condition: 3.75L x 4 legs = ₹15L business",
      "Carry forward: ₹11.25L",
      "Spot commission: ₹37,500 (2.5%)",
      "Monthly royalty: ₹4,500 (0.30%)",
    ],
  },
  {
    id: "level-3",
    name: "Area Manager",
    level: 3,
    icon: "/ranks/Level -3.png",
    color: "blue",
    requirements: {
      businessForAchievement: 7500000, // ₹75L
      carryForward: 6000000, // ₹60L
      spotCommission: 150000,
      monthlyRoyalty: 18750,
    },
    benefits: [
      "Condition: 25L x 3 legs = ₹75L business",
      "Carry forward: ₹60L",
      "Spot commission: ₹1,50,000 (2%)",
      "Monthly royalty: ₹18,750 (0.25%)",
    ],
  },
  {
    id: "level-4",
    name: "City Manager",
    level: 4,
    icon: "/ranks/Level -4.png",
    color: "purple",
    requirements: {
      businessForAchievement: 23200000, // ₹2.32CR
      carryForward: 17200000, // ₹1.72CR
      spotCommission: 464000, // ₹4,64,000
      monthlyRoyalty: 58000,
    },
    benefits: [
      "Condition: 77.62L x 3 legs = ₹2.32CR business",
      "Carry forward: ₹1.72CR",
      "Spot commission: ₹4,64,000 (2%)",
      "Monthly royalty: ₹58,000 (0.25%)",
    ],
  },
  {
    id: "level-5",
    name: "District Manager",
    level: 5,
    icon: "/ranks/Level -5.png",
    color: "emerald",
    requirements: {
      businessForAchievement: 76100000, // ₹7.61CR
      carryForward: 58900000, // ₹5.89CR
      spotCommission: 1141500, // ₹11,41,500
      monthlyRoyalty: 152200, // ₹1,52,200
    },
    benefits: [
      "Condition: 2.53CR x 3 legs = ₹7.61CR business",
      "Carry forward: ₹5.89CR",
      "Spot commission: ₹11,41,500 (1.50%)",
      "Monthly royalty: ₹1,52,200 (0.20%)",
    ],
  },
  {
    id: "level-6",
    name: "Division Manager",
    level: 6,
    icon: "/ranks/Level -6.png",
    color: "cyan",
    requirements: {
      businessForAchievement: 266500000, // ₹26.65CR
      carryForward: 207600000, // ₹20.76CR
      spotCommission: 3997500, // ₹39,97,500
      monthlyRoyalty: 533000, // ₹5,33,000
    },
    benefits: [
      "Condition: 13.32CR x 2 legs = ₹26.65CR business",
      "Carry forward: ₹20.76CR",
      "Spot commission: ₹39,97,500 (1.50%)",
      "Monthly royalty: ₹5,33,000 (0.20%)",
    ],
  },
  {
    id: "level-7",
    name: "State Manager",
    level: 7,
    icon: "/ranks/Level -7.png",
    color: "indigo",
    requirements: {
      businessForAchievement: 1039300000, // ₹103.93CR
      carryForward: 831700000, // ₹83.17CR
      spotCommission: 10393000, // Approx ₹1,03,93,000
      monthlyRoyalty: 1558950, // ₹15,58,950
    },
    benefits: [
      "Condition: 51.97CR x 2 legs = ₹103.93CR business",
      "Carry forward: ₹83.17CR",
      "Spot commission: approx ₹1,03,93,000 (1%)",
      "Monthly royalty: ₹15,58,950 (0.20%)",
    ],
  },
  {
    id: "level-8",
    name: "Regional Manager",
    level: 8,
    icon: "/ranks/Level -8.png",
    color: "rose",
    requirements: {
      businessForAchievement: 4469600000, // ₹446.96CR
      carryForward: 3637900000, // ₹363.79CR
      spotCommission: 44600000, // ₹4.46CR
      monthlyRoyalty: 6704400, // ₹67,04,400
    },
    benefits: [
      "Condition: 223.48CR x 2 legs = ₹446.96CR business",
      "Carry forward: ₹363.79CR",
      "Spot commission: ₹4.46CR (1%)",
      "Monthly royalty: ₹67,04,400 (0.15%)",
    ],
  },
  {
    id: "level-9",
    name: "King",
    level: 9,
    icon: "/ranks/Level -9.png",
    color: "yellow",
    requirements: {
      businessForAchievement: 21000000000, // ₹2100CR
      carryForward: 0,
      spotCommission: 210000000, // ₹21CR
      monthlyRoyalty: 21000000, // ₹2.10CR
    },
    benefits: [
      "Condition: 2100CR total business",
      "Final leadership rank with global recognition",
      "Spot commission: ₹21CR (0.50%)",
      "Monthly royalty: ₹2.10CR (0.10%)",
    ],
  },
];

export default function PathRankPage() {
  const user = useAppSelector((state) => state.auth.user);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pathRankData, setPathRankData] = useState<PathRankLevel[]>([]);
  const [eligibilityData, setEligibilityData] = useState<any>(null);

  // Fetch data from API
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [rankData, eligibility] = await Promise.all([
          getPathRank(),
          getPathRankEligibility().catch(() => null),
        ]);
        setPathRankData(rankData.levels);
        setEligibilityData(eligibility);
      } catch (err: any) {
        const errorMessage = getUserFriendlyError(err);
        setError(errorMessage);
        console.error('Failed to fetch path rank data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate total business from leg volumes
  const totalBusiness = useMemo(() => {
    if (!eligibilityData?.leg_volumes) return 0;
    const legVolumes = Object.values(eligibilityData.leg_volumes) as number[];
    return legVolumes.reduce((sum, vol) => sum + vol, 0);
  }, [eligibilityData]);

  // Get leg volumes array
  const legVolumesArray = useMemo(() => {
    if (!eligibilityData?.leg_volumes) return [];
    return Object.values(eligibilityData.leg_volumes) as number[];
  }, [eligibilityData]);

  // Calculate how many legs meet minimum requirement for a level
  const getLegsMeetingRequirement = (minAmount: number | null) => {
    if (!minAmount || legVolumesArray.length === 0) return 0;
    return legVolumesArray.filter((vol) => vol >= minAmount).length;
  };

  // Map API levels to UI ranks format with proper requirements from API
  const mappedRanks = useMemo(() => {
    return ranks.map((rank) => {
      const apiLevel = pathRankData.find((l) => l.level === rank.level);
      const levelReq = eligibilityData?.level_requirements?.find((r: any) => r.level === rank.level);
      
      // For level 0 (Direct), use API earnings but keep business requirement as 0
      if (rank.level === 0 && apiLevel) {
        return {
          ...rank,
          requirements: {
            businessForAchievement: 0, // No requirement for Direct
            carryForward: 0, // No carry forward for Direct
            spotCommission: apiLevel.earnings.spot_commissions,
            monthlyRoyalty: apiLevel.earnings.monthly_commissions,
          },
          apiLevel,
          levelRequirement: null,
        };
      }
      
      if (apiLevel && levelReq) {
        // Calculate business for achievement based on level requirements
        let businessForAchievement = 0;
        if (levelReq.total_business != null && levelReq.total_business > 0) {
          // Level 1 (or any level) with combined rule: use total_business from API
          businessForAchievement = levelReq.total_business;
        } else if (levelReq.required_leg_count && levelReq.required_leg_min_amount) {
          // For leg-based-only requirements: leg_count * min_amount
          businessForAchievement = levelReq.required_leg_count * levelReq.required_leg_min_amount;
        } else if (rank.level === 9) {
          // Level 9 uses total business requirement from static data
          businessForAchievement = rank.requirements.businessForAchievement;
        }
        
        // Calculate carry forward (75% of business for achievement)
        const carryForward = businessForAchievement * 0.75;
        
        return {
          ...rank,
          requirements: {
            businessForAchievement,
            carryForward,
            spotCommission: apiLevel.earnings.spot_commissions,
            monthlyRoyalty: apiLevel.earnings.monthly_commissions,
          },
          // Store API data for reference
          apiLevel,
          levelRequirement: levelReq,
        };
      }
      
      // Fallback: if API level exists but no level requirement, use API earnings
      if (apiLevel) {
        return {
          ...rank,
          requirements: {
            businessForAchievement: rank.requirements.businessForAchievement,
            carryForward: rank.requirements.carryForward,
            spotCommission: apiLevel.earnings.spot_commissions,
            monthlyRoyalty: apiLevel.earnings.monthly_commissions,
          },
          apiLevel,
          levelRequirement: null,
        };
      }
      
      return rank;
    });
  }, [pathRankData, eligibilityData]);

  // Find current rank (highest eligible level)
  const currentRankId = useMemo(() => {
    if (pathRankData.length === 0) return "direct";
    
    // Find highest eligible level
    const eligibleLevels = pathRankData
      .filter((l) => l.eligible)
      .sort((a, b) => b.level - a.level);
    
    if (eligibleLevels.length > 0) {
      const highestLevel = eligibleLevels[0].level;
      if (highestLevel === 0) return "direct";
      return `level-${highestLevel}`;
    }
    
    return "direct";
  }, [pathRankData]);

  // Get current user stats from API data
  const currentUserStats = useMemo(() => {
    const currentRankIndex = mappedRanks.findIndex((r) => r.id === currentRankId);
    const currentRank = mappedRanks[currentRankIndex] || mappedRanks[0];
    const apiLevel = pathRankData.find((l) => l.level === currentRank.level);
    
    // Use total business from leg volumes as business for achievement
    const businessForAchievement = totalBusiness;
    
    // Calculate carry forward (75% of business for achievement)
    const carryForward = businessForAchievement * 0.75;
    
    if (apiLevel) {
      return {
        currentRank: currentRankId as any,
        businessForAchievement,
        carryForward,
        spotCommission: apiLevel.earnings.spot_commissions,
        monthlyRoyalty: apiLevel.earnings.monthly_commissions,
      };
    }
    
    return {
      currentRank: currentRankId as any,
      businessForAchievement,
      carryForward,
      spotCommission: 0,
      monthlyRoyalty: 0,
    };
  }, [pathRankData, currentRankId, mappedRanks, totalBusiness]);

  const currentRankIndex = mappedRanks.findIndex(
    (r) => r.id === currentUserStats.currentRank,
  );
  const currentRank = mappedRanks[currentRankIndex] || mappedRanks[0];
  const nextRank = mappedRanks[currentRankIndex + 1];

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const getProgress = (current: number, required: number) => {
    if (required === 0) return 100;
    return Math.min(100, (current / required) * 100);
  };

  const getRequirementStatus = (current: number, required: number) => {
    return current >= required;
  };

  if (isLoading) {
    return (
      <div className="max-w-[1300px] mx-auto p-4 md:p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-[var(--text-muted)]">Loading rank data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[1300px] mx-auto p-4 md:p-6">
        <Card className="p-6">
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[1300px] mx-auto p-4 md:p-6 flex flex-col gap-5 md:gap-7">
      <H1>Path Rank</H1>

      {/* Visual Journey Roadmap */}
      <Card className="p-6 md:p-8">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-[var(--text-strong)] mb-2 flex items-center justify-center gap-2">
            <Trophy className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Your Business Rank Journey
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            Track your progress through the ranks
          </p>
        </div>
        <RankJourney
          ranks={mappedRanks.map((r) => ({
            id: r.id,
            name: r.name,
            level: r.level,
            icon: r.icon,
            color: r.color,
          }))}
          currentRankId={currentUserStats.currentRank}
        />
      </Card>

      {/* Current Rank Card */}
      <Card className="p-6 border-l-4 border-l-blue-500">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 flex items-center justify-center">
              {currentRank.icon.startsWith("/") ? (
                <img
                  src={currentRank.icon}
                  alt={currentRank.name}
                  className="w-16 h-16 object-contain rounded-full"
                />
              ) : (
                <div className="text-5xl">{currentRank.icon}</div>
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[var(--text-strong)]">
                Current Rank: {currentRank.name}
              </h2>
              <p className="text-sm text-[var(--text-muted)]">
                Level {currentRank.level}
              </p>
            </div>
          </div>
          <Badge tone="blue" soft={false} className="text-lg px-4 py-2">
            {currentRank.name} Rank
          </Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-[var(--hover-bg)] rounded-lg p-3">
            <p className="text-xs text-[var(--text-muted)] mb-1">
              Business for Achievement
            </p>
            <p className="text-lg font-bold text-[var(--text-strong)]">
              ₹{formatCurrency(currentUserStats.businessForAchievement)}
            </p>
          </div>
          <div className="bg-[var(--hover-bg)] rounded-lg p-3">
            <p className="text-xs text-[var(--text-muted)] mb-1">
              Carry Forward
            </p>
            <p className="text-lg font-bold text-[var(--text-strong)]">
              ₹{formatCurrency(currentUserStats.carryForward)}
            </p>
          </div>
          <div className="bg-[var(--hover-bg)] rounded-lg p-3">
            <p className="text-xs text-[var(--text-muted)] mb-1">
              Spot Commission
            </p>
            <p className="text-lg font-bold text-[var(--text-strong)]">
              ₹{formatCurrency(currentUserStats.spotCommission)}
            </p>
          </div>
          <div className="bg-[var(--hover-bg)] rounded-lg p-3">
            <p className="text-xs text-[var(--text-muted)] mb-1">
              Monthly Royalty
            </p>
            <p className="text-lg font-bold text-[var(--text-strong)]">
              ₹{formatCurrency(currentUserStats.monthlyRoyalty)}
            </p>
          </div>
        </div>
      </Card>

      {/* Next Rank Requirements */}
      {nextRank && (
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-bold text-[var(--text-strong)]">
              Next Rank: {nextRank.name}
            </h2>
            <Badge tone="amber" soft={false} className="ml-auto">
              Level {nextRank.level}
            </Badge>
          </div>

          <div className="space-y-4">
            {/* Business Requirement - Leg-based or Total Business */}
            {(() => {
              const nextLevelReq = (nextRank as any).levelRequirement;
              const requiredLegCount = nextLevelReq?.required_leg_count;
              const requiredLegMinAmount = nextLevelReq?.required_leg_min_amount;
              
              // For leg-based requirements (Levels 1-8)
              if (requiredLegCount && requiredLegMinAmount) {
                const legsMeetingRequirement = getLegsMeetingRequirement(requiredLegMinAmount);
                const isEligible = legsMeetingRequirement >= requiredLegCount;
                
                return (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-[var(--text-muted)]" />
                        <span className="text-sm font-medium text-[var(--text-body)]">
                          Legs Meeting Requirement
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[var(--text-muted)]">
                          {legsMeetingRequirement} / {requiredLegCount} legs (min ₹{formatCurrency(requiredLegMinAmount)} each)
                        </span>
                        {isEligible ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                    </div>
                    <div className="w-full bg-[var(--hover-bg)] rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all ${
                          isEligible ? "bg-emerald-600" : "bg-blue-600"
                        }`}
                        style={{
                          width: `${Math.min(100, (legsMeetingRequirement / requiredLegCount) * 100)}%`,
                        }}
                      ></div>
                    </div>
                    {!isEligible && (
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        Need {requiredLegCount - legsMeetingRequirement} more leg(s) with at least ₹{formatCurrency(requiredLegMinAmount)} business each
                      </p>
                    )}
                    
                    {/* Legs progress: show as many legs as required for next rank so user sees which leg(s) need more business */}
                    {eligibilityData?.leg_details && eligibilityData.leg_details.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-[var(--border)]">
                        <h4 className="text-sm font-semibold text-[var(--text-strong)] mb-3 flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Top {requiredLegCount} Legs Progress (for next rank)
                        </h4>
                        <div className="space-y-3">
                          {eligibilityData.leg_details.slice(0, requiredLegCount).map((leg: any, index: number) => {
                            const legVolume = leg.leg_business_volume || 0;
                            const legProgress = Math.min(100, (legVolume / requiredLegMinAmount) * 100);
                            const meetsRequirement = legVolume >= requiredLegMinAmount;
                            
                            return (
                              <div key={leg.leg_user_id} className="bg-[var(--hover-bg)] rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-[var(--text-muted)]">
                                      Leg {index + 1}:
                                    </span>
                                    <span className="text-sm font-semibold text-[var(--text-strong)]">
                                      {leg.leg_user_name || `User ${leg.leg_user_id}`}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-[var(--text-muted)]">
                                      ₹{formatCurrency(legVolume)} / ₹{formatCurrency(requiredLegMinAmount)}
                                    </span>
                                    {meetsRequirement ? (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    ) : (
                                      <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                                    )}
                                  </div>
                                </div>
                                <div className="w-full bg-[var(--card-bg)] rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full transition-all ${
                                      meetsRequirement ? "bg-emerald-600" : "bg-blue-600"
                                    }`}
                                    style={{
                                      width: `${legProgress}%`,
                                    }}
                                  ></div>
                                </div>
                                {!meetsRequirement && (
                                  <p className="text-xs text-[var(--text-muted)] mt-1">
                                    Need ₹{formatCurrency(requiredLegMinAmount - legVolume)} more
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {/* Show total business progress */}
                    <div className="mt-3 pt-3 border-t border-[var(--border)]">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-[var(--text-muted)]" />
                          <span className="text-sm font-medium text-[var(--text-body)]">
                            Total Business Volume
                          </span>
                        </div>
                        <span className="text-sm text-[var(--text-muted)]">
                          ₹{formatCurrency(totalBusiness)} / ₹{formatCurrency(nextRank.requirements.businessForAchievement)}
                        </span>
                      </div>
                      <div className="w-full bg-[var(--hover-bg)] rounded-full h-2.5">
                        <div
                          className="h-2.5 rounded-full transition-all bg-blue-600"
                          style={{
                            width: `${getProgress(
                              totalBusiness,
                              nextRank.requirements.businessForAchievement,
                            )}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              }
              
              // For total business requirement (Level 9)
              return (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[var(--text-muted)]" />
                      <span className="text-sm font-medium text-[var(--text-body)]">
                        Business for Achievement
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--text-muted)]">
                        ₹{formatCurrency(totalBusiness)} / ₹{formatCurrency(nextRank.requirements.businessForAchievement)}
                      </span>
                      {getRequirementStatus(
                        totalBusiness,
                        nextRank.requirements.businessForAchievement,
                      ) ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                  </div>
                  <div className="w-full bg-[var(--hover-bg)] rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all ${
                        getRequirementStatus(
                          totalBusiness,
                          nextRank.requirements.businessForAchievement,
                        )
                          ? "bg-emerald-600"
                          : "bg-blue-600"
                      }`}
                      style={{
                        width: `${getProgress(
                          totalBusiness,
                          nextRank.requirements.businessForAchievement,
                        )}%`,
                      }}
                    ></div>
                  </div>
                  {!getRequirementStatus(
                    totalBusiness,
                    nextRank.requirements.businessForAchievement,
                  ) && (
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Need ₹{formatCurrency(
                        nextRank.requirements.businessForAchievement - totalBusiness,
                      )} more business for achievement
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Carry Forward Requirement - Show only if next level has requirements */}
            {nextRank.requirements.carryForward > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[var(--text-muted)]" />
                    <span className="text-sm font-medium text-[var(--text-body)]">
                      Carry Forward
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--text-muted)]">
                      ₹{formatCurrency(currentUserStats.carryForward)} / ₹
                      {formatCurrency(nextRank.requirements.carryForward)}
                    </span>
                    {getRequirementStatus(
                      currentUserStats.carryForward,
                      nextRank.requirements.carryForward,
                    ) ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                </div>
                <div className="w-full bg-[var(--hover-bg)] rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${
                      getRequirementStatus(
                        currentUserStats.carryForward,
                        nextRank.requirements.carryForward,
                      )
                        ? "bg-emerald-600"
                        : "bg-blue-600"
                    }`}
                    style={{
                      width: `${getProgress(
                        currentUserStats.carryForward,
                        nextRank.requirements.carryForward,
                      )}%`,
                    }}
                  ></div>
                </div>
                {!getRequirementStatus(
                  currentUserStats.carryForward,
                  nextRank.requirements.carryForward,
                ) && (
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Need ₹{formatCurrency(
                      nextRank.requirements.carryForward -
                        currentUserStats.carryForward,
                    )} more carry forward business
                  </p>
                )}
              </div>
            )}

          </div>

          {/* Next Rank Benefits */}
          <div className="mt-6 pt-6 border-t border-[var(--border)]">
            <h3 className="text-lg font-semibold text-[var(--text-strong)] mb-3 flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Benefits of {nextRank.name} Rank
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {nextRank.benefits.map((benefit, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 text-sm text-[var(--text-body)]"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* All Ranks Overview */}
      <Card className="p-6">
        <h2 className="text-xl font-bold text-[var(--text-strong)] mb-6 flex items-center gap-2">
          <Trophy className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          All Ranks Overview
        </h2>
        <div className="space-y-4">
          {mappedRanks.map((rank, index) => {
            const apiLevel = pathRankData.find((l) => l.level === rank.level);
            const levelReq = eligibilityData?.level_requirements?.find((r: any) => r.level === rank.level);
            
            // Determine status based on API eligibility
            const isEligible = apiLevel?.eligible ?? false;
            const isCurrent = rank.id === currentUserStats.currentRank;
            const isCompleted = isEligible && !isCurrent && (index < currentRankIndex);
            const isNext = index === currentRankIndex + 1;

            // Get actual earnings from API
            const spotCommission = apiLevel?.earnings.spot_commissions ?? 0;
            const monthlyRoyalty = apiLevel?.earnings.monthly_commissions ?? 0;

            return (
              <div
                key={rank.id}
                className={`p-4 rounded-lg border-2 transition-all ${
                  isCurrent
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-500/20"
                    : isCompleted
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/20"
                      : isNext
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-500/20"
                        : "border-[var(--border)] bg-[var(--card-bg)]"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 flex items-center justify-center">
                      {rank.icon.startsWith("/") ? (
                        <img
                          src={rank.icon}
                          alt={rank.name}
                          className="w-12 h-12 object-contain rounded-full"
                        />
                      ) : (
                        <div className="text-3xl">{rank.icon}</div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[var(--text-strong)]">
                        {rank.name} Rank
                      </h3>
                      <p className="text-xs text-[var(--text-muted)]">
                        Level {rank.level}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isCurrent && (
                      <Badge tone="blue" soft={false}>
                        Current
                      </Badge>
                    )}
                    {isCompleted && (
                      <Badge tone="green" soft={false}>
                        Completed
                      </Badge>
                    )}
                    {isNext && (
                      <Badge tone="amber" soft={false}>
                        Next
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <p className="text-[var(--text-muted)]">
                      {rank.level === 0 ? "Total Business" : "Business for Achievement"}
                    </p>
                    <p className="font-semibold text-[var(--text-strong)]">
                      ₹{formatCurrency(
                        rank.level === 0 ? totalBusiness : rank.requirements.businessForAchievement
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--text-muted)]">Carry Forward</p>
                    <p className="font-semibold text-[var(--text-strong)]">
                      ₹{formatCurrency(rank.requirements.carryForward)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--text-muted)]">Spot Commission</p>
                    <p className="font-semibold text-[var(--text-strong)]">
                      ₹{formatCurrency(spotCommission)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--text-muted)]">
                      Monthly Royalty
                    </p>
                    <p className="font-semibold text-[var(--text-strong)]">
                      ₹{formatCurrency(monthlyRoyalty)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
