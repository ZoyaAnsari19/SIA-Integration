'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Card, { Toolbar, ToolbarButton } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable'
import { FiltersBar, SearchInput } from '../../components/ui/FiltersBar'
import StatusBadge from '../../components/ui/StatusBadge'
import {
  createNotice,
  deleteNotice,
  getNotices,
  updateNotice,
  type Notice,
} from '../../lib/api/notices'

type NotificationType = 'info' | 'success' | 'warning' | 'error'
type AudienceType = 'all' | 'admins' | 'subscribers' | 'single'
type StatusType = 'active' | 'expired' | 'resolved' | 'sent'

interface NotificationRow {
  id: number
  title: string
  body: string
  type: NotificationType
  audience: AudienceType
  createdAt: string
  status: StatusType
  // Optional identifier for single-user notifications
  targetUserId?: string
}

const mapNoticeToRow = (notice: Notice): NotificationRow => {
  const createdDate = new Date(notice.created_at)

  return {
    id: notice.id,
    title: notice.title,
    body: notice.content,
    // Backend does not store type/audience, so we default them for now
    type: 'info',
    audience: 'all',
    createdAt: createdDate.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    }),
    status: notice.is_active ? 'active' : 'expired',
  }
}

const typeLabel: Record<NotificationType, string> = {
  info: 'Info',
  success: 'Success',
  warning: 'Warning',
  error: 'Error / Critical',
}

const audienceLabel: Record<AudienceType, string> = {
  all: 'All Users',
  admins: 'Admins Only',
  subscribers: 'Paid Subscribers',
  single: 'Single User',
}

const statusLabel: Record<StatusType, string> = {
  active: 'Active',
  expired: 'Expired',
  resolved: 'Resolved',
  sent: 'Sent',
}

export default function NotificationModule() {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<NotificationType>('info')
  const [audience, setAudience] = useState<AudienceType>('all')
  const [message, setMessage] = useState('')
  const [targetUserId, setTargetUserId] = useState('')
  const [sendPush, setSendPush] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const [rows, setRows] = useState<NotificationRow[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | NotificationType>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    const loadNotices = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const data = await getNotices({ page: 1, limit: 50 })
        if (!isMounted) return
        setRows(data.items.map(mapNoticeToRow))
      } catch (err: any) {
        if (!isMounted) return
        console.error('Failed to load notices:', err)
        setError(err?.message || 'Failed to load notifications')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadNotices()

    return () => {
      isMounted = false
    }
  }, [])

  const openFormAndFocus = () => {
    setIsFormOpen(true)
    // Wait for modal content to mount before focusing
    setTimeout(() => {
      const input = document.getElementById('notifTitle')
      if (input instanceof HTMLInputElement) {
        input.focus()
      }
    }, 0)
  }

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return rows.filter(row => {
      const matchesSearch =
        !normalizedSearch ||
        row.title.toLowerCase().includes(normalizedSearch) ||
        row.body.toLowerCase().includes(normalizedSearch)

      const matchesType = typeFilter === 'all' || row.type === typeFilter

      return matchesSearch && matchesType
    })
  }, [rows, search, typeFilter])

  const resetForm = () => {
    setTitle('')
    setType('info')
    setAudience('all')
    setMessage('')
    setTargetUserId('')
    setSendPush(false)
    setEditingId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !message.trim()) {
      alert('Please fill title and message.')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      const payload = {
      title: title.trim(),
        content: message.trim(),
        // Model "active" notifications via is_active flag
        is_active: true,
      }

      if (editingId != null) {
        const updated = await updateNotice(editingId, payload)
        const updatedRow = mapNoticeToRow(updated)
        setRows(prev => prev.map(row => (row.id === editingId ? updatedRow : row)))
      } else {
        const created = await createNotice(payload)
        const newRow = mapNoticeToRow(created)
    setRows(prev => [newRow, ...prev])
      }

      setIsFormOpen(false)
      resetForm()
    } catch (err: any) {
      console.error('Failed to save notice:', err)
      setError(err?.message || 'Failed to save notification')
      alert(err?.message || 'Failed to save notification')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    const ok = confirm('Are you sure you want to delete this notification?')
    if (!ok) return
    try {
      setDeletingId(id)
      setError(null)
      await deleteNotice(id)
    setRows(prev => prev.filter(r => r.id !== id))
    } catch (err: any) {
      console.error('Failed to delete notice:', err)
      setError(err?.message || 'Failed to delete notification')
      alert(err?.message || 'Failed to delete notification')
    } finally {
      setDeletingId(null)
    }
  }

  const columns: Array<DataTableColumn<NotificationRow>> = [
    {
      key: 'title',
      title: 'Title',
      cellClassName: 'font-medium text-[#222]',
    },
    {
      key: 'type',
      title: 'Type',
      render: (row: NotificationRow) => {
        const base =
          row.type === 'success'
            ? 'bg-[#d1fae5] text-[#065f46]'
            : row.type === 'info'
            ? 'bg-[#dbeafe] text-[#1e40af]'
            : row.type === 'warning'
            ? 'bg-[#fef3c7] text-[#92400e]'
            : 'bg-[#fee2e2] text-[#b91c1c]'
        return (
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${base}`}>
            {typeLabel[row.type]}
          </span>
        )
      },
    },
    {
      key: 'audience',
      title: 'Audience',
      render: (row: NotificationRow) => audienceLabel[row.audience],
    },
    {
      key: 'createdAt',
      title: 'Created At',
    },
    {
      key: 'status',
      title: 'Status',
      render: (row: NotificationRow) => {
        const variant =
          row.status === 'active'
            ? 'active'
            : row.status === 'expired'
            ? 'expired'
            : row.status === 'resolved'
            ? 'rejected'
            : 'pending'
        return (
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                row.status === 'active' || row.status === 'sent' ? 'bg-[#10b981]' : 'bg-[#9ca3af]'
              }`}
            />
            <StatusBadge variant={variant}>{statusLabel[row.status as StatusType]}</StatusBadge>
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <h1 className="text-[24px] font-semibold mb-5 text-[#222]">Notification Management</h1>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#e5e7eb]">
              <h2 className="text-lg font-semibold text-[#111827]">Add Notification</h2>
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false)
                  resetForm()
                }}
                className="text-[#6b7280] hover:text-[#111827] text-xl leading-none px-1"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="px-5 py-4">
              <form id="notification-form" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="notifTitle" className="text-sm font-semibold text-[#222]">
                      Notification Title
                    </label>
                    <input
                      id="notifTitle"
                      type="text"
                      required
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="e.g., System Maintenance Alert"
                      className="px-3 py-2 border border-[#e0e0e0] rounded-md text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-white"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="notifType" className="text-sm font-semibold text-[#222]">
                      Type
                    </label>
                    <select
                      id="notifType"
                      value={type}
                      onChange={e => setType(e.target.value as NotificationType)}
                      className="px-3 py-2 border border-[#e0e0e0] rounded-md text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-white"
                    >
                      <option value="info">Info</option>
                      <option value="success">Success</option>
                      <option value="warning">Warning</option>
                      <option value="error">Error / Critical</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="notifAudience" className="text-sm font-semibold text-[#222]">
                      Audience
                    </label>
                    <select
                      id="notifAudience"
                      value={audience}
                      onChange={e => setAudience(e.target.value as AudienceType)}
                      className="px-3 py-2 border border-[#e0e0e0] rounded-md text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-white"
                    >
                      <option value="all">All Users</option>
                      <option value="admins">Admins Only</option>
                      <option value="subscribers">Paid Subscribers</option>
                      <option value="single">Single User (by ID)</option>
                    </select>
                  </div>

                  {audience === 'single' && (
                    <div className="flex flex-col gap-2">
                      <label htmlFor="notifTargetUser" className="text-sm font-semibold text-[#222]">
                        Target User ID
                      </label>
                      <input
                        id="notifTargetUser"
                        type="text"
                        value={targetUserId}
                        onChange={e => setTargetUserId(e.target.value)}
                        placeholder="Enter user ID or identifier"
                        className="px-3 py-2 border border-[#e0e0e0] rounded-md text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-white"
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-[#222]">Delivery Method</span>
                    <label className="inline-flex items-center gap-2 text-sm text-[#555] select-none">
                      <button
                        type="button"
                        onClick={() => setSendPush(v => !v)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          sendPush ? 'bg-primary' : 'bg-[#ccc]'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            sendPush ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <span>Send as Push Notification</span>
                    </label>
                  </div>

                  <div className="md:col-span-2 flex flex-col gap-2">
                    <label htmlFor="notifMessage" className="text-sm font-semibold text-[#222]">
                      Message Body
                    </label>
                    <textarea
                      id="notifMessage"
                      required
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder="Type your message here..."
                      className="px-3 py-2 border border-[#e0e0e0] rounded-md text-sm min-h-[100px] resize-y focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-white"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={() => {
                      resetForm()
                    }}
                  >
                    Clear
                  </Button>
                  <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save Notification'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* List / Table */}
      <Card
        toolbarRight={
          <Toolbar>
            <ToolbarButton
              type="button"
              className="bg-primary text-white hover:bg-primary/90 border-none px-4 py-2 rounded-md text-sm font-medium shadow-sm"
              onClick={() => {
                openFormAndFocus()
              }}
            >
              + Add New Notice
            </ToolbarButton>
            <ToolbarButton
              type="button"
              className="border border-[#d1d5db] text-[#374151] hover:bg-[#f3f4f6] px-3 py-1.5 rounded-md text-sm font-medium"
            >
              Export
            </ToolbarButton>
            <ToolbarButton
              type="button"
              className="border border-[#d1d5db] text-[#374151] hover:bg-[#f3f4f6] px-3 py-1.5 rounded-md text-sm font-medium"
            >
              Print
            </ToolbarButton>
          </Toolbar>
        }
      >
        <FiltersBar>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by title or content..."
          />
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
            <label htmlFor="typeFilter" className="font-medium text-sm sm:text-base whitespace-nowrap">
              Filter by Type:
            </label>
            <select
              id="typeFilter"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as 'all' | NotificationType)}
              className="px-3 py-2 border border-[#ccc] rounded-md text-sm w-full sm:w-auto min-w-[150px]"
            >
              <option value="all">All</option>
              <option value="success">Success</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>
        </FiltersBar>

        <div className="mt-4">
          <DataTable
            columns={columns}
            rows={filteredRows}
            actionsHeader="Actions"
            renderActions={(row: NotificationRow) => (
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingId(row.id)
                    setTitle(row.title)
                    setType(row.type)
                    setAudience(row.audience)
                    setMessage(row.body)
                    setTargetUserId(row.targetUserId ?? '')
                    openFormAndFocus()
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(row.id)}
                  disabled={deletingId === row.id}
                >
                  {deletingId === row.id ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            )}
          />
        </div>
      </Card>
    </div>
  )
}