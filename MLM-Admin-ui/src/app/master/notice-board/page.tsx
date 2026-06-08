"use client"

import React, { useMemo, useState, useEffect } from 'react'
import Card from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, TextInput } from '../../../components/ui/FiltersBar'
import { EditButton, DeleteButton } from '../../../components/ui/ActionButtons'
import Pagination from '../../../components/ui/Pagination'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import {
  getNotices,
  createNotice,
  updateNotice,
  deleteNotice,
  type Notice,
  type CreateNoticeRequest,
  type UpdateNoticeRequest,
} from '../../../lib/api/notices'
import { exportToCsv } from '../../../lib/export'

type Row = Notice & {
  notice_content: string // Maps to content
  notice_id: string // Maps to id
}

// Format ISO date to readable format (matches UI format: "2025-10-29 10:30 AM")
const formatDate = (isoString: string): string => {
  const date = new Date(isoString)
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  let hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  hours = hours ? hours : 12
  const hoursStr = hours.toString().padStart(2, '0')
  return `${year}-${month}-${day} ${hoursStr}:${minutes} ${ampm}`
}

export default function NoticeBoardPage() {
  const [searchFilter, setSearchFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notices, setNotices] = useState<Notice[]>([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    total_pages: 0,
  })
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null)

  // Fetch notices from API
  const fetchNotices = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await getNotices({
        page,
        limit: pageSize,
      })
      setNotices(response.items)
      setPagination(response.pagination)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch notices')
      console.error('Error fetching notices:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Load data on mount and when page/pageSize changes
  useEffect(() => {
    fetchNotices()
  }, [page, pageSize])

  // Filter notices by search query (client-side)
  const filteredNotices = useMemo(() => {
    if (!searchFilter.trim()) return notices

    const query = searchFilter.toLowerCase()
    return notices.filter(
      (notice) =>
        notice.content.toLowerCase().includes(query) ||
        (notice.title && notice.title.toLowerCase().includes(query))
    )
  }, [notices, searchFilter])

  // Convert to Row type for table
  const rows: Row[] = useMemo(() => {
    return filteredNotices.map(notice => ({
      ...notice,
      notice_content: notice.content,
      notice_id: notice.id.toString(),
    }))
  }, [filteredNotices])

  const columns: Array<DataTableColumn<Row>> = useMemo(() => [
    { 
      key: 'notice_content', 
      title: 'notice board (Content)',
      widthPx: 600,
      cellClassName: 'whitespace-normal break-words',
      render: (r: Row) => (
        <div className="text-sm leading-relaxed break-words">
          {r.notice_content}
        </div>
      )
    },
    { 
      key: 'created_at', 
      title: 'Created At',
      cellClassName: 'whitespace-nowrap',
      render: (r: Row) => formatDate(r.created_at)
    },
  ], [])

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    link: '',
    is_active: true,
  })

  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const handleEdit = (notice: Notice) => {
    setEditingNotice(notice)
    setFormData({
      title: notice.title || '',
      content: notice.content || '',
      link: notice.link || '',
      is_active: notice.is_active,
    })
    setFormErrors({})
    setIsModalOpen(true)
  }

  const handleCreate = () => {
    setEditingNotice(null)
    setFormData({
      title: '',
      content: '',
      link: '',
      is_active: true,
    })
    setFormErrors({})
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingNotice(null)
    setFormData({
      title: '',
      content: '',
      link: '',
      is_active: true,
    })
    setFormErrors({})
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.title.trim()) {
      errors.title = 'Title is required'
    }
    if (!formData.content.trim()) {
      errors.content = 'Content is required'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      if (editingNotice) {
        // Update existing notice
        const updateData: UpdateNoticeRequest = {
          title: formData.title,
          content: formData.content,
          link: formData.link.trim() || null,
          is_active: formData.is_active,
        }
        await updateNotice(editingNotice.id, updateData)
        alert('Notice updated successfully!')
      } else {
        // Create new notice
        const createData: CreateNoticeRequest = {
          title: formData.title,
          content: formData.content,
          link: formData.link.trim() || null,
          is_active: formData.is_active,
        }
        await createNotice(createData)
        alert('Notice created successfully!')
      }
      handleCloseModal()
      fetchNotices()
    } catch (err: any) {
      setError(err.message || 'Failed to save notice')
      alert(`Error: ${err.message || 'Failed to save notice'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (notice: Notice) => {
    if (!confirm(`Are you sure you want to delete this notice: "${notice.title || notice.content.substring(0, 30)}..."?`)) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await deleteNotice(notice.id)
      alert('Notice deleted successfully!')
      fetchNotices()
    } catch (err: any) {
      setError(err.message || 'Failed to delete notice')
      alert(`Error: ${err.message || 'Failed to delete notice'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleExport = () => {
    if (!filteredNotices.length) {
      alert('No notice records available to export.')
      return
    }

    const headers = ['id', 'title', 'content', 'is_active', 'created_at', 'updated_at']
    const data = filteredNotices.map(notice => [
      notice.id,
      notice.title || '',
      notice.content || '',
      notice.is_active ? 'Active' : 'Inactive',
      formatDate(notice.created_at),
      formatDate(notice.updated_at),
    ])

    exportToCsv('notice-board.csv', headers, data)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSearch = () => {
    // Search is handled client-side via filteredNotices
    setPage(1) // Reset to first page when searching
  }

  const handleClearFilters = () => {
    setSearchFilter('')
    setPage(1)
  }

  return (
    <>
    <Card
      title="Notice Board Management"
      toolbarRight={
        <>
            <Button variant="primary" size="md" onClick={handleCreate} disabled={isLoading}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>Add Notice</span>
            </Button>
          <Button variant="outline" size="md" aria-label="Export" onClick={handleExport}>
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
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {isLoading && !notices.length ? (
          <div className="text-center py-8">Loading notices...</div>
        ) : (
          <>
            <DataTable<Row>
              columns={columns}
              rows={rows}
              renderActions={(row) => {
                const notice = notices.find(n => n.id.toString() === row.notice_id)
                if (!notice) return null
                return (
                  <div className="flex items-center gap-1">
                    <EditButton onClick={() => handleEdit(notice)} />
                    <DeleteButton onClick={() => handleDelete(notice)} />
                  </div>
                )
              }}
        minWidthPx={800}
      />

      <FiltersBar>
        <TextInput 
          id="notice-search-filter" 
          label="Search Notice Content:" 
          value={searchFilter} 
          onChange={setSearchFilter} 
          placeholder="Search by keyword or package name..." 
        />
        <PrimaryButton type="button" onClick={handleSearch}>Search</PrimaryButton>
        <SecondaryButton type="button" onClick={handleClearFilters}>Clear filtering</SecondaryButton>
      </FiltersBar>

      <Pagination
        page={page}
        pageSize={pageSize}
              total={pagination.total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[10, 25, 50]}
      />
          </>
        )}
    </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingNotice ? 'Edit Notice' : 'Add Notice'}
        size="lg"
        footer={
          <>
            <Button variant="outline" size="md" onClick={handleCloseModal} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={handleSave} disabled={isLoading}>
              {isLoading ? 'Saving...' : editingNotice ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSave()
          }}
          className="space-y-4"
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="title" className="font-semibold">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              required
              value={formData.title}
              onChange={(e) => {
                setFormData({ ...formData, title: e.target.value })
                setFormErrors({ ...formErrors, title: '' })
              }}
              placeholder="e.g., Important Announcement"
              className={`px-3 py-2.5 border rounded-md ${
                formErrors.title ? 'border-red-500' : 'border-[#ccc]'
              }`}
            />
            {formErrors.title && <span className="text-red-500 text-sm">{formErrors.title}</span>}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="content" className="font-semibold">
              Content <span className="text-red-500">*</span>
            </label>
            <textarea
              id="content"
              required
              rows={8}
              value={formData.content}
              onChange={(e) => {
                setFormData({ ...formData, content: e.target.value })
                setFormErrors({ ...formErrors, content: '' })
              }}
              placeholder="Enter notice content..."
              className={`px-3 py-2.5 border rounded-md resize-y ${
                formErrors.content ? 'border-red-500' : 'border-[#ccc]'
              }`}
            />
            {formErrors.content && <span className="text-red-500 text-sm">{formErrors.content}</span>}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="link" className="font-semibold">
              Link (Optional)
            </label>
            <input
              id="link"
              type="url"
              value={formData.link}
              onChange={(e) => {
                setFormData({ ...formData, link: e.target.value })
                setFormErrors({ ...formErrors, link: '' })
              }}
              placeholder="e.g., https://example.com"
              className={`px-3 py-2.5 border rounded-md ${
                formErrors.link ? 'border-red-500' : 'border-[#ccc]'
              }`}
            />
            {formErrors.link && <span className="text-red-500 text-sm">{formErrors.link}</span>}
            <p className="text-xs text-gray-500">Optional: Add a link URL for this notice</p>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="is_active" className="font-semibold">
              Status
            </label>
            <select
              id="is_active"
              value={formData.is_active ? 'true' : 'false'}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
              className="px-3 py-2.5 border border-[#ccc] rounded-md"
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </form>
      </Modal>
    </>
  )
}
