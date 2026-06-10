"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, TextInput, DateRangeInput } from '../../../components/ui/FiltersBar'
import Pagination from '../../../components/ui/Pagination'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import { getActivityLogs, type ActivityLog, type ActivityLogsQuery } from '../../../lib/mock/activity-logs'
import { getSubAdmins, type SubAdmin, getMyPermissions } from '../../../lib/mock/sub-admins'
import { exportToCsv } from '../../../lib/export'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type ActivityLogRow = {
  id: string
  timestamp: string
  admin_name: string
  admin_email: string
  action_type: string
  target_user: string
  details: string
  status: 'success' | 'failed' | 'error'
  ip_address: string | null
}

// Action type labels
const ACTION_LABELS: Record<string, string> = {
  KYC_APPROVE: 'KYC Approved',
  KYC_REJECT: 'KYC Rejected',
  PACKAGE_ASSIGN: 'Package Assigned',
  WALLET_MANAGE: 'Wallet Managed',
  WALLET_CREDIT: 'Wallet Credited',
  WALLET_DEBIT: 'Wallet Debited',
  WITHDRAWAL_APPROVE: 'Withdrawal Approved',
  WITHDRAWAL_REJECT: 'Withdrawal Rejected',
  USER_BLOCK: 'User Blocked',
  USER_UNBLOCK: 'User Unblocked',
  USER_DELETE: 'User Deleted',
  USER_UPDATE: 'User Updated',
  ACTIVATION_APPROVE: 'Activation Approved',
  ACTIVATION_REJECT: 'Activation Rejected',
  COMMISSION_MANUAL_CREDIT: 'Commission Credited',
  COMMISSION_MANUAL_DEBIT: 'Commission Debited',
}

// Format date
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString)
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return dateString
  }
}

export default function SubAdminActivityPage() {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Filters
  const [adminFilter, setAdminFilter] = useState<string>('')
  const [actionTypeFilter, setActionTypeFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed' | 'error'>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  
  // Sub-admins list for filter dropdown
  const [subAdmins, setSubAdmins] = useState<SubAdmin[]>([])
  const [adminRole, setAdminRole] = useState<string>('SUPER_ADMIN')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(30) // seconds
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Copy to clipboard function
  const copyToClipboard = useCallback((text: string, fieldName: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldName)
      setTimeout(() => setCopiedField(null), 2000)
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopiedField(fieldName)
      setTimeout(() => setCopiedField(null), 2000)
    })
  }, [])

  // Check if user is SUPER_ADMIN
  useEffect(() => {
    const checkRole = async () => {
      try {
        const { role } = await getMyPermissions()
        setAdminRole(role)
        if (role !== 'SUPER_ADMIN') {
          // Redirect if not SUPER_ADMIN
          router.push('/dashboard')
        }
      } catch (error) {
        console.error('Error checking admin role:', error)
        router.push('/dashboard')
      }
    }
    checkRole()
  }, [router])

  // Fetch sub-admins for filter dropdown
  useEffect(() => {
    const fetchSubAdmins = async () => {
      try {
        // Fetch all sub-admins in batches (max limit is 100)
        const allSubAdmins: SubAdmin[] = []
        let page = 1
        const limit = 100
        
        while (true) {
          const response = await getSubAdmins({ page, limit })
          allSubAdmins.push(...response.items)
          
          // If we got less than limit, we've reached the end
          if (response.items.length < limit) {
            break
          }
          page++
        }
        
        setSubAdmins(allSubAdmins)
      } catch (err) {
        console.error('Error fetching sub-admins:', err)
        // On error, just set empty array
        setSubAdmins([])
      }
    }
    if (adminRole === 'SUPER_ADMIN') {
      fetchSubAdmins()
    }
  }, [adminRole])

  // Fetch activity logs
  const fetchLogs = useCallback(async () => {
    if (adminRole !== 'SUPER_ADMIN') return
    
    try {
      setIsLoading(true)
      setError(null)

      const query: ActivityLogsQuery = {
        page,
        limit: pageSize,
      }

      if (adminFilter) {
        query.admin_user_id = adminFilter
      }

      if (actionTypeFilter) {
        query.action_type = actionTypeFilter
      }

      if (statusFilter !== 'all') {
        query.status = statusFilter
      }

      if (startDate) {
        query.start_date = startDate
      }

      if (endDate) {
        query.end_date = endDate
      }

      const response = await getActivityLogs(query)
      console.log('📊 Activity logs response:', response.logs)
      // Debug: Check wallet manage logs
      const walletLogs = response.logs.filter(l => l.action_type === 'WALLET_MANAGE')
      if (walletLogs.length > 0) {
        console.log('💰 Wallet manage logs:', walletLogs)
        walletLogs.forEach(log => {
          console.log(`  Log ID ${log.id}:`, {
            action_details: log.action_details,
            action_details_type: typeof log.action_details,
            action_details_keys: log.action_details ? Object.keys(log.action_details) : 'null/undefined',
            action_summary: log.action_summary,
            has_action_summary: !!log.action_summary
          })
        })
      }
      setLogs(response.logs)
      setTotal(response.pagination.total)
    } catch (err: any) {
      console.error('Error fetching activity logs:', err)
      setError(err.message || 'Failed to fetch activity logs')
      setLogs([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, adminFilter, actionTypeFilter, statusFilter, startDate, endDate, adminRole])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh || adminRole !== 'SUPER_ADMIN') return

    const interval = setInterval(() => {
      fetchLogs()
    }, refreshInterval * 1000)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchLogs, adminRole])

  // Format action details for display
  const formatActionDetails = (log: ActivityLog): string => {
    // First, try to use action_summary if available (more reliable)
    if (log.action_summary && log.action_summary.trim()) {
      console.log(`✅ Using action_summary for log ${log.id}:`, log.action_summary);
      return log.action_summary;
    }
    
    // Debug if summary is missing
    if (log.action_type === 'WALLET_MANAGE') {
      console.warn(`⚠️ No action_summary for WALLET_MANAGE log ${log.id}:`, {
        has_summary: !!log.action_summary,
        summary_value: log.action_summary
      });
    }

    try {
      // Handle null, undefined, or empty action_details
      if (!log.action_details) {
        // If no action_details and no summary, return generic message
        return log.action_summary || 'No details available'
      }

      // Parse if string, otherwise use as-is
      let details: any = log.action_details
      if (typeof log.action_details === 'string') {
        try {
          details = JSON.parse(log.action_details)
        } catch (e) {
          console.error('Error parsing action_details JSON:', e, log.action_details)
          return log.action_summary || 'Invalid details format'
        }
      }

      if (!details || typeof details !== 'object' || Object.keys(details).length === 0) {
        // If action_details is empty, fall back to summary
        return log.action_summary || 'No details available'
      }

      // Debug: Log wallet manage actions
      if (log.action_type === 'WALLET_MANAGE') {
        console.log('💰 Formatting WALLET_MANAGE details:', {
          logId: log.id,
          action_details: details,
          keys: Object.keys(details),
          main_wallet_amount: details.main_wallet_amount,
          spot_wallet_amount: details.spot_wallet_amount,
          has_summary: !!log.action_summary
        })
      }

      const parts: string[] = []

      if (details.user_display_id) {
        parts.push(`User: ${details.user_display_id}`)
      }
      if (details.user_name) {
        parts.push(`Name: ${details.user_name}`)
      }
      if (details.package_name) {
        parts.push(`Package: ${details.package_name}`)
      }
      
      // Wallet management details - show clearly
      // Check if this is a wallet management action
      const hasMainWallet = 'main_wallet_amount' in details && details.main_wallet_amount !== undefined && details.main_wallet_amount !== null
      const hasSpotWallet = 'spot_wallet_amount' in details && details.spot_wallet_amount !== undefined && details.spot_wallet_amount !== null
      const hasTeamRoyaltyWallet = 'team_royalty_wallet_amount' in details && details.team_royalty_wallet_amount !== undefined && details.team_royalty_wallet_amount !== null
      
      if (hasMainWallet || hasSpotWallet || hasTeamRoyaltyWallet) {
        if (hasMainWallet) {
          const amount = Number(details.main_wallet_amount)
          if (!isNaN(amount)) {
            const sign = amount >= 0 ? '+' : '-'
            const absAmount = Math.abs(amount)
            let mainStr = `Main: ${sign}₹${absAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
            
            // Show balance change if available
            if (details.old_main_balance !== undefined && details.new_main_balance !== undefined) {
              const oldBal = Number(details.old_main_balance)
              const newBal = Number(details.new_main_balance)
              if (!isNaN(oldBal) && !isNaN(newBal)) {
                mainStr += ` (₹${oldBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} → ₹${newBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`
              }
            }
            parts.push(mainStr)
          }
        }
        
        if (hasSpotWallet) {
          const amount = Number(details.spot_wallet_amount)
          if (!isNaN(amount)) {
            const sign = amount >= 0 ? '+' : '-'
            const absAmount = Math.abs(amount)
            let spotStr = `Spot: ${sign}₹${absAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
            
            // Show balance change if available
            if (details.old_spot_balance !== undefined && details.new_spot_balance !== undefined) {
              const oldBal = Number(details.old_spot_balance)
              const newBal = Number(details.new_spot_balance)
              if (!isNaN(oldBal) && !isNaN(newBal)) {
                spotStr += ` (₹${oldBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} → ₹${newBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`
              }
            }
            parts.push(spotStr)
          }
        }
        
        if (hasTeamRoyaltyWallet) {
          const amount = Number(details.team_royalty_wallet_amount)
          if (!isNaN(amount)) {
            const sign = amount >= 0 ? '+' : '-'
            const absAmount = Math.abs(amount)
            let teamStr = `Team Royalty: ${sign}₹${absAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
            if (details.old_team_royalty_balance !== undefined && details.new_team_royalty_balance !== undefined) {
              const oldBal = Number(details.old_team_royalty_balance)
              const newBal = Number(details.new_team_royalty_balance)
              if (!isNaN(oldBal) && !isNaN(newBal)) {
                teamStr += ` (₹${oldBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} → ₹${newBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`
              }
            }
            parts.push(teamStr)
          }
        }
      }
      
      if (details.withdrawal_amount !== undefined) {
        parts.push(`Amount: ₹${Number(details.withdrawal_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
      }
      
      if (details.rejection_reason) {
        parts.push(`Reason: ${details.rejection_reason}`)
      }
      if (details.reason) {
        parts.push(`Reason: ${details.reason}`)
      }

      return parts.length > 0 ? parts.join(' | ') : 'No details'
    } catch (error) {
      console.error('Error formatting action details:', error, log)
      return 'Error loading details'
    }
  }

  const columns: Array<DataTableColumn<ActivityLogRow>> = useMemo(() => {
    const handleViewDetails = (row: ActivityLogRow) => {
      const log = logs.find(l => l.id === row.id)
      if (log) {
        console.log('🔍 Opening modal for log:', {
          id: log.id,
          action_type: log.action_type,
          action_details: log.action_details,
          action_details_type: typeof log.action_details,
          action_details_keys: log.action_details ? Object.keys(log.action_details) : 'null/undefined',
          full_log: log
        })
        setSelectedLog(log)
        setIsModalOpen(true)
      } else {
        console.error('❌ Log not found for row:', row.id, 'Available logs:', logs.map(l => l.id))
      }
    }

    return [
    {
      key: 'timestamp',
      title: 'Timestamp',
      render: (r: ActivityLogRow) => (
        <span className="text-sm text-gray-600">{formatDate(r.timestamp)}</span>
      ),
    },
    {
      key: 'admin_name',
      title: 'Sub-Admin',
      render: (r: ActivityLogRow) => (
        <div className="flex flex-col">
          <span className="font-semibold">{r.admin_name || 'N/A'}</span>
          <span className="text-xs text-gray-500">{r.admin_email}</span>
        </div>
      ),
    },
    {
      key: 'action_type',
      title: 'Action',
      render: (r: ActivityLogRow) => (
        <span className="font-medium text-blue-600">
          {ACTION_LABELS[r.action_type] || r.action_type}
        </span>
      ),
    },
    {
      key: 'target_user',
      title: 'Target User',
      render: (r: ActivityLogRow) => (
        <span className="font-mono text-sm">{r.target_user || 'N/A'}</span>
      ),
    },
    {
      key: 'details',
      title: 'Details',
      render: (r: ActivityLogRow) => (
        <button
          onClick={() => handleViewDetails(r)}
          className="text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left"
          title="Click to view full details"
        >
          {r.details.length > 50 ? `${r.details.substring(0, 50)}...` : r.details}
        </button>
      ),
    },
    {
      key: 'status',
      title: 'Status',
      render: (r: ActivityLogRow) => {
        const statusColors = {
          success: 'bg-green-100 text-green-800',
          failed: 'bg-red-100 text-red-800',
          error: 'bg-orange-100 text-orange-800',
        }
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[r.status] || 'bg-gray-100 text-gray-800'}`}>
            {r.status.toUpperCase()}
          </span>
        )
      },
    },
    {
      key: 'ip_address',
      title: 'IP Address',
      render: (r: ActivityLogRow) => (
        <span className="text-xs text-gray-500 font-mono">{r.ip_address || 'N/A'}</span>
      ),
    },
  ]
  }, [logs])

  const rows: ActivityLogRow[] = useMemo(() => {
    if (!logs || logs.length === 0) {
      return []
    }
    return logs.map(log => {
      // Ensure action_details is properly parsed if it's a string
      let parsedLog = { ...log }
      if (typeof log.action_details === 'string') {
        try {
          parsedLog.action_details = JSON.parse(log.action_details)
        } catch (e) {
          console.error('Error parsing action_details:', e, log.action_details)
        }
      }
      
      return {
        id: log.id,
        timestamp: log.created_at,
        admin_name: log.admin_name || 'Unknown',
        admin_email: log.admin_email || 'N/A',
        action_type: log.action_type,
        target_user: log.target_user_display_id || log.target_user_id || 'N/A',
        details: formatActionDetails(parsedLog),
        status: log.status,
        ip_address: log.ip_address,
      }
    })
  }, [logs])

  const handleExport = useCallback(() => {
    const headers = ['Timestamp', 'Sub-Admin', 'Admin Email', 'Action', 'Target User', 'Details', 'Status', 'IP Address']
    const csvRows = rows.map(row => [
      formatDate(row.timestamp),
      row.admin_name,
      row.admin_email,
      ACTION_LABELS[row.action_type] || row.action_type,
      row.target_user,
      row.details,
      row.status.toUpperCase(),
      row.ip_address || 'N/A',
    ])
    exportToCsv(`sub-admin-activity-${new Date().toISOString().split('T')[0]}.csv`, headers, csvRows)
  }, [rows])

  // Calculate statistics for dashboard charts
  const chartData = useMemo(() => {
    if (logs.length === 0) {
      return {
        actionsPerDay: [],
        successRate: { success: 0, failed: 0, error: 0 },
        topSubAdmins: [],
        actionTypeDistribution: [],
      }
    }

    // 1. Actions per day (last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - i))
      date.setHours(0, 0, 0, 0)
      return date.toISOString().split('T')[0]
    })

    const actionsPerDay = last7Days.map(date => {
      const count = logs.filter(log => {
        const logDate = new Date(log.created_at).toISOString().split('T')[0]
        return logDate === date
      }).length
      return {
        date: new Date(date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        count,
      }
    })

    // 2. Success rate
    const successCount = logs.filter(log => log.status === 'success').length
    const failedCount = logs.filter(log => log.status === 'failed').length
    const errorCount = logs.filter(log => log.status === 'error').length
    const successRate = {
      success: successCount,
      failed: failedCount,
      error: errorCount,
    }

    // 3. Top sub-admins (by action count)
    const adminCounts = new Map<string, { name: string; email: string; count: number }>()
    logs.forEach(log => {
      const key = log.admin_user_id
      const existing = adminCounts.get(key) || {
        name: log.admin_name || 'Unknown',
        email: log.admin_email || 'N/A',
        count: 0,
      }
      existing.count++
      adminCounts.set(key, existing)
    })

    const topSubAdmins = Array.from(adminCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(admin => ({
        name: admin.name.length > 15 ? admin.name.substring(0, 15) + '...' : admin.name,
        count: admin.count,
      }))

    // 4. Action type distribution
    const actionCounts = new Map<string, number>()
    logs.forEach(log => {
      const actionLabel = ACTION_LABELS[log.action_type] || log.action_type
      actionCounts.set(actionLabel, (actionCounts.get(actionLabel) || 0) + 1)
    })

    const actionTypeDistribution = Array.from(actionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }))

    return {
      actionsPerDay,
      successRate,
      topSubAdmins,
      actionTypeDistribution,
    }
  }, [logs])

  // Chart colors
  const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

  if (adminRole !== 'SUPER_ADMIN') {
    return (
      <div className="p-6">
        <Card>
          <div className="text-center py-8">
            <p className="text-red-600 font-semibold">Access Denied</p>
            <p className="text-gray-600 mt-2">Only SUPER_ADMIN can access this page.</p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6">
      <Card>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Sub-Admin Activity Logs</h1>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
              <input
                type="checkbox"
                id="auto-refresh"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="auto-refresh" className="text-sm text-gray-700 cursor-pointer">
                Auto-refresh ({refreshInterval}s)
              </label>
            </div>
            <Button variant="outline" onClick={handleExport}>
              Export
            </Button>
          </div>
        </div>

        <FiltersBar>
          <select
            value={adminFilter}
            onChange={(e) => {
              setAdminFilter(e.target.value)
              setPage(1)
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Sub-Admins</option>
            {subAdmins.map(admin => (
              <option key={admin.id} value={admin.id}>
                {admin.name} ({admin.email})
              </option>
            ))}
          </select>

          <select
            value={actionTypeFilter}
            onChange={(e) => {
              setActionTypeFilter(e.target.value)
              setPage(1)
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Actions</option>
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any)
              setPage(1)
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="error">Error</option>
          </select>

          <DateRangeInput
            id="date-range"
            label="Date Range:"
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={(date) => {
              setStartDate(date)
              setPage(1)
            }}
            onEndDateChange={(date) => {
              setEndDate(date)
              setPage(1)
            }}
          />
        </FiltersBar>

        {/* Activity Dashboard with Charts */}
        {!isLoading && logs.length > 0 && (
          <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Actions Per Day - Line Chart */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Actions Per Day (Last 7 Days)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData.actionsPerDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} name="Actions" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Success Rate - Pie Chart */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Success Rate</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Success', value: chartData.successRate.success },
                      { name: 'Failed', value: chartData.successRate.failed },
                      { name: 'Error', value: chartData.successRate.error },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(props: any) => {
                      const percentValue = props.percent ?? 0;
                      const name = props.name ?? '';
                      return `${name}: ${(percentValue * 100).toFixed(0)}%`;
                    }}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#f59e0b" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 flex justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>Success: {chartData.successRate.success}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span>Failed: {chartData.successRate.failed}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span>Error: {chartData.successRate.error}</span>
                </div>
              </div>
            </div>

            {/* Top Sub-Admins - Bar Chart */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Top 5 Sub-Admins (By Activity)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData.topSubAdmins} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" name="Actions" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Action Type Distribution - Pie Chart */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Action Type Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={chartData.actionTypeDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(props: any) => {
                      const percent = props.percent ?? 0;
                      const name = props.name ?? '';
                      return percent > 0.05 ? `${name}: ${(percent * 100).toFixed(0)}%` : '';
                    }}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.actionTypeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Summary Statistics Cards */}
        {!isLoading && logs.length > 0 && (
          <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-600 font-medium">Total Actions</div>
              <div className="text-2xl font-bold text-blue-800 mt-1">{logs.length}</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="text-sm text-green-600 font-medium">Success Rate</div>
              <div className="text-2xl font-bold text-green-800 mt-1">
                {logs.length > 0
                  ? `${((chartData.successRate.success / logs.length) * 100).toFixed(1)}%`
                  : '0%'}
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="text-sm text-purple-600 font-medium">Active Sub-Admins</div>
              <div className="text-2xl font-bold text-purple-800 mt-1">
                {new Set(logs.map(log => log.admin_user_id)).size}
              </div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <div className="text-sm text-orange-600 font-medium">Action Types</div>
              <div className="text-2xl font-bold text-orange-800 mt-1">
                {new Set(logs.map(log => log.action_type)).size}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-gray-600">Loading activity logs...</div>
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            minWidthPx={1600}
          />
        )}

        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize)
            setPage(1)
          }}
          pageSizeOptions={[10, 25, 50]}
        />

        {/* Activity Details Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedLog(null)
          }}
          title={
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Activity Details</span>
            </div>
          }
          size="xl"
        >
          {selectedLog && (
            <div className="space-y-6">
              {/* Header Section with Action Badge */}
              <div className="flex items-start justify-between pb-4 border-b border-gray-200">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                      selectedLog.action_type.includes('APPROVE') || selectedLog.action_type.includes('UNBLOCK')
                        ? 'bg-green-100 text-green-800'
                        : selectedLog.action_type.includes('REJECT') || selectedLog.action_type.includes('BLOCK')
                        ? 'bg-red-100 text-red-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {ACTION_LABELS[selectedLog.action_type] || selectedLog.action_type}
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      selectedLog.status === 'success' 
                        ? 'bg-green-100 text-green-800 border border-green-200'
                        : selectedLog.status === 'failed'
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : 'bg-orange-100 text-orange-800 border border-orange-200'
                    }`}>
                      {selectedLog.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDate(selectedLog.created_at)}
                  </p>
                </div>
              </div>

              {/* Main Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Sub-Admin */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Sub-Admin
                    </label>
                    <button
                      onClick={() => copyToClipboard(`${selectedLog.admin_name} (${selectedLog.admin_email})`, 'admin')}
                      className="text-blue-600 hover:text-blue-800 transition-colors"
                      title="Copy"
                    >
                      {copiedField === 'admin' ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-gray-800">
                    {selectedLog.admin_name || 'Unknown'}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {selectedLog.admin_email || 'N/A'}
                  </p>
                </div>

                {/* Target User */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 p-4 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-purple-700 uppercase tracking-wide flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      Target User
                    </label>
                    {(selectedLog.target_user_display_id || selectedLog.target_user_id) && (
                      <button
                        onClick={() => copyToClipboard(selectedLog.target_user_display_id || selectedLog.target_user_id || '', 'target_user')}
                        className="text-purple-600 hover:text-purple-800 transition-colors"
                        title="Copy"
                      >
                        {copiedField === 'target_user' ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                  <p className="text-sm font-mono font-semibold text-gray-800">
                    {selectedLog.target_user_display_id || selectedLog.target_user_id || 'N/A'}
                  </p>
                </div>

                {/* Timestamp */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 p-4 rounded-lg border border-gray-200">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Timestamp
                  </label>
                  <p className="text-sm font-medium text-gray-800">
                    {formatDate(selectedLog.created_at)}
                  </p>
                </div>

                {/* IP Address */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      IP Address
                    </label>
                    {selectedLog.ip_address && (
                      <button
                        onClick={() => copyToClipboard(selectedLog.ip_address || '', 'ip')}
                        className="text-gray-600 hover:text-gray-800 transition-colors"
                        title="Copy"
                      >
                        {copiedField === 'ip' ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                  <p className="text-sm font-mono text-gray-800">
                    {selectedLog.ip_address || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Error Message (if any) */}
              {selectedLog.error_message && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <label className="text-sm font-semibold text-red-800 block mb-1">Error Message</label>
                      <p className="text-sm text-red-700">
                        {selectedLog.error_message}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Details */}
              {(() => {
                // Debug: Log what we have
                console.log('📋 Modal rendering - selectedLog:', {
                  id: selectedLog.id,
                  action_type: selectedLog.action_type,
                  action_details: selectedLog.action_details,
                  action_details_type: typeof selectedLog.action_details,
                  action_details_is_object: selectedLog.action_details && typeof selectedLog.action_details === 'object',
                  action_details_keys: selectedLog.action_details ? Object.keys(selectedLog.action_details) : 'null/undefined',
                  action_details_length: selectedLog.action_details ? Object.keys(selectedLog.action_details).length : 0
                })
                
                // Parse action_details if it's a string
                let actionDetails: Record<string, any> | null = selectedLog.action_details as Record<string, any> | null
                if (typeof actionDetails === 'string') {
                  try {
                    actionDetails = JSON.parse(actionDetails)
                  } catch (e) {
                    console.error('Error parsing action_details string:', e)
                    actionDetails = null
                  }
                }
                
                // Check if we have valid action_details or action_summary
                const hasDetails = actionDetails && typeof actionDetails === 'object' && Object.keys(actionDetails).length > 0
                const hasSummary = selectedLog.action_summary && selectedLog.action_summary.trim()
                
                if (!hasDetails && !hasSummary) {
                  return (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-center">
                      <p className="text-sm text-gray-500">No additional details available for this action</p>
                      <p className="text-xs text-gray-400 mt-2">
                        Debug: action_details is {selectedLog.action_details ? typeof selectedLog.action_details : 'null/undefined'}
                        {selectedLog.action_details && typeof selectedLog.action_details === 'object' 
                          ? ` (${Object.keys(selectedLog.action_details).length} keys)` 
                          : ''}
                      </p>
                    </div>
                  )
                }
                
                // If no action_details but we have summary, show summary
                if (!hasDetails && hasSummary) {
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Action Summary
                        </label>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <p className="text-sm text-gray-800 font-medium">{selectedLog.action_summary}</p>
                      </div>
                    </div>
                  )
                }
                
                return (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Action Details
                    </label>
                    <button
                      onClick={() => {
                        const detailsToCopy = typeof selectedLog.action_details === 'string' 
                          ? selectedLog.action_details 
                          : JSON.stringify(selectedLog.action_details, null, 2)
                        copyToClipboard(detailsToCopy, 'details')
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors"
                      title="Copy JSON"
                    >
                      {copiedField === 'details' ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy JSON
                        </>
                      )}
                    </button>
                  </div>
                  
                  {/* User-friendly formatted details */}
                  {actionDetails && (
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-3">
                    <div className="space-y-2">
                      {actionDetails.user_display_id && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-600 w-24">User ID:</span>
                          <span className="text-sm font-mono text-gray-800">{actionDetails.user_display_id}</span>
                        </div>
                      )}
                      {actionDetails.user_name && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-600 w-24">User Name:</span>
                          <span className="text-sm text-gray-800">{actionDetails.user_name}</span>
                        </div>
                      )}
                      {actionDetails.package_name && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-600 w-24">Package:</span>
                          <span className="text-sm text-gray-800">{actionDetails.package_name}</span>
                        </div>
                      )}
                      {actionDetails.package_price !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-600 w-24">Amount:</span>
                          <span className="text-sm font-semibold text-gray-800">₹{Number(actionDetails.package_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      {/* Wallet Management Details */}
                      {(actionDetails.main_wallet_amount !== undefined || actionDetails.spot_wallet_amount !== undefined) && (
                        <div className="border-t border-gray-300 pt-3 mt-3">
                          <h4 className="text-xs font-bold text-gray-700 uppercase mb-3">Wallet Transaction</h4>
                          
                          {actionDetails.main_wallet_amount !== undefined && actionDetails.main_wallet_amount !== null && (
                            <div className="space-y-2 mb-3">
                              <div className="flex items-center justify-between p-2 bg-blue-50 rounded border border-blue-200">
                                <span className="text-xs font-semibold text-blue-700">Main Wallet Change:</span>
                                <span className={`text-sm font-bold ${Number(actionDetails.main_wallet_amount) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {Number(actionDetails.main_wallet_amount) >= 0 ? '+' : ''}₹{Math.abs(Number(actionDetails.main_wallet_amount)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              {actionDetails.old_main_balance !== undefined && actionDetails.new_main_balance !== undefined && (
                                <div className="flex items-center justify-between text-xs px-2">
                                  <span className="text-gray-600">Previous Balance:</span>
                                  <span className="font-mono text-gray-700">₹{Number(actionDetails.old_main_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                              )}
                              {actionDetails.new_main_balance !== undefined && (
                                <div className="flex items-center justify-between text-xs px-2">
                                  <span className="text-gray-600">New Balance:</span>
                                  <span className="font-mono font-semibold text-gray-800">₹{Number(actionDetails.new_main_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {actionDetails.spot_wallet_amount !== undefined && actionDetails.spot_wallet_amount !== null && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between p-2 bg-purple-50 rounded border border-purple-200">
                                <span className="text-xs font-semibold text-purple-700">Spot Wallet Change:</span>
                                <span className={`text-sm font-bold ${Number(actionDetails.spot_wallet_amount) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {Number(actionDetails.spot_wallet_amount) >= 0 ? '+' : ''}₹{Math.abs(Number(actionDetails.spot_wallet_amount)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              {actionDetails.old_spot_balance !== undefined && actionDetails.new_spot_balance !== undefined && (
                                <div className="flex items-center justify-between text-xs px-2">
                                  <span className="text-gray-600">Previous Balance:</span>
                                  <span className="font-mono text-gray-700">₹{Number(actionDetails.old_spot_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                              )}
                              {actionDetails.new_spot_balance !== undefined && (
                                <div className="flex items-center justify-between text-xs px-2">
                                  <span className="text-gray-600">New Balance:</span>
                                  <span className="font-mono font-semibold text-gray-800">₹{Number(actionDetails.new_spot_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {actionDetails.withdrawal_amount !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-600 w-24">Withdrawal:</span>
                          <span className="text-sm font-semibold text-gray-800">₹{Number(actionDetails.withdrawal_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      {actionDetails.rejection_reason && (
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-semibold text-red-600 w-24">Reason:</span>
                          <span className="text-sm text-red-700 flex-1">{actionDetails.rejection_reason}</span>
                        </div>
                      )}
                      {actionDetails.reason && (
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-semibold text-gray-600 w-24">Reason:</span>
                          <span className="text-sm text-gray-700 flex-1">{actionDetails.reason}</span>
                        </div>
                      )}
                      {actionDetails.old_status && actionDetails.new_status && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-600 w-24">Status:</span>
                          <span className="text-sm text-gray-800">
                            <span className="px-2 py-0.5 bg-gray-200 rounded text-xs">{actionDetails.old_status}</span>
                            <span className="mx-2 text-gray-400">→</span>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">{actionDetails.new_status}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  )}

                  {/* Raw JSON (collapsible) */}
                  {actionDetails && (
                  <details className="bg-gray-900 p-4 rounded-lg border border-gray-700">
                    <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300 mb-2">
                      View Raw JSON
                    </summary>
                    <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap overflow-x-auto mt-2">
                      {JSON.stringify(actionDetails, null, 2)}
                    </pre>
                  </details>
                  )}
                </div>
                )
              })()}

              {/* User Agent */}
              {selectedLog.user_agent && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      User Agent
                    </label>
                    <button
                      onClick={() => copyToClipboard(selectedLog.user_agent || '', 'user_agent')}
                      className="text-xs text-gray-600 hover:text-gray-800 font-medium flex items-center gap-1 transition-colors"
                      title="Copy"
                    >
                      {copiedField === 'user_agent' ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 break-all font-mono bg-white p-2 rounded border border-gray-200">
                    {selectedLog.user_agent}
                  </p>
                </div>
              )}
            </div>
          )}
        </Modal>
      </Card>
    </div>
  )
}
