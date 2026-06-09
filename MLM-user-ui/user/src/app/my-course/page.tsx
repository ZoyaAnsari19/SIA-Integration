"use client";

import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { H2, H3 } from "@/components/ui/Heading";
import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { CountdownTimer } from "@/components/ui/CountdownTimer";
import { Tabs } from "@/components/ui/Tabs";
import {
  Package as PackageIcon,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Loader2,
  AlertCircle,
  Info,
  ArrowUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyPackages, getMyPackageById, getPackages } from "@/lib/api/packages";
import { getUserFriendlyError } from "@/lib/api/errors";
import type { PackagePurchase, Package } from "@/lib/api/types";

export default function MyPackages() {
  const router = useRouter();
  const [packages, setPackages] = useState<PackagePurchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'reneweable' | 'completed'>('all');
  const [selectedPackage, setSelectedPackage] = useState<PackagePurchase | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [expiredPackageForRenewal, setExpiredPackageForRenewal] = useState<PackagePurchase | null>(null);
  const [availablePackages, setAvailablePackages] = useState<Package[]>([]);
  const [renewalType, setRenewalType] = useState<'same' | 'upgrade' | null>(null);

  // Fetch packages – always fetch ALL (no status filter) so we have both active + expired
  // in the list. Required for hide logic: expired package is hidden only when an *active*
  // package has previous_purchase_id = that expired id. If we fetch only expired, we never
  // see the renewal, so wasUpgraded is always false and expired stays visible.
  const fetchPackages = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getMyPackages({
        // Do not pass status – get all packages. Filter by statusFilter in visiblePackages below.
      });
      if (process.env.NODE_ENV === 'development') {
        console.log('📦 Packages response:', response.items.map(p => ({ 
          id: p.id, 
          is_renewal: p.is_renewal, 
          package_id: p.package_id,
          is_active: p.is_active,
          previous_package_id: p.previous_package_id,
          previous_purchase_id: p.previous_purchase_id,
        has_renewal_countdown: !!p.renewal_countdown,
        renewal_deadline: p.renewal_countdown?.renewal_deadline,
      })));
      }
      setPackages(response.items);
    } catch (err: unknown) {
      const errorMessage = getUserFriendlyError(err) || 'Failed to load packages';
      setError(errorMessage);
      console.error('Failed to fetch packages:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, [statusFilter]);

  // Get renewal deadline from API response (FIXED - never changes across browsers)
  // Backend returns renewal_countdown.renewal_deadline which is calculated from last income date + 65 days
  const getRenewalDeadline = (pkg: PackagePurchase): Date | null => {
    if (!pkg.renewal_countdown?.renewal_deadline) {
      console.warn(`⚠️ Package ${pkg.id} (${pkg.package_name}) - renewal_countdown missing!`, {
        has_renewal_countdown: !!pkg.renewal_countdown,
        renewal_countdown: pkg.renewal_countdown,
      });
      return null;
    }
    const deadline = new Date(pkg.renewal_countdown.renewal_deadline);
    console.log(`✅ Package ${pkg.id} (${pkg.package_name}) - Deadline: ${deadline.toISOString()}`);
    return deadline;
  };

  // Filter out expired packages that have been upgraded
  // Hide expired package if there exists an active package with 
  // previous_purchase_id matching this expired package's id (exact match)
  const visiblePackages = packages.filter(pkg => {
    // Handle active packages
    if (pkg.is_active) {
      return statusFilter === 'all' || statusFilter === 'active';
    }
    
    // For expired packages, check if they were upgraded using exact previous_purchase_id match
    // This is the correct way - matches exact expired purchase, not just package_id
    const wasUpgraded = packages.some(otherPkg => {
      if (!otherPkg.is_active) return false;
      if (!otherPkg.previous_purchase_id) return false;
      
      // Compare as strings to ensure exact match
      const match = String(otherPkg.previous_purchase_id) === String(pkg.id);
      
      if (match) {
        console.log(`🔍 Match found: Active package ${otherPkg.id} has previous_purchase_id=${otherPkg.previous_purchase_id} matching expired package ${pkg.id}`);
      }
      
      return match;
    });
    
    if (wasUpgraded) {
      console.log(`🚫 Hiding expired package ${pkg.id} (${pkg.package_name || pkg.package_id}) - upgraded to active package (previous_purchase_id match)`);
      return false; // Never show upgraded packages
    } else {
      console.log(`✅ Showing expired package ${pkg.id} (${pkg.package_name || pkg.package_id}) - not upgraded (no previous_purchase_id match)`);
    }
    
    // Now filter based on renewal window status for expired packages
    const renewalDeadlineDate = getRenewalDeadline(pkg);
    const isRenewWindowActive = renewalDeadlineDate !== null && renewalDeadlineDate.getTime() > Date.now();
    
    // Apply status filter
    if (statusFilter === 'all') {
      return isRenewWindowActive; // Show only reneweable packages in "all" tab
    } else if (statusFilter === 'reneweable') {
      return isRenewWindowActive; // Show only expired with open renewal window
    } else if (statusFilter === 'completed') {
      return true; // Show ALL expired packages (reneweable + time's up)
    }
    
    return false;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const handleViewDetails = async (pkg: PackagePurchase) => {
    try {
      const details = await getMyPackageById(pkg.id);
      // Merge fetched details with original package to preserve income and other fields
      setSelectedPackage({
        ...details,
        income: details.income !== undefined ? details.income : pkg.income,
        amount: details.amount || pkg.amount,
        is_active: details.is_active !== undefined ? details.is_active : pkg.is_active,
        global_ids_info: details.global_ids_info || pkg.global_ids_info,
      });
      setShowDetails(true);
    } catch (err: unknown) {
      const errorMessage = getUserFriendlyError(err) || 'Failed to load package details';
      setError(errorMessage);
    }
  };

  const handleRenewNow = async (pkg: PackagePurchase) => {
    // Show renewal modal to choose same package or upgrade
    setExpiredPackageForRenewal(pkg);
    setShowRenewalModal(true);
    setRenewalType(null);
    
    // Fetch available packages for upgrade option
    try {
      const packagesData = await getPackages();
      // Filter packages that are higher price than expired package
      const upgradePackages = packagesData.filter(
        p => p.status === 'active' && Number(p.price) > pkg.amount
      );
      setAvailablePackages(upgradePackages);
    } catch (err) {
      console.error('Failed to fetch packages:', err);
      setAvailablePackages([]);
    }
  };

  const handleRenewalTypeSelect = (type: 'same' | 'upgrade') => {
    setRenewalType(type);
  };

  const handleProceedToRenewal = (selectedUpgradePackageId?: number) => {
    if (!expiredPackageForRenewal) return;
    
    if (renewalType === 'same') {
      // Same package renewal
      router.push(`/add-balance?renewPackageId=${expiredPackageForRenewal.id}&previousPackageId=${expiredPackageForRenewal.package_id}`);
    } else if (renewalType === 'upgrade' && selectedUpgradePackageId) {
      // Upgrade package
      router.push(`/add-balance?renewPackageId=${expiredPackageForRenewal.id}&previousPackageId=${expiredPackageForRenewal.package_id}&upgradePackageId=${selectedUpgradePackageId}`);
    }
    
    setShowRenewalModal(false);
    setExpiredPackageForRenewal(null);
    setRenewalType(null);
  };

  // Calculate statistics based on visible packages (after filtering)
  const stats = {
    total: visiblePackages.length,
    active: visiblePackages.filter(p => p.is_active).length,
    expired: visiblePackages.filter(p => !p.is_active && p.status === 'completed').length,
    totalAmount: visiblePackages.reduce((sum, p) => sum + p.amount, 0),
  };

  return (
    <div className="max-w-[1200px] mx-auto my-4 md:my-5 px-4 md:px-5">
      <H2 className="mb-4 md:mb-5 text-xl md:text-2xl">My Packages</H2>

      {/* Statistics */}
      <div className="mb-6 grid gap-4 md:gap-5 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
        <Card className="p-6 text-center border-l-4 border-l-blue-600">
          <div className="flex items-center justify-center mb-3">
            <PackageIcon className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="m-0 text-[36px] font-extrabold leading-none text-blue-600 dark:text-blue-400">
            {stats.total}
          </h3>
          <p className="m-0 mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Total Packages
          </p>
        </Card>
        <Card className="p-6 text-center border-l-4 border-l-emerald-600">
          <div className="flex items-center justify-center mb-3">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="m-0 text-[36px] font-extrabold leading-none text-emerald-600 dark:text-emerald-400">
            {stats.active}
          </h3>
          <p className="m-0 mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Active Packages
          </p>
        </Card>
        <Card className="p-6 text-center border-l-4 border-l-red-600">
          <div className="flex items-center justify-center mb-3">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="m-0 text-[36px] font-extrabold leading-none text-red-600 dark:text-red-400">
            {stats.expired}
          </h3>
          <p className="m-0 mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Expired Packages
          </p>
        </Card>
        <Card className="p-6 text-center border-l-4 border-l-purple-600">
          <div className="flex items-center justify-center mb-3">
            <TrendingUp className="w-8 h-8 text-purple-600" />
          </div>
          <h3 className="m-0 text-[24px] font-extrabold leading-none text-purple-600 dark:text-purple-400">
            {formatCurrency(stats.totalAmount)}
          </h3>
          <p className="m-0 mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Total Investment
          </p>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6">
        <Tabs
          value={statusFilter}
          onChange={(value) => setStatusFilter(value as any)}
          items={[
            { value: "all", label: "All Packages" },
            { value: "active", label: "Active" },
            { value: "reneweable", label: "Expired (Reneweable)" },
            { value: "completed", label: "Completed" },
          ]}
        />
      </div>

      {/* Packages List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--brand-blue)]" />
        </div>
      ) : error ? (
        <Card className="p-12 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 font-medium mb-2">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchPackages}>
            Retry
          </Button>
        </Card>
      ) : visiblePackages.length === 0 ? (
        <Card className="p-12 text-center">
          <PackageIcon className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-4" />
          <p className="text-[var(--text-muted)] font-medium">
            No packages found
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {visiblePackages.map((pkg) => {
            const isExpired = !pkg.is_active;
            // Use FIXED renewal_deadline from backend API (never changes across browsers)
            const renewalDeadlineDate = isExpired ? getRenewalDeadline(pkg) : null;
            const isRenewWindowActive =
              renewalDeadlineDate !== null &&
              renewalDeadlineDate.getTime() > Date.now();

            return (
              <Card
                key={pkg.id}
                className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
              >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <H3 className="text-lg font-bold mb-1">
                    {pkg.package_name || `Package #${pkg.package_id}`}
                  </H3>
                  <p className="text-sm text-[var(--text-muted)]">
                    {formatCurrency(pkg.amount)}
                  </p>
                </div>
                {pkg.is_active ? (
                  <Badge tone="green">Active</Badge>
                ) : (
                  <Badge tone="red">Expired</Badge>
                )}
              </div>

              <div className="space-y-2 mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">
                    {pkg.is_renewal ? 'Renewed on:' : 'Purchased:'}
                  </span>
                  <span className="font-medium">
                    {formatDate(pkg.is_renewal && pkg.renewed_at ? pkg.renewed_at : pkg.purchased_at)}
                  </span>
                </div>
                
                {/* 2x Income Progress Bar */}
                {pkg.is_active && (
                  <div className="mt-3">
                    <div className="mb-1">
                      <span className="text-xs text-[var(--text-muted)]">Income Progress (2x Target)</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                      <div
                        className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, ((pkg.income || 0) / (pkg.amount * 2)) * 100)}%`
                        }}
                      />
                    </div>
                    <div className="mt-1">
                      <div className="text-xs font-semibold">
                        ₹{pkg.income?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} / ₹{(pkg.amount * 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                </div>
                )}
              </div>

              {/* Global IDs Info for Active Packages */}
              {pkg.is_active && pkg.global_ids_info && (
                <div className={`mb-4 p-3 rounded-lg border ${
                  pkg.global_ids_info.is_cap_reached
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                    : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {pkg.global_ids_info.is_cap_reached ? (
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                    ) : (
                    <Info className="w-4 h-4 text-emerald-600" />
                    )}
                    <span className={`text-sm font-semibold ${
                      pkg.global_ids_info.is_cap_reached
                        ? 'text-amber-800 dark:text-amber-200'
                        : 'text-emerald-800 dark:text-emerald-200'
                    }`}>
                      Global IDs Info
                    </span>
                  </div>
                  <div className={`text-xs space-y-1 ${
                    pkg.global_ids_info.is_cap_reached
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-emerald-700 dark:text-emerald-300'
                  }`}>
                    {pkg.global_ids_info.is_cap_reached ? (
                      <>
                        <div>Used: {pkg.global_ids_info.used_ids} / {pkg.global_ids_info.package_cap}</div>
                        <div className="text-red-600 dark:text-red-400 font-semibold">
                          Today inactive: {pkg.global_ids_info.inactive_global_contributors ?? 0}
                        </div>
                        <div className="font-semibold text-red-600 dark:text-red-400">
                          Cap Reached
                          {pkg.global_ids_info.new_ids_after_cap !== null && pkg.global_ids_info.new_ids_after_cap !== undefined && (
                            <div>
                              Loss: ID-{pkg.global_ids_info.new_ids_after_cap}/Income({calculateCapExceedLoss(pkg.global_ids_info.new_ids_after_cap, pkg.global_ids_info.cap_exceed_loss, pkg.purchased_at)})
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div>Used: {pkg.global_ids_info.used_ids} / {pkg.global_ids_info.package_cap}</div>
                        <div>Remaining: {pkg.global_ids_info.remaining_ids}</div>
                        <div className="text-red-600 dark:text-red-400 font-semibold">
                          Today inactive: {pkg.global_ids_info.inactive_global_contributors ?? 0}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Expiry Loss for Expired Packages */}
              {isExpired && pkg.expiry_loss && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-semibold text-red-800 dark:text-red-200">
                      Expiry Loss
                    </span>
                  </div>
                  <div className="text-xs space-y-1 text-red-700 dark:text-red-300">
                    <div>Total Loss: {formatCurrency(pkg.expiry_loss.total_loss)}</div>
                    <div>Days Since Expiry: {pkg.expiry_loss.days_since_expiry}</div>
                  </div>
                </div>
              )}

              {/* Countdown Timer for Expired Packages */}
              {isExpired && renewalDeadlineDate && (
                  <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-orange-600" />
                      <span className="text-sm font-semibold text-orange-800 dark:text-orange-200">
                        Time Remaining to Renew
                      </span>
                    </div>
                    <div className="text-xs font-medium text-orange-700 dark:text-orange-300">
                      <CountdownTimer
                        targetDate={renewalDeadlineDate}
                        label=""
                        format="compact"
                        showIcon={false}
                        className=""
                      />
                    </div>
                  </div>
              )}

              {isExpired ? (
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => handleRenewNow(pkg)}
                  disabled={!isRenewWindowActive}
                >
                  {isRenewWindowActive ? "Renew Now" : "Renew Window Closed"}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleViewDetails(pkg)}
                >
                  View Details
                </Button>
              )}
            </Card>
          );
          })}
        </div>
      )}

      {/* Details Modal */}
      {showDetails && selectedPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <H2>Package Details</H2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowDetails(false);
                  setSelectedPackage(null);
                }}
              >
                ×
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Package Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Package Name:</span>
                    <span className="font-medium">
                      {selectedPackage.package_name || `Package #${selectedPackage.package_id}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Amount:</span>
                    <span className="font-medium">{formatCurrency(selectedPackage.amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Status:</span>
                    <Badge tone={selectedPackage.is_active ? "green" : "red"}>
                      {selectedPackage.is_active ? "Active" : "Expired"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">
                      {selectedPackage.is_renewal ? 'Renewed on:' : 'Purchased:'}
                    </span>
                    <span className="font-medium">
                      {formatDate(selectedPackage.is_renewal && selectedPackage.renewed_at ? selectedPackage.renewed_at : selectedPackage.purchased_at)}
                    </span>
                  </div>
                  
                  {/* 2x Income Progress Bar in Details Modal */}
                  {selectedPackage.is_active && (
                    <div className="mt-3">
                      <div className="mb-1">
                        <span className="text-sm text-[var(--text-muted)]">Income Progress (2x Target)</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                        <div
                          className="bg-emerald-600 h-3 rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, ((selectedPackage.income || 0) / (selectedPackage.amount * 2)) * 100)}%`
                          }}
                        />
                      </div>
                      <div className="mt-1">
                        <div className="text-sm font-semibold">
                          ₹{selectedPackage.income?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} / ₹{(selectedPackage.amount * 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                  </div>
                  )}
                </div>
              </div>

              {selectedPackage.global_ids_info && (
                <div>
                  <h3 className="font-semibold mb-2">Global IDs Information</h3>
                  <div className={`p-4 rounded-lg border ${
                    selectedPackage.global_ids_info.is_cap_reached
                      ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                      : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                  }`}>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-[var(--text-muted)]">Package Cap:</span>
                        <span className="font-medium ml-2">{selectedPackage.global_ids_info.package_cap}</span>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)]">Used IDs:</span>
                        <span className="font-medium ml-2">{selectedPackage.global_ids_info.used_ids}</span>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)]">Remaining IDs:</span>
                        <span className="font-medium ml-2">{selectedPackage.global_ids_info.remaining_ids}</span>
                      </div>
                      <div className="col-span-2 text-sm font-semibold text-red-600 dark:text-red-400">
                        Today inactive: {selectedPackage.global_ids_info.inactive_global_contributors ?? 0}
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)]">Cap Reached:</span>
                        <Badge tone={selectedPackage.global_ids_info.is_cap_reached ? "red" : "green"}>
                          {selectedPackage.global_ids_info.is_cap_reached ? "Yes" : "No"}
                        </Badge>
                      </div>
                    </div>
                    {selectedPackage.global_ids_info.is_cap_reached && (
                      <div className="mt-4 pt-4 border-t border-amber-200 dark:border-amber-800">
                        <div className="space-y-2 text-sm">
                          {selectedPackage.global_ids_info.new_ids_after_cap !== null && selectedPackage.global_ids_info.new_ids_after_cap !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-[var(--text-muted)]">Loss:</span>
                              <span className="font-bold text-red-600 dark:text-red-400">
                                ID-{selectedPackage.global_ids_info.new_ids_after_cap}/Income({calculateCapExceedLoss(selectedPackage.global_ids_info.new_ids_after_cap, selectedPackage.global_ids_info.cap_exceed_loss, selectedPackage.purchased_at)})
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedPackage.expiry_loss && (
                <div>
                  <h3 className="font-semibold mb-2">Expiry Loss</h3>
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Total Loss:</span>
                        <span className="font-bold text-red-600">
                          {formatCurrency(selectedPackage.expiry_loss.total_loss)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Days Since Expiry:</span>
                        <span className="font-medium">{selectedPackage.expiry_loss.days_since_expiry}</span>
                      </div>
                      {selectedPackage.expiry_loss.daily_breakdown && (
                        <div className="mt-4">
                          <h4 className="font-semibold mb-2">Daily Breakdown</h4>
                          <div className="space-y-1 text-xs">
                            {selectedPackage.expiry_loss.daily_breakdown.slice(0, 5).map((day, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span>Day {day.day} ({formatDate(day.date)}):</span>
                                <span>{formatCurrency(day.total)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Renewal Selection Modal */}
      <Dialog
        isOpen={showRenewalModal}
        onClose={() => {
          setShowRenewalModal(false);
          setExpiredPackageForRenewal(null);
          setRenewalType(null);
        }}
        title="Renew Package"
        size="lg"
      >
        {expiredPackageForRenewal && (
          <div className="space-y-6">
            {/* Expired Package Info */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Expired Package
              </h4>
              <div className="text-sm space-y-1 text-blue-800 dark:text-blue-200">
                <div>
                  <strong>Package:</strong> {expiredPackageForRenewal.package_name || `Package #${expiredPackageForRenewal.package_id}`}
                </div>
                <div>
                  <strong>Amount:</strong> {formatCurrency(expiredPackageForRenewal.amount)}
                </div>
                {expiredPackageForRenewal.global_ids_info && (
                  <div>
                    <strong>Used IDs:</strong> {expiredPackageForRenewal.global_ids_info.used_ids} / {expiredPackageForRenewal.global_ids_info.package_cap}
                  </div>
                )}
              </div>
            </div>

            {/* Renewal Type Selection */}
            <div className="space-y-4">
              <h4 className="font-semibold text-[var(--text-strong)]">
                Choose Renewal Type:
              </h4>
              
              {/* Same Package Option */}
              <button
                onClick={() => handleRenewalTypeSelect('same')}
                className={`w-full p-4 rounded-lg border-2 transition-all ${
                  renewalType === 'same'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-[var(--border)] hover:border-blue-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <div className="font-semibold text-[var(--text-strong)]">
                      Renew Same Package
                    </div>
                    <div className="text-sm text-[var(--text-muted)] mt-1">
                      Continue with {formatCurrency(expiredPackageForRenewal.amount)} package
                    </div>
                  </div>
                  {renewalType === 'same' && (
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  )}
                </div>
              </button>

              {/* Upgrade Package Option */}
              <button
                onClick={() => handleRenewalTypeSelect('upgrade')}
                className={`w-full p-4 rounded-lg border-2 transition-all ${
                  renewalType === 'upgrade'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-[var(--border)] hover:border-blue-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <div className="font-semibold text-[var(--text-strong)] flex items-center gap-2">
                      <ArrowUp className="w-4 h-4" />
                      Upgrade Package
                    </div>
                    <div className="text-sm text-[var(--text-muted)] mt-1">
                      Upgrade to a higher package and carry forward your used IDs
                    </div>
                  </div>
                  {renewalType === 'upgrade' && (
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  )}
                </div>
              </button>
            </div>

            {/* Upgrade Package Selection */}
            {renewalType === 'upgrade' && (
              <div className="space-y-3">
                <h4 className="font-semibold text-[var(--text-strong)]">
                  Select Upgrade Package:
                </h4>
                {availablePackages.length === 0 ? (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
                    No upgrade packages available
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {availablePackages.map((pkg) => (
                      <button
                        key={pkg.id}
                        onClick={() => handleProceedToRenewal(pkg.id)}
                        className="w-full p-3 rounded-lg border border-[var(--border)] hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-left"
                      >
                        <div className="font-semibold text-[var(--text-strong)]">
                          {pkg.name}
                        </div>
                        <div className="text-sm text-[var(--text-muted)]">
                          {formatCurrency(Number(pkg.price))}
                        </div>
                        {expiredPackageForRenewal.global_ids_info && pkg.global_ids && (
                          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            Available IDs: {pkg.global_ids - expiredPackageForRenewal.global_ids_info.used_ids} 
                            (Total: {pkg.global_ids} - Used: {expiredPackageForRenewal.global_ids_info.used_ids})
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-[var(--border)]">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowRenewalModal(false);
                  setExpiredPackageForRenewal(null);
                  setRenewalType(null);
                }}
              >
                Cancel
              </Button>
              {renewalType === 'same' && (
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={() => handleProceedToRenewal()}
                >
                  Proceed to Renewal
                </Button>
              )}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
