"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, TextInput, SelectInput, DateRangeInput } from '../../../components/ui/FiltersBar'
import Pagination from '../../../components/ui/Pagination'
import Button from '../../../components/ui/Button'
import { getWithdrawalHistory, type WithdrawRequestItem } from '../../../lib/api/withdraw'
import { getUserById, type UserDetails } from '../../../lib/api/users'
import { getAllProfiles } from '../../../lib/api/kyc'
import { ToastContainer, useToast } from '../../../components/ui/Toast'
import { exportToCsv } from '../../../lib/export'

type WithdrawHistoryRow = {
  user_id: string
  user_display_id: string
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

export default function WithdrawHistoryPage() {
  const [userIdFilter, setUserIdFilter] = useState('')
  const [nameFilter, setNameFilter] = useState('')
  const [walletTypeFilter, setWalletTypeFilter] = useState<'spot' | 'wallet' | ''>('')
  const [statusFilter, setStatusFilter] = useState<'approved' | 'rejected' | ''>('')
  const [viewFilter, setViewFilter] = useState<'normal' | 'ca10' | 'spot-wallet' | 'main-wallet'>('normal')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [withdrawals, setWithdrawals] = useState<WithdrawRequestItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  
  // User details cache to avoid multiple API calls
  const [userDetailsCache, setUserDetailsCache] = useState<Record<string, UserDetails>>({})
  const [loadingUserDetails, setLoadingUserDetails] = useState<Set<string>>(new Set())
  
  const { toasts, showToast, closeToast } = useToast()

  const getStatusColor = (status: string): string => {
    const normalizedStatus = status.toLowerCase()
    if (normalizedStatus === 'approved' || normalizedStatus.includes('success')) return 'text-green-600 font-semibold'
    if (normalizedStatus === 'pending') return 'text-yellow-600 font-semibold'
    if (normalizedStatus === 'rejected' || normalizedStatus.includes('reject')) return 'text-red-600 font-semibold'
    if (normalizedStatus === 'processing') return 'text-blue-600 font-semibold'
    return 'font-semibold'
  }

  const formatStatus = (status: string): string => {
    const normalizedStatus = status.toLowerCase()
    if (normalizedStatus === 'approved') return 'Approved'
    if (normalizedStatus === 'rejected') return 'Rejected'
    if (normalizedStatus === 'pending') return 'Pending'
    if (normalizedStatus === 'processing') return 'Processing'
    return status
  }

  const parseAccountDetails = (accountDetails: string) => {
    // Try to parse account_details string
    // Format might be: "****1234 - HDFC Bank" or JSON string
    try {
      const parsed = JSON.parse(accountDetails)
      return {
        bank_name: parsed.bank_name || parsed.bankName || '-',
        branch: parsed.branch || '-',
        ac_hldr: parsed.account_holder || parsed.accountHolder || parsed.ac_hldr || '-',
        ac_no: parsed.account_number || parsed.accountNumber || parsed.ac_no || '-',
        ac_ifsc: parsed.ifsc || parsed.ifscCode || parsed.ac_ifsc || '-',
        upi_id: parsed.upi_id || parsed.upiId || parsed.upi || '-',
      }
    } catch {
      // If not JSON, try to extract info from string format
      // For now, just return defaults and show account_details as-is
      return {
        bank_name: accountDetails.includes('Bank') ? accountDetails.split(' - ')[1] || accountDetails : '-',
        branch: '-',
        ac_hldr: '-',
        ac_no: accountDetails.match(/\*{4}\d+/)?.[0] || accountDetails.split(' - ')[0] || '-',
        ac_ifsc: '-',
        upi_id: accountDetails.includes('@') ? accountDetails : '-',
      }
    }
  }

  const fetchWithdrawals = useCallback(async (overridePage?: number, overrideFilters?: { userId?: string; startDate?: string; endDate?: string; walletType?: string; status?: string }) => {
    setLoading(true)
    setError(null)
    try {
      // Use override filters if provided, otherwise use state values
      const currentUserIdFilter = overrideFilters?.userId !== undefined ? overrideFilters.userId : userIdFilter
      const currentStartDate = overrideFilters?.startDate !== undefined ? overrideFilters.startDate : startDate
      const currentEndDate = overrideFilters?.endDate !== undefined ? overrideFilters.endDate : endDate
      const currentWalletTypeFilter = overrideFilters?.walletType !== undefined ? overrideFilters.walletType : walletTypeFilter
      const currentStatusFilter = overrideFilters?.status !== undefined ? overrideFilters.status : statusFilter
      
      const params: any = {
        page: overridePage !== undefined ? overridePage : page,
        limit: pageSize,
      }
      
      if (currentUserIdFilter.trim()) {
        params.user_id = currentUserIdFilter.trim()
      }

      if (nameFilter.trim()) {
        params.name = nameFilter.trim()
      }

      if (currentWalletTypeFilter) {
        params.withdraw_type = currentWalletTypeFilter
      }

      if (currentStatusFilter) {
        params.status = currentStatusFilter
      }

      if (currentStartDate) {
        params.start_date = currentStartDate
      }

      if (currentEndDate) {
        params.end_date = currentEndDate
      }

      console.log('[Withdrawal History] Fetching with params:', params)

      const response = await getWithdrawalHistory(params)
      
      console.log('[Withdrawal History] Response:', { count: response.count, total: response.total, items: response.items.length })
      
      setWithdrawals(response.items || [])
      setTotal(response.total || 0)
      setTotalPages(response.total_pages || 0)
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to fetch withdrawal history'
      setError(errorMessage)
      showToast(errorMessage, 'error')
      setWithdrawals([])
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, userIdFilter, nameFilter, walletTypeFilter, statusFilter, startDate, endDate, showToast])

  // Fetch user details for a specific user
  const fetchUserDetails = useCallback(async (userId: string) => {
    try {
      setLoadingUserDetails(prev => {
        if (prev.has(userId)) {
          return prev
        }
        return new Set(prev).add(userId)
      })
      
      let userDetails = await getUserById(userId)
      
      // If bank details, address, or aadhaar are missing, try to get from admin profiles endpoint as fallback
      const needsProfileData = !userDetails.bank_name || !userDetails.bank_account_no || !userDetails.bank_ifsc || 
                                !userDetails.address || !userDetails.aadhar_number
      
      if (needsProfileData) {
        try {
          const profilesResponse = await getAllProfiles({ user_id: userId, limit: 1 })
          const profile = profilesResponse.items?.[0]
          if (profile?.profile) {
            // Merge all profile data from profiles endpoint into userDetails
            userDetails = {
              ...userDetails,
              bank_name: profile.profile.bank_name || userDetails.bank_name,
              bank_branch: profile.profile.bank_branch || userDetails.bank_branch,
              bank_account_no: profile.profile.bank_account_no || userDetails.bank_account_no,
              bank_ifsc: profile.profile.bank_ifsc || userDetails.bank_ifsc,
              address: userDetails.address || profile.profile.address || null,
              city: userDetails.city || profile.profile.city || null,
              state: userDetails.state || profile.profile.state || null,
              pincode: userDetails.pincode || profile.profile.pincode || null,
              aadhar_number: userDetails.aadhar_number || profile.profile.aadhar_number || null,
            }
          }
        } catch (profileErr: any) {
          console.warn(`Failed to fetch from profiles endpoint for ${userId}:`, profileErr)
        }
      }
      
      setUserDetailsCache(prev => {
        if (prev[userId]) {
          return prev
        }
        return {
          ...prev,
          [userId]: userDetails,
        }
      })
    } catch (err: any) {
      console.error(`Error fetching user details for ${userId}:`, err)
    } finally {
      setLoadingUserDetails(prev => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    }
  }, [])

  useEffect(() => {
    fetchWithdrawals()
  }, [page, pageSize, walletTypeFilter, statusFilter, startDate, endDate, userIdFilter, nameFilter, fetchWithdrawals]) // Include all filters to auto-refresh when they change

  // Fetch user details for all withdrawals to ensure complete bank information
  useEffect(() => {
    if (withdrawals.length === 0) return
    
    withdrawals.forEach((item) => {
      if (!item.user_id) return
      
      const isCached = !!userDetailsCache[item.user_id]
      const isLoading = loadingUserDetails.has(item.user_id)
      
      if (!isCached && !isLoading) {
        fetchUserDetails(item.user_id)
      }
    })
  }, [withdrawals, fetchUserDetails])

  // Normal columns (default view)
  const normalColumns: Array<DataTableColumn<WithdrawHistoryRow>> = useMemo(() => [
    { 
      key: 'user_display_id', 
      title: 'User ID',
      render: (r: WithdrawHistoryRow) => {
        const userName = r.user_name || ''
        return (
          <div className="flex flex-col">
            <span className="font-mono font-semibold text-blue-600">{r.user_display_id}</span>
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
      render: (r: WithdrawHistoryRow) => (
        <span className="font-mono">{r.pan_number || '-'}</span>
      )
    },
    { 
      key: 'mobile_number', 
      title: 'Mobile Number',
      render: (r: WithdrawHistoryRow) => (
        <span className="font-mono">{r.mobile_number || '-'}</span>
      )
    },
    { 
      key: 'withdraw_amount', 
      title: 'Withdraw Amount (Requested)',
      render: (r: WithdrawHistoryRow) => (
        <span className="font-bold">₹ {r.withdraw_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      )
    },
    { 
      key: 'tds_amount', 
      title: 'TDS (10%)',
      render: (r: WithdrawHistoryRow) => {
        const tdsAmount = r.withdraw_amount * 0.1
        return (
          <span className="font-bold text-orange-600">₹ {tdsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        )
      }
    },
    { 
      key: 'payout_inr', 
      title: 'Payout INR (after 10% TDS Deduction)',
      render: (r: WithdrawHistoryRow) => (
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
      render: (r: WithdrawHistoryRow) => (
        <span className={getStatusColor(r.withdraw_status)}>{r.withdraw_status}</span>
      )
    },
    { 
      key: 'date_request', 
      title: 'Date (Request)'
    },
  ], [])

  // CA10% columns (Excel format)
  const ca10Columns: Array<DataTableColumn<WithdrawHistoryRow>> = useMemo(() => [
    { 
      key: 'user_display_id', 
      title: 'ID Number',
      render: (r: WithdrawHistoryRow) => {
        const userName = r.user_name || ''
        return (
          <div className="flex flex-col">
            <span className="font-mono font-semibold">{r.user_display_id}</span>
            {userName && (
              <span className="text-xs text-gray-600 mt-0.5">{userName}</span>
            )}
          </div>
        )
      }
    },
    { 
      key: 'user_name', 
      title: 'NAME',
      render: (r: WithdrawHistoryRow) => (
        <span>{r.user_name || '-'}</span>
      )
    },
    { 
      key: 'withdraw_amount', 
      title: 'AMOUNT',
      render: (r: WithdrawHistoryRow) => (
        <span className="font-bold">₹ {r.withdraw_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      )
    },
    { 
      key: 'tds_amount', 
      title: '10% TDS',
      render: (r: WithdrawHistoryRow) => {
        const tdsAmount = r.withdraw_amount * 0.1
        return (
          <span className="font-bold">₹ {tdsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        )
      }
    },
    { 
      key: 'payout_inr', 
      title: 'GIVEN AMOUNT',
      render: (r: WithdrawHistoryRow) => (
        <span className="font-bold">₹ {r.payout_inr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      )
    },
    { 
      key: 'pan_number', 
      title: 'PANCARD',
      render: (r: WithdrawHistoryRow) => (
        <span className="font-mono">{r.pan_number || '-'}</span>
      )
    },
    { 
      key: 'mobile_number', 
      title: 'MOBILE',
      render: (r: WithdrawHistoryRow) => (
        <span className="font-mono">{r.mobile_number || '-'}</span>
      )
    },
    { 
      key: 'ac_no', 
      title: 'BANK AC',
      render: (r: WithdrawHistoryRow) => (
        <span className="font-mono">{r.ac_no || '-'}</span>
      )
    },
    { 
      key: 'ac_ifsc', 
      title: 'IFC CODE',
      render: (r: WithdrawHistoryRow) => (
        <span className="font-mono">{r.ac_ifsc || '-'}</span>
      )
    },
    { 
      key: 'address', 
      title: 'ADREESS',
      render: (r: WithdrawHistoryRow) => (
        <span>{r.address || '-'}</span>
      )
    },
    { 
      key: 'aadhaar', 
      title: 'AADHAR',
      render: (r: WithdrawHistoryRow) => (
        <span>{r.aadhaar || '-'}</span>
      )
    },
    { 
      key: 'withdraw_status', 
      title: 'APROVE',
      render: (r: WithdrawHistoryRow) => (
        <span className={getStatusColor(r.withdraw_status)}>{r.withdraw_status}</span>
      )
    },
    { 
      key: 'date_request', 
      title: 'DATE'
    },
  ], [])

  // Spot Wallet columns (Excel format)
  const spotWalletColumns: Array<DataTableColumn<WithdrawHistoryRow>> = useMemo(() => [
    { 
      key: 'user_display_id', 
      title: 'ID Number',
      render: (r: WithdrawHistoryRow) => {
        const userName = r.user_name || ''
        return (
          <div className="flex flex-col">
            <span className="font-mono font-semibold">{r.user_display_id}</span>
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
      render: (r: WithdrawHistoryRow) => (
        <span className="font-bold">₹ {r.withdraw_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      )
    },
    { 
      key: 'ac_ifsc', 
      title: 'IFC CODE',
      render: (r: WithdrawHistoryRow) => (
        <span className="font-mono">{r.ac_ifsc || '-'}</span>
      )
    },
    { 
      key: 'payout_inr', 
      title: 'AMOUNT',
      render: (r: WithdrawHistoryRow) => (
        <span className="font-bold">₹ {r.payout_inr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      )
    },
    { 
      key: 'tds_amount', 
      title: '10% TDS',
      render: (r: WithdrawHistoryRow) => {
        const tdsAmount = r.withdraw_amount * 0.1
        return (
          <span className="font-bold">₹ {tdsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        )
      }
    },
    { 
      key: 'mobile_number', 
      title: 'MOBILE',
      render: (r: WithdrawHistoryRow) => (
        <span className="font-mono">{r.mobile_number || '-'}</span>
      )
    },
    { 
      key: 'address', 
      title: 'ADREESS',
      render: (r: WithdrawHistoryRow) => (
        <span>{r.address || '-'}</span>
      )
    },
    { 
      key: 'remark', 
      title: 'REMARK',
      render: (r: WithdrawHistoryRow) => (
        <span>-</span>
      )
    },
    { 
      key: 'pan_number', 
      title: 'PAN CARD',
      render: (r: WithdrawHistoryRow) => (
        <span className="font-mono">{r.pan_number || '-'}</span>
      )
    },
    { 
      key: 'withdraw_status', 
      title: 'APROVE',
      render: (r: WithdrawHistoryRow) => (
        <span className={getStatusColor(r.withdraw_status)}>{r.withdraw_status}</span>
      )
    },
    { 
      key: 'date_request', 
      title: 'DATE'
    },
  ], [])

  // Main Wallet columns (Excel format)
  const mainWalletColumns: Array<DataTableColumn<WithdrawHistoryRow>> = useMemo(() => [
    { 
      key: 'user_display_id', 
      title: 'ID Number',
      render: (r: WithdrawHistoryRow) => {
        const userName = r.user_name || ''
        return (
          <div className="flex flex-col">
            <span className="font-mono font-semibold">{r.user_display_id}</span>
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
      render: (r: WithdrawHistoryRow) => (
        <span>{r.wallet_type === 'Main Wallet' ? 'Main Wallet' : r.wallet_type}</span>
      )
    },
    { 
      key: 'user_name', 
      title: 'NAME',
      render: (r: WithdrawHistoryRow) => (
        <span>{r.user_name || '-'}</span>
      )
    },
    { 
      key: 'withdraw_amount', 
      title: 'AMOUNT',
      render: (r: WithdrawHistoryRow) => (
        <span className="font-bold">₹ {r.withdraw_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      )
    },
    { 
      key: 'ac_ifsc', 
      title: 'IFC CODE',
      render: (r: WithdrawHistoryRow) => (
        <span className="font-mono">{r.ac_ifsc || '-'}</span>
      )
    },
    { 
      key: 'payout_inr', 
      title: 'AMOUNT',
      render: (r: WithdrawHistoryRow) => (
        <span className="font-bold">₹ {r.payout_inr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      )
    },
    { 
      key: 'tds_amount', 
      title: '10% TDS',
      render: (r: WithdrawHistoryRow) => {
        const tdsAmount = r.withdraw_amount * 0.1
        return (
          <span className="font-bold">₹ {tdsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        )
      }
    },
    { 
      key: 'mobile_number', 
      title: 'MOBILE',
      render: (r: WithdrawHistoryRow) => (
        <span className="font-mono">{r.mobile_number || '-'}</span>
      )
    },
    { 
      key: 'address', 
      title: 'ADREESS',
      render: (r: WithdrawHistoryRow) => (
        <span>{r.address || '-'}</span>
      )
    },
    { 
      key: 'remark', 
      title: 'REMARK',
      render: (r: WithdrawHistoryRow) => (
        <span>-</span>
      )
    },
    { 
      key: 'pan_number', 
      title: 'PAN CARD',
      render: (r: WithdrawHistoryRow) => (
        <span className="font-mono">{r.pan_number || '-'}</span>
      )
    },
    { 
      key: 'withdraw_status', 
      title: 'APROVE',
      render: (r: WithdrawHistoryRow) => (
        <span className={getStatusColor(r.withdraw_status)}>{r.withdraw_status}</span>
      )
    },
    { 
      key: 'date_request', 
      title: 'DATE'
    },
  ], [])

  // Select columns based on view filter
  const columns = viewFilter === 'ca10' ? ca10Columns : viewFilter === 'spot-wallet' ? spotWalletColumns : viewFilter === 'main-wallet' ? mainWalletColumns : normalColumns

  // Map API response to table rows
  const rows: WithdrawHistoryRow[] = useMemo(() => {
    return withdrawals.map((item) => {
      const accountInfo = parseAccountDetails(item.account_details || '')
      const userDetails = userDetailsCache[item.user_id]
      const requestDate = item.created_at ? new Date(item.created_at).toISOString().split('T')[0] : '-'
      
      // Merge account details with user profile details
      // Priority: account_details > user profile > '-'
      const finalBankDetails = {
        upi_id: (accountInfo.upi_id && accountInfo.upi_id !== '-' && accountInfo.upi_id.trim() !== '') 
          ? accountInfo.upi_id 
          : '-',
        bank_name: (accountInfo.bank_name && accountInfo.bank_name !== '-' && accountInfo.bank_name.trim() !== '') 
          ? accountInfo.bank_name 
          : (userDetails?.bank_name && userDetails.bank_name.trim() !== '' ? userDetails.bank_name : '-'),
        branch: (accountInfo.branch && accountInfo.branch !== '-' && accountInfo.branch.trim() !== '') 
          ? accountInfo.branch 
          : (userDetails?.bank_branch && userDetails.bank_branch.trim() !== '' ? userDetails.bank_branch : '-'),
        ac_hldr: (accountInfo.ac_hldr && accountInfo.ac_hldr !== '-' && accountInfo.ac_hldr.trim() !== '') 
          ? accountInfo.ac_hldr 
          : (userDetails?.name && userDetails.name.trim() !== '' ? userDetails.name : '-'),
        ac_no: (accountInfo.ac_no && accountInfo.ac_no !== '-' && accountInfo.ac_no.trim() !== '') 
          ? accountInfo.ac_no 
          : (userDetails?.bank_account_no && userDetails.bank_account_no.trim() !== '' ? userDetails.bank_account_no : '-'),
        ac_ifsc: (accountInfo.ac_ifsc && accountInfo.ac_ifsc !== '-' && accountInfo.ac_ifsc.trim() !== '') 
          ? accountInfo.ac_ifsc 
          : (userDetails?.bank_ifsc && userDetails.bank_ifsc.trim() !== '' ? userDetails.bank_ifsc : '-'),
      }
      
      // Calculate payout after 10% TDS deduction (90% of requested amount)
      const payoutAmount = item.amount * 0.9
      
      // Map withdraw_type to wallet_type display
      const walletTypeMap: Record<string, string> = {
        wallet: 'Main Wallet',
        spot: 'Spot Wallet',
      }
      const walletType = walletTypeMap[item.withdraw_type] || item.withdraw_type

      return {
        user_id: item.user_id || '-',
        user_display_id: item.user_display_id || item.user_id || '-',
        user_name: item.user_name || null,
        pan_number: item.user_pan_number || userDetails?.pan_number || null,
        mobile_number: item.user_phone || userDetails?.phone || null,
        withdraw_amount: item.amount || 0,
        payout_inr: payoutAmount,
        wallet_type: walletType,
        upi_id: finalBankDetails.upi_id,
        bank_name: finalBankDetails.bank_name,
        branch: finalBankDetails.branch,
        ac_hldr: finalBankDetails.ac_hldr,
        ac_no: finalBankDetails.ac_no,
        ac_ifsc: finalBankDetails.ac_ifsc,
        withdraw_status: formatStatus(item.status),
        date_request: requestDate,
        address: userDetails ? (
          userDetails.address 
            ? `${userDetails.address}${userDetails.city ? ', ' + userDetails.city : ''}${userDetails.state ? ', ' + userDetails.state : ''}${userDetails.pincode ? ' ' + userDetails.pincode : ''}`.trim()
            : (userDetails.city || userDetails.state || userDetails.pincode 
                ? `${userDetails.city || ''}${userDetails.city && userDetails.state ? ', ' : ''}${userDetails.state || ''}${userDetails.pincode ? ' ' + userDetails.pincode : ''}`.trim()
                : null)
        ) : null,
        aadhaar: userDetails?.aadhar_number || null,
      }
    })
  }, [withdrawals, userDetailsCache])

  const handleExport = async () => {
    try {
      // Show loading message
      alert('Fetching all withdrawal history for export...')
      
      // Build base params with filters
      const baseParams: any = {
        page: 1,
        limit: 100, // Use standard page size
      }
      
      // Apply filters if set (but fetch all matching records)
      if (walletTypeFilter) {
        baseParams.withdraw_type = walletTypeFilter
      }
      
      if (statusFilter) {
        baseParams.status = statusFilter
      }
      
      if (userIdFilter.trim()) {
        baseParams.user_id = userIdFilter.trim()
      }
      
      if (startDate) {
        baseParams.start_date = startDate
      }
      
      if (endDate) {
        baseParams.end_date = endDate
      }
      
      console.log('[Export] Fetching all withdrawal history with params:', baseParams)
      
      // Fetch first page to get total count
      const firstResponse = await getWithdrawalHistory(baseParams)
      let allWithdrawals = [...firstResponse.items]
      const totalPages = firstResponse.total_pages
      
      console.log(`[Export] Total: ${firstResponse.total}, Total pages: ${totalPages}`)
      
      // Fetch remaining pages if any
      if (totalPages > 1) {
        console.log(`[Export] Fetching remaining ${totalPages - 1} pages...`)
        
        for (let page = 2; page <= totalPages; page++) {
          const pageParams = { ...baseParams, page }
          try {
            const pageResponse = await getWithdrawalHistory(pageParams)
            allWithdrawals = [...allWithdrawals, ...pageResponse.items]
            console.log(`[Export] Fetched page ${page}/${totalPages}, total records: ${allWithdrawals.length}`)
          } catch (pageErr: any) {
            console.error(`[Export] Error fetching page ${page}:`, pageErr)
            // Continue with other pages even if one fails
          }
        }
      }
      
      console.log(`[Export] Total records fetched: ${allWithdrawals.length}`)
      
      if (!allWithdrawals.length) {
        alert('No withdrawal records available to export.')
        return
      }
      
      // Use existing cache and fetch missing user details
      const allUserDetailsCache: Record<string, UserDetails> = { ...userDetailsCache }
      const uniqueUserIds = [...new Set(allWithdrawals.map(w => w.user_id).filter(Boolean))]
      const missingUserIds = uniqueUserIds.filter(userId => !allUserDetailsCache[userId])
      
      console.log(`[Export] Fetching user details for ${missingUserIds.length} missing users (${uniqueUserIds.length} total)...`)
      
      // Fetch missing user details in parallel (but limit concurrent requests)
      const batchSize = 5
      for (let i = 0; i < missingUserIds.length; i += batchSize) {
        const batch = missingUserIds.slice(i, i + batchSize)
        await Promise.all(
          batch.map(async (userId) => {
            try {
              let userDetails = await getUserById(userId)
              
              // Try to get from profiles if missing
              const needsProfileData = !userDetails.bank_name || !userDetails.bank_account_no || !userDetails.bank_ifsc
              if (needsProfileData) {
                try {
                  const profilesResponse = await getAllProfiles({ user_id: userId, limit: 1 })
                  const profile = profilesResponse.items?.[0]
                  if (profile?.profile) {
                    userDetails = {
                      ...userDetails,
                      bank_name: profile.profile.bank_name || userDetails.bank_name,
                      bank_branch: profile.profile.bank_branch || userDetails.bank_branch,
                      bank_account_no: profile.profile.bank_account_no || userDetails.bank_account_no,
                      bank_ifsc: profile.profile.bank_ifsc || userDetails.bank_ifsc,
                      address: userDetails.address || profile.profile.address || null,
                      city: userDetails.city || profile.profile.city || null,
                      state: userDetails.state || profile.profile.state || null,
                      pincode: userDetails.pincode || profile.profile.pincode || null,
                      aadhar_number: userDetails.aadhar_number || profile.profile.aadhar_number || null,
                    }
                  }
                } catch (profileErr) {
                  console.warn(`[Export] Failed to fetch profile for ${userId}:`, profileErr)
                }
              }
              
              allUserDetailsCache[userId] = userDetails
            } catch (err) {
              console.warn(`[Export] Failed to fetch user details for ${userId}:`, err)
              // Create a minimal user details object to avoid errors
              allUserDetailsCache[userId] = {} as UserDetails
            }
          })
        )
        console.log(`[Export] Fetched user details batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(missingUserIds.length / batchSize)}`)
      }
      
      // Map all withdrawals to rows
      const allRows: WithdrawHistoryRow[] = allWithdrawals.map((item) => {
        const accountInfo = parseAccountDetails(item.account_details || '')
        const userDetails = allUserDetailsCache[item.user_id]
        const requestDate = item.created_at ? new Date(item.created_at).toISOString().split('T')[0] : '-'
        
        // Merge account details with user profile details
        const finalBankDetails = {
          upi_id: (accountInfo.upi_id && accountInfo.upi_id !== '-' && accountInfo.upi_id.trim() !== '') 
            ? accountInfo.upi_id 
            : '-',
          bank_name: (accountInfo.bank_name && accountInfo.bank_name !== '-' && accountInfo.bank_name.trim() !== '') 
            ? accountInfo.bank_name 
            : (userDetails?.bank_name && userDetails.bank_name.trim() !== '' ? userDetails.bank_name : '-'),
          branch: (accountInfo.branch && accountInfo.branch !== '-' && accountInfo.branch.trim() !== '') 
            ? accountInfo.branch 
            : (userDetails?.bank_branch && userDetails.bank_branch.trim() !== '' ? userDetails.bank_branch : '-'),
          ac_hldr: (accountInfo.ac_hldr && accountInfo.ac_hldr !== '-' && accountInfo.ac_hldr.trim() !== '') 
            ? accountInfo.ac_hldr 
            : (userDetails?.name && userDetails.name.trim() !== '' ? userDetails.name : '-'),
          ac_no: (accountInfo.ac_no && accountInfo.ac_no !== '-' && accountInfo.ac_no.trim() !== '') 
            ? accountInfo.ac_no 
            : (userDetails?.bank_account_no && userDetails.bank_account_no.trim() !== '' ? userDetails.bank_account_no : '-'),
          ac_ifsc: (accountInfo.ac_ifsc && accountInfo.ac_ifsc !== '-' && accountInfo.ac_ifsc.trim() !== '') 
            ? accountInfo.ac_ifsc 
            : (userDetails?.bank_ifsc && userDetails.bank_ifsc.trim() !== '' ? userDetails.bank_ifsc : '-'),
        }
        
        const payoutAmount = item.amount * 0.9
        
        const walletTypeMap: Record<string, string> = {
          wallet: 'Main Wallet',
          spot: 'Spot Wallet',
        }
        const walletType = walletTypeMap[item.withdraw_type] || item.withdraw_type

        return {
          user_id: item.user_id || '-',
          user_display_id: item.user_display_id || item.user_id || '-',
          user_name: item.user_name || null,
          pan_number: item.user_pan_number || userDetails?.pan_number || null,
          mobile_number: item.user_phone || userDetails?.phone || null,
          withdraw_amount: item.amount || 0,
          payout_inr: payoutAmount,
          wallet_type: walletType,
          upi_id: finalBankDetails.upi_id,
          bank_name: finalBankDetails.bank_name,
          branch: finalBankDetails.branch,
          ac_hldr: finalBankDetails.ac_hldr,
          ac_no: finalBankDetails.ac_no,
          ac_ifsc: finalBankDetails.ac_ifsc,
          withdraw_status: formatStatus(item.status),
          date_request: requestDate,
          address: userDetails ? (
            userDetails.address 
              ? `${userDetails.address}${userDetails.city ? ', ' + userDetails.city : ''}${userDetails.state ? ', ' + userDetails.state : ''}${userDetails.pincode ? ' ' + userDetails.pincode : ''}`.trim()
              : (userDetails.city || userDetails.state || userDetails.pincode 
                  ? `${userDetails.city || ''}${userDetails.city && userDetails.state ? ', ' : ''}${userDetails.state || ''}${userDetails.pincode ? ' ' + userDetails.pincode : ''}`.trim()
                  : null)
          ) : null,
          aadhaar: userDetails?.aadhar_number || null,
        }
      })

    if (viewFilter === 'ca10') {
      // CA10% Excel format
      const headers = ['ID Number', 'NAME', 'AMOUNT', '10% TDS', 'GIVEN AMOUNT', 'PANCARD', 'MOBILE', 'BANK AC', 'IFC CODE', 'ADREESS', 'AADHAR', 'APROVE', 'DATE']
      const data = allRows.map(row => {
        const tdsAmount = row.withdraw_amount * 0.1
        return [
          row.user_display_id,
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
      exportToCsv(`withdrawal-history-ca10-${new Date().toISOString().split('T')[0]}.csv`, headers, data)
    } else if (viewFilter === 'spot-wallet') {
      // Spot Wallet Excel format
      const headers = ['ID Number', 'SPOT WALLET NAME', 'AMOUNT', 'IFC CODE', 'AMOUNT', '10% TDS', 'MOBILE', 'ADREESS', 'REMARK', 'PAN CARD', 'APROVE', 'DATE']
      const data = allRows.map(row => {
        const tdsAmount = row.withdraw_amount * 0.1
        return [
          row.user_display_id,
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
      exportToCsv(`withdrawal-history-spot-wallet-${new Date().toISOString().split('T')[0]}.csv`, headers, data)
    } else if (viewFilter === 'main-wallet') {
      // Main Wallet Excel format
      const headers = ['ID Number', 'MAIN WALLET', 'NAME', 'AMOUNT', 'IFC CODE', 'AMOUNT', '10% TDS', 'MOBILE', 'ADREESS', 'REMARK', 'PAN CARD', 'APROVE', 'DATE']
      const data = allRows.map(row => {
        const tdsAmount = row.withdraw_amount * 0.1
        return [
          row.user_display_id,
          row.wallet_type === 'Main Wallet' ? 'Main Wallet' : row.wallet_type,
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
      exportToCsv(`withdrawal-history-main-wallet-${new Date().toISOString().split('T')[0]}.csv`, headers, data)
    } else {
      // Normal format
      const headers = ['User ID', 'PAN Number', 'Mobile Number', 'Withdraw Amount', 'Payout (INR)', 'Wallet Type', 'UPI ID', 'Bank Name', 'Branch', 'Account Holder', 'Account Number', 'IFSC', 'Status', 'Date Request']
      const data = allRows.map(row => [
        row.user_display_id,
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
      exportToCsv(`withdrawal-history-${new Date().toISOString().split('T')[0]}.csv`, headers, data)
    }
    } catch (err: any) {
      console.error('Error exporting withdrawal history:', err)
      alert(`Error exporting data: ${err.message || 'Failed to export'}`)
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
      walletType: walletTypeFilter,
      status: statusFilter
    })
  }

  const handleClearFilters = () => {
    setUserIdFilter('')
    setNameFilter('')
    setWalletTypeFilter('')
    setStatusFilter('')
    setViewFilter('normal')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  const WALLET_TYPE_OPTIONS = [
    { value: '', label: 'All Wallets' },
    { value: 'spot', label: 'Spot Wallet' },
    { value: 'wallet', label: 'Main Wallet' },
  ]

  const STATUS_OPTIONS = [
    { value: '', label: 'All' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
  ]

  const VIEW_OPTIONS = [
    { value: 'normal', label: 'Normal View' },
    { value: 'ca10', label: 'CA10%' },
    { value: 'spot-wallet', label: 'Spot Wallet' },
    { value: 'main-wallet', label: 'Main Wallet' },
  ]

  return (
    <Card
      title="User Withdrawal History & Payouts 💸"
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
      {loading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
            <p className="text-sm text-gray-600">Loading withdrawal history...</p>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <DataTable<WithdrawHistoryRow>
        columns={columns}
        rows={rows}
        minWidthPx={viewFilter === 'ca10' ? 1200 : viewFilter === 'spot-wallet' ? 1400 : viewFilter === 'main-wallet' ? 1400 : 1600}
      />

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
          label="Search by User ID (Display ID):" 
          value={userIdFilter} 
          onChange={setUserIdFilter}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSearch();
            }
          }}
          placeholder="Enter Display ID (e.g., SIA02047)" 
        />
        <SelectInput
          id="wallet-type-filter"
          label="Filter by Wallet Type:"
          value={walletTypeFilter}
          onChange={(v) => {
            setWalletTypeFilter(v as 'spot' | 'wallet' | '')
            setPage(1) // Reset to first page when filter changes
          }}
          options={WALLET_TYPE_OPTIONS}
        />
        <SelectInput
          id="status-filter"
          label="Filter by Status:"
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v as 'approved' | 'rejected' | '')
            setPage(1) // Reset to first page when filter changes
          }}
          options={STATUS_OPTIONS}
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
        <PrimaryButton type="button" onClick={handleSearch}>Search</PrimaryButton>
        <SecondaryButton type="button" onClick={handleClearFilters}>Clear filtering</SecondaryButton>
      </FiltersBar>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[10, 25, 50, 100]}
      />

      <ToastContainer toasts={toasts} onClose={closeToast} />
    </Card>
  )
}
