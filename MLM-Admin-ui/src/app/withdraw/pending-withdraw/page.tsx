"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, TextInput, SelectInput, DateRangeInput } from '../../../components/ui/FiltersBar'
import Pagination from '../../../components/ui/Pagination'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import { ApproveReject } from '../../../components/ui/ActionButtons'
import { getPendingWithdrawals, approveWithdrawal, rejectWithdrawal, type PendingWithdrawItem } from '../../../lib/api/withdraw'
import { exportToCsv } from '../../../lib/export'
import { usePinVerification } from '../../../hooks/usePinVerification'

type PendingWithdrawRow = {
  request_id: string // Added for approve/reject
  user_id: string
  user_display_id: string | null
  user_name: string | null
  pan_number: string | null
  mobile_number: string | null
  withdraw_amount: number
  payout_inr: number
  wallet_type: string
  upi_id: string
  bank_name: string
  branch: string
  ac_hldr: string
  ac_no: string
  ac_ifsc: string
  withdraw_status: string
  date_request: string
  address?: string | null
  aadhaar?: string | null
}

// Helper function to parse account_details
const parseAccountDetails = (accountDetails: string, paymentMethod: string): {
  upi_id: string
  bank_name: string
  branch: string
  ac_hldr: string
  ac_no: string
  ac_ifsc: string
} => {
  // Return defaults if account_details is empty
  if (!accountDetails || accountDetails.trim() === '') {
    return {
      upi_id: '-',
      bank_name: '-',
      branch: '-',
      ac_hldr: '-',
      ac_no: '-',
      ac_ifsc: '-',
    }
  }

  try {
    // Try parsing as JSON first
    const parsed = JSON.parse(accountDetails)
    return {
      upi_id: parsed.upi_id || parsed.upi || parsed.bank_upi || '-',
      bank_name: parsed.bank_name || parsed.bank || '-',
      branch: parsed.branch || parsed.bank_branch || '-',
      ac_hldr: parsed.ac_hldr || parsed.account_holder || parsed.holder_name || parsed.bank_ac_holder || '-',
      ac_no: parsed.ac_no || parsed.account_number || parsed.account_no || parsed.bank_account_no || '-',
      ac_ifsc: parsed.ac_ifsc || parsed.ifsc || parsed.bank_ifsc || '-',
    }
  } catch {
    // If not JSON, treat as plain text
    // For UPI, account_details might be the UPI ID
    if (paymentMethod?.toLowerCase().includes('upi')) {
      return {
        upi_id: accountDetails.trim(),
        bank_name: '-',
        branch: '-',
        ac_hldr: '-',
        ac_no: '-',
        ac_ifsc: '-',
      }
    }
    // For bank transfer, might be formatted text
    // Try to extract IFSC code (format: XXXX0XXXXX)
    const ifscMatch = accountDetails.match(/[A-Z]{4}0[A-Z0-9]{6}/)
    // Try to extract account number (10+ digits)
    const acNoMatch = accountDetails.match(/\d{10,}/)
    
    return {
      upi_id: '-',
      bank_name: accountDetails.includes('Bank') || accountDetails.includes('bank') ? accountDetails.split(/[,\-]/)[0].trim() : '-',
      branch: '-',
      ac_hldr: '-',
      ac_no: acNoMatch ? acNoMatch[0] : '-',
      ac_ifsc: ifscMatch ? ifscMatch[0] : '-',
    }
  }
}

// Helper function to format date
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  } catch {
    return dateString
  }
}

/** Profile fields embedded on each pending withdrawal list item from API. */
const profileFromWithdrawItem = (item: PendingWithdrawItem) => ({
  name: item.user_name,
  pan_number: item.user_pan_number,
  phone: item.user_phone,
  bank_name: item.user_bank_name,
  bank_branch: item.user_bank_branch,
  bank_account_no: item.user_bank_account_no,
  bank_ifsc: item.user_bank_ifsc,
  bank_upi: item.user_bank_upi,
  address: item.user_address,
  city: item.user_city,
  state: item.user_state,
  pincode: item.user_pincode,
  aadhar_number: item.user_aadhar_number,
})

const formatProfileAddress = (profile: ReturnType<typeof profileFromWithdrawItem>): string | null => {
  if (profile.address) {
    return `${profile.address}${profile.city ? ', ' + profile.city : ''}${profile.state ? ', ' + profile.state : ''}${profile.pincode ? ' ' + profile.pincode : ''}`.trim()
  }
  if (profile.city || profile.state || profile.pincode) {
    return `${profile.city || ''}${profile.city && profile.state ? ', ' : ''}${profile.state || ''}${profile.pincode ? ' ' + profile.pincode : ''}`.trim()
  }
  return null
}

const mapPendingWithdrawToRow = (item: PendingWithdrawItem): PendingWithdrawRow => {
  const accountDetails = parseAccountDetails(item.account_details || '', item.payment_method || '')
  const profile = profileFromWithdrawItem(item)

  const finalBankDetails = {
    upi_id:
      accountDetails.upi_id && accountDetails.upi_id !== '-' && accountDetails.upi_id.trim() !== ''
        ? accountDetails.upi_id
        : profile.bank_upi && profile.bank_upi.trim() !== ''
          ? profile.bank_upi
          : '-',
    bank_name:
      accountDetails.bank_name && accountDetails.bank_name !== '-' && accountDetails.bank_name.trim() !== ''
        ? accountDetails.bank_name
        : profile.bank_name && profile.bank_name.trim() !== ''
          ? profile.bank_name
          : '-',
    branch:
      accountDetails.branch && accountDetails.branch !== '-' && accountDetails.branch.trim() !== ''
        ? accountDetails.branch
        : profile.bank_branch && profile.bank_branch.trim() !== ''
          ? profile.bank_branch
          : '-',
    ac_hldr:
      accountDetails.ac_hldr && accountDetails.ac_hldr !== '-' && accountDetails.ac_hldr.trim() !== ''
        ? accountDetails.ac_hldr
        : profile.name && profile.name.trim() !== ''
          ? profile.name
          : '-',
    ac_no:
      accountDetails.ac_no && accountDetails.ac_no !== '-' && accountDetails.ac_no.trim() !== ''
        ? accountDetails.ac_no
        : profile.bank_account_no && profile.bank_account_no.trim() !== ''
          ? profile.bank_account_no
          : '-',
    ac_ifsc:
      accountDetails.ac_ifsc && accountDetails.ac_ifsc !== '-' && accountDetails.ac_ifsc.trim() !== ''
        ? accountDetails.ac_ifsc
        : profile.bank_ifsc && profile.bank_ifsc.trim() !== ''
          ? profile.bank_ifsc
          : '-',
  }

  const payoutInr = item.amount * 0.9

  return {
    request_id: item.id,
    user_id: item.user_id,
    user_display_id: item.user_display_id || null,
    user_name: item.user_name || null,
    pan_number: profile.pan_number || null,
    mobile_number: profile.phone || null,
    withdraw_amount: item.amount,
    payout_inr: payoutInr,
    wallet_type: item.withdraw_type === 'wallet' ? 'Wallet' : item.withdraw_type === 'spot' ? 'Spot Wallet' : item.withdraw_type,
    upi_id: finalBankDetails.upi_id,
    bank_name: finalBankDetails.bank_name,
    branch: finalBankDetails.branch,
    ac_hldr: finalBankDetails.ac_hldr,
    ac_no: finalBankDetails.ac_no,
    ac_ifsc: finalBankDetails.ac_ifsc,
    withdraw_status: item.status.charAt(0).toUpperCase() + item.status.slice(1),
    date_request: formatDate(item.created_at),
    address: formatProfileAddress(profile),
    aadhaar: profile.aadhar_number || null,
  }
}

export default function PendingWithdrawPage() {
  const [userIdFilter, setUserIdFilter] = useState('')
  const [nameFilter, setNameFilter] = useState('')
  const [walletTypeFilter, setWalletTypeFilter] = useState<'spot' | 'wallet' | 'team_royalty' | ''>('')
  const [viewFilter, setViewFilter] = useState<'normal' | 'ca10' | 'spot-wallet' | 'main-wallet'>('normal')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [withdrawals, setWithdrawals] = useState<PendingWithdrawItem[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Reject modal state
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Bulk selection state
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [bulkApproveProgress, setBulkApproveProgress] = useState<{ current: number; total: number } | null>(null)
  const [bulkRejectProgress, setBulkRejectProgress] = useState<{ current: number; total: number } | null>(null)

  // Maximum bulk operations limit
  const MAX_BULK_LIMIT = 50

  // PIN verification hook
  const { verifyPinForAction } = usePinVerification()

  // Fetch pending withdrawals
  const fetchWithdrawals = useCallback(async (overridePage?: number, overrideFilters?: { userId?: string; startDate?: string; endDate?: string; walletType?: string }) => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Use override filters if provided, otherwise use state values
      const currentUserIdFilter = overrideFilters?.userId !== undefined ? overrideFilters.userId : userIdFilter
      const currentStartDate = overrideFilters?.startDate !== undefined ? overrideFilters.startDate : startDate
      const currentEndDate = overrideFilters?.endDate !== undefined ? overrideFilters.endDate : endDate
      const currentWalletTypeFilter = overrideFilters?.walletType !== undefined ? overrideFilters.walletType : walletTypeFilter
      
      const params: any = {
        page: overridePage !== undefined ? overridePage : page,
        limit: pageSize,
      }
      
      if (currentWalletTypeFilter) {
        params.withdraw_type = currentWalletTypeFilter
      }
      
      // Pass user_id filter to API for server-side filtering
      if (currentUserIdFilter.trim()) {
        params.user_id = currentUserIdFilter.trim()
      }
      
      // Pass name filter to API for server-side filtering
      if (nameFilter.trim()) {
        params.name = nameFilter.trim()
      }
      
      // Pass date range filters to API for server-side filtering
      if (currentStartDate) {
        params.start_date = currentStartDate
      }
      if (currentEndDate) {
        params.end_date = currentEndDate
      }
      
      console.log('[Pending Withdrawals] Fetching with params:', params)
      
      const response = await getPendingWithdrawals(params)
      
      console.log('[Pending Withdrawals] Response:', { count: response.count, total: response.total, items: response.items.length })
      
      setWithdrawals(response.items)
      setTotal(response.total)
      
      // Don't clear cache immediately - let it persist so we can use it
      // The cache will be naturally updated as user details are fetched
    } catch (err: any) {
      console.error('Error fetching pending withdrawals:', err)
      setError(err.message || 'Failed to fetch pending withdrawals')
      setWithdrawals([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, walletTypeFilter, userIdFilter, nameFilter, startDate, endDate])

  // Clear selection when filters or page changes
  useEffect(() => {
    setSelectedRows(new Set())
  }, [page, pageSize, walletTypeFilter, userIdFilter, startDate, endDate, viewFilter])

  // Fetch on mount and when page/pageSize/walletTypeFilter changes
  useEffect(() => {
    fetchWithdrawals()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, walletTypeFilter, userIdFilter, startDate, endDate]) // Include all filters to auto-refresh when they change

  const rows: PendingWithdrawRow[] = useMemo(() => {
    return withdrawals.map((item) => mapPendingWithdrawToRow(item))
  }, [withdrawals])

  // No client-side filtering needed - API handles all filtering
  // Rows are already filtered by the API based on userIdFilter, startDate, endDate
  const filteredRows = rows

  // Handle approve (with PIN verification)
  const handleApprove = useCallback(async (row: PendingWithdrawRow) => {
    // Verify PIN before proceeding
    const pinVerified = await verifyPinForAction('Withdrawal Approval')
    if (!pinVerified) return

    try {
      setActionLoading(row.request_id)
      console.log('✅ Approving withdrawal request:', row.request_id)
      await approveWithdrawal(row.request_id, {})
      console.log('✅ Withdrawal approved successfully')
      await fetchWithdrawals() // Refresh list
      alert('Withdrawal request approved successfully!')
    } catch (err: any) {
      console.error('❌ Error approving withdrawal:', err)
      alert(`Error approving withdrawal: ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }, [fetchWithdrawals, verifyPinForAction])

  // Handle reject - open modal
  const handleReject = useCallback((row: PendingWithdrawRow) => {
    setRejectingRequestId(row.request_id)
    setRejectReason('')
    setIsRejectModalOpen(true)
  }, [])

  // Handle reject submit (with PIN verification)
  const handleRejectSubmit = useCallback(async () => {
    if (!rejectingRequestId) return

    if (!rejectReason.trim()) {
      alert('Please provide a rejection reason')
      return
    }

    // Verify PIN before proceeding
    const pinVerified = await verifyPinForAction('Withdrawal Rejection')
    if (!pinVerified) return

    try {
      setActionLoading(rejectingRequestId)
      console.log('❌ Rejecting withdrawal request:', rejectingRequestId, 'Reason:', rejectReason)
      await rejectWithdrawal(rejectingRequestId, {
        rejection_reason: rejectReason.trim(),
      })
      console.log('✅ Withdrawal rejected successfully')
      setIsRejectModalOpen(false)
      setRejectingRequestId(null)
      setRejectReason('')
      await fetchWithdrawals() // Refresh list
      alert('Withdrawal request rejected successfully!')
    } catch (err: any) {
      console.error('❌ Error rejecting withdrawal:', err)
      alert(`Error rejecting withdrawal: ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }, [rejectingRequestId, rejectReason, fetchWithdrawals, verifyPinForAction])

  // Handle checkbox selection with 50 limit
  const handleRowSelect = useCallback((requestId: string, checked: boolean) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev)
      if (checked) {
        // Check if we're at the limit
        if (newSet.size >= MAX_BULK_LIMIT) {
          alert(`Maximum ${MAX_BULK_LIMIT} items can be selected for bulk operations.`)
          return prev
        }
        newSet.add(requestId)
      } else {
        newSet.delete(requestId)
      }
      return newSet
    })
  }, [])

  // Handle select all (limited to 50)
  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      // Select up to 50 items from filtered rows
      const rowsToSelect = filteredRows.slice(0, MAX_BULK_LIMIT)
      const allIds = new Set(rowsToSelect.map(row => row.request_id))
      setSelectedRows(allIds)
      
      if (filteredRows.length > MAX_BULK_LIMIT) {
        alert(`Only first ${MAX_BULK_LIMIT} items selected. Maximum ${MAX_BULK_LIMIT} items allowed for bulk operations.`)
      }
    } else {
      setSelectedRows(new Set())
    }
  }, [filteredRows])

  // Check if all rows are selected (up to 50)
  const isAllSelected = useMemo(() => {
    if (filteredRows.length === 0) return false
    const selectableRows = filteredRows.slice(0, MAX_BULK_LIMIT)
    return selectableRows.length > 0 && selectableRows.every(row => selectedRows.has(row.request_id))
  }, [filteredRows, selectedRows])

  // Check if some rows are selected
  const isSomeSelected = useMemo(() => {
    const selectableRows = filteredRows.slice(0, MAX_BULK_LIMIT)
    return selectableRows.some(row => selectedRows.has(row.request_id)) && !isAllSelected
  }, [filteredRows, selectedRows, isAllSelected])

  // Bulk approve with batch processing (max 50)
  const handleBulkApprove = useCallback(async () => {
    const selectedIds = Array.from(selectedRows)
    if (selectedIds.length === 0) {
      alert('Please select at least one withdrawal request')
      return
    }

    if (selectedIds.length > MAX_BULK_LIMIT) {
      alert(`Maximum ${MAX_BULK_LIMIT} items can be processed at once. Please select fewer items.`)
      return
    }

    const confirmed = window.confirm(
      `Are you sure you want to approve ${selectedIds.length} withdrawal request(s)?`
    )
    if (!confirmed) return

    setIsBulkProcessing(true)
    setBulkApproveProgress({ current: 0, total: selectedIds.length })
    setBulkRejectProgress(null) // Clear reject progress

    const BATCH_SIZE = 5 // Process 5 requests at a time
    const DELAY_BETWEEN_BATCHES = 1000 // 1 second delay between batches
    const DELAY_BETWEEN_REQUESTS = 200 // 200ms delay between individual requests

    let successCount = 0
    let failCount = 0
    const failedRequests: Array<{ id: string; userId: string; userName: string | null; error: string }> = []

    try {
      // Process in batches
      for (let i = 0; i < selectedIds.length; i += BATCH_SIZE) {
        const batch = selectedIds.slice(i, i + BATCH_SIZE)
        
        // Process batch in parallel with small delays
        const batchPromises = batch.map(async (requestId, index) => {
          // Small delay between requests in same batch
          await new Promise(resolve => setTimeout(resolve, index * DELAY_BETWEEN_REQUESTS))
          
          try {
            await approveWithdrawal(requestId, {})
            successCount++
            setBulkApproveProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null)
            return { success: true, id: requestId }
          } catch (error: any) {
            failCount++
            // Get user details for failed request
            const failedRow = filteredRows.find(r => r.request_id === requestId)
            failedRequests.push({
              id: requestId,
              userId: failedRow?.user_display_id || failedRow?.user_id || requestId,
              userName: failedRow?.user_name || null,
              error: error.message || 'Unknown error'
            })
            setBulkApproveProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null)
            console.error(`Failed to approve ${requestId}:`, error)
            return { success: false, id: requestId, error: error.message }
          }
        })

        await Promise.all(batchPromises)

        // Delay between batches (except for last batch)
        if (i + BATCH_SIZE < selectedIds.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
        }
      }

      // Refresh list
      await fetchWithdrawals()
      
      // Clear selection
      setSelectedRows(new Set())

      // Show results with user details
      let message = `Successfully approved ${successCount} request(s).`
      if (failCount > 0) {
        message += `\n\nFailed to approve ${failCount} request(s):\n`
        failedRequests.forEach((req, idx) => {
          const userInfo = req.userName ? `${req.userId} (${req.userName})` : req.userId
          message += `\n${idx + 1}. Request ID: ${req.id} | User: ${userInfo}\n   Error: ${req.error}`
        })
      }
      alert(message)
    } catch (error: any) {
      console.error('Bulk approve error:', error)
      alert(`Error during bulk approval: ${error.message}`)
    } finally {
      setIsBulkProcessing(false)
      setBulkApproveProgress(null)
    }
  }, [selectedRows, fetchWithdrawals, filteredRows])

  // Bulk reject with batch processing (max 50)
  const handleBulkReject = useCallback(async () => {
    const selectedIds = Array.from(selectedRows)
    if (selectedIds.length === 0) {
      alert('Please select at least one withdrawal request')
      return
    }

    if (selectedIds.length > MAX_BULK_LIMIT) {
      alert(`Maximum ${MAX_BULK_LIMIT} items can be processed at once. Please select fewer items.`)
      return
    }

    // Ask for rejection reason
    const rejectReason = window.prompt(
      `Please provide a reason for rejecting ${selectedIds.length} withdrawal request(s):`
    )
    if (!rejectReason || !rejectReason.trim()) {
      alert('Rejection reason is required')
      return
    }

    const confirmed = window.confirm(
      `Are you sure you want to reject ${selectedIds.length} withdrawal request(s) with reason: "${rejectReason}"?`
    )
    if (!confirmed) return

    setIsBulkProcessing(true)
    setBulkRejectProgress({ current: 0, total: selectedIds.length })
    setBulkApproveProgress(null) // Clear approve progress

    const BATCH_SIZE = 5
    const DELAY_BETWEEN_BATCHES = 1000
    const DELAY_BETWEEN_REQUESTS = 200

    let successCount = 0
    let failCount = 0
    const failedRequests: Array<{ id: string; userId: string; userName: string | null; error: string }> = []

    try {
      for (let i = 0; i < selectedIds.length; i += BATCH_SIZE) {
        const batch = selectedIds.slice(i, i + BATCH_SIZE)
        
        const batchPromises = batch.map(async (requestId, index) => {
          await new Promise(resolve => setTimeout(resolve, index * DELAY_BETWEEN_REQUESTS))
          
          try {
            await rejectWithdrawal(requestId, {
              rejection_reason: rejectReason.trim(),
            })
            successCount++
            setBulkRejectProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null)
            return { success: true, id: requestId }
          } catch (error: any) {
            failCount++
            // Get user details for failed request
            const failedRow = filteredRows.find(r => r.request_id === requestId)
            failedRequests.push({
              id: requestId,
              userId: failedRow?.user_display_id || failedRow?.user_id || requestId,
              userName: failedRow?.user_name || null,
              error: error.message || 'Unknown error'
            })
            setBulkRejectProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null)
            console.error(`Failed to reject ${requestId}:`, error)
            return { success: false, id: requestId, error: error.message }
          }
        })

        await Promise.all(batchPromises)

        if (i + BATCH_SIZE < selectedIds.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
        }
      }

      await fetchWithdrawals()
      setSelectedRows(new Set())

      // Show results with user details
      let message = `Successfully rejected ${successCount} request(s).`
      if (failCount > 0) {
        message += `\n\nFailed to reject ${failCount} request(s):\n`
        failedRequests.forEach((req, idx) => {
          const userInfo = req.userName ? `${req.userId} (${req.userName})` : req.userId
          message += `\n${idx + 1}. Request ID: ${req.id} | User: ${userInfo}\n   Error: ${req.error}`
        })
      }
      alert(message)
    } catch (error: any) {
      console.error('Bulk reject error:', error)
      alert(`Error during bulk rejection: ${error.message}`)
    } finally {
      setIsBulkProcessing(false)
      setBulkRejectProgress(null)
    }
  }, [selectedRows, fetchWithdrawals, filteredRows])

  // Normal columns (default view)
  const normalColumns: Array<DataTableColumn<PendingWithdrawRow>> = useMemo(() => [
    {
      key: 'select',
      title: (
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={isAllSelected}
            ref={(input) => {
              if (input) input.indeterminate = isSomeSelected
            }}
            onChange={(e) => handleSelectAll(e.target.checked)}
            disabled={isBulkProcessing || filteredRows.length === 0}
            className="cursor-pointer"
          />
        </div>
      ),
      render: (row: PendingWithdrawRow) => {
        const isSelectable = filteredRows.slice(0, MAX_BULK_LIMIT).some(r => r.request_id === row.request_id)
        return (
          <input
            type="checkbox"
            checked={selectedRows.has(row.request_id)}
            onChange={(e) => handleRowSelect(row.request_id, e.target.checked)}
            disabled={isBulkProcessing || !isSelectable}
            className="cursor-pointer"
            title={!isSelectable ? `Only first ${MAX_BULK_LIMIT} items can be selected` : ''}
          />
        )
      }
    },
    {
      key: 'action',
      title: 'Action',
      render: (row: PendingWithdrawRow) => {
        const isLoading = actionLoading === row.request_id
        return (
          <div className="flex items-center gap-2">
            <ApproveReject
              onApprove={() => !isLoading && handleApprove(row)}
              onReject={() => !isLoading && handleReject(row)}
            />
            {isLoading && (
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
            )}
          </div>
        )
      }
    },
    { 
      key: 'user_id', 
      title: 'User ID',
      render: (r: PendingWithdrawRow) => {
        // Show display_id if available, otherwise show numeric user_id
        const displayId = r.user_display_id || r.user_id
        const userName = r.user_name || ''
        return (
          <div className="flex flex-col">
            <span className="font-mono font-semibold text-blue-600">{displayId}</span>
            {userName && (
              <span className="text-xs text-gray-600 mt-0.5">{userName}</span>
            )}
          </div>
        )
      }
    },
    { 
      key: 'pan_number', 
      title: 'PAN Details',
      render: (r: PendingWithdrawRow) => (
        <span className="font-mono">{r.pan_number || '-'}</span>
      )
    },
    { 
      key: 'mobile_number', 
      title: 'Mobile Number',
      render: (r: PendingWithdrawRow) => (
        <span className="font-mono">{r.mobile_number || '-'}</span>
      )
    },
    { 
      key: 'withdraw_amount', 
      title: 'Withdraw Amount (Requested)',
      render: (r: PendingWithdrawRow) => (
        <span className="font-bold">₹ {r.withdraw_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      )
    },
    { 
      key: 'tds_amount', 
      title: 'TDS (10%)',
      render: (r: PendingWithdrawRow) => {
        const tdsAmount = r.withdraw_amount * 0.1
        return (
          <span className="font-bold text-orange-600">₹ {tdsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        )
      }
    },
    { 
      key: 'payout_inr', 
      title: 'Payout INR (after 10% TDS Deduction)',
      render: (r: PendingWithdrawRow) => (
        <span className="font-bold text-blue-600">₹ {r.payout_inr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      )
    },
    { 
      key: 'wallet_type', 
      title: 'Wallet Type'
    },
    { 
      key: 'upi_id', 
      title: 'UPI ID'
    },
    { 
      key: 'bank_name', 
      title: 'Bank Name'
    },
    { 
      key: 'branch', 
      title: 'Branch'
    },
    { 
      key: 'ac_hldr', 
      title: 'AC Holder'
    },
    { 
      key: 'ac_no', 
      title: 'AC No'
    },
    { 
      key: 'ac_ifsc', 
      title: 'AC IFSC'
    },
    { 
      key: 'withdraw_status', 
      title: 'Withdraw Status',
      render: (r: PendingWithdrawRow) => (
        <span className="text-yellow-600 font-semibold">{r.withdraw_status}</span>
      )
    },
    { 
      key: 'date_request', 
      title: 'Date (Request)'
    },
  ], [actionLoading, handleApprove, handleReject, selectedRows, isAllSelected, isSomeSelected, handleSelectAll, handleRowSelect, isBulkProcessing, filteredRows])

  // CA10% columns (Excel format)
  const ca10Columns: Array<DataTableColumn<PendingWithdrawRow>> = useMemo(() => [
    {
      key: 'select',
      title: (
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={isAllSelected}
            ref={(input) => {
              if (input) input.indeterminate = isSomeSelected
            }}
            onChange={(e) => handleSelectAll(e.target.checked)}
            disabled={isBulkProcessing || filteredRows.length === 0}
            className="cursor-pointer"
          />
        </div>
      ),
      render: (row: PendingWithdrawRow) => {
        const isSelectable = filteredRows.slice(0, MAX_BULK_LIMIT).some(r => r.request_id === row.request_id)
        return (
          <input
            type="checkbox"
            checked={selectedRows.has(row.request_id)}
            onChange={(e) => handleRowSelect(row.request_id, e.target.checked)}
            disabled={isBulkProcessing || !isSelectable}
            className="cursor-pointer"
            title={!isSelectable ? `Only first ${MAX_BULK_LIMIT} items can be selected` : ''}
          />
        )
      }
    },
    { 
      key: 'user_id', 
      title: 'ID Number',
      render: (r: PendingWithdrawRow) => {
        const displayId = r.user_display_id || r.user_id
        const userName = r.user_name || ''
        return (
          <div className="flex flex-col">
            <span className="font-mono font-semibold">{displayId}</span>
            {userName && (
              <span className="text-xs text-gray-600 mt-0.5">{userName}</span>
            )}
          </div>
        )
      }
    },
    { 
      key: 'withdraw_amount', 
      title: 'AMOUNT',
      render: (r: PendingWithdrawRow) => (
        <span className="font-bold">₹ {r.withdraw_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      )
    },
    { 
      key: 'tds_amount', 
      title: '10% TDS',
      render: (r: PendingWithdrawRow) => {
        const tdsAmount = r.withdraw_amount * 0.1
        return (
          <span className="font-bold">₹ {tdsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        )
      }
    },
    { 
      key: 'payout_inr', 
      title: 'GIVEN AMOUNT',
      render: (r: PendingWithdrawRow) => (
        <span className="font-bold">₹ {r.payout_inr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      )
    },
    { 
      key: 'pan_number', 
      title: 'PANCARD',
      render: (r: PendingWithdrawRow) => (
        <span className="font-mono">{r.pan_number || '-'}</span>
      )
    },
    { 
      key: 'mobile_number', 
      title: 'MOBILE',
      render: (r: PendingWithdrawRow) => (
        <span className="font-mono">{r.mobile_number || '-'}</span>
      )
    },
    { 
      key: 'ac_no', 
      title: 'BANK AC',
      render: (r: PendingWithdrawRow) => (
        <span className="font-mono">{r.ac_no || '-'}</span>
      )
    },
    { 
      key: 'ac_ifsc', 
      title: 'IFC CODE',
      render: (r: PendingWithdrawRow) => (
        <span className="font-mono">{r.ac_ifsc || '-'}</span>
      )
    },
    { 
      key: 'address', 
      title: 'ADREESS',
      render: (r: PendingWithdrawRow) => (
        <span>{r.address || '-'}</span>
      )
    },
    { 
      key: 'aadhaar', 
      title: 'AADHAR',
      render: (r: PendingWithdrawRow) => (
        <span>{r.aadhaar || '-'}</span>
      )
    },
    {
      key: 'action',
      title: 'APROVE',
      render: (row: PendingWithdrawRow) => {
        const isLoading = actionLoading === row.request_id
        return (
          <div className="flex items-center gap-2">
            <ApproveReject
              onApprove={() => !isLoading && handleApprove(row)}
              onReject={() => !isLoading && handleReject(row)}
            />
            {isLoading && (
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
            )}
          </div>
        )
      }
    },
    { 
      key: 'date_request', 
      title: 'DATE'
    },
  ], [actionLoading, handleApprove, handleReject, selectedRows, isAllSelected, isSomeSelected, handleSelectAll, handleRowSelect, isBulkProcessing, filteredRows])

  // Spot Wallet columns (Excel format)
  const spotWalletColumns: Array<DataTableColumn<PendingWithdrawRow>> = useMemo(() => [
    {
      key: 'select',
      title: (
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={isAllSelected}
            ref={(input) => {
              if (input) input.indeterminate = isSomeSelected
            }}
            onChange={(e) => handleSelectAll(e.target.checked)}
            disabled={isBulkProcessing || filteredRows.length === 0}
            className="cursor-pointer"
          />
        </div>
      ),
      render: (row: PendingWithdrawRow) => {
        const isSelectable = filteredRows.slice(0, MAX_BULK_LIMIT).some(r => r.request_id === row.request_id)
        return (
          <input
            type="checkbox"
            checked={selectedRows.has(row.request_id)}
            onChange={(e) => handleRowSelect(row.request_id, e.target.checked)}
            disabled={isBulkProcessing || !isSelectable}
            className="cursor-pointer"
            title={!isSelectable ? `Only first ${MAX_BULK_LIMIT} items can be selected` : ''}
          />
        )
      }
    },
    { 
      key: 'user_id', 
      title: 'ID Number',
      render: (r: PendingWithdrawRow) => {
        const displayId = r.user_display_id || r.user_id
        const userName = r.user_name || ''
        return (
          <div className="flex flex-col">
            <span className="font-mono font-semibold">{displayId}</span>
            {userName && (
              <span className="text-xs text-gray-600 mt-0.5">{userName}</span>
            )}
          </div>
        )
      }
    },
    { 
      key: 'withdraw_amount', 
      title: 'AMOUNT',
      render: (r: PendingWithdrawRow) => (
        <span className="font-bold">₹ {r.withdraw_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      )
    },
    { 
      key: 'ac_ifsc', 
      title: 'IFC CODE',
      render: (r: PendingWithdrawRow) => (
        <span className="font-mono">{r.ac_ifsc || '-'}</span>
      )
    },
    { 
      key: 'payout_inr', 
      title: 'AMOUNT',
      render: (r: PendingWithdrawRow) => (
        <span className="font-bold">₹ {r.payout_inr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      )
    },
    { 
      key: 'tds_amount', 
      title: '10% TDS',
      render: (r: PendingWithdrawRow) => {
        const tdsAmount = r.withdraw_amount * 0.1
        return (
          <span className="font-bold">₹ {tdsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        )
      }
    },
    { 
      key: 'mobile_number', 
      title: 'MOBILE',
      render: (r: PendingWithdrawRow) => (
        <span className="font-mono">{r.mobile_number || '-'}</span>
      )
    },
    { 
      key: 'address', 
      title: 'ADREESS',
      render: (r: PendingWithdrawRow) => (
        <span>{r.address || '-'}</span>
      )
    },
    { 
      key: 'remark', 
      title: 'REMARK',
      render: (r: PendingWithdrawRow) => (
        <span>-</span>
      )
    },
    { 
      key: 'pan_number', 
      title: 'PAN CARD',
      render: (r: PendingWithdrawRow) => (
        <span className="font-mono">{r.pan_number || '-'}</span>
      )
    },
    {
      key: 'action',
      title: 'APROVE',
      render: (row: PendingWithdrawRow) => {
        const isLoading = actionLoading === row.request_id
        return (
          <div className="flex items-center gap-2">
            <ApproveReject
              onApprove={() => !isLoading && handleApprove(row)}
              onReject={() => !isLoading && handleReject(row)}
            />
            {isLoading && (
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
            )}
          </div>
        )
      }
    },
    { 
      key: 'date_request', 
      title: 'DATE'
    },
  ], [actionLoading, handleApprove, handleReject, selectedRows, isAllSelected, isSomeSelected, handleSelectAll, handleRowSelect, isBulkProcessing, filteredRows])

  // Main Wallet columns (Excel format)
  const mainWalletColumns: Array<DataTableColumn<PendingWithdrawRow>> = useMemo(() => [
    {
      key: 'select',
      title: (
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={isAllSelected}
            ref={(input) => {
              if (input) input.indeterminate = isSomeSelected
            }}
            onChange={(e) => handleSelectAll(e.target.checked)}
            disabled={isBulkProcessing || filteredRows.length === 0}
            className="cursor-pointer"
          />
        </div>
      ),
      render: (row: PendingWithdrawRow) => {
        const isSelectable = filteredRows.slice(0, MAX_BULK_LIMIT).some(r => r.request_id === row.request_id)
        return (
          <input
            type="checkbox"
            checked={selectedRows.has(row.request_id)}
            onChange={(e) => handleRowSelect(row.request_id, e.target.checked)}
            disabled={isBulkProcessing || !isSelectable}
            className="cursor-pointer"
            title={!isSelectable ? `Only first ${MAX_BULK_LIMIT} items can be selected` : ''}
          />
        )
      }
    },
    { 
      key: 'user_id', 
      title: 'ID Number',
      render: (r: PendingWithdrawRow) => {
        const displayId = r.user_display_id || r.user_id
        const userName = r.user_name || ''
        return (
          <div className="flex flex-col">
            <span className="font-mono font-semibold">{displayId}</span>
            {userName && (
              <span className="text-xs text-gray-600 mt-0.5">{userName}</span>
            )}
          </div>
        )
      }
    },
    { 
      key: 'wallet_type', 
      title: 'MAIN WALLET',
      render: (r: PendingWithdrawRow) => (
        <span>{r.wallet_type === 'Wallet' ? 'Main Wallet' : r.wallet_type}</span>
      )
    },
    { 
      key: 'user_name', 
      title: 'NAME',
      render: (r: PendingWithdrawRow) => (
        <span>{r.user_name || '-'}</span>
      )
    },
    { 
      key: 'withdraw_amount', 
      title: 'AMOUNT',
      render: (r: PendingWithdrawRow) => (
        <span className="font-bold">₹ {r.withdraw_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      )
    },
    { 
      key: 'ac_ifsc', 
      title: 'IFC CODE',
      render: (r: PendingWithdrawRow) => (
        <span className="font-mono">{r.ac_ifsc || '-'}</span>
      )
    },
    { 
      key: 'payout_inr', 
      title: 'AMOUNT',
      render: (r: PendingWithdrawRow) => (
        <span className="font-bold">₹ {r.payout_inr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      )
    },
    { 
      key: 'tds_amount', 
      title: '10% TDS',
      render: (r: PendingWithdrawRow) => {
        const tdsAmount = r.withdraw_amount * 0.1
        return (
          <span className="font-bold">₹ {tdsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        )
      }
    },
    { 
      key: 'mobile_number', 
      title: 'MOBILE',
      render: (r: PendingWithdrawRow) => (
        <span className="font-mono">{r.mobile_number || '-'}</span>
      )
    },
    { 
      key: 'address', 
      title: 'ADREESS',
      render: (r: PendingWithdrawRow) => (
        <span>{r.address || '-'}</span>
      )
    },
    { 
      key: 'remark', 
      title: 'REMARK',
      render: (r: PendingWithdrawRow) => (
        <span>-</span>
      )
    },
    { 
      key: 'pan_number', 
      title: 'PAN CARD',
      render: (r: PendingWithdrawRow) => (
        <span className="font-mono">{r.pan_number || '-'}</span>
      )
    },
    {
      key: 'action',
      title: 'APROVE',
      render: (row: PendingWithdrawRow) => {
        const isLoading = actionLoading === row.request_id
        return (
          <div className="flex items-center gap-2">
            <ApproveReject
              onApprove={() => !isLoading && handleApprove(row)}
              onReject={() => !isLoading && handleReject(row)}
            />
            {isLoading && (
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
            )}
          </div>
        )
      }
    },
    { 
      key: 'date_request', 
      title: 'DATE'
    },
  ], [actionLoading, handleApprove, handleReject, selectedRows, isAllSelected, isSomeSelected, handleSelectAll, handleRowSelect, isBulkProcessing, filteredRows])

  // Select columns based on view filter
  const columns = viewFilter === 'ca10' ? ca10Columns : viewFilter === 'spot-wallet' ? spotWalletColumns : viewFilter === 'main-wallet' ? mainWalletColumns : normalColumns

  // All filtering is done server-side, so use rows directly (already paginated by API)
  const paginatedRows = filteredRows
  
  // Use API total (server-side filtering)
  const paginationTotal = total

  const handleExport = async () => {
    if (isExporting) return
    try {
      setIsExporting(true)

      const baseParams: any = {
        page: 1,
        limit: 100,
      }

      if (walletTypeFilter) baseParams.withdraw_type = walletTypeFilter
      if (userIdFilter.trim()) baseParams.user_id = userIdFilter.trim()
      if (startDate) baseParams.start_date = startDate
      if (endDate) baseParams.end_date = endDate

      const firstResponse = await getPendingWithdrawals(baseParams)
      let allWithdrawals = [...firstResponse.items]
      const totalPages = firstResponse.total_pages

      // Fetch remaining pages in parallel (was sequential — slow for 1000+ rows)
      if (totalPages > 1) {
        const pageResponses = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) =>
            getPendingWithdrawals({ ...baseParams, page: i + 2 }),
          ),
        )
        for (const pageResponse of pageResponses) {
          allWithdrawals = allWithdrawals.concat(pageResponse.items)
        }
      }

      if (!allWithdrawals.length) {
        alert('No pending withdrawal records available to export.')
        return
      }

      // Profile + bank fields are on each pending item from API — no per-user getUserById loop
      const allRows = allWithdrawals.map((item) => mapPendingWithdrawToRow(item))

    if (viewFilter === 'ca10') {
      // CA10% Excel format
      const headers = ['ID Number', 'NAME', 'AMOUNT', '10% TDS', 'GIVEN AMOUNT', 'PANCARD', 'MOBILE', 'BANK AC', 'IFC CODE', 'ADREESS', 'AADHAR', 'APROVE', 'DATE']
      const data = allRows.map(row => {
        const tdsAmount = row.withdraw_amount * 0.1
        return [
          row.user_display_id || row.user_id,
          row.user_name || 'N/A',
          row.withdraw_amount,
          tdsAmount,
          row.payout_inr,
          row.pan_number || 'N/A',
          row.mobile_number || 'N/A',
          row.ac_no || 'N/A',
          row.ac_ifsc || 'N/A',
          row.address || 'N/A',
          row.aadhaar || 'N/A',
          row.withdraw_status,
          row.date_request,
        ]
      })
      exportToCsv(`pending-withdrawals-ca10-${new Date().toISOString().split('T')[0]}.csv`, headers, data)
    } else if (viewFilter === 'spot-wallet') {
      // Spot Wallet Excel format
      const headers = ['ID Number', 'SPOT WALLET NAME', 'AMOUNT', 'IFC CODE', 'AMOUNT', '10% TDS', 'MOBILE', 'ADREESS', 'REMARK', 'PAN CARD', 'APROVE', 'DATE']
      const data = allRows.map(row => {
        const tdsAmount = row.withdraw_amount * 0.1
        return [
          row.user_display_id || row.user_id,
          row.user_name || 'N/A',
          row.withdraw_amount,
          row.ac_ifsc || 'N/A',
          row.payout_inr,
          tdsAmount,
          row.mobile_number || 'N/A',
          row.address || 'N/A',
          '-', // REMARK
          row.pan_number || 'N/A',
          row.withdraw_status,
          row.date_request,
        ]
      })
      exportToCsv(`pending-withdrawals-spot-wallet-${new Date().toISOString().split('T')[0]}.csv`, headers, data)
    } else if (viewFilter === 'main-wallet') {
      // Main Wallet Excel format
      const headers = ['ID Number', 'MAIN WALLET', 'NAME', 'AMOUNT', 'IFC CODE', 'AMOUNT', '10% TDS', 'MOBILE', 'ADREESS', 'REMARK', 'PAN CARD', 'APROVE', 'DATE']
      const data = allRows.map(row => {
        const tdsAmount = row.withdraw_amount * 0.1
        return [
          row.user_display_id || row.user_id,
          row.wallet_type === 'Wallet' ? 'Main Wallet' : row.wallet_type,
          row.user_name || 'N/A',
          row.withdraw_amount,
          row.ac_ifsc || 'N/A',
          row.payout_inr,
          tdsAmount,
          row.mobile_number || 'N/A',
          row.address || 'N/A',
          '-', // REMARK
          row.pan_number || 'N/A',
          row.withdraw_status,
          row.date_request,
        ]
      })
      exportToCsv(`pending-withdrawals-main-wallet-${new Date().toISOString().split('T')[0]}.csv`, headers, data)
    } else {
      // Normal format
      const headers = ['User ID', 'PAN Number', 'Mobile Number', 'Withdraw Amount', 'Payout (INR)', 'Wallet Type', 'UPI ID', 'Bank Name', 'Branch', 'Account Holder', 'Account Number', 'IFSC', 'Status', 'Date Request']
      const data = allRows.map(row => [
        row.user_display_id || row.user_id,
        row.pan_number || 'N/A',
        row.mobile_number || 'N/A',
        row.withdraw_amount,
        row.payout_inr,
        row.wallet_type,
        row.upi_id || 'N/A',
        row.bank_name || 'N/A',
        row.branch || 'N/A',
        row.ac_hldr || 'N/A',
        row.ac_no || 'N/A',
        row.ac_ifsc || 'N/A',
        row.withdraw_status,
        row.date_request,
      ])
      exportToCsv(`pending-withdrawals-${new Date().toISOString().split('T')[0]}.csv`, headers, data)
    }
    } catch (err: any) {
      console.error('Error exporting pending withdrawals:', err)
      alert(`Error exporting data: ${err.message || 'Failed to export'}`)
    } finally {
      setIsExporting(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSearch = () => {
    setPage(1) // Reset to first page when searching
    // Explicitly trigger fetch with current filter values to ensure search happens immediately
    fetchWithdrawals(1, {
      userId: userIdFilter,
      startDate: startDate,
      endDate: endDate,
      walletType: walletTypeFilter
    })
  }

  const handleClearFilters = () => {
    setUserIdFilter('')
    setNameFilter('')
    setWalletTypeFilter('')
    setViewFilter('normal')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  const WALLET_TYPE_OPTIONS = [
    { value: '', label: 'All Wallets' },
    { value: 'spot', label: 'Spot Wallet' },
    { value: 'wallet', label: 'Main Wallet' },
    { value: 'team_royalty', label: 'Team Royalty Wallet' },
  ]

  const VIEW_OPTIONS = [
    { value: 'normal', label: 'Normal View' },
    { value: 'ca10', label: 'CA10%' },
    { value: 'spot-wallet', label: 'Spot Wallet' },
    { value: 'main-wallet', label: 'Main Wallet' },
  ]

  return (
    <Card
      title="Pending Withdrawals ⏳"
      toolbarRight={
        <>
          {selectedRows.size > 0 && (
            <>
              <Button
                variant="outline"
                size="md"
                onClick={handleBulkApprove}
                disabled={isBulkProcessing || selectedRows.size > MAX_BULK_LIMIT}
                className="bg-green-50 text-green-700 border-green-300 hover:bg-green-100 disabled:opacity-50"
              >
                {isBulkProcessing && bulkApproveProgress ? (
                  <>
                    <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-green-700 mr-2"></span>
                    Approving ({bulkApproveProgress.current}/{bulkApproveProgress.total})
                  </>
                ) : (
                  `Approve Selected (${selectedRows.size})`
                )}
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={handleBulkReject}
                disabled={isBulkProcessing || selectedRows.size > MAX_BULK_LIMIT}
                className="bg-red-50 text-red-700 border-red-300 hover:bg-red-100 disabled:opacity-50"
              >
                {isBulkProcessing && bulkRejectProgress ? (
                  <>
                    <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-red-700 mr-2"></span>
                    Rejecting ({bulkRejectProgress.current}/{bulkRejectProgress.total})
                  </>
                ) : (
                  `Reject Selected (${selectedRows.size})`
                )}
              </Button>
              {selectedRows.size > MAX_BULK_LIMIT && (
                <span className="text-xs text-red-600 self-center">
                  Max {MAX_BULK_LIMIT} items allowed
                </span>
              )}
            </>
          )}
          <Button
            variant="outline"
            size="md"
            aria-label="Export"
            onClick={handleExport}
            disabled={isExporting}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <span>{isExporting ? 'Exporting…' : 'Export'}</span>
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
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="text-gray-600">Loading pending withdrawals...</div>
        </div>
      ) : (
        <DataTable<PendingWithdrawRow>
        columns={columns}
        rows={paginatedRows}
          minWidthPx={viewFilter === 'ca10' ? 1200 : viewFilter === 'spot-wallet' ? 1400 : 1600}
          />
        )}

      <FiltersBar>
        <TextInput 
          id="fullname-filter" 
          label="Filter by Full Name:" 
          value={nameFilter} 
          onChange={setNameFilter} 
          placeholder="Enter Full Name (e.g., Ramesh Kumar)"
        />
        <TextInput 
          id="user-id-filter" 
          label="Filter by User ID:" 
          value={userIdFilter} 
          onChange={setUserIdFilter}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSearch()
            }
          }}
          placeholder="Enter User ID (Display ID)" 
        />
        <SelectInput
          id="wallet-type-filter"
          label="Filter by Wallet Type:"
          value={walletTypeFilter}
          onChange={(v) => {
            setWalletTypeFilter(v as 'spot' | 'wallet' | 'team_royalty' | '')
            setPage(1) // Reset to first page when filter changes
          }}
          options={WALLET_TYPE_OPTIONS}
        />
        <SelectInput
          id="view-filter"
          label="View Format:"
          value={viewFilter}
          onChange={(v) => {
            setViewFilter(v as 'normal' | 'ca10' | 'spot-wallet' | 'main-wallet')
            setPage(1) // Reset to first page when filter changes
          }}
          options={VIEW_OPTIONS}
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
        <PrimaryButton type="button" onClick={handleSearch} disabled={isLoading}>
          Search
        </PrimaryButton>
        <SecondaryButton type="button" onClick={handleClearFilters} disabled={isLoading}>
          Clear filtering
        </SecondaryButton>
      </FiltersBar>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={paginationTotal}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[10, 25, 50, 100]}
      />

      {/* Reject Reason Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => {
          if (!actionLoading) {
            setIsRejectModalOpen(false)
            setRejectingRequestId(null)
            setRejectReason('')
          }
        }}
        title="Reject Withdrawal - Provide Reason"
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!actionLoading) {
                  setIsRejectModalOpen(false)
                  setRejectingRequestId(null)
                  setRejectReason('')
                }
              }}
              disabled={actionLoading === rejectingRequestId}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRejectSubmit}
              disabled={actionLoading === rejectingRequestId || !rejectReason.trim()}
            >
              {actionLoading === rejectingRequestId ? 'Submitting...' : 'Submit Reason'}
            </Button>
          </div>
        }
      >
        <p className="mb-4 text-gray-700">
          Please provide a reason for rejecting withdrawal request ID: {rejectingRequestId}
        </p>
        <textarea
          className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
          rows={4}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Enter rejection reason..."
          disabled={actionLoading === rejectingRequestId}
        ></textarea>
      </Modal>
    </Card>
  )
}
