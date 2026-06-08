"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, TextInput, DateRangeInput } from '../../../components/ui/FiltersBar'
import Pagination from '../../../components/ui/Pagination'
import Button from '../../../components/ui/Button'
import { ViewButton } from '../../../components/ui/ActionButtons'
import Modal from '../../../components/ui/Modal'
import { ToastContainer, useToast } from '../../../components/ui/Toast'
import { approveKYC, getAllProfiles, getKYCCounts, getPendingKYCs, getUserDocuments, rejectKYC, type ProfileItem, type KYCDocument } from '../../../lib/api/kyc'
import { exportToCsv } from '../../../lib/export'
import { usePinVerification } from '../../../hooks/usePinVerification'

type KycRow = {
  fullname: string
  user_id: string
  user_display_id: string
  bank_name: string
  branch: string
  account_holder: string
  account_no_masked: string
  ifsc: string
  aadhaar_no_masked: string
  pan_no: string
  submitted_on: string
  status: 'default' | 'Pending' | 'Rejected' | 'Approved'
}

// Helper function to mask account number (show last 4 digits)
const maskAccountNumber = (accountNo: string | null): string => {
  if (!accountNo || accountNo.length < 4) return 'N/A'
  const last4 = accountNo.slice(-4)
  const masked = 'X'.repeat(Math.max(0, accountNo.length - 4))
  return `${masked}${last4}`
}

// Helper function to mask Aadhaar number (show last 4 digits)
const maskAadhaarNumber = (aadhaar: string | null): string => {
  if (!aadhaar || aadhaar.length < 4) return 'N/A'
  const last4 = aadhaar.slice(-4)
  const masked = 'X'.repeat(Math.max(0, aadhaar.length - 4))
  // Format as XXXX XXXX 1234
  if (masked.length >= 8) {
    return `${masked.slice(0, 4)} ${masked.slice(4, 8)} ${last4}`
  }
  return `${masked}${last4}`
}

// Helper function to format date
const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'N/A'
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return 'N/A'
  }
}

// Helper function to get status from kyc_status
const getStatus = (kycStatus: string): 'default' | 'Pending' | 'Rejected' | 'Approved' => {
  switch (kycStatus.toLowerCase()) {
    case 'pending':
      return 'Pending'
    case 'submitted':
      return 'Pending'
    case 'rejected':
      return 'Rejected'
    case 'approved':
      return 'Approved'
    default:
      return 'default'
  }
}

type KYCStatusFilter = 'pending' | 'approved' | 'rejected'

export default function UsersKycPage() {
  const [userIdFilter, setUserIdFilter] = useState('')
  const [nameFilter, setNameFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<KYCStatusFilter>('pending')
  const [startDate, setStartDate] = useState('') // Date range start
  const [endDate, setEndDate] = useState('') // Date range end
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [profiles, setProfiles] = useState<ProfileItem[]>([])
  const [allProfiles, setAllProfiles] = useState<ProfileItem[]>([]) // Table data for Approved/Rejected tabs
  const [kycCounts, setKycCounts] = useState({ pending: 0, approved: 0, rejected: 0 }) // Stable counts from GET /admin/kyc/counts - no fluctuation
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [actionLoading, setActionLoading] = useState(false)
  
  // Toast notifications
  const { toasts, showToast, closeToast } = useToast()
  
  // PIN verification hook
  const { verifyPinForAction } = usePinVerification()
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<ProfileItem | null>(null)
  const [userDocuments, setUserDocuments] = useState<KYCDocument[]>([])
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  
  // Reject modal state
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [userToReject, setUserToReject] = useState<string | null>(null)
  

  // Fetch profiles from API
  const fetchProfiles = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const hasNoFilters = !userIdFilter.trim() && !nameFilter.trim() && !startDate && !endDate
      const usePendingEndpoint = statusFilter === 'pending' && hasNoFilters

      let allItems: ProfileItem[] = []
      let totalCount = 0

      if (usePendingEndpoint) {
        // Use dedicated pending endpoint for table; counts from GET /admin/kyc/counts (stable)
        console.log('🔍 Fetching pending KYCs + KYC counts')
        const [pendingResponse, counts] = await Promise.all([
          getPendingKYCs(),
          getKYCCounts().catch(() => ({ pending: 0, approved: 0, rejected: 0 })),
        ])
        allItems = pendingResponse.items || []
        totalCount = pendingResponse.count ?? allItems.length
        setAllProfiles([]) // not needed for pending tab table
        setKycCounts(counts)
        console.log('✅ Pending KYCs:', { count: allItems.length }, 'counts:', counts)
        setIsInitialLoad(false)
      } else {
        // Always fetch all pages when filtering by status (getAllProfiles)
        const shouldFetchAll = true
        const fetchLimit = shouldFetchAll ? 100 : pageSize

        const params: any = {
          page: 1,
          limit: fetchLimit,
        }

        if (userIdFilter.trim()) {
          const trimmedFilter = userIdFilter.trim()
          if (/^sia/i.test(trimmedFilter)) {
            params.user_id = trimmedFilter.toUpperCase()
          } else {
            params.user_id = trimmedFilter
          }
        }
        if (nameFilter.trim()) {
          params.name = nameFilter.trim()
        }
        const formatDateForAPI = (dateString: string): string => {
          if (!dateString) return ''
          if (dateString.includes('T')) return dateString.split('T')[0]
          return dateString
        }
        if (startDate) params.start_date = formatDateForAPI(startDate)
        if (endDate) params.end_date = formatDateForAPI(endDate)

        console.log('🔍 Fetching KYC profiles with params:', params)

        if (shouldFetchAll) {
          let currentPage = 1
          let hasMore = true
          const maxPages = 50
          while (hasMore && currentPage <= maxPages) {
            try {
              const response = await getAllProfiles({ ...params, page: currentPage, limit: 100 })
              allItems = [...allItems, ...response.items]
              totalCount = response.total
              if (currentPage >= response.total_pages || response.items.length === 0) {
                hasMore = false
              } else {
                currentPage++
              }
            } catch (pageError) {
              console.error(`Error fetching page ${currentPage}:`, pageError)
              if (allItems.length > 0) hasMore = false
              else throw pageError
            }
          }
        } else {
          const response = await getAllProfiles(params)
          allItems = response.items
          totalCount = response.total
        }
        console.log('✅ API Response:', { total_items: allItems.length, total_count: totalCount })
        setAllProfiles(allItems)
        setIsInitialLoad(false)
        // Stable counts from dedicated endpoint (no fluctuation after approve/reject)
        getKYCCounts()
          .then(setKycCounts)
          .catch(() => setKycCounts({ pending: 0, approved: 0, rejected: 0 }))
      }

      // Filter by status on client side
      let filteredItems = allItems.filter(item => {
        if (!item || !item.kyc_status) return false
        const status = item.kyc_status.toLowerCase()
        if (statusFilter === 'pending') return status === 'submitted'
        if (statusFilter === 'approved') return status === 'approved'
        if (statusFilter === 'rejected') return status === 'rejected'
        return false
      })

      // Apply client-side filters (user_id, name, date) when set
      if (userIdFilter.trim()) {
        const uid = userIdFilter.trim().toUpperCase()
        filteredItems = filteredItems.filter(
          item => (item.display_id || item.user_id || '').toString().toUpperCase().includes(uid)
        )
      }
      if (nameFilter.trim()) {
        const n = nameFilter.trim().toLowerCase()
        filteredItems = filteredItems.filter(
          item => (item.name || '').toLowerCase().includes(n)
        )
      }
      if (startDate || endDate) {
        const formatDateForCompare = (d: string): string => (d || '').split('T')[0]
        filteredItems = filteredItems.filter(item => {
          const sub = item.submitted_at ? formatDateForCompare(String(item.submitted_at)) : ''
          if (startDate && sub < formatDateForCompare(startDate)) return false
          if (endDate && sub > formatDateForCompare(endDate)) return false
          return true
        })
      }
      
      // Sort by latest first - use submitted_at for submitted, kyc_verified_at for approved/rejected
      const sortedItems = filteredItems.sort((a, b) => {
        // For submitted status, sort by submitted_at (newest first)
        if (a.kyc_status?.toLowerCase() === 'submitted' && b.kyc_status?.toLowerCase() === 'submitted') {
          const dateA = a.submitted_at ? new Date(a.submitted_at).getTime() : 0
          const dateB = b.submitted_at ? new Date(b.submitted_at).getTime() : 0
          return dateB - dateA // Newest first
        }
        
        // For approved/rejected, sort by kyc_verified_at (newest first), fallback to submitted_at
        const dateA = a.kyc_verified_at 
          ? new Date(a.kyc_verified_at).getTime() 
          : (a.submitted_at ? new Date(a.submitted_at).getTime() : 0)
        const dateB = b.kyc_verified_at 
          ? new Date(b.kyc_verified_at).getTime() 
          : (b.submitted_at ? new Date(b.submitted_at).getTime() : 0)
        return dateB - dateA // Newest first
      })
      
      // Apply pagination to sorted results
      const startIndex = (page - 1) * pageSize
      const endIndex = startIndex + pageSize
      const paginatedItems = sortedItems.slice(startIndex, endIndex)
      
      setProfiles(paginatedItems)
      setTotal(filteredItems.length) // Update total to reflect filtered count
      setTotalPages(Math.ceil(filteredItems.length / pageSize))
    } catch (err: any) {
      console.error('❌ Error fetching profiles:', err)
      setError(err.message || 'Failed to fetch KYC profiles')
      setProfiles([])
      setTotal(0)
      setTotalPages(0)
    } finally {
      setLoading(false)
    }
  }, [userIdFilter, nameFilter, page, pageSize, statusFilter, startDate, endDate]) // Keep filters in closure for access

  // Fetch on mount and when page/pageSize/statusFilter/filters change
  useEffect(() => {
    // Reset to page 1 when date filters change
    if (startDate || endDate) {
      if (page !== 1) {
        setPage(1)
        return // Will trigger another fetch when page changes
      }
    }
    fetchProfiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, statusFilter, userIdFilter, nameFilter, startDate, endDate]) // Include all filters

  // Map API data to table rows
  const rows: KycRow[] = useMemo(() => {
    return profiles.map(profile => {
      const profileData = profile.profile
      
      return {
        fullname: profile.name || 'N/A',
        user_id: profile.user_id,
        user_display_id: profile.display_id || profile.user_id, // Use display_id if available, else fallback to user_id
        bank_name: profileData?.bank_name || 'N/A',
        branch: profileData?.bank_branch || 'N/A',
        account_holder: profileData?.account_holder || profile.name || 'N/A',
        account_no_masked: maskAccountNumber(profileData?.bank_account_no || null),
        ifsc: profileData?.bank_ifsc || 'N/A',
        aadhaar_no_masked: maskAadhaarNumber(profileData?.aadhar_number || null),
        pan_no: profileData?.pan_number || 'N/A',
        submitted_on: formatDate(profile.submitted_at),
        status: getStatus(profile.kyc_status),
      }
    })
  }, [profiles])

  // Handle view click (view-only, no edit functionality available)
  const handleViewClick = useCallback(async (user_id: string) => {
    console.log('🔍 View clicked for user_id:', user_id)
    const profile = profiles.find(p => p.user_id === user_id)
    console.log('📋 Found profile:', profile)
    if (profile) {
      setSelectedProfile(profile)
      setIsModalOpen(true)
      console.log('✅ Modal opened')
      
      // Fetch user documents
      try {
        setLoadingDocuments(true)
        const documentsResponse = await getUserDocuments(user_id)
        setUserDocuments(documentsResponse.documents || [])
        console.log('📄 Documents fetched:', documentsResponse.documents)
      } catch (err: any) {
        console.error('❌ Error fetching documents:', err)
        setUserDocuments([])
      } finally {
        setLoadingDocuments(false)
      }
    } else {
      console.warn('⚠️ Profile not found for user_id:', user_id)
    }
  }, [profiles])

  // Handle modal close
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
    setSelectedProfile(null)
    setUserDocuments([])
  }, [])

  // Approve KYC for selected user (with PIN verification)
  const handleApproveKYC = useCallback(
    async (userId: string) => {
      if (!userId) return
      const confirm = window.confirm('Are you sure you want to approve this KYC?')
      if (!confirm) return

      // Verify PIN before proceeding
      const pinVerified = await verifyPinForAction('KYC Approval')
      if (!pinVerified) return

      try {
        setActionLoading(true)
        await approveKYC(userId)
        showToast('KYC approved successfully', 'success')
        await fetchProfiles()
        setIsModalOpen(false)
        setSelectedProfile(null)
      } catch (err: any) {
        console.error('Error approving KYC:', err)
        showToast(err.message || 'Failed to approve KYC', 'error')
      } finally {
        setActionLoading(false)
      }
    },
    [fetchProfiles, showToast, verifyPinForAction]
  )

  // Open reject modal
  const handleRejectClick = useCallback((userId: string) => {
    setUserToReject(userId)
    setRejectReason('')
    setIsRejectModalOpen(true)
  }, [])

  // Close reject modal
  const handleCloseRejectModal = useCallback(() => {
    setIsRejectModalOpen(false)
    setRejectReason('')
    setUserToReject(null)
  }, [])

  // Reject KYC for selected user (with PIN verification)
  const handleRejectKYC = useCallback(
    async () => {
      if (!userToReject || !rejectReason.trim()) {
        showToast('Please enter a reason for rejection', 'error')
        return
      }

      // Verify PIN before proceeding
      const pinVerified = await verifyPinForAction('KYC Rejection')
      if (!pinVerified) return

      try {
        setActionLoading(true)
        await rejectKYC(userToReject, rejectReason.trim())
        showToast('KYC rejected successfully', 'success')
        await fetchProfiles()
        setIsRejectModalOpen(false)
        setRejectReason('')
        setUserToReject(null)
        setIsModalOpen(false)
        setSelectedProfile(null)
      } catch (err: any) {
        console.error('Error rejecting KYC:', err)
        showToast(err.message || 'Failed to reject KYC', 'error')
      } finally {
        setActionLoading(false)
      }
    },
    [userToReject, rejectReason, fetchProfiles, showToast, verifyPinForAction]
  )


  const columns: Array<DataTableColumn<KycRow>> = useMemo(() => {
    return [
    {
      key: 'action',
      title: 'Action',
        render: (row: KycRow) => {
          const profile = profiles.find(p => p.user_id === row.user_id)
          const kycStatus = profile?.kyc_status?.toLowerCase() || ''
          const isPending = kycStatus === 'pending' || kycStatus === 'submitted'
          
          return (
        <div className="flex items-center gap-2">
              <ViewButton onClick={() => handleViewClick(row.user_id)} />
              {isPending && (
                <button
                  onClick={() => handleRejectClick(row.user_id)}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Reject with reason"
                >
                  Reject
                </button>
              )}
        </div>
      )
        }
    },
    { key: 'fullname', title: 'Fullname', render: (r: KycRow) => (<span className="font-semibold">{r.fullname}</span>) },
    { key: 'user_id', title: 'User Id', render: (r: KycRow) => (<span className="font-semibold font-mono text-blue-600">{r.user_display_id}</span>) },
    { key: 'bank_name', title: 'bank name' },
    { key: 'branch', title: 'branch' },
    { key: 'account_holder', title: 'a/c holder' },
    { key: 'account_no_masked', title: 'ac/no' },
    { key: 'ifsc', title: 'ifsc' },
    { key: 'aadhaar_no_masked', title: 'Aadhaar no' },
    { key: 'pan_no', title: 'pan no' },
    {
      key: 'submitted_on',
      title: 'Date (Submitted)',
      render: (r: KycRow) => {
        const cls = r.status === 'Rejected'
          ? 'text-red-600 font-semibold'
          : r.status === 'Pending'
          ? 'text-yellow-500 font-semibold'
          : r.status === 'Approved'
          ? 'text-green-600 font-semibold'
          : ''
        const statusText = r.status === 'Rejected' 
          ? ` (Rejected)` 
          : r.status === 'Pending'
          ? ` (Pending)`
          : r.status === 'Approved'
          ? ` (Approved)`
          : ''
        return <span className={cls}>{r.submitted_on}{statusText}</span>
      }
    },
  ]
  }, [handleViewClick, handleRejectClick, profiles])

  const handleExport = () => {
    if (!rows.length) {
      alert('No KYC records available to export.')
      return
    }

    const headers = ['Fullname', 'User ID', 'Display ID', 'Bank Name', 'Branch', 'Account Holder', 'Account Number (Masked)', 'IFSC', 'Aadhaar Number (Masked)', 'PAN Number', 'Submitted On', 'Status']
    const data = rows.map(row => [
      row.fullname,
      row.user_id,
      row.user_display_id,
      row.bank_name || 'N/A',
      row.branch || 'N/A',
      row.account_holder || 'N/A',
      row.account_no_masked || 'N/A',
      row.ifsc || 'N/A',
      row.aadhaar_no_masked || 'N/A',
      row.pan_no || 'N/A',
      row.submitted_on,
      row.status,
    ])

    exportToCsv(`users-kyc-${new Date().toISOString().split('T')[0]}.csv`, headers, data)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSearch = () => {
    setPage(1)
    fetchProfiles()
  }

  const handleClearFilters = () => {
    setUserIdFilter('')
    setNameFilter('')
    setStatusFilter('pending')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }
  
  const handleStatusFilterChange = (status: KYCStatusFilter) => {
    setStatusFilter(status)
    setPage(1)
  }

  if (loading && profiles.length === 0) {
    return (
      <Card title="User KYC & Bank Details Verification 📑">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-4"></div>
            <p className="text-gray-600">Loading KYC profiles...</p>
          </div>
        </div>
      </Card>
    )
  }

  if (error && profiles.length === 0) {
    return (
      <Card title="User KYC & Bank Details Verification 📑">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button variant="outline" onClick={fetchProfiles}>
              Retry
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <>
      <ToastContainer toasts={toasts} onClose={closeToast} />
    <Card
      title="User KYC & Bank Details Verification 📑"
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
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mb-2"></div>
            <p className="text-sm text-gray-600">Refreshing...</p>
          </div>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="mb-4 border-b border-gray-200">
        <nav className="flex space-x-8" aria-label="KYC Status Tabs">
          <button
            onClick={() => handleStatusFilterChange('pending')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              statusFilter === 'pending'
                ? 'border-yellow-500 text-yellow-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            KYC Requests ({kycCounts.pending})
          </button>
          <button
            onClick={() => handleStatusFilterChange('approved')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              statusFilter === 'approved'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Approved KYC ({kycCounts.approved})
          </button>
          <button
            onClick={() => handleStatusFilterChange('rejected')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              statusFilter === 'rejected'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Rejected KYC ({kycCounts.rejected})
          </button>
        </nav>
      </div>

      <DataTable<KycRow>
        columns={columns}
        rows={rows}
        minWidthPx={1400}
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
          label="Filter by User ID:" 
          value={userIdFilter} 
          onChange={setUserIdFilter}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSearch()
            }
          }}
          placeholder="Enter User ID (e.g., 13)" 
        />
        <DateRangeInput
          id="date-range"
          label="Date Range:"
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />
        <PrimaryButton type="button" onClick={handleSearch} disabled={loading}>
          Search
        </PrimaryButton>
        <SecondaryButton type="button" onClick={handleClearFilters} disabled={loading}>
          Clear filtering
        </SecondaryButton>
      </FiltersBar>

      {totalPages > 1 && (
      <Pagination
        page={page}
        pageSize={pageSize}
          total={total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        />
      )}

      {/* KYC Details Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={`KYC Details - ${selectedProfile?.name || 'User'}`}
        size="lg"
      >
        {selectedProfile && (
          <div className="space-y-6">
            {/* User Information */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-800 border-b pb-2">User Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">User ID</label>
                  <p className="text-gray-900 font-semibold">{selectedProfile.user_id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Full Name</label>
                  <p className="text-gray-900">{selectedProfile.name || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
                  <p className="text-gray-900">{selectedProfile.email || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">KYC Status</label>
                  <p className={`font-semibold ${
                    selectedProfile.kyc_status === 'approved' ? 'text-green-600' :
                    selectedProfile.kyc_status === 'rejected' ? 'text-red-600' :
                    selectedProfile.kyc_status === 'pending' || selectedProfile.kyc_status === 'submitted' ? 'text-yellow-600' :
                    'text-gray-600'
                  }`}>
                    {selectedProfile.kyc_status.toUpperCase()}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Submitted On</label>
                  <p className="text-gray-900">{formatDate(selectedProfile.submitted_at)}</p>
                </div>
                {selectedProfile.kyc_verified_at && (
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Verified On</label>
                    <p className="text-gray-900">{formatDate(selectedProfile.kyc_verified_at)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Admin Actions */}
            {selectedProfile.kyc_status === 'submitted' && (
              <div className="flex flex-wrap gap-4 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => handleApproveKYC(selectedProfile.user_id)}
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-md bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? 'Processing...' : 'Approve KYC'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false) // Close the details modal
                    handleRejectClick(selectedProfile.user_id) // Open reject modal
                  }}
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-md bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? 'Processing...' : 'Reject KYC'}
                </button>
              </div>
            )}

            {/* Profile Details */}
            {selectedProfile.profile ? (
              <>
                {/* Personal Details */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-800 border-b pb-2">Personal Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Phone</label>
                      <p className="text-gray-900">{selectedProfile.profile.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Date of Birth</label>
                      <p className="text-gray-900">
                        {selectedProfile.profile.date_of_birth 
                          ? formatDate(selectedProfile.profile.date_of_birth)
                          : 'N/A'}
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-600 mb-1">Address</label>
                      <p className="text-gray-900">{selectedProfile.profile.address || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">City</label>
                      <p className="text-gray-900">{selectedProfile.profile.city || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">State</label>
                      <p className="text-gray-900">{selectedProfile.profile.state || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Pincode</label>
                      <p className="text-gray-900">{selectedProfile.profile.pincode || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Bank Details */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-800 border-b pb-2">Bank Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Account Holder</label>
                      <p className="text-gray-900 font-semibold">{selectedProfile.profile.account_holder || selectedProfile.name || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Bank Name</label>
                      <p className="text-gray-900">{selectedProfile.profile.bank_name || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Branch</label>
                      <p className="text-gray-900">{selectedProfile.profile.bank_branch || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Account Number</label>
                      <p className="text-gray-900 font-mono">
                        {selectedProfile.profile.bank_account_no || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">IFSC Code</label>
                      <p className="text-gray-900 font-mono">{selectedProfile.profile.bank_ifsc || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Identity Documents */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-800 border-b pb-2">Identity Documents</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">PAN Number</label>
                      <p className="text-gray-900 font-mono">{selectedProfile.profile.pan_number || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Aadhaar Number</label>
                      <p className="text-gray-900 font-mono">
                        {selectedProfile.profile.aadhar_number || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Uploaded Documents */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-800 border-b pb-2">Uploaded Documents</h3>
                  {loadingDocuments ? (
                    <div className="text-center py-4">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mb-2"></div>
                      <p className="text-sm text-gray-600">Loading documents...</p>
                    </div>
                  ) : userDocuments.length > 0 ? (
                    <div className="space-y-6">
                      {(() => {
                        // Sort documents by submitted_at date (newest first)
                        const sortedDocs = [...userDocuments].sort((a, b) => {
                          const dateA = new Date(a.submitted_at).getTime()
                          const dateB = new Date(b.submitted_at).getTime()
                          return dateB - dateA // Newest first
                        })

                        // Group by document type and find latest for each type
                        const latestByType = new Map<string, string>()
                        sortedDocs.forEach(doc => {
                          const type = doc.document_type.toLowerCase()
                          if (!latestByType.has(type)) {
                            latestByType.set(type, doc.id)
                          }
                        })

                        return sortedDocs.map((doc) => {
                          // Check if front and back images are the same (for bank documents)
                          const isSameImage = doc.front_image_url === doc.back_image_url
                          const isBankDocument = ['bank_statement', 'cheque', 'passbook'].includes(doc.document_type.toLowerCase())
                          const isLatest = latestByType.get(doc.document_type.toLowerCase()) === doc.id
                          
                          // Get display name for document type
                          const getDocumentDisplayName = (type: string) => {
                            const typeLower = type.toLowerCase()
                            if (typeLower === 'aadhar') return 'Aadhar Card'
                            if (typeLower === 'bank_statement') return 'Bank Statement'
                            if (typeLower === 'cheque') return 'Cheque'
                            if (typeLower === 'passbook') return 'Passbook'
                            return type.charAt(0).toUpperCase() + type.slice(1)
                          }

                          return (
                            <div 
                              key={doc.id} 
                              className={`border rounded-lg p-4 ${
                                isLatest 
                                  ? 'border-blue-400 bg-blue-50 shadow-md' 
                                  : 'border-gray-200 bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h4 className="font-semibold text-gray-900 text-lg">
                                      {getDocumentDisplayName(doc.document_type)}
                                    </h4>
                                    {isLatest && (
                                      <span className="px-2 py-1 text-xs font-bold rounded bg-blue-600 text-white">
                                        LATEST
                                      </span>
                                    )}
                                  </div>
                                  {doc.document_number && (
                                    <p className="text-sm text-gray-600 font-mono mt-1">
                                      <span className="font-medium">Number:</span> {doc.document_number}
                                    </p>
                                  )}
                                  <div className="flex flex-wrap gap-3 mt-2 text-xs">
                                    <p className="text-gray-600">
                                      <span className="font-medium">Submitted:</span> {formatDate(doc.submitted_at)}
                                    </p>
                                    {doc.status === 'rejected' && doc.verified_at && (
                                      <p className="text-red-600">
                                        <span className="font-medium">Rejected On:</span> {formatDate(doc.verified_at)}
                                      </p>
                                    )}
                                    {doc.status === 'approved' && doc.verified_at && (
                                      <p className="text-green-600">
                                        <span className="font-medium">Approved On:</span> {formatDate(doc.verified_at)}
                                      </p>
                                    )}
                                  </div>
                                  {doc.status && (
                                    <span className={`inline-block mt-2 px-3 py-1 text-xs font-semibold rounded ${
                                      doc.status === 'approved' ? 'bg-green-100 text-green-800' :
                                      doc.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                      'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {doc.status.toUpperCase()}
                                    </span>
                                  )}
                                  {doc.rejection_reason && (
                                    <p className="text-sm text-red-600 mt-2">
                                      <span className="font-medium">Rejection Reason:</span> {doc.rejection_reason}
                                    </p>
                                  )}
                                </div>
                              </div>
                              
                              {/* For bank documents with same image, show single image */}
                              {isBankDocument && isSameImage && doc.front_image_url ? (
                                <div>
                                  <label className="block text-sm font-medium text-gray-600 mb-2">
                                    {doc.document_type.toLowerCase() === 'cheque' ? 'Cheque' : 
                                     doc.document_type.toLowerCase() === 'passbook' ? 'Passbook' : 
                                     'Bank Document'} Image
                                  </label>
                                  <div className="border border-gray-300 rounded-lg overflow-hidden bg-white max-w-md">
                                    <img
                                      src={doc.front_image_url}
                                      alt={`${getDocumentDisplayName(doc.document_type)}`}
                                      className="w-full h-auto max-h-96 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() => window.open(doc.front_image_url!, '_blank')}
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement
                                        target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect width="400" height="300" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="16" fill="%23999"%3EImage Not Available%3C/text%3E%3C/svg%3E'
                                      }}
                                    />
                                  </div>
                                  <a
                                    href={doc.front_image_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline text-sm mt-1 inline-block"
                                  >
                                    Open in new tab
                                  </a>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {doc.front_image_url && (
                                    <div>
                                      <label className="block text-sm font-medium text-gray-600 mb-2">
                                        {isBankDocument ? `${getDocumentDisplayName(doc.document_type)} Image` : 'Front Image'}
                                      </label>
                                      <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
                                        <img
                                          src={doc.front_image_url}
                                          alt={`${getDocumentDisplayName(doc.document_type)} front`}
                                          className="w-full h-auto max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                          onClick={() => window.open(doc.front_image_url!, '_blank')}
                                          onError={(e) => {
                                            const target = e.target as HTMLImageElement
                                            target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect width="400" height="300" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="16" fill="%23999"%3EImage Not Available%3C/text%3E%3C/svg%3E'
                                          }}
                                        />
                                      </div>
                                      <a
                                        href={doc.front_image_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline text-sm mt-1 inline-block"
                                      >
                                        Open in new tab
                                      </a>
                                    </div>
                                  )}
                                  {doc.back_image_url && !isSameImage && (
                                    <div>
                                      <label className="block text-sm font-medium text-gray-600 mb-2">Back Image</label>
                                      <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
                                        <img
                                          src={doc.back_image_url}
                                          alt={`${getDocumentDisplayName(doc.document_type)} back`}
                                          className="w-full h-auto max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                          onClick={() => window.open(doc.back_image_url!, '_blank')}
                                          onError={(e) => {
                                            const target = e.target as HTMLImageElement
                                            target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect width="400" height="300" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="16" fill="%23999"%3EImage Not Available%3C/text%3E%3C/svg%3E'
                                          }}
                                        />
                                      </div>
                                      <a
                                        href={doc.back_image_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline text-sm mt-1 inline-block"
                                      >
                                        Open in new tab
                                      </a>
                                    </div>
                                  )}
                                </div>
                              )}
                              {!doc.front_image_url && !doc.back_image_url && (
                                <p className="text-sm text-gray-500 text-center py-4">No images uploaded for this document</p>
                              )}
                            </div>
                          )
                        })
                      })()}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <p>No documents uploaded for this user.</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No profile details available for this user.</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Reject KYC Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={handleCloseRejectModal}
        title="Reject KYC"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Rejection <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter the reason for rejecting this KYC submission..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleCloseRejectModal}
              disabled={actionLoading}
              className="px-4 py-2 text-sm font-medium rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRejectKYC}
              disabled={actionLoading || !rejectReason.trim()}
              className="px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? 'Rejecting...' : 'Reject KYC'}
            </button>
          </div>
        </div>
      </Modal>

    </Card>
    </>
  )
}
