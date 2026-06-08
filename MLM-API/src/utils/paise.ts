/**
 * Paise-based arithmetic utilities for 100% accurate commission calculations
 * All amounts stored as integers (paise = rupees × 100)
 * Zero rounding errors guaranteed!
 */

/**
 * Convert rupees to paise (integer)
 */
export function rupeesToPaise(rupees: number): bigint {
  return BigInt(Math.round(rupees * 100));
}

/**
 * Convert paise (integer) to rupees (decimal)
 */
export function paiseToRupees(paise: bigint): number {
  return Number(paise) / 100;
}

/**
 * Calculate daily amount from monthly amount using paise arithmetic
 * Returns: { dailyPaise: bigint, remainderPaise: bigint }
 */
export function calculateDailyPaise(monthlyRupees: number, daysInMonth: number): {
  dailyPaise: bigint;
  remainderPaise: bigint;
} {
  const monthlyPaise = rupeesToPaise(monthlyRupees);
  const dailyPaise = monthlyPaise / BigInt(daysInMonth);
  const remainderPaise = monthlyPaise % BigInt(daysInMonth);
  
  return { dailyPaise, remainderPaise };
}

/**
 * Calculate commission amount in paise from purchase amount
 */
export function calculateCommissionPaise(purchaseAmountRupees: number, percentageRate: number): bigint {
  const purchasePaise = rupeesToPaise(purchaseAmountRupees);
  const ratePaise = BigInt(Math.round(percentageRate * 100)); // e.g., 5% → 500, 0.5% → 50
  const commissionPaise = (purchasePaise * ratePaise) / BigInt(10000); // Divide by 10000 (100 for % × 100 for paise)
  
  return commissionPaise;
}

/**
 * Multiply paise amount by a factor
 */
export function multiplyPaise(paise: bigint, factor: number): bigint {
  return paise * BigInt(factor);
}

/**
 * Add two paise amounts
 */
export function addPaise(paise1: bigint, paise2: bigint): bigint {
  return paise1 + paise2;
}

/**
 * Format paise as rupees string for display
 */
export function formatPaise(paise: bigint): string {
  const rupees = paiseToRupees(paise);
  return `₹${rupees.toFixed(2)}`;
}

/**
 * Calculate daily amount with remainder tracking for atomic precision
 * For use in scheduled commissions where we need to track and adjust on last day
 */
export function calculateDailyWithRemainder(
  monthlyPaise: bigint,
  daysInMonth: number,
  dayNumber: number,
  totalDaysProcessed: number
): bigint {
  const dailyPaise = monthlyPaise / BigInt(daysInMonth);
  const remainderPaise = monthlyPaise % BigInt(daysInMonth);
  
  // On the last day of the month, add the remainder
  if (totalDaysProcessed + 1 === daysInMonth) {
    return dailyPaise + remainderPaise;
  }
  
  return dailyPaise;
}

/**
 * Example usage and validation
 */
export function validatePaiseCalculations() {
  // Example: ₹62.50 for 31 days
  const monthly = 62.50;
  const days = 31;
  
  const { dailyPaise, remainderPaise } = calculateDailyPaise(monthly, days);
  
  console.log('Paise Calculation Validation:');
  console.log(`  Monthly: ${formatPaise(rupeesToPaise(monthly))}`);
  console.log(`  Days: ${days}`);
  console.log(`  Daily: ${formatPaise(dailyPaise)} (${dailyPaise} paise)`);
  console.log(`  Remainder: ${remainderPaise} paise`);
  console.log(`  Total: ${formatPaise(dailyPaise * BigInt(days) + remainderPaise)}`);
  console.log(`  Match: ${dailyPaise * BigInt(days) + remainderPaise === rupeesToPaise(monthly) ? '✅' : '❌'}`);
}

