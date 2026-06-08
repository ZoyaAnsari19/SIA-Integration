'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Card from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import Pagination from '../../../components/ui/Pagination'
import { getFlushHistory, type FlushHistoryItem } from '../../../lib/api/flush-history'

const formatDate = (dateString: string) => {
  try {
    return new Date(dateString).toLocaleString('en-IN', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return dateString
  }
}

const formatAmount = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n)

export default function FlushHistoryPage() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [userIdFilter, setUserIdFilter] = useState('')
  const [userIdInput, setUserIdInput] = useState('')
  const [items, setItems] = useState<FlushHistoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getFlushHistory({
        page,
        limit,
        user_id: userIdFilter.trim() || undefined,
      })
      setItems(res.items)
      setTotal(res.total)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load flush history'
      setError(msg)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [page, limit, userIdFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const applyUserFilter = () => {
    setUserIdFilter(userIdInput.trim())
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))

  const columns: DataTableColumn<FlushHistoryItem>[] = [
    { key: 'display_id', title: 'User ID', widthPx: 120, render: (r) => <span className="font-mono font-medium">{r.display_id}</span> },
    { key: 'user_name', title: 'Name', widthPx: 180, render: (r) => r.user_name || '—' },
    {
      key: 'flushed_at',
      title: 'Flushed at',
      widthPx: 160,
      render: (r) => formatDate(r.flushed_at),
    },
    {
      key: 'spot_amount_flushed',
      title: 'Spot flushed',
      widthPx: 110,
      render: (r) => formatAmount(r.spot_amount_flushed),
    },
    {
      key: 'team_royalty_amount_flushed',
      title: 'Team royalty flushed',
      widthPx: 130,
      render: (r) => formatAmount(r.team_royalty_amount_flushed),
    },
    {
      key: 'current_spot_balance',
      title: 'Current spot',
      widthPx: 110,
      render: (r) => formatAmount(r.current_spot_balance ?? 0),
    },
    {
      key: 'current_team_royalty_balance',
      title: 'Current team royalty',
      widthPx: 130,
      render: (r) => formatAmount(r.current_team_royalty_balance ?? 0),
    },
    {
      key: 'trigger_commission_type',
      title: 'Trigger',
      widthPx: 100,
      render: (r) => r.trigger_commission_type || '—',
    },
  ]

  return (
    <div className="p-4 md:p-6">
      <Card title="Flush History (10× rule)" className="mb-4">
        <p className="text-sm text-gray-600 mb-4">
          When a user&apos;s Spot + Team Royalty wallets are zeroed after 10× limit + 15 days (no upgrade). Table shows how much was flushed at that time and their current spot/team royalty balance now.
        </p>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <input
            type="text"
            placeholder="Filter by User ID"
            value={userIdInput}
            onChange={(e) => setUserIdInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyUserFilter()}
            className="border border-gray-300 rounded px-3 py-2 text-sm w-48"
          />
          <button
            type="button"
            onClick={applyUserFilter}
            className="px-4 py-2 bg-primary text-white rounded text-sm font-medium hover:opacity-90"
          >
            Apply
          </button>
          {userIdFilter && (
            <button
              type="button"
              onClick={() => { setUserIdInput(''); setUserIdFilter(''); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded text-sm"
            >
              Clear
            </button>
          )}
        </div>
        {error && <div className="text-red-600 text-sm mb-4">{error}</div>}
        {loading ? (
          <div className="py-8 text-center text-gray-500">Loading...</div>
        ) : (
          <>
            <DataTable columns={columns} rows={items} minWidthPx={1050} />
            {totalPages > 1 && (
              <Pagination
                page={page}
                pageSize={limit}
                total={total}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </Card>
    </div>
  )
}
