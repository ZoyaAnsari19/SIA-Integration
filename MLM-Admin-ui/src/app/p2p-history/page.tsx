"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, TextInput, DateRangeInput } from '../../components/ui/FiltersBar'
import Pagination from '../../components/ui/Pagination'
import Button from '../../components/ui/Button'
import { getWalletTransfers, type WalletTransferItem } from '../../lib/api/withdraw'
import { ToastContainer, useToast } from '../../components/ui/Toast'

type P2PTransferRow = {
  id: string
  from_user_id: string
  from_user_display_id: string | null
  from_user_name: string | null
  to_user_id: string
  to_user_display_id: string | null
  to_user_name: string | null
  amount: number
  tax_amount: number
  net_amount: number
  status: string
  remarks: string | null
  created_at: string
}

export default function P2PHistoryPage() {
  const [senderIdFilter, setSenderIdFilter] = useState('')
  const [senderNameFilter, setSenderNameFilter] = useState('')
  const [receiverIdFilter, setReceiverIdFilter] = useState('')
  const [receiverNameFilter, setReceiverNameFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [transfers, setTransfers] = useState<WalletTransferItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { toasts, showToast, closeToast } = useToast()

  // Format date helper
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString)
      return date.toLocaleString('en-IN', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  // Fetch P2P transfers from API
  const fetchTransfers = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const params: any = {
        page,
        limit: pageSize,
      }
      
      if (senderIdFilter.trim()) {
        params.from_user_id = senderIdFilter.trim()
      }

      if (senderNameFilter.trim()) {
        params.from_user_name = senderNameFilter.trim()
      }

      if (receiverIdFilter.trim()) {
        params.to_user_id = receiverIdFilter.trim()
      }

      if (receiverNameFilter.trim()) {
        params.to_user_name = receiverNameFilter.trim()
      }

      if (startDate) {
        params.from_date = startDate
      }
      if (endDate) {
        params.to_date = endDate
      }

      const response = await getWalletTransfers(params)
      console.log('🔍 P2P Transfers API Response:', {
        itemsCount: response.items?.length,
        firstItem: response.items?.[0],
        hasDisplayIds: response.items?.[0]?.from_user_display_id || response.items?.[0]?.to_user_display_id,
      })
      setTransfers(response.items || [])
      setTotal(response.pagination?.total || 0)
      setTotalPages(response.pagination?.total_pages || 0)
    } catch (err: any) {
      console.error('Error fetching P2P transfers:', err)
      const errorMessage = err?.message || 'Failed to fetch P2P transfers'
      setError(errorMessage)
      showToast(errorMessage, 'error')
      setTransfers([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, senderIdFilter, senderNameFilter, receiverIdFilter, receiverNameFilter, startDate, endDate, showToast])

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchTransfers()
  }, [fetchTransfers])

  // Map API response to UI rows
  const rows: P2PTransferRow[] = useMemo(() => {
    return transfers.map((item, index) => {
      // Use display_id directly from API - NO FALLBACK GENERATION
      // If API doesn't return display_id, show null (not generated fake ID)
      const senderDisplayId = item.from_user_display_id || null
      const receiverDisplayId = item.to_user_display_id || null
      
      // Debug log for first item
      if (index === 0) {
        console.log('🔍 First P2P Transfer Row Mapping:', {
          api_from_user_id: item.from_user_id,
          api_from_user_display_id: item.from_user_display_id,
          mapped_from_display_id: senderDisplayId,
          api_to_user_id: item.to_user_id,
          api_to_user_display_id: item.to_user_display_id,
          mapped_to_display_id: receiverDisplayId,
        })
      }
      
      return {
        id: item.id || '-',
        from_user_id: item.from_user_id || '-',
        from_user_display_id: senderDisplayId,
        from_user_name: item.from_user_name || null,
        to_user_id: item.to_user_id || '-',
        to_user_display_id: receiverDisplayId,
        to_user_name: item.to_user_name || null,
        amount: item.amount || 0,
        tax_amount: item.tax_amount || 0,
        net_amount: item.net_amount || 0,
        status: item.status || 'completed',
        remarks: item.remarks || null,
        created_at: formatDate(item.created_at),
      }
    })
  }, [transfers])

  const columns: Array<DataTableColumn<P2PTransferRow>> = useMemo(() => [
    { 
      key: 'id', 
      title: 'Transaction ID',
      render: (r: P2PTransferRow) => (
        <span className="font-mono text-sm text-gray-600">#{r.id}</span>
      )
    },
    { 
      key: 'from_user_id', 
      title: 'Sender ID',
      render: (r: P2PTransferRow) => (
        <div>
          <span className="font-semibold">
            {r.from_user_display_id ? (
              <span>{r.from_user_display_id}</span>
            ) : (
              <span>ID: {r.from_user_id}</span>
            )}
          </span>
          {r.from_user_name && (
            <div className="text-xs text-gray-500 mt-0.5">{r.from_user_name}</div>
          )}
        </div>
      )
    },
    { 
      key: 'to_user_id', 
      title: 'Receiver ID',
      render: (r: P2PTransferRow) => (
        <div>
          <span className="font-semibold">
            {r.to_user_display_id ? (
              <span>{r.to_user_display_id}</span>
            ) : (
              <span>ID: {r.to_user_id}</span>
            )}
          </span>
          {r.to_user_name && (
            <div className="text-xs text-gray-500 mt-0.5">{r.to_user_name}</div>
          )}
        </div>
      )
    },
    { 
      key: 'amount', 
      title: 'Transfer Amount',
      render: (r: P2PTransferRow) => (
        <span className="font-bold text-gray-900">₹ {r.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      )
    },
    { 
      key: 'tax_amount', 
      title: 'Transfer Charges',
      render: (r: P2PTransferRow) => {
        const percentage = r.amount > 0 ? ((r.tax_amount / r.amount) * 100).toFixed(2) : '0.00'
        return (
          <span className="text-orange-600">₹ {r.tax_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({percentage}%)</span>
        )
      }
    },
    { 
      key: 'net_amount', 
      title: 'Received Amount (Net)',
      render: (r: P2PTransferRow) => (
        <span className="font-semibold text-green-600">₹ {r.net_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      )
    },
    { 
      key: 'created_at', 
      title: 'Created At'
    },
  ], [])

  const handleExport = () => {
    // Create CSV content
    const headers = ['Transaction ID', 'Sender ID', 'Sender Name', 'Receiver ID', 'Receiver Name', 'Amount', 'Tax Amount', 'Net Amount', 'Created At']
    const csvRows = [
      headers.join(','),
      ...rows.map(row => [
        row.id,
        row.from_user_display_id || row.from_user_id,
        row.from_user_name || '',
        row.to_user_display_id || row.to_user_id,
        row.to_user_name || '',
        row.amount,
        row.tax_amount,
        row.net_amount,
        row.created_at
      ].join(','))
    ]
    
    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `p2p-history-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSearch = () => {
    setPage(1) // Reset to first page when searching
    fetchTransfers() // Fetch with new filters
  }

  const handleClearFilters = () => {
    setSenderIdFilter('')
    setSenderNameFilter('')
    setReceiverIdFilter('')
    setReceiverNameFilter('')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  return (
    <Card
      title="P2P Transfer History"
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
            <p className="text-sm text-gray-600">Loading P2P transfers...</p>
          </div>
        </div>
      ) : (
        <DataTable<P2PTransferRow>
          columns={columns}
          rows={rows}
          minWidthPx={1400}
        />
      )}

      <FiltersBar>
        <TextInput 
          id="sender-id-filter" 
          label="Filter by Sender ID:" 
          value={senderIdFilter} 
          onChange={setSenderIdFilter} 
          placeholder="Enter Sender ID (e.g., 10)" 
        />
        <TextInput 
          id="receiver-name-filter" 
          label="Filter by Receiver Name:" 
          value={receiverNameFilter} 
          onChange={setReceiverNameFilter} 
          placeholder="Enter Receiver Full Name (e.g., Ramesh Kumar)"
        />
        <TextInput 
          id="receiver-id-filter" 
          label="Filter by Receiver ID:" 
          value={receiverIdFilter} 
          onChange={setReceiverIdFilter} 
          placeholder="Enter Receiver ID (e.g., 7)" 
        />
        <DateRangeInput
          id="date-range"
          label="Date Range:"
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />
        <PrimaryButton type="button" onClick={handleSearch} disabled={isLoading}>Search</PrimaryButton>
        <SecondaryButton type="button" onClick={handleClearFilters} disabled={isLoading}>Clear filtering</SecondaryButton>
      </FiltersBar>

      {totalPages > 1 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 25, 50]}
        />
      )}

      <ToastContainer toasts={toasts} onClose={closeToast} />
    </Card>
  )
}

