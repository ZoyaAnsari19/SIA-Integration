/**
 * Check if current time is within allowed withdrawal hours (10 AM to 5 PM IST)
 */
export function isWithdrawalTimeAllowed(): {
  allowed: boolean;
  message?: string;
} {
  // Get current time in IST
  // IST is UTC+5:30, so we need to convert UTC time to IST
  const now = new Date();
  
  // Get UTC time components
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  
  // Convert to IST (UTC+5:30)
  let istHours = utcHours + 5;
  let istMinutes = utcMinutes + 30;
  
  // Handle minute overflow (if minutes >= 60, add 1 hour)
  if (istMinutes >= 60) {
    istHours += 1;
    istMinutes -= 60;
  }
  
  // Handle hour overflow (if hours >= 24, subtract 24)
  if (istHours >= 24) {
    istHours -= 24;
  }
  
  const currentTimeMinutes = istHours * 60 + istMinutes;
  
  // 10 AM = 10 * 60 = 600 minutes
  // 5 PM = 17 * 60 = 1020 minutes (inclusive, so we check < 1020, meaning up to 16:59:59)
  const startTimeMinutes = 10 * 60; // 10:00 AM
  const endTimeMinutes = 17 * 60; // 5:00 PM (17:00) - exclusive, so 16:59:59 is last allowed
  
  if (currentTimeMinutes >= startTimeMinutes && currentTimeMinutes < endTimeMinutes) {
    return { allowed: true };
  }
  
  const currentTimeStr = `${String(istHours).padStart(2, '0')}:${String(istMinutes).padStart(2, '0')}`;
  return {
    allowed: false,
    message: `Withdrawal is only allowed between 10:00 AM and 5:00 PM IST. Current time is ${currentTimeStr} IST.`
  };
}

export function isWithdrawalDateAllowed(): {
  allowed: boolean;
  allowedWallets: ('spot' | 'other' | 'team_royalty')[];
  message?: string;
} {
  const today = new Date();
  const day = today.getDate();
  const month = today.getMonth() + 1; // 1-12
  const isFebruary = month === 2;

  // 10th & 20th: ONLY SPOT wallet allowed
  if (day === 10 || day === 20) {
    return { allowed: true, allowedWallets: ['spot'] };
  }

  // 30th (or 28th for February): All wallets allowed (SPOT, Main/Other, Team Royalty)
  if ((isFebruary && day === 28) || (!isFebruary && day === 30)) {
    return { allowed: true, allowedWallets: ['spot', 'other', 'team_royalty'] };
  }

  return {
    allowed: false,
    allowedWallets: [],
    message: `Withdrawal is only allowed on 10th, 20th and ${isFebruary ? '28th' : '30th'} of each month. Today is ${day}.`
  };
}

