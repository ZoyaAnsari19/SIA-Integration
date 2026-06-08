"use client"

import React, { useEffect, useMemo, useState } from 'react'
import Card, { ToolbarButton } from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, TextInput, DateRangeInput } from '../../../components/ui/FiltersBar'
import Pagination from '../../../components/ui/Pagination'
import { ViewButton } from '../../../components/ui/ActionButtons'
import Modal from '../../../components/ui/Modal'
import {
  getPurchaseRequests,
  getPurchaseRequestDetails,
  type PurchaseRequestItem,
  type PurchaseRequestStatus,
  revertApprovedPurchaseRequest,
} from '../../../lib/api/purchaseRequests'
import { exportToCsv } from '../../../lib/export'

type Row = {
  id: string
  user_id: string
  user_display_id: string
  user_name: string | null
  request_type: string
  expire_package_id: string
  new_package_id: string
  utr: string
  status: 'Success' | 'Rejected' | 'Pending'
  renewal_added: string
  renewal_updated: string
  clarification: string
}

export default function RequestHistoryPage() {
  const [user, setUser] = useState('')
  const [nameFilter, setNameFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [statusFilter, setStatusFilter] = useState<'all' | PurchaseRequestStatus>('all')
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [viewingRequest, setViewingRequest] = useState<PurchaseRequestItem | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [isRevertModalOpen, setIsRevertModalOpen] = useState(false)
  const [revertRow, setRevertRow] = useState<Row | null>(null)
  const [revertReason, setRevertReason] = useState('')
  const [revertPuzzleInput, setRevertPuzzleInput] = useState('')
  const [revertLoading, setRevertLoading] = useState(false)
  const [revertError, setRevertError] = useState<string | null>(null)
  const [exportLoading, setExportLoading] = useState(false)

  const formatRequestType = (type: PurchaseRequestItem['request_type']): string => {
    if (type === 'renew') return 'Renewal'
    if (type === 'reinvestment') return 'Reinvestment'
    if (type === 'activation') return 'New Purchase (Manual)'
    return type
  }

  const columns: Array<DataTableColumn<Row>> = useMemo(
    () => [
      {
        key: 'user_display_id',
        title: 'User',
        render: (r: Row) => (
          <div className="flex flex-col">
            <span className="font-mono font-semibold text-blue-600">
              {r.user_display_id || r.user_id}
            </span>
            {r.user_name && (
              <span className="text-xs text-gray-600 mt-0.5">{r.user_name}</span>
            )}
          </div>
        ),
      },
      { key: 'request_type', title: 'Request Type' },
      { key: 'new_package_id', title: 'New Package' },
      { key: 'utr', title: 'UTR / Txn ID' },
      {
        key: 'status',
        title: 'Approval Status',
        render: (r: Row) => (
          <span
            className={
              r.status === 'Success'
                ? 'px-2 py-1 rounded text-xs font-semibold bg-[#d4edda] text-[#155724]'
                : r.status === 'Pending'
                ? 'px-2 py-1 rounded text-xs font-semibold bg-[#fff3cd] text-[#856404]'
                : 'px-2 py-1 rounded text-xs font-semibold bg-[#f8d7da] text-[#721c24]'
            }
          >
            {r.status}
          </span>
        ),
      },
      { key: 'renewal_added', title: 'Request Added' },
      { key: 'renewal_updated', title: 'Request Updated' },
      { key: 'clarification', title: 'Clarification / Remarks' },
    ],
    [],
  )

  const formatDateTime = (value: string | null | undefined): string => {
    if (!value) return '-'
    try {
      const d = new Date(value)
      return d.toLocaleString('en-IN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return value
    }
  }

  const mapItemToRow = (item: PurchaseRequestItem): Row => {
    // Very defensive mapping so we always show something even if some fields are missing

    // User
    const rawUserId =
      item.user_id !== null && item.user_id !== undefined && item.user_id !== ''
        ? String(item.user_id)
        : '-'
    // Handle user_display_id - show display_id if available, fallback to user_id
    const userDisplayId = item.user_display_id || rawUserId

    // Request type (Renewal / Reactivation / New Purchase)
    const requestTypeText = formatRequestType(item.request_type)

    // Expired package (for renew / reinvestment) – fall back to simple text if
    // previous_purchases or names are not available
    let expirePackage = '-'
    if (item.request_type === 'renew' || item.request_type === 'reinvestment') {
      const previousArray = Array.isArray(item.previous_purchases)
        ? item.previous_purchases
        : []
      if (previousArray.length > 0) {
        const previous = previousArray[0]
        const name = previous?.package_name || `Package ID: ${previous?.package_id ?? '-'}`
        const amount = previous?.amount ?? previous?.package_price
        expirePackage =
          amount != null
            ? `${name} - ₹${Number(amount).toFixed(2)}`
            : name
      }
    }

    // New package: prefer package_name, then package_id
    let newPackage = '-'
    if (item.package_name && item.package_name.trim() !== '') {
      if (item.package_price != null) {
        newPackage = `${item.package_name} - ₹${Number(item.package_price).toFixed(2)}`
      } else {
        newPackage = item.package_name
      }
    } else if (item.package_id) {
      newPackage = `Package ID: ${item.package_id}`
    }

    // UTR / Txn ID
    const utr = item.txn_id && item.txn_id.trim() !== '' ? item.txn_id : '-'

    // Status (Success / Pending / Rejected)
    let status: Row['status'] = 'Pending'
    if (item.status === 'approved') status = 'Success'
    else if (item.status === 'rejected') status = 'Rejected'

    return {
      id: item.id || '-',
      user_id: rawUserId,
      user_display_id: userDisplayId,
      user_name: item.user_name || null,
      request_type: requestTypeText,
      expire_package_id: expirePackage,
      new_package_id: newPackage,
      utr,
      status,
      renewal_added: formatDateTime(item.created_at),
      renewal_updated: formatDateTime(item.processed_at),
      clarification: item.rejection_reason || item.remarks || '-',
    }
  }

  // Helper function to convert YYYY-MM-DD to ISO 8601 date-time format
  const convertToISODateTime = (dateString: string, isEndDate: boolean = false): string => {
    if (!dateString) return ''
    // If already in ISO format, return as is
    if (dateString.includes('T')) return dateString
    // Convert YYYY-MM-DD to ISO 8601
    if (isEndDate) {
      // For end date, set to end of day (23:59:59.999)
      return `${dateString}T23:59:59.999Z`
    } else {
      // For start date, set to start of day (00:00:00.000)
      return `${dateString}T00:00:00.000Z`
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Request History should NOT show pending requests
      // Only show approved or rejected requests
      // If statusFilter is 'all', exclude pending by fetching approved and rejected separately
      let apiStatus: PurchaseRequestStatus | undefined
      if (statusFilter === 'all') {
        // For 'all', we'll fetch approved and rejected, excluding pending
        // We'll fetch both and combine them
        apiStatus = undefined // We'll filter out pending after fetching
      } else {
        apiStatus = statusFilter
      }

      // Convert dates to ISO 8601 format for API
      const fromDateISO = startDate ? convertToISODateTime(startDate, false) : undefined
      const toDateISO = endDate ? convertToISODateTime(endDate, true) : undefined

      // Fetch all request types (activation, renew, reinvestment)
      const response = await getPurchaseRequests({
        status: apiStatus,
        // Remove request_type filter to show all types
        display_id: user.trim() || undefined,
        name: nameFilter.trim() || undefined,
        from_date: fromDateISO,
        to_date: toDateISO,
        page,
        limit: pageSize,
      })

      // Filter out pending requests from Request History page
      // Pending requests should only show on New Request page, not in History
      const filteredItems = response.items.filter(item => item.status !== 'pending')
      
      const mapped = filteredItems.map(mapItemToRow)

      setRows(mapped)
      // For pagination total, we need to account for filtered items
      // If we filtered out items, we can't accurately know the total without another API call
      // For now, use the response total minus estimated pending count
      // In a real scenario, you might want to fetch approved/rejected separately
      setTotal(response.pagination.total)
    } catch (err: any) {
      console.error('Error fetching renewal request history:', err)
      setError(err?.message || 'Failed to load request history.')
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, user, nameFilter, statusFilter, startDate, endDate])

  const handleSearchClick = () => {
    setPage(1)
    fetchData()
  }

  const handleClearFilters = () => {
    setUser('')
    setNameFilter('')
    setStatusFilter('all')
    setStartDate('')
    setEndDate('')
    setPage(1)
    fetchData()
  }

  const handleViewDetails = async (row: Row) => {
    try {
      setLoadingDetails(true)
      const details = await getPurchaseRequestDetails(row.id)
      setViewingRequest(details)
      setIsViewModalOpen(true)
    } catch (err: any) {
      console.error('Error fetching request details:', err)
      window.alert(err?.message || 'Failed to load request details.')
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleOpenRevertModal = (row: Row) => {
    setRevertRow(row)
    setRevertReason('')
    setRevertPuzzleInput('')
    setRevertError(null)
    setIsRevertModalOpen(true)
  }

  const handleConfirmRevert = async () => {
    if (!revertRow) return
    if (!revertReason || revertReason.trim().length < 10) {
      setRevertError('Please enter a clear reason (at least 10 characters).')
      return
    }

    // Puzzle: admin must type first 3 letters + last 2 characters of the User ID (display_id)
    const displayId = (revertRow.user_display_id || revertRow.user_id || '').trim()
    if (displayId) {
      if (displayId.length >= 5) {
        const expectedPuzzle = `${displayId.slice(0, 3)}${displayId.slice(-2)}`
        if (revertPuzzleInput.trim().toUpperCase() !== expectedPuzzle.toUpperCase()) {
          setRevertError(
            `Puzzle mismatch. Please type the first 3 letters and last 2 characters of the User ID (e.g., ${expectedPuzzle}).`,
          )
          return
        }
      } else {
        // Fallback: require full User ID if it's too short to apply the pattern
        if (revertPuzzleInput.trim().toUpperCase() !== displayId.toUpperCase()) {
          setRevertError(`Puzzle mismatch. Please type the User ID exactly as shown: ${displayId}.`)
          return
        }
      }
    }

    try {
      setRevertLoading(true)
      setRevertError(null)
      await revertApprovedPurchaseRequest(revertRow.id, revertReason.trim(), false)
      window.alert('Revert request sent successfully. Please refresh to see latest status.')
      setIsRevertModalOpen(false)
      setRevertRow(null)
      setRevertReason('')
      setRevertPuzzleInput('')
      await fetchData()
    } catch (err: any) {
      console.error('Error reverting purchase request:', err)
      setRevertError(err?.message || 'Failed to revert this purchase. Please try again.')
    } finally {
      setRevertLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      setExportLoading(true)
      const fromDateISO = startDate ? convertToISODateTime(startDate, false) : undefined
      const toDateISO = endDate ? convertToISODateTime(endDate, true) : undefined
      const apiStatus: PurchaseRequestStatus | undefined = statusFilter === 'all' ? undefined : statusFilter

      const exportPageSize = 100
      const firstResponse = await getPurchaseRequests({
        status: apiStatus,
        display_id: user.trim() || undefined,
        name: nameFilter.trim() || undefined,
        from_date: fromDateISO,
        to_date: toDateISO,
        page: 1,
        limit: exportPageSize,
      })

      let allItems: PurchaseRequestItem[] = [...firstResponse.items]
      const totalPages = firstResponse.pagination?.total_pages ?? 1

      for (let p = 2; p <= totalPages; p++) {
        const next = await getPurchaseRequests({
          status: apiStatus,
          display_id: user.trim() || undefined,
          name: nameFilter.trim() || undefined,
          from_date: fromDateISO,
          to_date: toDateISO,
          page: p,
          limit: exportPageSize,
        })
        allItems = [...allItems, ...next.items]
      }

      const filtered = allItems.filter(item => item.status !== 'pending')
      if (!filtered.length) {
        alert('No request records available to export.')
        return
      }

      const exportRows = filtered.map(mapItemToRow)
      const headers = ['User ID', 'User Name', 'Request Type', 'New Package', 'UTR / Txn ID', 'Status', 'Renewal Added', 'Renewal Updated', 'Clarification']
      const data = exportRows.map(row => [
        row.user_display_id || row.user_id,
        row.user_name || '',
        row.request_type,
        row.new_package_id,
        row.utr,
        row.status,
        row.renewal_added,
        row.renewal_updated,
        row.clarification,
      ])

      exportToCsv(`request-history-${new Date().toISOString().split('T')[0]}.csv`, headers, data)
    } catch (err: any) {
      console.error('Export error:', err)
      alert(err?.message || 'Failed to export request history.')
    } finally {
      setExportLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <Card
      title="Request History"
      toolbarRight={
        <>
          <ToolbarButton aria-label="Export" onClick={handleExport} disabled={exportLoading}>
            {exportLoading ? 'Exporting...' : 'Export'}
          </ToolbarButton>
          <ToolbarButton aria-label="Print" onClick={handlePrint}>Print</ToolbarButton>
        </>
      }
    >
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 bg-white/75 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-b-2 border-gray-900 mb-2" />
            <p className="text-sm text-gray-600">Loading request history...</p>
          </div>
        </div>
      )}

      <DataTable<Row>
        columns={columns}
        rows={rows}
        renderActions={(row: Row) => (
          <div className="flex items-center gap-2">
            <ViewButton onClick={() => handleViewDetails(row)} />
            {row.status === 'Success' && (
              <button
                type="button"
                className="px-2 py-1 rounded border border-red-300 bg-white text-xs text-red-600 hover:bg-red-50 hover:border-red-400 transition-colors"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleOpenRevertModal(row)
                }}
              >
                Revert
              </button>
            )}
          </div>
        )}
        minWidthPx={2500}
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
          id="user-id" 
          label="Search by User ID (Display ID):" 
          value={user} 
          onChange={setUser} 
          placeholder="Enter Display ID (e.g., SIA02047)"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSearchClick()
            }
          }}
        />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Status</label>
          <select
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as 'all' | PurchaseRequestStatus)}
          >
            <option value="all">All</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <DateRangeInput
          id="date-range"
          label="Date Range:"
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />
        <PrimaryButton type="button" onClick={handleSearchClick}>Search</PrimaryButton>
        <SecondaryButton type="button" onClick={handleClearFilters}>Clear filtering</SecondaryButton>
      </FiltersBar>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[10, 25, 50]}
      />

      {/* View Details Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false)
          setViewingRequest(null)
        }}
        title="Request Details"
        size="xl"
        footer={
          <button
            className="px-4 py-2 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors"
            onClick={() => {
              setIsViewModalOpen(false)
              setViewingRequest(null)
            }}
          >
            Close
          </button>
        }
      >
        {loadingDetails ? (
          <div className="flex items-center justify-center py-8">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-b-2 border-gray-900 mr-2" />
            <span className="text-sm text-gray-600">Loading details...</span>
          </div>
        ) : viewingRequest ? (
          <div className="space-y-6">
            {/* User Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">User Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600">User ID</label>
                  <p className="mt-1 text-sm text-gray-900">{viewingRequest.user_id}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Name</label>
                  <p className="mt-1 text-sm text-gray-900">{viewingRequest.user_name || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Email</label>
                  <p className="mt-1 text-sm text-gray-900">{viewingRequest.user_email || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Phone</label>
                  <p className="mt-1 text-sm text-gray-900">{viewingRequest.user_phone || '-'}</p>
                </div>
              </div>
            </div>

            {/* Package Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Package Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600">Request Type</label>
                  <p className="mt-1 text-sm text-gray-900 capitalize">{viewingRequest.request_type}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">New Package</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {viewingRequest.package_name || '-'}
                    {viewingRequest.package_price != null && ` (₹${Number(viewingRequest.package_price).toFixed(2)})`}
                  </p>
                </div>
                {(viewingRequest.request_type === 'renew' || viewingRequest.request_type === 'reinvestment') && (
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-600">Previous Package</label>
                    {viewingRequest.previous_purchases && viewingRequest.previous_purchases.length > 0 ? (
                      <div className="mt-1">
                        {viewingRequest.previous_purchases[0].package_name && (
                          <p className="text-sm text-gray-900">
                            {viewingRequest.previous_purchases[0].package_name}
                            {viewingRequest.previous_purchases[0].amount && (
                              ` (₹${Number(viewingRequest.previous_purchases[0].amount).toFixed(2)})`
                            )}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-gray-500">-</p>
                    )}
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-gray-600">Amount</label>
                  <p className="mt-1 text-sm text-gray-900">₹{Number(viewingRequest.amount).toFixed(2)}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Status</label>
                  <p className="mt-1">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      viewingRequest.status === 'approved'
                        ? 'bg-[#d4edda] text-[#155724]'
                        : viewingRequest.status === 'pending'
                        ? 'bg-[#fff3cd] text-[#856404]'
                        : 'bg-[#f8d7da] text-[#721c24]'
                    }`}>
                      {viewingRequest.status === 'approved' ? 'Success' : viewingRequest.status.charAt(0).toUpperCase() + viewingRequest.status.slice(1)}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Payment Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600">UTR / Transaction ID</label>
                  <p className="mt-1 text-sm text-gray-900">{viewingRequest.txn_id || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Payment Type</label>
                  <p className="mt-1 text-sm text-gray-900">{viewingRequest.payment_type || '-'}</p>
                </div>
                {viewingRequest.payment_proof_url && (
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-600">Payment Proof</label>
                    <div className="mt-2">
                      <img
                        src={viewingRequest.payment_proof_url}
                        alt="Payment Proof"
                        className="max-w-full h-auto rounded border border-gray-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                          const parent = (e.target as HTMLImageElement).parentElement
                          if (parent) {
                            parent.innerHTML = '<p class="text-sm text-gray-500">Image failed to load</p>'
                          }
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Request Details */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Request Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600">Created At</label>
                  <p className="mt-1 text-sm text-gray-900">{formatDateTime(viewingRequest.created_at)}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Updated At</label>
                  <p className="mt-1 text-sm text-gray-900">{formatDateTime(viewingRequest.updated_at)}</p>
                </div>
                {viewingRequest.processed_at && (
                  <div>
                    <label className="text-xs font-medium text-gray-600">Processed At</label>
                    <p className="mt-1 text-sm text-gray-900">{formatDateTime(viewingRequest.processed_at)}</p>
                  </div>
                )}
                {viewingRequest.processed_by && (
                  <div>
                    <label className="text-xs font-medium text-gray-600">Processed By</label>
                    <p className="mt-1 text-sm text-gray-900">{viewingRequest.processed_by}</p>
                  </div>
                )}
                {viewingRequest.remarks && (
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-600">Remarks</label>
                    <p className="mt-1 text-sm text-gray-900">{viewingRequest.remarks}</p>
                  </div>
                )}
                {viewingRequest.rejection_reason && (
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-600">Rejection Reason</label>
                    <p className="mt-1 text-sm text-red-600">{viewingRequest.rejection_reason}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Previous Purchases (for renew/reinvestment) */}
            {(viewingRequest.request_type === 'renew' || viewingRequest.request_type === 'reinvestment') &&
              viewingRequest.previous_purchases &&
              viewingRequest.previous_purchases.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2">Previous Purchases</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Package</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Amount</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Purchased At</th>
                          {/* Active Until column removed - expiry is ONLY based on 2x income */}
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {viewingRequest.previous_purchases.map((purchase) => (
                          <tr key={purchase.id}>
                            <td className="px-3 py-2 text-gray-900">{purchase.package_name || '-'}</td>
                            <td className="px-3 py-2 text-gray-900">₹{Number(purchase.amount).toFixed(2)}</td>
                            <td className="px-3 py-2 text-gray-900">{formatDateTime(purchase.purchased_at)}</td>
                            {/* active_until removed - expiry is ONLY based on 2x income */}
                            <td className="px-3 py-2">
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                purchase.status === 'active'
                                  ? 'bg-[#d4edda] text-[#155724]'
                                  : purchase.status === 'expired'
                                  ? 'bg-[#f8d7da] text-[#721c24]'
                                  : 'bg-[#fff3cd] text-[#856404]'
                              }`}>
                                {purchase.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
          </div>
        ) : null}
      </Modal>

      {/* Revert Purchase Modal */}
      <Modal
        isOpen={isRevertModalOpen}
        onClose={() => {
          if (revertLoading) return
          setIsRevertModalOpen(false)
          setRevertRow(null)
          setRevertReason('')
          setRevertError(null)
        }}
        title="Revert Approved Purchase"
        size="lg"
      >
        {revertRow ? (
          <div className="space-y-4">
            <div className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
              <p className="font-semibold">Warning</p>
              <p>
                This will request a full revert of the approved purchase, including commissions and
                wallet credits generated from this request. Use only in genuine mistake cases.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs font-medium text-gray-600">User</div>
                <div className="mt-1 text-gray-900">
                  <span className="font-mono font-semibold">{revertRow.user_display_id}</span>
                  {revertRow.user_name && (
                    <span className="ml-1 text-gray-600">({revertRow.user_name})</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-600">New Package</div>
                <div className="mt-1 text-gray-900">{revertRow.new_package_id || '-'}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-600">UTR / Txn ID</div>
                <div className="mt-1 text-gray-900">{revertRow.utr || '-'}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-600">Status</div>
                <div className="mt-1 text-gray-900">{revertRow.status}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-600">Request Added</div>
                <div className="mt-1 text-gray-900">{revertRow.renewal_added}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-600">Last Updated</div>
                <div className="mt-1 text-gray-900">{revertRow.renewal_updated}</div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-700">
                Reason for revert <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={4}
                value={revertReason}
                disabled={revertLoading}
                onChange={(e) => {
                  setRevertReason(e.target.value)
                  if (revertError) setRevertError(null)
                }}
                placeholder="Explain clearly why this purchase is being reverted (e.g., wrong amount, wrong user, duplicate approval, etc.)"
              />
              <p className="text-xs text-gray-500">
                This reason will be stored in the system and visible in admin logs for future
                reference.
              </p>
            </div>

            {/* Simple confirmation puzzle */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-700">
                Confirmation puzzle <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-600">
                To confirm you are reverting the correct purchase, please type the{' '}
                <span className="font-semibold">first 3 letters and last 2 characters</span> of the
                User ID shown below.
              </p>
              <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-800">
                {revertRow.user_display_id || revertRow.user_id || '-'}
              </div>
              <input
                type="text"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={revertPuzzleInput}
                disabled={revertLoading}
                onChange={(e) => {
                  setRevertPuzzleInput(e.target.value)
                  if (revertError) setRevertError(null)
                }}
                placeholder="Example: SIA16 (for User ID SIA02216)"
              />
            </div>

            {revertError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {revertError}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors"
                onClick={() => {
                  if (revertLoading) return
                  setIsRevertModalOpen(false)
                  setRevertRow(null)
                  setRevertReason('')
                  setRevertError(null)
                }}
                disabled={revertLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded text-sm font-medium text-white transition-colors ${
                  revertLoading
                    ? 'bg-red-400 cursor-wait'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
                onClick={handleConfirmRevert}
                disabled={revertLoading}
              >
                {revertLoading ? 'Reverting…' : 'Confirm Revert'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-600">No request selected.</p>
        )}
      </Modal>
    </Card>
  )
}