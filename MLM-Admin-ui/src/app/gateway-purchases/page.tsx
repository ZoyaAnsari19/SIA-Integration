"use client"

import React, { useEffect, useMemo, useState } from 'react'
import Card from '../../components/ui/Card'
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, TextInput, DateRangeInput } from '../../components/ui/FiltersBar'
import Pagination from '../../components/ui/Pagination'
import Modal from '../../components/ui/Modal'
import { getGatewayPurchases, reconcileGatewayPurchase, type GatewayFlowType, type GatewayPurchaseItem } from '../../lib/api/purchases'

type Row = {
  id: string
  user_id: string
  user_display_id: string | null
  user_name: string | null
  flow_type: GatewayFlowType
  package_name: string
  amount: number
  amount_display: string
  status: string
  purchased_at: string
  source: string
}

const flowTypeLabel = (flow: GatewayFlowType): string => {
  switch (flow) {
    case 'REINVESTMENT':
      return 'Reinvestment (Gateway)'
    case 'RENEWAL':
      return 'Renewal (Gateway)'
    case 'UPGRADE':
      return 'Upgrade Package (Gateway)'
    case 'NEW_PURCHASE':
    default:
      return 'New Purchase (Gateway)'
  }
}

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

const formatAmount = (amount: number | null | undefined): string => {
  if (amount == null) return '-'
  try {
    return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  } catch {
    return String(amount)
  }
}

const convertToISODateTime = (dateString: string, isEndDate: boolean = false): string => {
  if (!dateString) return ''
  if (dateString.includes('T')) return dateString
  if (isEndDate) {
    return `${dateString}T23:59:59.999Z`
  }
  return `${dateString}T00:00:00.000Z`
}

const mapItemToRow = (item: GatewayPurchaseItem): Row => {
  const userId = item.user_id || '-'
  const displayId = item.user_display_id || userId

  return {
    id: item.id,
    user_id: userId,
    user_display_id: displayId,
    user_name: item.user_name || null,
    flow_type: item.flow_type,
    package_name: item.package_name || `Package ID: ${item.package_id}`,
    amount: item.amount ?? 0,
    amount_display: formatAmount(item.amount),
    status: item.status || '-',
    purchased_at: formatDateTime(item.purchased_at),
    source: item.payment_type ? item.payment_type.toUpperCase() : 'ICICI',
  }
}

export default function GatewayPurchasesPage() {
  const [userFilter, setUserFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending' | 'cancelled'>('all')
  const [flowTypeFilter, setFlowTypeFilter] = useState<'all' | GatewayFlowType>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reconcilingId, setReconcilingId] = useState<string | null>(null)
  const [reconcileModalRow, setReconcileModalRow] = useState<Row | null>(null)
  const [reconcileConfirmText, setReconcileConfirmText] = useState('')

  const handleOpenReconcileModal = (row: Row) => {
    if (row.status.toLowerCase() !== 'pending') return
    setReconcileModalRow(row)
    setReconcileConfirmText('')
    setError(null)
  }

  const handleCloseReconcileModal = () => {
    setReconcileModalRow(null)
    setReconcileConfirmText('')
  }

  const handleReconcileConfirm = async () => {
    const row = reconcileModalRow
    if (!row || row.status.toLowerCase() !== 'pending') return
    if (reconcileConfirmText.trim() !== 'CONFIRM') return
    try {
      setReconcilingId(row.id)
      setError(null)
      await reconcileGatewayPurchase({
        purchase_id: row.id,
        display_id: row.user_display_id || undefined,
        amount: row.amount,
      })
      handleCloseReconcileModal()
      await fetchData()
    } catch (err: any) {
      setError(err.message || 'Reconcile failed')
    } finally {
      setReconcilingId(null)
    }
  }

  const reconcileModalOpen = !!reconcileModalRow
  const canReconcile = reconcileConfirmText.trim() === 'CONFIRM'

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
      {
        key: 'flow_type',
        title: 'Type',
        render: (r: Row) => <span>{flowTypeLabel(r.flow_type)}</span>,
      },
      {
        key: 'package_name',
        title: 'Package',
        cellClassName: 'whitespace-normal max-w-xs',
      },
      {
        key: 'amount_display',
        title: 'Amount',
      },
      {
        key: 'status',
        title: 'Status',
        render: (r: Row) => {
          const s = r.status.toLowerCase()
          const base = 'px-2 py-1 rounded text-xs font-semibold'
          if (s === 'completed') {
            return <span className={`${base} bg-[#d4edda] text-[#155724]`}>Completed</span>
          }
          if (s === 'pending') {
            return <span className={`${base} bg-[#fff3cd] text-[#856404]`}>Pending</span>
          }
          if (s === 'cancelled') {
            return <span className={`${base} bg-[#f8d7da] text-[#721c24]`}>Cancelled</span>
          }
          return <span className={`${base} bg-[#e2e3e5] text-[#383d41]`}>{r.status}</span>
        },
      },
      {
        key: 'purchased_at',
        title: 'Purchased At',
      },
      {
        key: 'source',
        title: 'Source',
      },
      {
        key: 'actions',
        title: 'Action',
        render: (r: Row) => {
          if (r.status.toLowerCase() !== 'pending') return null
          const busy = reconcilingId === r.id
          return (
            <button
              type="button"
              onClick={() => handleOpenReconcileModal(r)}
              disabled={busy}
              className="px-3 py-1.5 text-xs font-medium rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Processing…' : 'Mark as paid'}
            </button>
          )
        },
      },
    ],
    [reconcilingId],
  )

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const params: any = {
        page,
        limit: pageSize,
      }

      if (userFilter.trim() !== '') {
        params.display_id = userFilter.trim()
      }

      if (statusFilter !== 'all') {
        params.status = statusFilter
      }

      if (startDate) {
        params.start_date = convertToISODateTime(startDate, false)
      }
      if (endDate) {
        params.end_date = convertToISODateTime(endDate, true)
      }

      if (flowTypeFilter !== 'all') {
        params.flow_type = flowTypeFilter
      }

      const data = await getGatewayPurchases(params)

      setTotal(data.total || data.count || 0)
      setRows((data.items || []).map(mapItemToRow))
    } catch (err: any) {
      console.error('Error fetching gateway purchases:', err)
      setError(err.message || 'Failed to load gateway purchases')
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize])

  const handleApplyFilters = () => {
    setPage(1)
    void fetchData()
  }

  const handleClearFilters = () => {
    setUserFilter('')
    setStatusFilter('all')
    setFlowTypeFilter('all')
    setStartDate('')
    setEndDate('')
    setPage(1)
    void fetchData()
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Payment Gateway History</h1>

      <Card title="Gateway Purchases">
        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
            {error}
          </div>
        )}
        <DataTable<Row> columns={columns} rows={rows} />
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </Card>

      <Modal
        isOpen={reconcileModalOpen}
        onClose={handleCloseReconcileModal}
        title="Confirm: Mark as paid"
        size="md"
        closeOnBackdropClick={!reconcilingId}
        footer={
          <>
            <button
              type="button"
              onClick={handleCloseReconcileModal}
              disabled={!!reconcilingId}
              className="px-4 py-2 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReconcileConfirm}
              disabled={!canReconcile || !!reconcilingId}
              className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {reconcilingId ? 'Processing…' : 'Mark as paid'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {reconcileModalRow && (
            <>
              <p className="text-gray-700">
                This will mark the payment as <strong>completed</strong>, activate the package for{' '}
                <span className="font-mono font-semibold">{reconcileModalRow.user_display_id || reconcileModalRow.user_id}</span>
                {' '}({reconcileModalRow.amount_display}) and run commissions. This action is logged for audit.
              </p>
              <p className="text-amber-700 text-sm font-medium">
                Type <strong>CONFIRM</strong> below to proceed:
              </p>
              <input
                type="text"
                value={reconcileConfirmText}
                onChange={(e) => setReconcileConfirmText(e.target.value)}
                placeholder="CONFIRM"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono uppercase"
                autoComplete="off"
              />
            </>
          )}
        </div>
      </Modal>

      <Card title="Filter Gateway Purchases">
        <FiltersBar>
          <TextInput
            id="gateway-filter-user"
            label="User (Display ID)"
            placeholder="e.g. SIA00021"
            value={userFilter}
            onChange={setUserFilter}
          />
          <TextInput
            id="gateway-filter-status"
            label="Status"
            placeholder="all / completed / pending / cancelled"
            value={statusFilter}
            onChange={(v) => {
              const lower = (v || '').toLowerCase() as typeof statusFilter
              if (lower === 'completed' || lower === 'pending' || lower === 'cancelled' || lower === 'all') {
                setStatusFilter(lower)
              } else if (v === '') {
                setStatusFilter('all')
              }
            }}
          />
          <TextInput
            id="gateway-filter-type"
            label="Type"
            placeholder="all / new / reinvest / renew / upgrade"
            value={flowTypeFilter}
            onChange={(v) => {
              const lower = (v || '').toUpperCase()
              if (lower === '' || lower === 'ALL') {
                setFlowTypeFilter('all')
              } else if (
                lower === 'NEW_PURCHASE' ||
                lower === 'REINVESTMENT' ||
                lower === 'RENEWAL' ||
                lower === 'UPGRADE'
              ) {
                setFlowTypeFilter(lower as GatewayFlowType)
              } else if (lower === 'NEW') {
                setFlowTypeFilter('NEW_PURCHASE')
              } else if (lower === 'REINVEST') {
                setFlowTypeFilter('REINVESTMENT')
              } else if (lower === 'RENEW') {
                setFlowTypeFilter('RENEWAL')
              } else if (lower === 'UPGRADE_PACKAGE' || lower === 'UPGRADE') {
                setFlowTypeFilter('UPGRADE')
              }
            }}
          />
          <DateRangeInput
            id="gateway-filter-date"
            label="Date Range"
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />
          <PrimaryButton onClick={handleApplyFilters} disabled={loading}>
            {loading ? 'Loading...' : 'Apply'}
          </PrimaryButton>
          <SecondaryButton onClick={handleClearFilters} disabled={loading}>
            Clear
          </SecondaryButton>
        </FiltersBar>
      </Card>
    </div>
  )
}

