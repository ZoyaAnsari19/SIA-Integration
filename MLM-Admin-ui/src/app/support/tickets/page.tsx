'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { getAdminTickets, type AdminTicketListItem } from '@/lib/api/support'
import { getMyPermissions } from '@/lib/api/sub-admins'

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function statusLabel(s: string | null | undefined): string {
  if (!s) return '—'
  switch (s) {
    case 'open': return 'Open'
    case 'in_progress': return 'In Progress'
    case 'closed': return 'Closed'
    default: return s
  }
}

function statusColor(s: string | null | undefined): string {
  if (!s) return 'bg-slate-100 text-slate-600'
  switch (s) {
    case 'open': return 'bg-amber-100 text-amber-800'
    case 'in_progress': return 'bg-blue-100 text-blue-800'
    case 'closed': return 'bg-slate-100 text-slate-600'
    default: return 'bg-slate-100 text-slate-600'
  }
}

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState<AdminTicketListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [limit, setLimit] = useState(15)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [assignedFilter, setAssignedFilter] = useState<string>('')
  const [searchName, setSearchName] = useState<string>('')
  const [searchId, setSearchId] = useState<string>('')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adminRole, setAdminRole] = useState<string>('')

  useEffect(() => {
    getMyPermissions()
      .then(({ role }) => {
        setAdminRole(role)
        if (role === 'SUB_ADMIN') setAssignedFilter('me')
      })
      .catch(() => setAdminRole(''))
  }, [])

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getAdminTickets({
        page,
        limit,
        status: statusFilter || undefined,
        assigned_to: assignedFilter || undefined,
        search_name: searchName.trim() || undefined,
        search_id: searchId.trim() || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      })
      setTickets(res.items)
      setTotal(res.total)
      setTotalPages(res.total_pages)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tickets')
      setTickets([])
    } finally {
      setLoading(false)
    }
  }, [page, limit, statusFilter, assignedFilter, searchName, searchId, dateFrom, dateTo])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  return (
    <div className="space-y-4">
      <Card title="Support Tickets">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-600">Status:</span>
              {['', 'open', 'in_progress', 'closed'].map((s) => (
                <button
                  key={s || 'all'}
                  type="button"
                  onClick={() => { setStatusFilter(s); setPage(1) }}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  {s === '' ? 'All' : statusLabel(s)}
                </button>
              ))}
              <span className="text-sm text-slate-600 ml-2">Assigned:</span>
              {['', 'me'].map((a) => (
                <button
                  key={a || 'all'}
                  type="button"
                  onClick={() => { setAssignedFilter(a); setPage(1) }}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${assignedFilter === a ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  {a === '' ? 'All' : 'My tickets'}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <input
                type="text"
                value={searchId}
                onChange={(e) => { setSearchId(e.target.value); setPage(1) }}
                placeholder="Search by ID (e.g. SIA00001)"
                className="w-40 rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
              <input
                type="text"
                value={searchName}
                onChange={(e) => { setSearchName(e.target.value); setPage(1) }}
                placeholder="Search by name"
                className="w-44 rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                className="rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
              <span className="text-xs text-slate-500">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                className="rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          {adminRole === 'SUB_ADMIN' && (
            <p className="text-xs text-slate-500">
              Tickets assigned to you by admin appear under <strong>My tickets</strong>. Reassigned tickets show status &quot;In Progress&quot;.
            </p>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-slate-500">Loading...</div>
          ) : tickets.length === 0 ? (
            <div className="py-12 text-center text-slate-500">No tickets found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="pb-2 pr-4 text-sm font-semibold text-slate-600">ID</th>
                    <th className="pb-2 pr-4 text-sm font-semibold text-slate-600">User</th>
                    <th className="pb-2 pr-4 text-sm font-semibold text-slate-600">Subject / Topic</th>
                    <th className="pb-2 pr-4 text-sm font-semibold text-slate-600">Status</th>
                    <th className="pb-2 pr-4 text-sm font-semibold text-slate-600">Assigned</th>
                    <th className="pb-2 pr-4 text-sm font-semibold text-slate-600">Updated</th>
                    <th className="pb-2 text-sm font-semibold text-slate-600" />
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id != null ? `ticket-${t.id}` : Math.random()} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 pr-4 text-sm font-medium">{t.id != null ? `#${t.id}` : '—'}</td>
                      <td className="py-3 pr-4 text-sm">
                        <span className="font-medium">
                          {t.user?.display_id && (
                            <>
                              {t.user.display_id}
                              {t.user?.name ? ' - ' : ''}
                            </>
                          )}
                          {t.user?.name || (!t.user?.display_id && `User #${t.user_id}`)}
                        </span>
                        {t.user?.email && <span className="block text-xs text-slate-500">{t.user.email}</span>}
                      </td>
                      <td className="py-3 pr-4 text-sm">
                        <span>{t.subject || t.pre_question || 'No subject'}</span>
                        {t.last_message?.text && (
                          <p className="text-xs text-slate-500 truncate max-w-[180px] mt-0.5">{t.last_message.text}</p>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(t.status)}`}>
                          {statusLabel(t.status)}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-sm text-slate-600">
                        {t.assigned_to_user?.name || '—'}
                      </td>
                      <td className="py-3 pr-4 text-sm text-slate-500">{formatDate(t.updated_at)}</td>
                      <td className="py-3">
                        {t.id != null ? (
                          <Link href={`/support/tickets/${t.id}`} className="text-blue-600 font-medium hover:underline">
                            View
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {total > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-slate-500">
                  Page {page} of {totalPages} ({total} ticket{total !== 1 ? 's' : ''})
                </p>
                <label className="flex items-center gap-2 text-sm text-slate-500">
                  Per page:
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value))
                      setPage(1)
                    }}
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-800"
                  >
                    {[10, 25, 50].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
