import React from 'react'

export function StatusBadge({ variant, children }: { variant: 'active' | 'expired' | 'rejected' | 'pending'; children?: React.ReactNode }) {
  const cls =
    variant === 'active'
      ? 'text-[#28a745] font-medium'
      : variant === 'expired'
      ? 'text-[#dc3545] font-medium'
      : variant === 'rejected'
      ? 'text-[#dc3545] font-medium'
      : 'text-[#8a99b5] font-medium'
  return <span className={cls}>{children || variant}</span>
}

export default StatusBadge


