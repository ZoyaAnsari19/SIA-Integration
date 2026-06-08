"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, TextInput, DateRangeInput, SelectInput } from '../../../components/ui/FiltersBar'
import Pagination from '../../../components/ui/Pagination'
import Button from '../../../components/ui/Button'
import { getLedgerEntries, type LedgerEntryItem } from '../../../lib/api/ledger'
import { exportToCsv } from '../../../lib/export'
import { ToastContainer, useToast } from '../../../components/ui/Toast'

type GlobalHelpIncomeRow = {
  id: string
  receiver_user_id: string
  receiver_display_id: string | null
  receiver_name: string | null
  source_user_id: string
  source_display_id: string | null
  source_name: string | null
  commission_type: 'GLOBAL_HELPING'
  amount: number
  credited_at: string
  settled: boolean
}

export default function GlobalHelpIncomePage() {
  const [userIdFilter, setUserIdFilter] = useState('')
  const [nameFilter, setNameFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [incomeData, setIncomeData] = useState<LedgerEntryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  
  const { toasts, showToast, closeToast } = useToast()

  // Format date (same format as Ledger Logs)
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
        hour12: true
      })
    } catch {
      return dateString
    }
  }

  // Helper to extract user ID from filter input
  const extractUserId = (input: string): string | undefined => {
    const trimmed = input.trim()
    if (!trimmed) return undefined
    // If it starts with "SIA" (case-insensitive), pass it as-is
    if (trimmed.toUpperCase().startsWith('SIA')) {
      return trimmed
    }
    // Otherwise, treat as numeric ID
    const numeric = parseInt(trimmed, 10)
    return isNaN(numeric) ? undefined : numeric.toString()
  }

  // Fetch global help income from ledger
  const fetchGlobalHelpIncome = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const userId = extractUserId(userIdFilter)
      const params: any = {
        page,
        limit: pageSize,
        commission_type: 'GLOBAL_HELPING', // Filter by Global Help Income
      }
      
      if (userId) {
        params.user_id = userId
      }
      if (nameFilter) {
        params.name = nameFilter
      }
      if (startDate) {
        params.start_date = startDate
      }
      if (endDate) {
        params.end_date = endDate
      }
      
      const response = await getLedgerEntries(params)
      const filteredItems = response.items || []
      
      setIncomeData(filteredItems)
      const apiTotal = response.total || 0
      setTotal(apiTotal)
      setTotalPages(response.total_pages || 0)
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to fetch global help income'
      setError(errorMessage)
      showToast(errorMessage, 'error')
      setIncomeData([])
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, userIdFilter, nameFilter, startDate, endDate, showToast])

  useEffect(() => {
    fetchGlobalHelpIncome()
  }, [fetchGlobalHelpIncome])

  // Map API response to table rows
  const rows: GlobalHelpIncomeRow[] = useMemo(() => {
    return incomeData.map((item) => ({
      id: item.id || '-',
      receiver_user_id: item.receiver_user_id || '-',
      receiver_display_id: item.receiver_display_id || null,
      receiver_name: item.receiver_name || null,
      source_user_id: item.source_user_id || '-',
      source_display_id: item.source_display_id || null,
      source_name: item.source_name || null,
      commission_type: 'GLOBAL_HELPING' as const,
      amount: item.amount || 0,
      credited_at: item.credited_at,
      settled: item.settled || false,
    }))
  }, [incomeData])

  // Filter rows by name (client-side for now, can be moved to server-side later)
  const filteredRows = useMemo(() => {
    if (!nameFilter.trim()) return rows
    
    const query = nameFilter.toLowerCase()
    return rows.filter(
      (row) =>
        (row.receiver_name?.toLowerCase().includes(query)) ||
        (row.receiver_display_id?.toLowerCase().includes(query)) ||
        (row.source_name?.toLowerCase().includes(query)) ||
        (row.source_display_id?.toLowerCase().includes(query))
    )
  }, [rows, nameFilter])

  const columns: Array<DataTableColumn<GlobalHelpIncomeRow>> = useMemo(() => [
    { 
      key: 'id', 
      title: 'Entry ID',
      render: (r: GlobalHelpIncomeRow) => (
        <span className="font-mono text-sm text-gray-600">#{r.id}</span>
      )
    },
    { 
      key: 'receiver_user_id', 
      title: 'Receiver',
      render: (r: GlobalHelpIncomeRow) => (
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
      render: (r: GlobalHelpIncomeRow) => (
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
      render: (r: GlobalHelpIncomeRow) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          Global Helping
        </span>
      )
    },
    { 
      key: 'amount', 
      title: 'Amount',
      render: (r: GlobalHelpIncomeRow) => {
        const isNegative = r.amount < 0
        return (
          <span className={`text-sm font-medium ${isNegative ? 'text-red-600' : 'text-green-600'}`}>
            ₹ {Math.abs(r.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )
      }
    },
    { 
      key: 'credited_at', 
      title: 'Credited At',
      cellClassName: 'whitespace-nowrap',
      render: (r: GlobalHelpIncomeRow) => formatDate(r.credited_at)
    },
  ], [])

  const handleExport = async () => {
    try {
      const exportPageSize = 1000
      const userId = extractUserId(userIdFilter)
      const baseParams: any = {
        page: 1,
        limit: exportPageSize,
        commission_type: 'GLOBAL_HELPING',
      }
      if (userId) {
        baseParams.user_id = userId
      }
      if (nameFilter) {
        baseParams.name = nameFilter
      }
      if (startDate) {
        baseParams.start_date = startDate
      }
      if (endDate) {
        baseParams.end_date = endDate
      }

      const firstResponse = await getLedgerEntries(baseParams)
      const allItems: LedgerEntryItem[] = []
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
        showToast('No data available to export', 'error')
        return
      }

      const exportRows: GlobalHelpIncomeRow[] = allItems.map(item => ({
        id: item.id || '-',
        receiver_user_id: item.receiver_user_id || '-',
        receiver_display_id: item.receiver_display_id || null,
        receiver_name: item.receiver_name || null,
        source_user_id: item.source_user_id || '-',
        source_display_id: item.source_display_id || null,
        source_name: item.source_name || null,
        commission_type: 'GLOBAL_HELPING' as const,
        amount: item.amount || 0,
        credited_at: item.credited_at,
        settled: item.settled || false,
      }))

      const headers = [
        'Entry ID',
        'Receiver ID',
        'Receiver Name',
        'Source ID',
        'Source Name',
        'Transaction Type',
        'Amount (₹)',
        'Credited At',
      ]
      const data = exportRows.map(row => [
        `#${row.id}`,
        row.receiver_display_id || row.receiver_user_id,
        row.receiver_name || '-',
        row.source_display_id || row.source_user_id,
        row.source_name || '-',
        'Global Helping',
        row.amount.toFixed(2),
        formatDate(row.credited_at),
      ])

      exportToCsv('global-help-income.csv', headers, data)
      showToast('Data exported successfully', 'success')
    } catch (err: any) {
      console.error('❌ Error exporting global help income:', err)
      const message = err?.message || 'Failed to export global help income.'
      showToast(message, 'error')
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Global Help Income</h1>
          <Button onClick={handleExport} variant="secondary">
            Export CSV
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="mt-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
              <p className="text-sm text-gray-600">Loading global help income data...</p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No global help income records found
            </div>
          ) : (
            <DataTable
              columns={columns}
              rows={filteredRows}
              minWidthPx={1000}
            />
          )}
        </div>

        <FiltersBar>
          <TextInput
            id="user-id-filter"
            label="Filter by User ID:"
            placeholder="Enter User ID or Display"
            value={userIdFilter}
            onChange={(value) => {
              setUserIdFilter(value)
              setPage(1)
            }}
          />
          <TextInput
            id="name-filter"
            label="Filter by Full Name:"
            placeholder="Enter Full Name"
            value={nameFilter}
            onChange={(value) => {
              setNameFilter(value)
              setPage(1)
            }}
          />
          <DateRangeInput
            id="date-range"
            label="Filter by Date Range:"
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
          <PrimaryButton onClick={fetchGlobalHelpIncome} disabled={loading}>
            {loading ? 'Loading...' : 'Search'}
          </PrimaryButton>
          <SecondaryButton
            onClick={() => {
              setUserIdFilter('')
              setNameFilter('')
              setStartDate('')
              setEndDate('')
              setPage(1)
            }}
          >
            Clear filtering
          </SecondaryButton>
        </FiltersBar>

        {(totalPages > 1 || total > pageSize) && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize)
              setPage(1)
            }}
            pageSizeOptions={[10, 25, 50, 100, 250, 500, 1000]}
          />
        )}
      </Card>
      <ToastContainer toasts={toasts} onClose={closeToast} />
    </div>
  )
}

