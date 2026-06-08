"use client"

import React, { useEffect, useMemo, useState } from 'react'
import Card, { ToolbarButton } from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, TextInput, DateRangeInput } from '../../../components/ui/FiltersBar'
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
import { usePinVerification } from '../../../hooks/usePinVerification'

type Row = {
  id: string
  user_id: string
  user_display_id: string
  request_type: string
  expire_package_id: string
  new_package_id: string
  utr: string
  approval_status: 'Pending' | 'Approved' | 'Rejected'
  renewal_added: string
  renewal_updated: string
  clarification: string
}

export default function ActivationRequestPage() {
  const [user, setUser] = useState('')
  const [nameFilter, setNameFilter] = useState('')
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
    
    if (type === 'renew') return 'Renewal'
    if (type === 'reinvestment') return 'Reinvestment'
    if (type === 'activation') return 'New Purchase (Manual)'
    return type
  }

    const columns: Array<DataTableColumn<Row>> = useMemo(() => [
    { 
      key: 'user_display_id', 
      title: 'User', 
      render: (r: Row) => (
        <span className="font-mono font-semibold text-blue-600">{r.user_display_id || r.user_id}</span>
      )
    },
    { key: 'request_type', title: 'Request Type' },
    { key: 'expire_package_id', title: 'expire_package_id' },
    { key: 'new_package_id', title: 'new_package_id' },
    { key: 'utr', title: 'UTR / Txn ID' },
    {
      key: 'approval_status',
      title: 'approval staus',
      render: (r: Row) => (
        <span
          className={
            r.approval_status === 'Approved'
              ? 'px-2 py-1 rounded text-xs font-semibold bg-[#d4edda] text-[#155724]'
              : r.approval_status === 'Pending'
              ? 'px-2 py-1 rounded text-xs font-semibold bg-[#fff3cd] text-[#856404]'
              : 'px-2 py-1 rounded text-xs font-semibold bg-[#f8d7da] text-[#721c24]'
          }
        >
          {r.approval_status}
        </span>
      ),
    },
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
    const userIdText =
      item.user_id !== null && item.user_id !== undefined && item.user_id !== ''
        ? String(item.user_id)
        : '-'

    // Handle user_display_id - show display_id if available, fallback to user_id
    const userDisplayId = item.user_display_id || userIdText

    let expirePackage = '-'
    if (item.request_type === 'renew' || item.request_type === 'reinvestment') {
      const previousArray = item.previous_purchases || []
      if (Array.isArray(previousArray) && previousArray.length > 0) {
        const previous = previousArray[0]
        if (previous && previous.package_name) {
          const amount = previous.amount || previous.package_price || 0
          expirePackage = `${previous.package_name} - ₹${Number(amount).toFixed(2)}`
        }
      }
    }

    let newPackage = '-'
    if (item.package_name && item.package_name.trim() !== '') {
      if (item.package_price != null && item.package_price !== undefined) {
        newPackage = `${item.package_name} - ₹${Number(item.package_price).toFixed(2)}`
      } else {
        newPackage = item.package_name
      }
    } else if (item.package_id) {
      newPackage = `Package ID: ${item.package_id}`
    }

    const utr = item.txn_id && item.txn_id.trim() !== '' ? item.txn_id : '-'

    return {
      id: item.id || '-',
      user_id: userIdText,
      user_display_id: userDisplayId,
      request_type: formatRequestType(item.request_type, item),
      expire_package_id: expirePackage,
      new_package_id: newPackage,
      utr,
      approval_status:
        item.status === 'approved'
          ? 'Approved'
          : item.status === 'rejected'
          ? 'Rejected'
          : 'Pending',
      renewal_added: formatDateTime(item.created_at),
      renewal_updated: formatDateTime(item.processed_at),
      clarification: item.rejection_reason || item.remarks || '-',
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await getPurchaseRequests({
        status: 'pending',
        display_id: user.trim() || undefined,
        name: nameFilter.trim() || undefined,
        from_date: startDate || undefined,
        to_date: endDate || undefined,
        page,
        limit: pageSize,
      })

      const validItems = response.items.filter((item) => {
        const hasData = item && typeof item === 'object' && Object.keys(item).length > 0
        return hasData
      })

      const mapped = validItems.map(mapItemToRow)

      setRows(mapped)
      setTotal(validItems.length > 0 ? response.pagination.total : 0)
    } catch (err: any) {
      console.error('Error fetching activation requests:', err)
      setError(err?.message || 'Failed to load activation requests.')
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, user, nameFilter, startDate, endDate])

  const handleSearchClick = () => {
    setPage(1)
    fetchData()
  }

  const handleClearFilters = () => {
    setUser('')
    setNameFilter('')
    setStartDate('')
    setEndDate('')
    setPage(1)
    fetchData()
  }

  const handleApprove = async (row: Row) => {
    // VERY VISIBLE DEBUG
    console.log('==========================================')
    console.log('[ACTIVATION] 🔴🔴🔴 APPROVE BUTTON CLICKED 🔴🔴🔴')
    console.log('[ACTIVATION] Request ID:', row.id)
    console.log('[ACTIVATION] verifyPinForAction function exists:', !!verifyPinForAction)
    console.log('==========================================')
    
    // PIN verification for critical action
    
    // Verify PIN before proceeding
    console.log('[ACTIVATION] Calling verifyPinForAction...')
    
    let pinVerified = false
    try {
      pinVerified = await verifyPinForAction('Activation Request Approval')
    } catch (pinError) {
      console.error('[ACTIVATION] PIN verification threw error:', pinError)
      alert('PIN verification error: ' + String(pinError))
      return
    }
    
    console.log('[ACTIVATION] PIN verification result:', pinVerified)
    
    if (!pinVerified) {
      console.log('[ACTIVATION] PIN verification failed or cancelled, aborting approval')
      return
    }

    try {
      setLoading(true)
      console.log('[ACTIVATION] Proceeding with approval...')
      await approvePurchaseRequest(row.id)
      await fetchData()
      window.alert('Request approved successfully.')
    } catch (err: any) {
      console.error('Error approving activation request:', err)
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
    const pinVerified = await verifyPinForAction('Activation Request Rejection')
    if (!pinVerified) return

    try {
      setLoading(true)
      await rejectPurchaseRequest(row.id, reason)
      await fetchData()
      window.alert('Request rejected successfully.')
    } catch (err: any) {
      console.error('Error rejecting activation request:', err)
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

    return (
        <Card
      title="Activation Requests"
            toolbarRight={
                <>
                    <ToolbarButton aria-label="Export">Export</ToolbarButton>
                    <ToolbarButton aria-label="Print">Print</ToolbarButton>
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
        <DateRangeInput
          id="date-range"
          label="Date Range:"
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />
        <PrimaryButton type="button" onClick={handleSearchClick}>
          Search
        </PrimaryButton>
        <SecondaryButton type="button" onClick={handleClearFilters}>
          Clear filtering
        </SecondaryButton>
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
        title="Activation Request Details"
      >
        {loadingDetails ? (
          <div className="py-8 text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-b-2 border-gray-900 mb-2" />
            <p className="text-sm text-gray-600">Loading details...</p>
          </div>
        ) : viewingRequest ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-gray-900">User Details</p>
                <p className="text-gray-700">
                  <span className="font-medium">User ID:</span>{' '}
                  {viewingRequest.user_id || '-'}
                </p>
                <p className="text-gray-700">
                  <span className="font-medium">Name:</span>{' '}
                  {viewingRequest.user_name || '-'}
                </p>
                <p className="text-gray-700">
                  <span className="font-medium">Email:</span>{' '}
                  {viewingRequest.user_email || '-'}
                </p>
                <p className="text-gray-700">
                  <span className="font-medium">Phone:</span>{' '}
                  {viewingRequest.user_phone || '-'}
                </p>
              </div>

              <div className="space-y-1 text-sm">
                <p className="font-semibold text-gray-900">Request Details</p>
                <p className="text-gray-700">
                  <span className="font-medium">Request Type:</span>{' '}
                  {formatRequestType(viewingRequest.request_type)}
                </p>
                <p className="text-gray-700">
                  <span className="font-medium">Status:</span>{' '}
                  {viewingRequest.status}
                </p>
                <p className="text-gray-700">
                  <span className="font-medium">Amount:</span>{' '}
                  ₹{Number(viewingRequest.amount).toFixed(2)}
                </p>
                <p className="text-gray-700">
                  <span className="font-medium">Created At:</span>{' '}
                  {formatDateTime(viewingRequest.created_at)}
                </p>
                <p className="text-gray-700">
                  <span className="font-medium">Processed At:</span>{' '}
                  {formatDateTime(viewingRequest.processed_at)}
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-2 text-sm">
              <p className="font-semibold text-gray-900">Package Details</p>
              <p className="text-gray-700">
                <span className="font-medium">Package:</span>{' '}
                {viewingRequest.package_name || '-'}
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Package Price:</span>{' '}
                {viewingRequest.package_price != null
                  ? `₹${Number(viewingRequest.package_price).toFixed(2)}`
                  : '-'}
              </p>
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-2 text-sm">
              <p className="font-semibold text-gray-900">Payment Details</p>
              <p className="text-gray-700">
                <span className="font-medium">UTR / Txn ID:</span>{' '}
                {viewingRequest.txn_id || '-'}
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Payment Type:</span>{' '}
                {viewingRequest.payment_type || '-'}
              </p>
              {viewingRequest.payment_proof_url && (
                <p className="text-gray-700">
                  <span className="font-medium">Payment Proof:</span>{' '}
                  <a
                    href={viewingRequest.payment_proof_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View Image
                  </a>
                </p>
              )}
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-2 text-sm">
              <p className="font-semibold text-gray-900">Remarks</p>
              <p className="text-gray-700">
                <span className="font-medium">Admin Remarks:</span>{' '}
                {viewingRequest.remarks || '-'}
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Rejection Reason:</span>{' '}
                {viewingRequest.rejection_reason || '-'}
              </p>
            </div>
          </div>
        ) : null}
      </Modal>
        </Card>
  )
}