"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, TextInput, SelectInput, DateRangeInput } from '../../components/ui/FiltersBar'
import Pagination from '../../components/ui/Pagination'
import Button from '../../components/ui/Button'
import { getLedgerEntries, getCommissionBreakdown, type LedgerEntryItem, type LedgerCommissionType, type CommissionBreakdownResponse } from '../../lib/api/ledger'
import { ToastContainer, useToast } from '../../components/ui/Toast'
import { getMyPermissions } from '../../lib/api/sub-admins'

type LedgerLogRow = {
  id: string
  receiver_user_id: string
  receiver_display_id: string | null
  receiver_name: string | null
  source_user_id: string
  source_display_id: string | null
  source_name: string | null
  commission_type: LedgerCommissionType
  amount: number
  credited_at: string
  settled: boolean
  metadata?: any
}

const COMMISSION_TYPE_OPTIONS: Array<{ value: LedgerCommissionType | 'P2P_TRANSFER' | 'WITHDRAWAL' | 'ADMIN_OPS' | ''; label: string }> = [
  { value: '', label: 'All Types' },
  { value: 'SELF', label: 'Self Income' },
  { value: 'SPOT', label: 'Direct Income' },
  { value: 'MONTHLY', label: 'Team Income' },
  { value: 'GLOBAL_HELPING', label: 'Global Helping' },
  { value: 'FEE_DEDUCTION', label: 'Fee Deduction' },
  { value: 'ADMIN_OPS', label: 'Admin Operations' },
  { value: 'P2P_TRANSFER', label: 'P2P Transfer' },
  { value: 'WITHDRAWAL', label: 'Withdrawal' },
]

export default function LedgerLogsPage() {
  const [userIdFilter, setUserIdFilter] = useState('')
  const [nameFilter, setNameFilter] = useState('')
  const [commissionTypeFilter, setCommissionTypeFilter] = useState<LedgerCommissionType | 'P2P_TRANSFER' | 'WITHDRAWAL' | 'ADMIN_OPS' | ''>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [entries, setEntries] = useState<LedgerEntryItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summaryData, setSummaryData] = useState<CommissionBreakdownResponse | null>(null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)
  const [adminRole, setAdminRole] = useState<string>('SUPER_ADMIN')
  
  const { toasts, showToast, closeToast } = useToast()

  // Fetch admin role
  useEffect(() => {
    const fetchAdminRole = async () => {
      try {
        const { role } = await getMyPermissions()
        setAdminRole(role)
      } catch (err) {
        console.error('Error fetching admin role:', err)
        // Default to SUPER_ADMIN if error
        setAdminRole('SUPER_ADMIN')
      }
    }
    fetchAdminRole()
  }, [])

  // Format date helper
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString)
      return date.toLocaleString('en-IN', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  // Format commission type with color and user-friendly labels
  const formatCommissionType = (row: LedgerLogRow): React.ReactElement => {
    const type = row.commission_type
    const colors: Record<LedgerCommissionType | 'ADMIN_OPS', string> = {
      'SELF': 'bg-blue-100 text-blue-800',
      'SPOT': 'bg-purple-100 text-purple-800',
      'MONTHLY': 'bg-green-100 text-green-800',
      'GLOBAL_HELPING': 'bg-yellow-100 text-yellow-800',
      'FEE_DEDUCTION': 'bg-red-100 text-red-800',
      'ADMIN_OPS': 'bg-indigo-100 text-indigo-800',
    }
    
    const labels: Record<LedgerCommissionType | 'ADMIN_OPS', string> = {
      'SELF': 'Self Income',
      'SPOT': 'Direct Income',
      'MONTHLY': 'Team Income',
      'GLOBAL_HELPING': 'Global Helping',
      'FEE_DEDUCTION': 'Fee Deduction',
      'ADMIN_OPS': 'Admin Operations',
    }
    
    // Check if this is a withdrawal (metadata.reason === 'WITHDRAWAL')
    const isWithdrawal = row.metadata?.reason === 'WITHDRAWAL' || 
                        row.metadata?.reference_type === 'withdraw_request'
    
    // For withdrawals, show "Withdrawal (Main Wallet)" or "Withdrawal (Spot Wallet)"
    if (isWithdrawal && type === 'FEE_DEDUCTION') {
      const walletType = row.metadata?.wallet_type
      let walletLabel = 'Main Wallet'
      
      if (walletType === 'spot_balance' || walletType === 'spot') {
        walletLabel = 'Spot Wallet'
      } else if (walletType === 'team_royalty_balance' || walletType === 'team_royalty') {
        walletLabel = 'Team Royalty Wallet'
      } else if (walletType === 'other_balance' || walletType === 'other' || walletType === 'main') {
        walletLabel = 'Main Wallet'
      } else if (walletType === 'both') {
        // If both wallets were used, show based on which one had more deduction
        const spotDeducted = row.metadata?.spot_deducted || 0
        const otherDeducted = row.metadata?.other_deducted || 0
        walletLabel = spotDeducted > otherDeducted ? 'Spot Wallet' : 'Main Wallet'
      }
      
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
          Withdrawal ({walletLabel})
        </span>
      )
    }
    
    // For ADMIN_OPS, show reason from metadata if available
    if (type === 'ADMIN_OPS') {
      const reason = row.metadata?.reason
      const walletType = row.metadata?.wallet_type
      let walletLabel = ''
      if (walletType === 'spot_balance') {
        walletLabel = ' (Spot Wallet)'
      } else if (walletType === 'other_balance') {
        walletLabel = ' (Main Wallet)'
      } else if (walletType === 'team_royalty_balance' || walletType === 'team_royalty') {
        walletLabel = ' (Team Royalty Wallet)'
      }
      const reasonText = reason ? ` - ${reason}` : ''
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors['ADMIN_OPS']}`}>
          {labels['ADMIN_OPS']}{walletLabel}{reasonText}
        </span>
      )
    }
    
    // For FEE_DEDUCTION, show rule_code or transfer_type from metadata in brackets
    // P2P transfers are taxes, not fees, so show them differently
    let displayLabel = labels[type] || type
    if (type === 'FEE_DEDUCTION') {
      // Check if this is a P2P transfer (tax) or a regular fee
      const transferType = row.metadata?.transfer_type
      const ruleCode = row.metadata?.rule_code
      const isP2PTransfer = transferType?.includes('p2p') || 
                           ruleCode?.includes('p2p') ||
                           transferType === 'p2p_transfer' || 
                           transferType === 'p2p_transfer_tax' ||
                           ruleCode === 'p2p_transfer' || 
                           ruleCode === 'p2p_transfer_tax'
      
      // Use rule_code if available, otherwise use transfer_type
      const codeToDisplay = ruleCode || transferType
      
      if (codeToDisplay) {
        const code = codeToDisplay as string
        
        if (isP2PTransfer) {
          // P2P transfers are taxes, not fees
          // Format code to be more readable (e.g., p2p_transfer_tax -> P2P Transfer Tax)
          const formattedCode = code
            .split('_')
            .map(word => {
              // Handle special cases
              if (word.toLowerCase() === 'p2p') return 'P2P'
              // Capitalize first letter, lowercase rest
              return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            })
            .join(' ')
          displayLabel = `Tax (${formattedCode})`
        } else {
          // Regular fees (KYC, Account Change, etc.)
          const formattedCode = code
            .split('_')
            .map(word => {
              // Handle special cases
              if (word.toLowerCase() === 'p2p') return 'P2P'
              if (word.toLowerCase() === 'kyc') return 'KYC'
              // Capitalize first letter, lowercase rest
              return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            })
            .join(' ')
          displayLabel = `${displayLabel} (${formattedCode})`
        }
      }
    }
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[type] || 'bg-gray-100 text-gray-800'}`}>
        {displayLabel}
      </span>
    )
  }

  // Fetch ledger entries from API
  const fetchEntries = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const params: any = {
        page,
        limit: pageSize,
      }
      
      if (userIdFilter.trim()) {
        params.user_id = userIdFilter.trim()
      }

      if (nameFilter.trim()) {
        params.name = nameFilter.trim()
      }

      if (commissionTypeFilter) {
        // P2P_TRANSFER is a special filter that needs to be handled differently
        if (commissionTypeFilter === 'P2P_TRANSFER') {
          params.transfer_type = 'p2p_transfer' // Special parameter for P2P transfers
        } else if (commissionTypeFilter === 'WITHDRAWAL') {
          params.withdrawal_filter = 'true' // Special parameter to filter withdrawals
        } else {
          params.commission_type = commissionTypeFilter
        }
      }

      if (startDate) {
        params.start_date = startDate
      }

      if (endDate) {
        params.end_date = endDate
      }

      console.log('[Ledger Logs Page] Calling getLedgerEntries with params:', params);
      const response = await getLedgerEntries(params)
      console.log('[Ledger Logs Page] Received response:', { count: response.count, total: response.total, itemsCount: response.items?.length });
      setEntries(response.items || [])
      setTotal(response.total || 0)
      setTotalPages(response.total_pages || 0)
    } catch (err: any) {
      console.error('Error fetching ledger entries:', err)
      const errorMessage = err?.message || 'Failed to fetch ledger entries'
      setError(errorMessage)
      showToast(errorMessage, 'error')
      setEntries([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, userIdFilter, nameFilter, commissionTypeFilter, startDate, endDate, showToast])

  // Fetch commission breakdown summary
  const fetchSummary = useCallback(async () => {
    try {
      setIsLoadingSummary(true)
      console.log('[Ledger Logs Page] Calling getCommissionBreakdown');
      const data = await getCommissionBreakdown()
      console.log('[Ledger Logs Page] Received commission breakdown:', data);
      setSummaryData(data)
    } catch (err: any) {
      console.error('Error fetching commission breakdown:', err)
      // Don't show error toast for summary, just log it
    } finally {
      setIsLoadingSummary(false)
    }
  }, [])

  // Fetch on mount
  useEffect(() => {
    fetchEntries()
    fetchSummary()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch entries when page or pageSize changes
  useEffect(() => {
    fetchEntries()
  }, [page, pageSize, fetchEntries])

  // Map API response to UI rows
  // NOTE: Date range filtering is now handled on the API side (`/api/v1/admin/audit-log`)
  // so we no longer need additional client-side date filtering here. This keeps
  // pagination and totals consistent with the backend.
  const rows: LedgerLogRow[] = useMemo(() => {
    return entries.map((item) => {
      // Debug first FEE_DEDUCTION entry
      if (
        item.commission_type === 'FEE_DEDUCTION' &&
        entries.indexOf(item) === entries.findIndex((e) => e.commission_type === 'FEE_DEDUCTION')
      ) {
        console.log('[Ledger Logs] First FEE_DEDUCTION entry from API:', {
          id: item.id,
          metadata: item.metadata,
          metadata_type: typeof item.metadata,
          rule_code: item.metadata?.rule_code,
        })
      }
      
      return {
        id: item.id || '-',
        receiver_user_id: item.receiver_user_id || '-',
        receiver_display_id: item.receiver_display_id || null,
        receiver_name: item.receiver_name || null,
        source_user_id: item.source_user_id || '-',
        source_display_id: item.source_display_id || null,
        source_name: item.source_name || null,
        commission_type: item.commission_type,
        amount: item.amount || 0,
        credited_at: formatDate(item.credited_at),
        settled: item.settled || false,
        metadata: item.metadata || null,
      }
    })
  }, [entries])

  // Calculate filtered total for pagination (if client-side filtering is applied)
  const filteredTotal = useMemo(() => {
    // Date filtering is handled on the backend, so always use API total
    return total
  }, [total])

  const filteredTotalPages = useMemo(() => {
    return Math.ceil(filteredTotal / pageSize)
  }, [filteredTotal, pageSize])

  const columns: Array<DataTableColumn<LedgerLogRow>> = useMemo(() => [
    { 
      key: 'id', 
      title: 'Entry ID',
      render: (r: LedgerLogRow) => (
        <span className="font-mono text-sm text-gray-600">#{r.id}</span>
      )
    },
    { 
      key: 'receiver_user_id', 
      title: 'Receiver',
      render: (r: LedgerLogRow) => (
        <div>
          <span className="font-semibold">
            {r.receiver_display_id ? (
              <span>{r.receiver_display_id}</span>
            ) : (
              <span>ID: {r.receiver_user_id}</span>
            )}
          </span>
          {r.receiver_name && (
            <div className="text-xs text-gray-500 mt-0.5">{r.receiver_name}</div>
          )}
        </div>
      )
    },
    { 
      key: 'source_user_id', 
      title: 'Source',
      render: (r: LedgerLogRow) => (
        <div>
          <span className="font-semibold">
            {r.source_display_id ? (
              <span>{r.source_display_id}</span>
            ) : (
              <span>ID: {r.source_user_id}</span>
            )}
          </span>
          {r.source_name && (
            <div className="text-xs text-gray-500 mt-0.5">{r.source_name}</div>
          )}
        </div>
      )
    },
    { 
      key: 'commission_type', 
      title: 'Transaction Type',
      render: (r: LedgerLogRow) => formatCommissionType(r)
    },
    { 
      key: 'amount', 
      title: 'Amount',
      render: (r: LedgerLogRow) => {
        const isNegative = r.amount < 0
        const isWithdrawal = r.metadata?.reason === 'WITHDRAWAL' || r.metadata?.reference_type === 'withdraw_request'
        const withdrawalFee = r.metadata?.withdrawal_fee
        
        // If this is a withdrawal with fee, show breakdown
        if (isWithdrawal && withdrawalFee && r.commission_type === 'FEE_DEDUCTION') {
          const totalAmount = Math.abs(r.amount)
          const feeAmount = Number(withdrawalFee)
          const withdrawalAmount = totalAmount - feeAmount
          
          return (
            <div className="flex flex-col gap-1">
              <span className={`font-bold ${isNegative ? 'text-red-600' : 'text-green-600'}`}>
                {isNegative ? '-' : '+'}₹ {totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <div className="text-xs text-gray-500">
                <div>Withdrawal: ₹{withdrawalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div>Processing Fee: ₹{feeAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            </div>
          )
        }
        
        return (
          <span className={`font-bold ${isNegative ? 'text-red-600' : 'text-green-600'}`}>
            {isNegative ? '-' : '+'}₹ {Math.abs(r.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )
      }
    },
    { 
      key: 'credited_at', 
      title: 'Credited At'
    },
  ], [])

  const handleExport = async () => {
    try {
      showToast('Preparing ledger logs export (all records)...', 'info')

      const exportPageSize = 1000
      const baseParams: any = {
        page: 1,
        limit: exportPageSize,
      }

      if (userIdFilter.trim()) {
        baseParams.user_id = userIdFilter.trim()
      }

      if (nameFilter.trim()) {
        baseParams.name = nameFilter.trim()
      }

      if (commissionTypeFilter) {
        if (commissionTypeFilter === 'P2P_TRANSFER') {
          baseParams.transfer_type = 'p2p_transfer'
        } else if (commissionTypeFilter === 'WITHDRAWAL') {
          baseParams.withdrawal_filter = 'true'
        } else {
          baseParams.commission_type = commissionTypeFilter
        }
      }

      if (startDate) {
        baseParams.start_date = startDate
      }

      if (endDate) {
        baseParams.end_date = endDate
      }

      const allItems: LedgerEntryItem[] = []

      const firstResponse = await getLedgerEntries(baseParams)
      if (firstResponse.items?.length) {
        allItems.push(...firstResponse.items)
      }

      const totalRecords =
        firstResponse.total ?? firstResponse.count ?? firstResponse.items.length
      const totalPagesForExport = Math.max(
        firstResponse.total_pages ||
          Math.ceil(totalRecords / exportPageSize) ||
          1,
        1,
      )

      for (let exportPage = 2; exportPage <= totalPagesForExport; exportPage++) {
        const params = { ...baseParams, page: exportPage }
        const response = await getLedgerEntries(params)
        if (response.items?.length) {
          allItems.push(...response.items)
        }
        if (!response.items || response.items.length === 0) {
          break
        }
      }

      if (!allItems.length) {
        alert('No ledger entries available to export.')
        return
      }

      const exportRows: LedgerLogRow[] = allItems.map(item => ({
        id: item.id || '-',
        receiver_user_id: item.receiver_user_id || '-',
        receiver_display_id: item.receiver_display_id || null,
        receiver_name: item.receiver_name || null,
        source_user_id: item.source_user_id || '-',
        source_display_id: item.source_display_id || null,
        source_name: item.source_name || null,
        commission_type: item.commission_type,
        amount: item.amount || 0,
        credited_at: formatDate(item.credited_at),
        settled: item.settled || false,
        metadata: item.metadata || null,
      }))

      const headers = [
        'Entry ID',
        'Receiver Display ID',
        'Receiver ID',
        'Receiver Name',
        'Source Display ID',
        'Source ID',
        'Source Name',
        'Transaction Type',
        'Amount',
        'Credited At',
      ]
      const csvRows = [
        headers.join(','),
        ...exportRows.map(row => [
          row.id,
          row.receiver_display_id || row.receiver_user_id,
          row.receiver_user_id,
          row.receiver_name || '',
          row.source_display_id || row.source_user_id,
          row.source_user_id,
          row.source_name || '',
          row.commission_type,
          row.amount,
          row.credited_at,
        ].join(','))
      ]

      const csvContent = csvRows.join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `ledger-logs-${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      showToast(
        `Exported ${exportRows.length} ledger entries successfully.`,
        'success',
      )
    } catch (err: any) {
      console.error('❌ Error exporting ledger logs:', err)
      const message = err?.message || 'Failed to export ledger entries.'
      showToast(message, 'error')
      alert(message)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSearch = async () => {
    setPage(1) // Reset to first page when searching
    // Manually trigger fetch with current filters
    try {
      setIsLoading(true)
      setError(null)
      
      const params: any = {
        page: 1,
        limit: pageSize,
      }
      
      if (userIdFilter.trim()) {
        params.user_id = userIdFilter.trim()
      }

      if (nameFilter.trim()) {
        params.name = nameFilter.trim()
      }

      if (commissionTypeFilter) {
        // P2P_TRANSFER is a special filter that needs to be handled differently
        if (commissionTypeFilter === 'P2P_TRANSFER') {
          params.transfer_type = 'p2p_transfer' // Special parameter for P2P transfers
        } else if (commissionTypeFilter === 'WITHDRAWAL') {
          params.withdrawal_filter = 'true' // Special parameter to filter withdrawals
        } else {
          params.commission_type = commissionTypeFilter
        }
      }

      if (startDate) {
        params.start_date = startDate
      }

      if (endDate) {
        params.end_date = endDate
      }

      console.log('[Ledger Logs Page] Search clicked, calling getLedgerEntries with params:', params);
      const response = await getLedgerEntries(params)
      console.log('[Ledger Logs Page] Search response:', { count: response.count, total: response.total, itemsCount: response.items?.length });
      setEntries(response.items || [])
      setTotal(response.total || 0)
      setTotalPages(response.total_pages || 0)
    } catch (err: any) {
      console.error('Error fetching ledger entries:', err)
      const errorMessage = err?.message || 'Failed to fetch ledger entries'
      setError(errorMessage)
      showToast(errorMessage, 'error')
      setEntries([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearFilters = async () => {
    setUserIdFilter('')
    setNameFilter('')
    setCommissionTypeFilter('')
    setStartDate('')
    setEndDate('')
    setPage(1)
    // Fetch with cleared filters
    try {
      setIsLoading(true)
      setError(null)
      
      const params: any = {
        page: 1,
        limit: pageSize,
      }

      console.log('[Ledger Logs Page] Clear filters, calling getLedgerEntries with params:', params);
      const response = await getLedgerEntries(params)
      setEntries(response.items || [])
      setTotal(response.total || 0)
      setTotalPages(response.total_pages || 0)
    } catch (err: any) {
      console.error('Error fetching ledger entries:', err)
      const errorMessage = err?.message || 'Failed to fetch ledger entries'
      setError(errorMessage)
      showToast(errorMessage, 'error')
      setEntries([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }

  // Get totals for each commission type
  const getTotalByType = (type: LedgerCommissionType): number => {
    if (!summaryData) return 0
    const item = summaryData.by_type.find(item => item.commission_type === type)
    return item ? item.total_amount : 0
  }

  // Format currency
  const formatCurrency = (amount: number): string => {
    return `₹ ${Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // KPI Cards data
  const kpiCards = useMemo(() => [
    {
      title: 'Total Self Transactions Amt',
      value: formatCurrency(getTotalByType('SELF')),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-6 h-6">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      borderColor: 'border-blue-200',
    },
    {
      title: 'Total Direct Transactions Amt',
      value: formatCurrency(getTotalByType('GLOBAL_HELPING')),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-6 h-6">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="8.5" cy="7" r="4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 8v6M23 11h-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-600',
      borderColor: 'border-yellow-200',
    },
    {
      title: 'Total SPOT Transactions Amt',
      value: formatCurrency(getTotalByType('SPOT')),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-6 h-6">
          <circle cx="12" cy="12" r="10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 6v6l4 2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
      borderColor: 'border-purple-200',
    },
    {
      title: 'Total Team Transactions Amt',
      value: formatCurrency(getTotalByType('MONTHLY')),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-6 h-6">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="9" cy="7" r="4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
      borderColor: 'border-green-200',
    },
  ], [summaryData])

  return (
    <div className="space-y-6">
      {/* KPI Cards - Hide for SUB_ADMIN */}
      {adminRole !== 'SUB_ADMIN' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((card, index) => (
            <div
              key={index}
              className={`${card.bgColor} ${card.borderColor} border-2 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className={`text-sm font-medium ${card.textColor} opacity-80 mb-1`}>
                    {card.title}
                  </p>
                  {isLoadingSummary ? (
                    <div className="h-8 w-24 bg-gray-200 rounded animate-pulse"></div>
                  ) : (
                    <p className={`text-2xl font-bold ${card.textColor}`}>
                      {card.value}
                    </p>
                  )}
                </div>
                <div className={`${card.textColor} opacity-60`}>
                  {card.icon}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Card
        title="Ledger Logs"
      toolbarRight={
        <>
          <Button
            variant="outline"
            size="md"
            aria-label="Export"
            onClick={handleExport}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <span>Export</span>
          </Button>
          <Button variant="outline" size="md" aria-label="Print" onClick={handlePrint}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            <span>Print</span>
          </Button>
        </>
      }
    >
      {error && !isLoading && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
            <p className="text-sm text-gray-600">Loading ledger entries...</p>
          </div>
        </div>
      ) : (
        <DataTable<LedgerLogRow>
          columns={columns}
          rows={rows}
          minWidthPx={1400}
        />
      )}

      <FiltersBar>
        <TextInput 
          id="fullname-filter" 
          label="Filter by Full Name:" 
          value={nameFilter} 
          onChange={setNameFilter} 
          placeholder="Enter Full Name (e.g., Ramesh Kumar)"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSearch()
            }
          }}
        />
        <TextInput 
          id="user-id-filter" 
          label="Filter by User ID:" 
          value={userIdFilter} 
          onChange={setUserIdFilter} 
          placeholder="Enter User ID or Display ID (e.g., 10 or SIA02047)" 
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSearch()
            }
          }}
        />
        <SelectInput
          id="commission-type-filter"
          label="Filter by Transaction Type:"
          value={commissionTypeFilter}
          onChange={(v) => setCommissionTypeFilter(v as LedgerCommissionType | 'P2P_TRANSFER' | 'WITHDRAWAL' | '')}
          options={COMMISSION_TYPE_OPTIONS}
        />
        <DateRangeInput
          id="date-range-filter"
          label="Filter by Date Range:"
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={(v) => {
            setStartDate(v)
            setPage(1)
          }}
          onEndDateChange={(v) => {
            setEndDate(v)
            setPage(1)
          }}
        />
        <PrimaryButton type="button" onClick={handleSearch} disabled={isLoading}>Search</PrimaryButton>
        <SecondaryButton type="button" onClick={handleClearFilters} disabled={isLoading}>Clear filtering</SecondaryButton>
      </FiltersBar>

      {(filteredTotalPages > 1 || totalPages > 1) && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={filteredTotal}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 25, 50, 100, 250, 500, 1000]}
        />
      )}

      <ToastContainer toasts={toasts} onClose={closeToast} />
      </Card>
    </div>
  )
}

