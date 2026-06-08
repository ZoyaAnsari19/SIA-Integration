"use client"

import React, { useMemo, useState, useEffect, useCallback } from 'react'
import Card from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, TextInput } from '../../../components/ui/FiltersBar'
import { EditButton, DeleteButton } from '../../../components/ui/ActionButtons'
import Pagination from '../../../components/ui/Pagination'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import { getWebsiteNotices, createWebsiteNotice, type WebsiteNotice } from '../../../lib/api/website'
import { exportToCsv } from '../../../lib/export'
import { ToastContainer, useToast } from '../../../components/ui/Toast'

type Row = {
  sr_no: number
  notice_id: string
  notice_title: string
  description: string
  id: string
}

export default function NoticePage() {
  const [titleFilter, setTitleFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingNotice, setEditingNotice] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    notice_title: '',
    description: '',
  })
  const [notices, setNotices] = useState<WebsiteNotice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const { toasts, showToast, closeToast } = useToast()

  // Fetch website notices from API
  const fetchNotices = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: any = {
        page,
        limit: pageSize,
      }
      
      const response = await getWebsiteNotices(params)
      setNotices(response.items || [])
      setTotal(response.pagination?.total || 0)
      setTotalPages(response.pagination?.total_pages || 0)
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to fetch notices'
      console.error('Error fetching website notices:', err)
      setError(errorMessage)
      showToast(errorMessage, 'error')
      setNotices([])
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, showToast])

  useEffect(() => {
    fetchNotices()
  }, [fetchNotices])

  const columns: Array<DataTableColumn<Row>> = useMemo(() => [
    { 
      key: 'sr_no', 
      title: 'sr-no',
      widthPx: 50,
      render: (r: Row) => r.sr_no.toString()
    },
    { 
      key: 'notice_id', 
      title: 'id',
      widthPx: 80,
      render: (r: Row) => (
        <span className="font-semibold">{r.notice_id}</span>
      )
    },
    { 
      key: 'notice_title', 
      title: 'notice title',
      cellClassName: 'whitespace-normal',
      render: (r: Row) => (
        <span className="font-semibold">{r.notice_title}</span>
      )
    },
    { 
      key: 'description', 
      title: 'description',
      cellClassName: 'whitespace-normal',
      widthPx: 300,
      render: (r: Row) => (
        <div className="text-sm leading-relaxed max-w-[300px]" style={{ wordBreak: 'break-word' }}>
          {r.description}
        </div>
      )
    },
  ], [])

  // Map API data to table rows
  const rows: Row[] = useMemo(() => {
    return notices.map((notice, index) => ({
      sr_no: (page - 1) * pageSize + index + 1,
      notice_id: `NTC-${String(notice.id).padStart(3, '0')}`,
      notice_title: notice.title,
      description: notice.content,
      id: notice.id.toString(),
    }))
  }, [notices, page, pageSize])

  const handleEdit = (id: string) => {
    const notice = notices.find(n => n.id.toString() === id)
    if (notice) {
      setFormData({
        notice_title: notice.title,
        description: notice.content,
      })
      setEditingNotice(notice.id)
      setIsModalOpen(true)
    }
  }

  const handleDelete = (id: string) => {
    const notice = notices.find(n => n.id.toString() === id)
    if (notice) {
      showToast('Delete functionality not available. Backend PUT/DELETE endpoints not implemented.', 'warning')
    }
  }

  const handleExport = () => {
    if (!filteredRows.length) {
      alert('No website notices available to export.')
      return
    }

    const headers = ['sr_no', 'notice_id', 'notice_title', 'description']
    const data = filteredRows.map(row => [
      row.sr_no,
      row.notice_id,
      row.notice_title,
      row.description,
    ])

    exportToCsv('website-notices.csv', headers, data)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSearch = () => {
    // Client-side filtering for now
    if (titleFilter.trim()) {
      showToast(`Filtering by: ${titleFilter}`, 'info')
    }
  }

  const handleClearFilters = () => {
    setTitleFilter('')
    showToast('Filters cleared', 'info')
  }

  const handleAddNew = () => {
    setFormData({
      notice_title: '',
      description: '',
    })
    setEditingNotice(null)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setFormData({
      notice_title: '',
      description: '',
    })
    setEditingNotice(null)
  }

  const handleSaveNotice = async () => {
    if (!formData.notice_title || !formData.description) {
      showToast('Please fill in Title and Description', 'error')
      return
    }

    try {
    if (editingNotice) {
        // Note: PUT endpoint doesn't exist in backend, so we can't update
        showToast('Update functionality not available. Backend PUT endpoint not implemented.', 'warning')
        return
    } else {
        // Create new notice
        await createWebsiteNotice({
          title: formData.notice_title,
          content: formData.description,
          is_active: true,
        })
        showToast('Notice created successfully', 'success')
        handleCloseModal()
        fetchNotices()
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to save notice'
      console.error('Error saving notice:', err)
      showToast(errorMessage, 'error')
    }
  }

  // Filter rows client-side by title
  const filteredRows = useMemo(() => {
    if (!titleFilter.trim()) return rows
    const filter = titleFilter.toLowerCase()
    return rows.filter(row => 
      row.notice_title.toLowerCase().includes(filter) || 
      row.notice_id.toLowerCase().includes(filter)
    )
  }, [rows, titleFilter])

  if (loading && notices.length === 0) {
    return (
      <Card title="Notice Board Management">
        <div className="text-center py-8">Loading notices...</div>
      </Card>
    )
  }

  return (
    <>
      <ToastContainer toasts={toasts} onClose={closeToast} />
      <Card
        title="Notice Board Management"
        toolbarRight={
          <>
            <Button
              variant="success"
              size="md"
              onClick={handleAddNew}
              aria-label="Add New Notice"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>Add New Notice</span>
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
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}
        <DataTable<Row>
          columns={columns}
          rows={filteredRows}
          renderActions={(row) => (
            <div className="flex items-center gap-1">
              <EditButton onClick={() => {}} />
              <DeleteButton onClick={() => {}} />
            </div>
          )}
          minWidthPx={700}
        />

        <FiltersBar>
          <TextInput 
            id="notice-filter" 
            label="Filter by Title/ID:" 
            value={titleFilter} 
            onChange={setTitleFilter} 
            placeholder="Search by title or id..." 
          />
          <PrimaryButton type="button" onClick={handleSearch}>Search</PrimaryButton>
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
      </Card>

      {/* Add/Edit Notice Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingNotice ? `Edit Notice: ${formData.notice_title}` : 'Add New Notice'}
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              size="md"
              onClick={handleCloseModal}
            >
              Cancel
            </Button>
            <Button
              variant="success"
              size="md"
              onClick={handleSaveNotice}
            >
              Save
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSaveNotice(); }} className="space-y-4">
          {editingNotice && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-sm">
              Note: Update functionality is not available as the backend PUT endpoint is not implemented.
          </div>
          )}
          
          <div className="flex flex-col gap-2">
            <label htmlFor="modal-title" className="font-semibold text-sm">Notice Title:</label>
            <input
              id="modal-title"
              type="text"
              required
              value={formData.notice_title}
              onChange={(e) => setFormData({ ...formData, notice_title: e.target.value })}
              placeholder="Enter a brief, descriptive title"
              className="w-full px-3 py-2.5 border border-[#ccc] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              disabled={!!editingNotice}
            />
          </div>
          
          <div className="flex flex-col gap-2">
            <label htmlFor="modal-description" className="font-semibold text-sm">Description:</label>
            <textarea
              id="modal-description"
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter the full details of the notice..."
              rows={5}
              className="w-full px-3 py-2.5 border border-[#ccc] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y min-h-[100px]"
            />
          </div>
        </form>
      </Modal>
    </>
  )
}
