export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function daysInMonth(date: Date): number {
  const year = date.getFullYear();
  const month = date.getMonth();
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Get the date of the next day at midnight (00:00:00)
 * This is when the daily commission will be credited
 * Uses current date (production-ready)
 */
export function getNextMidnight(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

// NOTE: calculateDailyAmount() function removed - we now use calculateDailyPaise() from paise.ts
// This ensures 100% accuracy using BigInt arithmetic

