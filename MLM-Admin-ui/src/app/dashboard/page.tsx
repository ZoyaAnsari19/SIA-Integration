"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { getDashboard, type DashboardResponse } from '../../lib/api/dashboard'
import { getPendingKYCs } from '../../lib/api/kyc'
import { getMyPermissions } from '../../lib/api/sub-admins'
import { getSupportSummary, type SupportSummary } from '../../lib/api/support'

// Helper function to format currency
const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '0.00'
  }
  return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Helper function to format number
const formatNumber = (num: number | null | undefined): string => {
  if (num === null || num === undefined || isNaN(num)) {
    return '0'
  }
  return num.toLocaleString('en-IN')
}

// Ecosystem links: quick redirect to other admin panels in the group
type EcosystemLink = {
  title: string
  subtitle: string
  host: string
  url: string
  gradient: string
  icon: React.ReactNode
}

const ecosystemLinks: EcosystemLink[] = [
  {
    title: 'Networker',
    subtitle: 'Binary Admin',
    host: 'admin-binary.securepharma.co.in',
    url: 'https://admin-binary.securepharma.co.in/dashboard',
    gradient: 'from-indigo-500 via-indigo-600 to-blue-600',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="2" />
        <circle cx="5" cy="19" r="2" />
        <circle cx="19" cy="19" r="2" />
        <path d="M12 7v4" />
        <path d="M12 11l-6 6" />
        <path d="M12 11l6 6" />
      </svg>
    ),
  },
  {
    title: 'Secure Coin',
    subtitle: 'Coin Admin',
    host: 'admin.securecoin.co.in',
    url: 'https://admin.securecoin.co.in/login',
    gradient: 'from-amber-500 via-orange-500 to-yellow-600',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M14.8 9.5a3 3 0 0 0-5.6 0" />
        <path d="M9.2 14.5a3 3 0 0 0 5.6 0" />
        <path d="M12 7v10" />
      </svg>
    ),
  },
  {
    title: 'SecurePharma',
    subtitle: 'Main Admin',
    host: 'admin.securepharma.co.in',
    url: 'https://admin.securepharma.co.in/admin/login',
    gradient: 'from-emerald-500 via-green-600 to-teal-600',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.5 20.5a4.95 4.95 0 0 1-7-7l10-10a4.95 4.95 0 0 1 7 7Z" />
        <path d="m8.5 8.5 7 7" />
      </svg>
    ),
  },
  {
    title: 'Franchise',
    subtitle: 'Franchise Admin',
    host: 'franchise.securepharma.co.in',
    url: 'https://franchise.securepharma.co.in',
    gradient: 'from-rose-500 via-pink-600 to-red-600',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l1-5h16l1 5" />
        <path d="M5 9v11h14V9" />
        <path d="M3 9h18" />
        <path d="M10 14h4v6h-4z" />
      </svg>
    ),
  },
  {
    title: 'Retailer',
    subtitle: 'Retailer Portal',
    host: 'retailer.securepharma.co.in',
    url: 'https://retailer.securepharma.co.in',
    gradient: 'from-violet-500 via-purple-600 to-fuchsia-600',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
  },
  {
    title: 'Distributor',
    subtitle: 'SCM Distributor',
    host: 'distributor.securepharma.co.in',
    url: 'https://distributor.securepharma.co.in/scm/distributor',
    gradient: 'from-cyan-500 via-sky-600 to-blue-600',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 17h4V5H2v12h3" />
        <path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h2" />
        <circle cx="7.5" cy="17.5" r="2.5" />
        <circle cx="17.5" cy="17.5" r="2.5" />
      </svg>
    ),
  },
]

const variantStyles: Record<string, { border: string; bg: string; icon: string }> = {
  green: { border: 'border-l-emerald-500', bg: 'bg-emerald-50', icon: 'text-emerald-600' },
  teal: { border: 'border-l-teal-500', bg: 'bg-teal-50', icon: 'text-teal-600' },
  orange: { border: 'border-l-amber-500', bg: 'bg-amber-50', icon: 'text-amber-600' },
  purple: { border: 'border-l-violet-500', bg: 'bg-violet-50', icon: 'text-violet-600' },
  indigo: { border: 'border-l-indigo-500', bg: 'bg-indigo-50', icon: 'text-indigo-600' },
  red: { border: 'border-l-rose-500', bg: 'bg-rose-50', icon: 'text-rose-600' },
  blue: { border: 'border-l-blue-500', bg: 'bg-blue-50', icon: 'text-blue-600' },
}

function StatCard ({
  title,
  value,
  variant,
  icon,
  iconFor,
}: {
  title: string
  value: string
  variant: string
  icon?: React.ReactNode
  iconFor: (v: string) => React.ReactNode
}) {
  const style = variantStyles[variant] || variantStyles.blue
  return (
    <div
      className={`stat-card-hover flex items-center justify-between bg-white px-5 py-5 rounded-xl border border-slate-100 border-l-4 ${style.border} shadow-sm transition-all duration-200`}
    >
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 truncate">{title}</span>
        <span className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight tabular-nums truncate">{value}</span>
      </div>
      <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center shadow-sm ${style.bg} ${style.icon}`}>
        {icon || iconFor(variant)}
      </div>
    </div>
  )
}

export default function Page() {
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null)
  const [pendingKYCCount, setPendingKYCCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adminRole, setAdminRole] = useState<string>('SUPER_ADMIN')
  const [adminPermissions, setAdminPermissions] = useState<string[]>([])
  /** Avoid showing permission-gated UI (e.g. Ecosystem) until /my-permissions has returned */
  const [adminRoleReady, setAdminRoleReady] = useState(false)
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [showDateFilter, setShowDateFilter] = useState<boolean>(false)
  const [showSmsNotification, setShowSmsNotification] = useState<boolean>(false)
  const [showMonthlyBalance, setShowMonthlyBalance] = useState<boolean>(false)
  const [supportSummary, setSupportSummary] = useState<SupportSummary | null>(null)

  // Fetch dashboard data
  const fetchDashboard = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      console.log('📊 Fetching dashboard data...')
      const params: { start_date?: string; end_date?: string } = {}
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate
      
      // Fetch dashboard data
      const dashboardDataResult = await getDashboard(Object.keys(params).length > 0 ? params : undefined)
      console.log('✅ Dashboard API Response:', dashboardDataResult)
      setDashboardData(dashboardDataResult)
      
      // Fetch pending KYC count from dedicated endpoint (same as KYC Requests tab)
      try {
        const pendingResponse = await getPendingKYCs()
        const pendingCount = pendingResponse.count ?? pendingResponse.items?.length ?? 0
        console.log('✅ Pending KYC Count (from /admin/kyc/pending):', pendingCount)
        setPendingKYCCount(pendingCount)
      } catch (err: any) {
        console.warn('Could not fetch pending KYC count:', err)
        setPendingKYCCount(0)
      }

      // Fetch support ticket summary for dashboard KPIs
      try {
        const summary = await getSupportSummary()
        setSupportSummary(summary)
      } catch (err: any) {
        console.warn('Could not fetch support ticket summary:', err)
        setSupportSummary(null)
      }
    } catch (err: any) {
      console.error('❌ Error fetching dashboard:', err)
      setError(err.message || 'Failed to load dashboard data')
    } finally {
      setIsLoading(false)
    }
  }, [startDate, endDate])

  // Fetch admin role + permissions (Ecosystem visibility for sub-admins)
  useEffect(() => {
    const fetchAdminRole = async () => {
      try {
        const { role, permissions } = await getMyPermissions()
        setAdminRole(role)
        setAdminPermissions(permissions ?? [])
      } catch (err) {
        console.error('Error fetching admin role:', err)
        setAdminRole('SUPER_ADMIN')
        setAdminPermissions([])
      } finally {
        setAdminRoleReady(true)
      }
    }
    fetchAdminRole()
  }, [])

  const canViewEcosystem = useMemo(() => {
    if (!adminRoleReady) return false
    if (adminRole === 'SUPER_ADMIN') return true
    return adminPermissions.includes('ECOSYSTEM_VIEW')
  }, [adminRole, adminPermissions, adminRoleReady])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  // Check SMS balance and show notification if low or ended
  useEffect(() => {
    if (dashboardData) {
      const smsLeft = Number(dashboardData.sms_left) || 0
      const smsBalance = Number(dashboardData.sms_wallet_balance) || 0
      
      // Show notification if SMS left is 0 or balance is 0 or very low (< 100)
      if (smsLeft === 0 || smsBalance === 0 || smsBalance < 100) {
        setShowSmsNotification(true)
      } else {
        setShowSmsNotification(false)
      }
    }
  }, [dashboardData])

  const handleRechargeNow = () => {
    window.open('https://www.fast2sms.com', '_blank')
  }

  // Map API data to stats
  const stats = useMemo(() => {
    // Use default values if data is not loaded yet
    const data = dashboardData || {
      sms_wallet_balance: 0,
      sms_left: 0,
      activation_pending_count: 0,
      total_system_amount: 0,
      total_users: 0,
      package_activated: 0,
      users_with_active_package: 0,
      users_with_no_active_package: 0,
      total_deposit_from_all_users: 0,
      monthly_business: 0,
      monthly_new_purchase_manual: 0,
      monthly_upgrade: 0,
      monthly_renewal: 0,
      monthly_reinvestment: 0,
      total_self_income_given: 0,
      total_royalty_given: 0,
      total_spot: 0,
      total_withdrawal: 0,
      pending_withdrawal_amount: 0,
      total_main_wallet: 0,
      total_spot_wallet: 0,
      pending_kyc_count: 0,
      kyc_approved_today: 0,
    }

    console.log('📊 Mapping dashboard data:', data)
    console.log('📊 total_system_amount in data:', data.total_system_amount)
    console.log('📊 total_system_amount type:', typeof data.total_system_amount)

    // Ensure all values are numbers (handle null/undefined from API)
    const safeData = {
      sms_wallet_balance: Number(data.sms_wallet_balance) || 0,
      sms_left: Number(data.sms_left) || 0,
      activation_pending_count: Number(data.activation_pending_count) || 0,
      total_system_amount: Number(data.total_system_amount) || 0,
      total_users: Number(data.total_users) || 0,
      package_activated: Number(data.package_activated) || 0,
      users_with_active_package: Number(data.users_with_active_package) ?? 0,
      users_with_no_active_package: Number(data.users_with_no_active_package) ?? 0,
      total_deposit_from_all_users: Number(data.total_deposit_from_all_users) || 0,
      monthly_business: Number(data.monthly_business) || 0,
      monthly_new_purchase_manual: Number(data.monthly_new_purchase_manual) || 0,
      monthly_upgrade: Number(data.monthly_upgrade) || 0,
      monthly_renewal: Number(data.monthly_renewal) || 0,
      monthly_reinvestment: Number(data.monthly_reinvestment) || 0,
      total_self_income_given: Number(data.total_self_income_given) || 0,
      total_royalty_given: Number(data.total_royalty_given) || 0,
      total_spot: Number(data.total_spot) || 0,
      total_withdrawal: Number(data.total_withdrawal) || 0,
      pending_withdrawal_amount: Number(data.pending_withdrawal_amount) || 0,
      total_main_wallet: Number(data.total_main_wallet) || 0,
      total_spot_wallet: Number(data.total_spot_wallet) || 0,
      pending_kyc_count: pendingKYCCount, // Use the separately fetched count
      kyc_approved_today: Number(data.kyc_approved_today) || 0,
      support_open: Number(supportSummary?.open ?? 0) || 0,
      support_in_progress: Number(supportSummary?.in_progress ?? 0) || 0,
      support_closed: Number(supportSummary?.closed ?? 0) || 0,
    }

    console.log('✅ Safe data mapped:', safeData)
    console.log('✅ total_system_amount in safeData:', safeData.total_system_amount)

    // All available stats
    const allStats = [
      {
        title: 'SMS WALLET BALANCE',
        value: formatCurrency(safeData.sms_wallet_balance),
        variant: 'blue' as const,
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
      {
        title: 'SMS LEFT',
        value: formatNumber(safeData.sms_left),
        variant: 'blue' as const,
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
      {
        title: 'TOTAL USERS',
        value: formatNumber(safeData.total_users),
        variant: 'blue' as const,
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
      { title: 'PACKAGE ACTIVATED', value: formatNumber(safeData.package_activated), variant: 'green' as const },
      { title: 'USERS WITH ACTIVE PACKAGE', value: formatNumber(safeData.users_with_active_package), variant: 'green' as const },
      { title: 'USERS WITH NO ACTIVE PACKAGE', value: formatNumber(safeData.users_with_no_active_package), variant: 'orange' as const },
      { title: 'PENDING REQUESTS', value: formatNumber(safeData.activation_pending_count), variant: 'teal' as const },
      { title: 'Total Deposit (From All User)', value: formatCurrency(safeData.total_deposit_from_all_users), variant: 'green' as const },
      { 
        title: 'Monthly Business', 
        value: formatCurrency(safeData.monthly_business), 
        variant: 'green' as const,
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
      { title: 'Monthly New Purchase (Manual)', value: formatCurrency(safeData.monthly_new_purchase_manual), variant: 'green' as const },
      { title: 'Monthly Upgrade', value: formatCurrency(safeData.monthly_upgrade), variant: 'green' as const },
      { title: 'Monthly Renewal', value: formatCurrency(safeData.monthly_renewal), variant: 'green' as const },
      { title: 'Monthly Reinvestment', value: formatCurrency(safeData.monthly_reinvestment), variant: 'green' as const },
      { title: 'Total Self Income Given', value: formatCurrency(safeData.total_self_income_given), variant: 'green' as const },
      { title: 'Total Royalty Given', value: formatCurrency(safeData.total_royalty_given), variant: 'green' as const },
      { title: 'Total Spot (Direct + Level based)', value: formatCurrency(safeData.total_spot), variant: 'green' as const },
      { 
        title: 'Total Withdrawal', 
        value: formatCurrency(safeData.total_withdrawal), 
        variant: 'orange' as const,
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
            <path d="M12 2v20M17 5l-5 5-5-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
      { 
        title: 'Pending Withdrawals', 
        value: formatCurrency(safeData.pending_withdrawal_amount), 
        variant: 'red' as const,
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
            <path d="M12 22c5.523 0 10-3.582 10-8s-4.477-8-10-8S2 9.582 2 14s4.477 8 10 8Z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 8v6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="17" r="1" />
          </svg>
        ),
      },
      { 
        title: 'Total Main Wallet Balance', 
        value: formatCurrency(safeData.total_main_wallet), 
        variant: 'purple' as const,
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
            <rect x="2" y="4" width="20" height="16" rx="2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6 8h12M6 12h12M6 16h8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
      { 
        title: 'Total Spot Wallet Balance', 
        value: formatCurrency(safeData.total_spot_wallet), 
        variant: 'indigo' as const,
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
            <circle cx="12" cy="12" r="10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 6v6l4 2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
      { 
        title: 'Pending KYC Count', 
        value: formatNumber(safeData.pending_kyc_count), 
        variant: 'red' as const,
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
            <path d="M9 12l2 2 4-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 21c0-1-1-3-3-3s-3 2-3 3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 3c0 1 1 3 3 3s3-2 3-3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
      { 
        title: 'KYC Approved Today', 
        value: formatNumber(safeData.kyc_approved_today), 
        variant: 'green' as const,
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="22 4 12 14.01 9 11.01" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
      {
        title: 'Support Tickets - Open',
        value: formatNumber(safeData.support_open),
        variant: 'orange' as const,
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M15 3h6v6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 14 21 3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
      {
        title: 'Support Tickets - In Progress',
        value: formatNumber(safeData.support_in_progress),
        variant: 'blue' as const,
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h11" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="18" cy="6" r="3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
      {
        title: 'Support Tickets - Closed',
        value: formatNumber(safeData.support_closed),
        variant: 'green' as const,
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="m9 12 2 2 4-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
    ]

    // Filter stats based on admin role
    // SUB_ADMIN should only see: Pending Activation, KYC Approved Today, Pending KYC Count, SMS LEFT, SMS WALLET BALANCE, Pending Withdrawals, Support ticket status
    if (adminRole === 'SUB_ADMIN') {
      const allowedTitles = [
        'PENDING REQUESTS',
        'KYC Approved Today',
        'Pending KYC Count',
        'SMS LEFT',
        'SMS WALLET BALANCE',
        'Pending Withdrawals',
        'Support Tickets - Open',
        'Support Tickets - In Progress',
        'Support Tickets - Closed',
        'USERS WITH ACTIVE PACKAGE',
        'USERS WITH NO ACTIVE PACKAGE',
      ]
      return allStats.filter(stat => allowedTitles.includes(stat.title))
    }

    // SUPER_ADMIN sees all stats
    return allStats
  }, [dashboardData, adminRole, pendingKYCCount, supportSummary])

  // Section grouping for SUPER_ADMIN (cleaner layout)
  const sections = useMemo(() => {
    const sectionConfig = [
      { id: 'overview', title: 'Overview', subtitle: 'Users & system', keys: ['SMS WALLET BALANCE', 'SMS LEFT', 'TOTAL USERS', 'PACKAGE ACTIVATED', 'USERS WITH ACTIVE PACKAGE', 'USERS WITH NO ACTIVE PACKAGE', 'PENDING REQUESTS'] },
      { id: 'monthly', title: 'Monthly Business', subtitle: 'Current period', keys: ['Total Deposit (From All User)', 'Monthly Business', 'Monthly New Purchase (Manual)', 'Monthly Upgrade', 'Monthly Renewal', 'Monthly Reinvestment'] },
      { id: 'income', title: 'Income & Commission', subtitle: 'Given to users', keys: ['Total Self Income Given', 'Total Royalty Given', 'Total Spot (Direct + Level based)'] },
      { id: 'wallets', title: 'Withdrawals & Wallets', subtitle: 'Balances', keys: ['Total Withdrawal', 'Pending Withdrawals', 'Total Main Wallet Balance', 'Total Spot Wallet Balance'] },
      { id: 'kyc', title: 'KYC & Alerts', subtitle: 'Verification', keys: ['Pending KYC Count', 'KYC Approved Today'] },
      { id: 'support', title: 'Support Tickets', subtitle: 'Status', keys: ['Support Tickets - Open', 'Support Tickets - In Progress', 'Support Tickets - Closed'] },
    ]
    return sectionConfig
  }, [])

  const periodLabel = useMemo(() => {
    if (startDate && endDate) return `Custom: ${startDate} – ${endDate}`
    const now = new Date()
    const monthName = now.toLocaleString('en-IN', { month: 'long' })
    return `${monthName} ${now.getFullYear()}`
  }, [startDate, endDate])

  const iconFor = (variant: string) => {
    if (variant === 'green') {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
          <circle cx="10" cy="20.5" r="1" />
          <circle cx="18" cy="20.5" r="1" />
          <path d="M2.5 2.5h3l2.7 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6l1.6-8.4H7.1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    }
    if (variant === 'teal') {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="8.5" cy="7" r="4" />
          <line x1="20" y1="8" x2="20" y2="14" />
          <line x1="23" y1="11" x2="17" y2="11" />
        </svg>
      )
    }
    if (variant === 'orange') {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
          <path d="M12 2v20M17 5l-5 5-5-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    }
    if (variant === 'purple') {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
          <rect x="2" y="4" width="20" height="16" rx="2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 8h12M6 12h12M6 16h8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    }
    if (variant === 'indigo') {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
          <circle cx="12" cy="12" r="10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 6v6l4 2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    }
    return null
  }

  const handleDateFilterApply = () => {
    fetchDashboard()
  }

  const handleDateFilterReset = () => {
    setStartDate('')
    setEndDate('')
    setShowDateFilter(false)
    // fetchDashboard will be called automatically via useEffect when startDate/endDate change
  }

  const monthlyBusinessValue = Number(dashboardData?.monthly_business) || 0
  const totalUsers = Number(dashboardData?.total_users) || 0
  const packageActivated = Number(dashboardData?.package_activated) || 0
  const pendingActivation = Number(dashboardData?.activation_pending_count) || 0

  return (
    <div className="dashboard-page-bg min-h-full -m-4 p-4 sm:-m-5 sm:p-5 md:-m-6 md:p-6 rounded-xl">
      {/* SMS Recharge Notification Popup */}
      {showSmsNotification && dashboardData && (
        <div className="mb-5 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-md shadow-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className="flex-shrink-0 mt-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-800 mb-1">
                  SMS Service Recharge Required
                </h3>
                <p className="text-yellow-700 text-sm mb-3">
                  Your SMS service balance is running low. 
                  {Number(dashboardData.sms_left) === 0 && ' SMS count has reached zero.'}
                  {Number(dashboardData.sms_wallet_balance) === 0 && ' Wallet balance is zero.'}
                  {Number(dashboardData.sms_wallet_balance) > 0 && Number(dashboardData.sms_wallet_balance) < 100 && ' Wallet balance is below ₹100.'}
                  Please recharge to continue sending SMS notifications.
                </p>
                <div className="flex items-center gap-4 text-sm text-yellow-700 mb-3">
                  <span>Balance: ₹{formatCurrency(dashboardData.sms_wallet_balance)}</span>
                  <span>•</span>
                  <span>SMS Left: {formatNumber(dashboardData.sms_left)}</span>
                </div>
                <button
                  onClick={handleRechargeNow}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-medium rounded-md transition-colors flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Recharge Now
                </button>
              </div>
              <button
                onClick={() => setShowSmsNotification(false)}
                className="flex-shrink-0 text-yellow-600 hover:text-yellow-800 transition-colors p-1 hover:bg-yellow-100 rounded"
                aria-label="Dismiss notification"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header: title + period + date filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Key metrics at a glance</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {showDateFilter && (
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Start Date"
              />
              <span className="text-slate-400 text-sm">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="End Date"
              />
              <button
                onClick={handleDateFilterApply}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Apply
              </button>
              <button
                onClick={handleDateFilterReset}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md text-sm hover:bg-slate-200 transition-colors"
              >
                Reset
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-sm font-medium hidden sm:inline">{periodLabel}</span>
            <button
              onClick={() => setShowDateFilter(!showDateFilter)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all shadow-sm hover:shadow flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              {showDateFilter ? 'Hide Filter' : 'Custom Date Range'}
            </button>
          </div>
        </div>
      </div>

      {/* Ecosystem: SUPER_ADMIN always; SUB_ADMIN only if ECOSYSTEM_VIEW granted */}
      {canViewEcosystem && (
        <section className="mb-5 rounded-2xl bg-white border border-slate-100 shadow-lg p-3 sm:p-4">
          <div className="flex items-baseline justify-between gap-2 mb-2.5 flex-wrap">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-800">Ecosystem</h2>
              <span className="text-slate-400 text-xs sm:text-sm font-medium">Quick access to other admin panels</span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {ecosystemLinks.length} systems
            </span>
          </div>
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {ecosystemLinks.map((link) => (
              <a
                key={link.title}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`group relative overflow-hidden rounded-lg bg-gradient-to-br ${link.gradient} px-3 py-2 text-white shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="w-7 h-7 rounded-md bg-white/20 backdrop-blur flex items-center justify-center text-white shrink-0">
                    {link.icon}
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    className="w-3.5 h-3.5 text-white/80 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M7 17L17 7" />
                    <path d="M7 7h10v10" />
                  </svg>
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/80 leading-tight">{link.subtitle}</p>
                <p className="text-sm font-bold leading-tight text-white">{link.title}</p>
                <p className="text-[10px] text-white/65 mt-0.5 truncate leading-tight" title={link.host}>{link.host}</p>
                <div className="absolute -right-3 -bottom-3 w-14 h-14 rounded-full bg-white/10 blur-lg pointer-events-none" />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Hero: Monthly Business + Quick stats (only when data loaded, SUPER_ADMIN) */}
      {!isLoading && dashboardData && adminRole === 'SUPER_ADMIN' && (
        <>
          <div className="mb-6 rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-6 sm:p-8 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-emerald-100 text-sm font-medium uppercase tracking-wider mb-1">This period</p>
                <p className="text-white/90 text-lg mb-2">{periodLabel}</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-4xl sm:text-5xl font-bold text-white tracking-tight tabular-nums drop-shadow-sm">
                    {showMonthlyBalance ? `₹${formatCurrency(monthlyBusinessValue)}` : '₹ •••••••••'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowMonthlyBalance((v) => !v)}
                    className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
                    aria-label={showMonthlyBalance ? 'Hide balance' : 'Show balance'}
                    title={showMonthlyBalance ? 'Hide balance' : 'Show balance'}
                  >
                    {showMonthlyBalance ? (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-6 h-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-6 h-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-emerald-100 text-sm mt-2 font-medium">Monthly Business</p>
              </div>
              <div className="hidden sm:flex w-24 h-24 rounded-2xl bg-white/20 backdrop-blur items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-12 h-12 text-white" strokeWidth="1.5">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm font-medium text-slate-700">
              <span className="text-slate-500 text-xs uppercase tracking-wider">Users</span>
              <p className="text-lg font-bold tabular-nums">{formatNumber(totalUsers)}</p>
            </div>
            <div className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm font-medium text-slate-700">
              <span className="text-slate-500 text-xs uppercase tracking-wider">Activated</span>
              <p className="text-lg font-bold tabular-nums">{formatNumber(packageActivated)}</p>
            </div>
            <div className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm font-medium text-slate-700">
              <span className="text-slate-500 text-xs uppercase tracking-wider">Pending activation</span>
              <p className="text-lg font-bold tabular-nums">{formatNumber(pendingActivation)}</p>
            </div>
          </div>
        </>
      )}
      
      {error && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 font-semibold">Error: {error}</p>
          <p className="text-red-600 text-sm mt-2">
            Please check browser console (F12) for more details.
          </p>
          <button
            onClick={fetchDashboard}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-8">
          {[1, 2, 3].map((block) => (
            <div key={block}>
              <div className="h-5 w-40 bg-slate-200 rounded animate-pulse mb-4" />
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
                    <div className="h-4 w-24 bg-slate-200 rounded animate-pulse mb-3" />
                    <div className="h-8 w-32 bg-slate-200 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : adminRole === 'SUB_ADMIN' ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map(({ title, value, variant, icon }, idx) => (
            <StatCard key={idx} title={title} value={value} variant={variant} icon={icon} iconFor={iconFor} />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {sections.map((section) => {
            const sectionStats = stats.filter((s) => section.keys.includes(s.title))
            if (sectionStats.length === 0) return null
            const isMonthly = section.id === 'monthly'
            return (
              <section
                key={section.id}
                className={`rounded-2xl overflow-hidden shadow-lg border border-slate-100/80 p-5 sm:p-6 ${
                  isMonthly ? 'bg-gradient-to-br from-emerald-50/60 to-white' : 'bg-white'
                }`}
              >
                <div className="flex items-baseline gap-2 mb-4">
                  <h2 className="text-lg font-bold text-slate-800">{section.title}</h2>
                  <span className="text-slate-400 text-sm font-medium">{section.subtitle}</span>
                </div>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
                  {sectionStats.map(({ title, value, variant, icon }, idx) => (
                    <StatCard key={idx} title={title} value={value} variant={variant} icon={icon} iconFor={iconFor} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
      
      <footer className="pt-8 mt-8 text-left text-slate-400 text-sm border-t border-slate-200">2025 ©</footer>
    </div>
  )
}


