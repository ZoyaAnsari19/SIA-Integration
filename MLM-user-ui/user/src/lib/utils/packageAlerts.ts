/**
 * Package Alert Utilities
 * Check for expired packages or packages with high income progress
 */

import type { PackagePurchase } from '../api/types';

export interface PackageAlert {
  hasExpired: boolean;
  hasHighProgress: boolean;
  expiredPackages: PackagePurchase[];
  highProgressPackages: PackagePurchase[];
}

/**
 * Check if user has expired packages or packages with 95%+ income progress
 * IMPORTANT: Filters out expired packages that were upgraded (same logic as My Packages and Dashboard pages)
 */
export function checkPackageAlerts(packages: PackagePurchase[]): PackageAlert {
  const expiredPackages: PackagePurchase[] = [];
  const highProgressPackages: PackagePurchase[] = [];

  packages.forEach((pkg) => {
    // Check if package is expired
    // Note: API sets is_active=false when expired (income >= 2x amount), status is always 'completed'
    if (!pkg.is_active) {
      // IMPORTANT: Filter out expired packages that were upgraded
      // Check if this expired package was upgraded using exact previous_purchase_id match
      const wasUpgraded = packages.some(otherPkg => {
        if (!otherPkg.is_active) return false;
        if (!otherPkg.previous_purchase_id) return false;
        
        // Compare as strings to ensure exact match (BigInts from backend)
        const match = String(otherPkg.previous_purchase_id) === String(pkg.id);
        
        return match;
      });
      
      // Only include expired packages that were NOT upgraded
      if (!wasUpgraded) {
        expiredPackages.push(pkg);
      }
    }

    // Check if package has 95%+ income progress (only for active packages)
    if (pkg.is_active && pkg.income !== undefined && pkg.amount !== undefined) {
      const progressPercentage = (pkg.income / (pkg.amount * 2)) * 100;
      if (progressPercentage >= 95) {
        highProgressPackages.push(pkg);
      }
    }
  });

  return {
    hasExpired: expiredPackages.length > 0,
    hasHighProgress: highProgressPackages.length > 0,
    expiredPackages,
    highProgressPackages,
  };
}

/**
 * Get alert message for package renewal
 */
export function getPackageAlertMessage(alert: PackageAlert): string {
  if (alert.hasExpired && alert.hasHighProgress) {
    return 'Aapka package expire hogya hai/hone wala hai kindly renew it from my packages section';
  } else if (alert.hasExpired) {
    return 'Aapka package expire hogya hai kindly renew it from my packages section';
  } else if (alert.hasHighProgress) {
    return 'Aapka package hone wala hai kindly renew it from my packages section';
  }
  return '';
}

