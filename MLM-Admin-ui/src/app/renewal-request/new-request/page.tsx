"use client"

import React, { useEffect, useMemo, useState } from 'react'
import Card, { ToolbarButton } from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, SearchInput, TextInput, DateRangeInput } from '../../../components/ui/FiltersBar'
import Pagination from '../../../components/ui/Pagination'
import { ApproveReject, ViewButton } from '../../../components/ui/ActionButtons'
import Modal from '../../../components/ui/Modal'
import {
  approvePurchaseRequest,
  getPurchaseRequests,
  getPurchaseRequestDetails,
  rejectPurchaseRequest,
  type PurchaseRequestItem,
  type PreviousPurchase,
} from '../../../lib/api/purchaseRequests'
import { exportToCsv } from '../../../lib/export'
import { usePinVerification } from '../../../hooks/usePinVerification'

type Row = {
  id: string
  user_id: string
  user_display_id: string
  user_name: string | null
  request_type: string
  expire_package_id: string
  new_package_id: string
  utr: string
  approval_status: 'Pending' | 'Approved' | 'Rejected'
  renewal_added: string
  renewal_updated: string
  clarification: string
}

export default function NewRequestPage() {
  const [search, setSearch] = useState('')
  const [user, setUser] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [viewingRequest, setViewingRequest] = useState<PurchaseRequestItem | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  // PIN verification hook
  const { verifyPinForAction } = usePinVerification()

  const formatRequestType = (type: PurchaseRequestItem['request_type'], item?: PurchaseRequestItem): string => {
    // Check if 'activation' but user has active packages → show as 'reinvestment'
    if (type === 'activation' && item?.previous_purchases) {
      const hasActivePackage = item.previous_purchases.some(
        (p: PreviousPurchase) => p.is_2x_reached === false
      );
      if (hasActivePackage) {
        return 'Reinvestment'; // Display as reinvestment
      }
    }
    
    if (type === 'renew') {
      // Check if it's an upgrade
      if (item?.previous_package_id && item.previous_package_id !== item.package_id) {
        // Find previous package info
        const previous = item.previous_purchases?.find(p => p.package_id === item.previous_package_id);
        if (previous) {
          const amount = previous.amount || previous.package_price || 0;
          return `Renewal (Upgrade Package - ₹${Number(amount).toFixed(2)})`;
        }
        return 'Renewal (Upgrade Package)';
      }
      return 'Renewal'
    }
    if (type === 'reinvestment') return 'Reinvestment'
    if (type === 'activation') return 'New Purchase (Manual)'
    return type
  }

  const columns: Array<DataTableColumn<Row>> = useMemo(() => [
    { 
      key: 'user_display_id', 
      title: 'User', 
      render: (r: Row) => (
        <div className="flex flex-col">
          <span className="font-mono font-semibold text-blue-600">{r.user_display_id || r.user_id}</span>
          {r.user_name && (
            <span className="text-xs text-gray-600 mt-0.5">{r.user_name}</span>
          )}
        </div>
      )
    },
    { key: 'request_type', title: 'Request Type' },
    { key: 'new_package_id', title: 'new_package_id' },
    { key: 'utr', title: 'UTR / Txn ID' },
    { key: 'approval_status', title: 'approval staus', render: (r: Row) => (
      <span className={
        r.approval_status === 'Approved'
          ? 'px-2 py-1 rounded text-xs font-semibold bg-[#d4edda] text-[#155724]'
          : r.approval_status === 'Pending'
          ? 'px-2 py-1 rounded text-xs font-semibold bg-[#fff3cd] text-[#856404]'
          : 'px-2 py-1 rounded text-xs font-semibold bg-[#f8d7da] text-[#721c24]'
      }>{r.approval_status}</span>
    ) },
    { key: 'renewal_added', title: 'renewal added' },
    { key: 'renewal_updated', title: 'renewal updated' },
    { key: 'clarification', title: 'clarification' },
  ], [])

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
    // Debug: Log the item to see what we're receiving (development only)
    if (process.env.NODE_ENV === 'development') {
      console.log('Mapping item:', item)
    }

    // Handle user_id - ensure it's always a string
    // Check for both null/undefined and empty string
    const userIdText = (item.user_id !== null && item.user_id !== undefined && item.user_id !== '') 
      ? String(item.user_id) 
      : '-'

    // Handle user_display_id - show display_id if available, fallback to user_id
    const userDisplayId = item.user_display_id || userIdText

    // Handle expire_package_id based on request type
    let expirePackage = '-'
    if (item.request_type === 'renew' || item.request_type === 'reinvestment') {
      // For renew/reinvestment, check if it's an upgrade
      const isUpgrade = item.previous_package_id && item.previous_package_id !== item.package_id;
      
      if (isUpgrade) {
        // Upgrade: Show previous package info
        const previousArray = item.previous_purchases || []
        if (Array.isArray(previousArray) && previousArray.length > 0) {
          const previous = previousArray.find(p => p.package_id === item.previous_package_id) || previousArray[0]
          if (previous && previous.package_name) {
            const amount = previous.amount || previous.package_price || 0
            expirePackage = `Upgrade from: ${previous.package_name} - ₹${Number(amount).toFixed(2)}`
          }
        }
      } else {
        // Same package renewal: Get the most recent previous purchase
        const previousArray = item.previous_purchases || []
        if (Array.isArray(previousArray) && previousArray.length > 0) {
          const previous = previousArray[0] // Already sorted by date desc from API
          if (previous && previous.package_name) {
            const amount = previous.amount || previous.package_price || 0
            expirePackage = `${previous.package_name} - ₹${Number(amount).toFixed(2)}`
          }
        }
      }
    }
    // For 'activation' type, expire_package_id should be '-'

    // Handle new_package_id - show package name and price
    let newPackage = '-'
    if (item.package_name && item.package_name.trim() !== '') {
      if (item.package_price != null && item.package_price !== undefined) {
        newPackage = `${item.package_name} - ₹${Number(item.package_price).toFixed(2)}`
      } else {
        newPackage = item.package_name
      }
    } else if (item.package_id) {
      // Fallback: show package_id if package_name is missing
      newPackage = `Package ID: ${item.package_id}`
    }

    // Handle UTR/Txn ID
    const utr = (item.txn_id && item.txn_id.trim() !== '') ? item.txn_id : '-'

    const mappedRow: Row = {
      id: item.id || '-',
      user_id: userIdText,
      user_display_id: userDisplayId,
      user_name: item.user_name || null,
      request_type: formatRequestType(item.request_type, item),
      expire_package_id: expirePackage,
      new_package_id: newPackage,
      utr: utr,
      approval_status: (
        item.status === 'approved'
          ? 'Approved'
          : item.status === 'rejected'
          ? 'Rejected'
          : 'Pending'
      ) as 'Pending' | 'Approved' | 'Rejected',
      renewal_added: formatDateTime(item.created_at),
      renewal_updated: formatDateTime(item.processed_at),
      clarification: item.rejection_reason || item.remarks || '-',
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('Mapped row:', mappedRow)
    }
    return mappedRow
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch all pending requests (activation, renew, reinvestment)
      const response = await getPurchaseRequests({
        status: 'pending',
        // Remove request_type filter to show all types
        display_id: user.trim() || undefined,
        from_date: startDate || undefined,
        to_date: endDate || undefined,
        page,
        limit: pageSize,
      })

      // Development-only logging
      if (process.env.NODE_ENV === 'development') {
        console.log('API Response:', response)
        console.log('Items count:', response.items?.length || 0)
        
        // Log each item before mapping to see its structure
        if (response.items && response.items.length > 0) {
          console.log('First item (raw):', response.items[0])
          console.log('First item keys:', Object.keys(response.items[0]))
          console.log('First item JSON:', JSON.stringify(response.items[0], null, 2))
        }
      }
      
      // Filter out empty objects (API might return empty objects if data is malformed)
      const validItems = response.items.filter(item => {
        const hasData = item && typeof item === 'object' && Object.keys(item).length > 0;
        if (!hasData) {
          console.warn('Filtered out empty item:', item);
        }
        return hasData;
      });
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Valid items count:', validItems.length, 'out of', response.items.length);
      }
      
      const mapped = validItems.map(mapItemToRow)
      if (process.env.NODE_ENV === 'development') {
        console.log('Mapped rows:', mapped)
      }

      // Simple client-side search on user_display_id text if search term present
      const filtered = search.trim()
        ? mapped.filter(r =>
            r.user_display_id.toLowerCase().includes(search.trim().toLowerCase()),
          )
        : mapped

      setRows(filtered)
      // Update total to reflect valid items, not empty ones
      setTotal(validItems.length > 0 ? response.pagination.total : 0)
    } catch (err: any) {
      console.error('Error fetching renewal requests:', err)
      setError(err?.message || 'Failed to load renewal requests.')
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, user, startDate, endDate])

  const handleSearchClick = () => {
    setPage(1)
    fetchData()
  }

  const handleClearFilters = () => {
    setSearch('')
    setUser('')
    setStartDate('')
    setEndDate('')
    setPage(1)
    fetchData()
  }

  const handleApprove = async (row: Row) => {
    console.log('==========================================')
    console.log('[NEW-REQUEST] 🔴🔴🔴 APPROVE BUTTON CLICKED 🔴🔴🔴')
    console.log('[NEW-REQUEST] Request ID:', row.id)
    console.log('[NEW-REQUEST] verifyPinForAction function exists:', !!verifyPinForAction)
    console.log('==========================================')

    // Verify PIN before proceeding
    console.log('[NEW-REQUEST] Calling verifyPinForAction...')
    
    let pinVerified = false
    try {
      pinVerified = await verifyPinForAction('Activation Request Approval')
    } catch (pinError) {
      console.error('[NEW-REQUEST] PIN verification threw error:', pinError)
      alert('PIN verification error: ' + String(pinError))
      return
    }
    
    console.log('[NEW-REQUEST] PIN verification result:', pinVerified)
    
    if (!pinVerified) {
      console.log('[NEW-REQUEST] PIN verification failed or cancelled, aborting approval')
      return
    }

    try {
      setLoading(true)
      console.log('[NEW-REQUEST] Proceeding with approval...')
      await approvePurchaseRequest(row.id)
      await fetchData()
      window.alert('Request approved successfully.')
    } catch (err: any) {
      console.error('Error approving renewal request:', err)
      window.alert(err?.message || 'Failed to approve request.')
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async (row: Row) => {
    const reason = window.prompt(
      `Enter rejection reason for ${row.user_id}:`,
      'Invalid payment / proof',
    )
    if (!reason) return

    // Verify PIN before proceeding
    console.log('[NEW-REQUEST] Calling verifyPinForAction for rejection...')
    const pinVerified = await verifyPinForAction('Activation Request Rejection')
    
    if (!pinVerified) {
      console.log('[NEW-REQUEST] PIN verification failed or cancelled, aborting rejection')
      return
    }

    try {
      setLoading(true)
      await rejectPurchaseRequest(row.id, reason)
      await fetchData()
      window.alert('Request rejected successfully.')
    } catch (err: any) {
      console.error('Error rejecting renewal request:', err)
      window.alert(err?.message || 'Failed to reject request.')
    } finally {
      setLoading(false)
    }
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

  const handleExport = () => {
    if (!rows.length) {
      alert('No activation request records available to export.')
      return
    }

    const headers = ['User ID', 'Request Type', 'New Package', 'UTR / Txn ID', 'Status', 'Renewal Added', 'Renewal Updated', 'Clarification']
    const data = rows.map(row => [
      row.user_display_id || row.user_id,
      row.request_type,
      row.new_package_id,
      row.utr,
      row.approval_status,
      row.renewal_added,
      row.renewal_updated,
      row.clarification,
    ])

    exportToCsv(`activation-requests-${new Date().toISOString().split('T')[0]}.csv`, headers, data)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <Card
      title="Activation Requests"
      toolbarRight={
        <>
          <ToolbarButton aria-label="Export" onClick={handleExport}>Export</ToolbarButton>
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
            <p className="text-sm text-gray-600">Loading activation requests...</p>
          </div>
        </div>
      )}

      <DataTable<Row>
        columns={columns}
        rows={rows}
        renderActions={(row: Row) => (
          <div className="flex items-center gap-1">
            {row.approval_status === 'Pending' && (
              <ApproveReject
                onApprove={() => handleApprove(row)}
                onReject={() => handleReject(row)}
              />
            )}
            <ViewButton onClick={() => handleViewDetails(row)} />
          </div>
        )}
        minWidthPx={2200}
      />

      <FiltersBar>
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
                      {viewingRequest.status.charAt(0).toUpperCase() + viewingRequest.status.slice(1)}
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
    </Card>
  )
}
