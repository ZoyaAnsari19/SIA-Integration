"use client"

import React, { useMemo, useState, useEffect, useCallback } from 'react'
import Card from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, TextInput } from '../../../components/ui/FiltersBar'
import { EditButton, DeleteButton } from '../../../components/ui/ActionButtons'
import Pagination from '../../../components/ui/Pagination'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import { getSliders, createSlider, updateSlider, deleteSlider, uploadSliderImage, type Slider } from '../../../lib/api/website'
import { exportToCsv } from '../../../lib/export'
import { ToastContainer, useToast } from '../../../components/ui/Toast'

type Row = {
  sr_no: number
  image: string // Image URL or preview
  title: string
  link: string
  created_at: string
  slider_id: string
}

export default function LandingSliderPage() {
  const [titleFilter, setTitleFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSlider, setEditingSlider] = useState<number | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    link: '',
    image_url: '',
    imageFile: null as File | null,
  })
  const [sliders, setSliders] = useState<Slider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const { toasts, showToast, closeToast } = useToast()

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const hh = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${d} ${hh}:${mm}`
    } catch {
      return dateString
    }
  }

  // Fetch sliders from API
  const fetchSliders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: any = {
        page,
        limit: pageSize,
      }
      
      const response = await getSliders(params)
      setSliders(response.items || [])
      setTotal(response.pagination?.total || 0)
      setTotalPages(response.pagination?.total_pages || 0)
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to fetch sliders'
      console.error('Error fetching sliders:', err)
      setError(errorMessage)
      showToast(errorMessage, 'error')
      setSliders([])
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, showToast])

  useEffect(() => {
    fetchSliders()
  }, [fetchSliders])

  const columns: Array<DataTableColumn<Row>> = useMemo(() => [
    { 
      key: 'sr_no', 
      title: 'sr-no',
      render: (r: Row) => r.sr_no.toString()
    },
    { 
      key: 'image', 
      title: 'image',
      render: (r: Row) => (
        r.image ? (
          <img 
            src={r.image} 
            alt="Slider" 
            className="w-20 h-10 object-cover rounded border border-[#e0e0e0]"
          />
        ) : (
          <span className="text-gray-400 text-xs">No image</span>
        )
      )
    },
    { 
      key: 'title', 
      title: 'title',
      render: (r: Row) => (
        <span className="font-semibold">**{r.title}**</span>
      )
    },
    { 
      key: 'link', 
      title: 'link',
      render: (r: Row) => (
        r.link ? (
        <a href={r.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          {r.link}
        </a>
        ) : (
          <span className="text-gray-400 text-xs">No link</span>
        )
      )
    },
    { 
      key: 'created_at', 
      title: 'created_at'
    },
  ], [])

  // Map API data to table rows
  const rows: Row[] = useMemo(() => {
    return sliders.map((slider, index) => ({
      sr_no: (page - 1) * pageSize + index + 1,
      image: slider.image_url || '',
      title: slider.title,
      link: slider.link || '',
      created_at: formatDate(slider.created_at),
      slider_id: slider.id.toString(),
    }))
  }, [sliders, page, pageSize])

  const handleEdit = (sliderId: string) => {
    const slider = sliders.find(s => s.id.toString() === sliderId)
    if (slider) {
      setFormData({
        title: slider.title,
        link: slider.link || '',
        image_url: slider.image_url,
        imageFile: null,
      })
      setImagePreview(slider.image_url || null)
      setIsUploadingImage(false)
      setEditingSlider(slider.id)
      setIsModalOpen(true)
    }
  }

  const handleDelete = async (sliderId: string) => {
    const slider = sliders.find(s => s.id.toString() === sliderId)
    if (slider && confirm(`Are you sure you want to delete the slider titled: ${slider.title}?`)) {
      try {
        await deleteSlider(slider.id)
        showToast('Slider deleted successfully', 'success')
        fetchSliders()
      } catch (err: any) {
        const errorMessage = err?.message || 'Failed to delete slider'
        console.error('Error deleting slider:', err)
        showToast(errorMessage, 'error')
      }
    }
  }

  const handleExport = () => {
    if (!filteredRows.length) {
      alert('No landing sliders available to export.')
      return
    }

    const headers = ['sr_no', 'title', 'image_url', 'link', 'created_at']
    const data = filteredRows.map(row => [
      row.sr_no,
      row.title,
      row.image,
      row.link || '',
      row.created_at,
    ])

    exportToCsv('landing-sliders.csv', headers, data)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSearch = () => {
    // Client-side filtering for now (can be enhanced with server-side search)
    // For now, just show a message
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
      title: '',
      link: '',
      image_url: '',
      imageFile: null,
    })
    setImagePreview(null)
    setIsUploadingImage(false)
    setEditingSlider(null)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setFormData({
      title: '',
      link: '',
      image_url: '',
      imageFile: null,
    })
    setImagePreview(null)
    setIsUploadingImage(false)
    setEditingSlider(null)
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setFormData({ ...formData, imageFile: null })
      setImagePreview(null)
      return
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Allowed: JPG, PNG, GIF, WebP')
      e.target.value = ''
      return
    }

    // Validate file size (5MB max)
    const maxSizeMB = 5
    if (file.size > maxSizeMB * 1024 * 1024) {
      alert(`File too large. Maximum size: ${maxSizeMB}MB`)
      e.target.value = ''
      return
    }

    setFormData({ ...formData, imageFile: file })

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    // Upload file immediately
    setIsUploadingImage(true)
    try {
      const result = await uploadSliderImage(file)
      setFormData({ ...formData, image_url: result.image_url })
      setImagePreview(result.image_url)
    } catch (err: any) {
      console.error('Error uploading slider image:', err)
      alert(err?.message || 'Failed to upload slider image')
      setFormData({ ...formData, imageFile: null, image_url: '' })
      setImagePreview(null)
      e.target.value = ''
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleImageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value
    setFormData({ ...formData, image_url: url })
    if (url) {
      setImagePreview(url)
    }
  }

  const handleSaveSlider = async () => {
    if (!formData.title) {
      showToast('Please fill in the title', 'error')
      return
    }

    // For image, we need either image_url or imageFile
    // Since backend expects image_url (URL string), we'll use image_url field
    // In a real app, you'd upload the file first and get a URL
    const imageUrl = formData.image_url || imagePreview || ''

    if (!imageUrl) {
      showToast('Please provide an image URL or upload an image', 'error')
      return
    }

    try {
    if (editingSlider) {
      // Update existing slider
        await updateSlider(editingSlider, {
          title: formData.title,
          link: formData.link || null,
          image_url: imageUrl,
        })
        showToast('Slider updated successfully', 'success')
    } else {
        // Create new slider
        await createSlider({
        title: formData.title,
          link: formData.link || null,
          image_url: imageUrl,
          is_active: true,
        })
        showToast('Slider created successfully', 'success')
      }
      handleCloseModal()
      fetchSliders()
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to save slider'
      console.error('Error saving slider:', err)
      showToast(errorMessage, 'error')
    }
  }

  // Filter rows client-side by title (can be enhanced with server-side search)
  const filteredRows = useMemo(() => {
    if (!titleFilter.trim()) return rows
    const filter = titleFilter.toLowerCase()
    return rows.filter(row => row.title.toLowerCase().includes(filter))
  }, [rows, titleFilter])

  if (loading && sliders.length === 0) {
    return (
      <Card title="Landing Slider Management">
        <div className="text-center py-8">Loading sliders...</div>
      </Card>
    )
  }

  return (
    <>
      <ToastContainer toasts={toasts} onClose={closeToast} />
      <Card
        title="Landing Slider Management"
        toolbarRight={
          <>
            <Button
              variant="success"
              size="md"
              onClick={handleAddNew}
              aria-label="Add New Slider"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>Add New Slider</span>
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
              <EditButton onClick={() => handleEdit(row.slider_id)} />
              <DeleteButton onClick={() => handleDelete(row.slider_id)} />
            </div>
          )}
          minWidthPx={800}
        />

        <FiltersBar>
          <TextInput 
            id="title-filter" 
            label="Filter by Title/Package:" 
            value={titleFilter} 
            onChange={setTitleFilter} 
            placeholder="Enter title or package..." 
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

      {/* Add/Edit Landing Slider Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingSlider ? `Edit Landing Slider: ${formData.title}` : 'Add New Landing Slider'}
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
              onClick={handleSaveSlider}
            >
              Save
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSaveSlider(); }} className="space-y-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="modal-title" className="font-semibold text-sm">Title:</label>
            <input
              id="modal-title"
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter slider title (e.g., Summer Sale)"
              className="w-full px-3 py-2.5 border border-[#ccc] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          
          <div className="flex flex-col gap-2">
            <label htmlFor="modal-image-url" className="font-semibold text-sm">Image URL:</label>
            <input
              id="modal-image-url"
              type="url"
              value={formData.image_url}
              onChange={handleImageUrlChange}
              placeholder="Enter image URL (e.g., https://example.com/image.jpg)"
              className="w-full px-3 py-2.5 border border-[#ccc] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <p className="text-xs text-gray-500">Or upload a file:</p>
            <input
              id="modal-image"
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              onChange={handleImageChange}
              disabled={isUploadingImage}
              className="w-full px-3 py-2.5 border border-[#ccc] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {isUploadingImage && (
              <span className="text-sm text-blue-600">Uploading image...</span>
            )}
            {imagePreview && (
              <div className="mt-2">
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  className="w-full max-w-md h-40 object-cover rounded border border-[#e0e0e0]"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview(null)
                    setFormData({ ...formData, imageFile: null, image_url: '' })
                  }}
                  className="mt-2 text-sm text-red-600 hover:text-red-800"
                >
                  Remove image
                </button>
              </div>
            )}
          </div>
          
          <div className="flex flex-col gap-2">
            <label htmlFor="modal-link" className="font-semibold text-sm">Link (URL) - Optional:</label>
            <input
              id="modal-link"
              type="url"
              value={formData.link}
              onChange={(e) => setFormData({ ...formData, link: e.target.value })}
              placeholder="Enter full URL (e.g., https://example.com/offer) or leave empty"
              className="w-full px-3 py-2.5 border border-[#ccc] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </form>
      </Modal>
    </>
  )
}
