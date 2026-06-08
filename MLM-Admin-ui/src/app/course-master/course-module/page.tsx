"use client"

import React, { useMemo, useState, useEffect, useCallback } from 'react'
import Card from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, TextInput } from '../../../components/ui/FiltersBar'
import { EditButton, DeleteButton, ViewButton } from '../../../components/ui/ActionButtons'
import Pagination from '../../../components/ui/Pagination'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import { getCourses, getCourseById, createCourse, updateCourse, deleteCourse, uploadCourseThumbnail, type Course } from '../../../lib/api/courses'
import { exportToCsv } from '../../../lib/export'
import { getPackages, type Package } from '../../../lib/api/packages'

type Row = {
  course_name: string
  course_details: string
  library_id: string
  course_status: 'Active' | 'Inactive'
  created_at: string
}

export default function CourseModulePage() {
  const [courseFilter, setCourseFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [courses, setCourses] = useState<Course[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null)
  const [viewingCourse, setViewingCourse] = useState<Course | null>(null)
  const [packages, setPackages] = useState<Package[]>([])
  const [formData, setFormData] = useState({
    title: '',
    short_description: '',
    long_description: '',
    price: '',
    original_price: '',
    package_id: '',
    language: 'HINDI' as 'HINDI' | 'ENGLISH' | 'BILINGUAL',
    level: 'BEGINNER' as 'BASIC' | 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT' | 'PROFESSIONAL',
    category: '',
    thumbnail_url: '',
    is_published: false,
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false)

  const fetchCourses = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await getCourses({
        page,
        limit: pageSize,
        search: courseFilter || undefined,
      })
      setCourses(response.courses)
      setTotal(response.pagination.total)
    } catch (err: any) {
      console.error('Error fetching courses:', err)
      setError(err.message || 'Failed to load courses')
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, courseFilter])

  useEffect(() => {
    fetchCourses()
  }, [fetchCourses])

  // Fetch packages for dropdown
  useEffect(() => {
    const fetchPackages = async () => {
      try {
        // Fetch all packages (both active and inactive) so we can show the current package even if inactive
        const response = await getPackages({ limit: 100 })
        setPackages(response.items || [])
      } catch (err: any) {
        console.error('Error fetching packages:', err)
        // Don't show error to user - packages are optional for course creation
        // If packages fail to load, user can still create courses without package_id
        setPackages([])
        // Only log error, don't set it as blocking error
        console.warn('Packages could not be loaded. Course creation will continue without package selection.')
      }
    }
    fetchPackages()
  }, [])

  const handleAddNew = () => {
    setEditingCourseId(null)
    setFormData({
      title: '',
      short_description: '',
      long_description: '',
      price: '',
      original_price: '',
      package_id: '',
      language: 'HINDI',
      level: 'BEGINNER',
      category: '',
      thumbnail_url: '',
      is_published: false,
    })
    setFormErrors({})
    setIsModalOpen(true)
  }

  const handleEdit = async (courseId: string) => {
    try {
      setIsLoading(true)
      const courseDetail = await getCourseById(courseId)
      const course = courseDetail.course
      
      // If course has a package_id but it's not in our packages list, fetch it
      if (course.package_id) {
        const packageExists = packages.some(pkg => pkg.id === course.package_id)
        if (!packageExists) {
          // Package might be inactive or not loaded, try to fetch all packages again
          try {
            const allPackagesResponse = await getPackages({ limit: 100 })
            setPackages(allPackagesResponse.items || [])
          } catch (pkgErr) {
            console.warn('Could not fetch all packages:', pkgErr)
          }
        }
      }
      
      setEditingCourseId(courseId)
      setFormData({
        title: course.title,
        short_description: course.short_description || '',
        long_description: course.long_description || '',
        price: course.price.toString(),
        original_price: course.original_price ? course.original_price.toString() : '',
        package_id: course.package_id ? course.package_id.toString() : '',
        language: course.language as 'HINDI' | 'ENGLISH' | 'BILINGUAL',
        level: course.level as 'BASIC' | 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT' | 'PROFESSIONAL',
        category: course.category,
        thumbnail_url: course.thumbnail_url || '',
        is_published: course.is_published,
      })
      setThumbnailPreview(course.thumbnail_url || null)
      setThumbnailFile(null)
      setFormErrors({})
      setIsModalOpen(true)
    } catch (err: any) {
      console.error('Error loading course:', err)
      setError(err.message || 'Failed to load course')
    } finally {
      setIsLoading(false)
    }
  }

  const handleView = async (courseId: string) => {
    try {
      setIsLoading(true)
      const courseDetail = await getCourseById(courseId)
      setViewingCourse(courseDetail.course)
      setIsViewModalOpen(true)
    } catch (err: any) {
      console.error('Error loading course:', err)
      setError(err.message || 'Failed to load course')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (courseId: string) => {
    if (!confirm('Are you sure you want to delete this course? This action cannot be undone.')) {
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      await deleteCourse(courseId)
      fetchCourses() // Refresh the list
    } catch (err: any) {
      console.error('Error deleting course:', err)
      setError(err.message || 'Failed to delete course')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingCourseId(null)
    setFormData({
      title: '',
      short_description: '',
      long_description: '',
      price: '',
      original_price: '',
      package_id: '',
      language: 'HINDI',
      level: 'BEGINNER',
      category: '',
      thumbnail_url: '',
      is_published: false,
    })
    setFormErrors({})
    setThumbnailFile(null)
    setThumbnailPreview(null)
  }
  
  const handleThumbnailFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setThumbnailFile(null)
      setThumbnailPreview(null)
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

    setThumbnailFile(file)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setThumbnailPreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    // Upload file immediately
    setIsUploadingThumbnail(true)
    try {
      const result = await uploadCourseThumbnail(file)
      setFormData({ ...formData, thumbnail_url: result.thumbnail_url })
      setThumbnailPreview(result.thumbnail_url)
    } catch (err: any) {
      console.error('Error uploading thumbnail:', err)
      alert(err?.message || 'Failed to upload thumbnail image')
      setThumbnailFile(null)
      setThumbnailPreview(null)
      e.target.value = ''
    } finally {
      setIsUploadingThumbnail(false)
    }
  }

  const handleSave = async () => {
    // Validate form
    const errors: Record<string, string> = {}
    if (!formData.title.trim()) errors.title = 'Title is required'
    if (!formData.price.trim()) errors.price = 'Price is required'
    if (!formData.package_id) errors.package_id = 'Package is required'
    if (!formData.category.trim()) errors.category = 'Category is required'
    
    if (formData.price && isNaN(parseFloat(formData.price))) {
      errors.price = 'Price must be a valid number'
    }
    if (formData.original_price && isNaN(parseFloat(formData.original_price))) {
      errors.original_price = 'Original price must be a valid number'
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)
      
      if (editingCourseId) {
        // Update existing course
        const updateData: any = {
          title: formData.title.trim(),
          price: parseFloat(formData.price),
          package_id: parseInt(formData.package_id, 10),
          language: formData.language,
          level: formData.level,
          category: formData.category.trim(),
          is_published: formData.is_published,
        }
        
        // Only include optional fields if they have values
        if (formData.short_description.trim()) {
          updateData.short_description = formData.short_description.trim()
        }
        if (formData.long_description.trim()) {
          updateData.long_description = formData.long_description.trim()
        }
        if (formData.original_price && formData.original_price.trim()) {
          updateData.original_price = parseFloat(formData.original_price)
        }
        if (formData.thumbnail_url.trim()) {
          // Only include thumbnail_url if it's a valid URL
          try {
            new URL(formData.thumbnail_url.trim())
            updateData.thumbnail_url = formData.thumbnail_url.trim()
          } catch {
            // Invalid URL, skip it
          }
        }
        
        await updateCourse(editingCourseId, updateData)
      } else {
        // Create new course
        await createCourse({
          title: formData.title.trim(),
          short_description: formData.short_description.trim() || undefined,
          long_description: formData.long_description.trim() || undefined,
          price: parseFloat(formData.price),
          original_price: formData.original_price ? parseFloat(formData.original_price) : undefined,
          package_id: parseInt(formData.package_id, 10),
          language: formData.language,
          level: formData.level,
          category: formData.category.trim(),
          thumbnail_url: formData.thumbnail_url.trim() || undefined,
          is_published: formData.is_published,
        })
      }

      handleCloseModal()
      fetchCourses() // Refresh the list
    } catch (err: any) {
      console.error('Error saving course:', err)
      setError(err.message || 'Failed to save course')
    } finally {
      setIsSubmitting(false)
    }
  }

  const columns: Array<DataTableColumn<Row>> = useMemo(() => [
    { key: 'course_name', title: 'course_name' },
    { key: 'course_details', title: 'course_details' },
    { key: 'library_id', title: 'library_id' },
    { key: 'course_status', title: 'course_status', render: (r: Row) => (
      <span className={
        r.course_status === 'Active'
          ? 'px-2 py-1 rounded text-xs font-semibold bg-[#d4edda] text-[#155724]'
          : 'px-2 py-1 rounded text-xs font-semibold bg-[#f8d7da] text-[#721c24]'
      }>{r.course_status}</span>
    ) },
    { key: 'created_at', title: 'created_at' },
  ], [])

  // Map courses to rows format
  const rows: Row[] = useMemo(() => {
    return courses.map(course => ({
      course_name: course.title,
      course_details: course.short_description || course.long_description || '-',
      library_id: course.id, // Using course ID as library_id
      course_status: course.is_published ? 'Active' : 'Inactive',
      created_at: new Date(course.created_at).toLocaleDateString('en-IN'),
    }))
  }, [courses])

  const handleExport = () => {
    if (!rows.length) {
      alert('No course data available to export.')
      return
    }

    const headers = ['course_name', 'course_details', 'library_id', 'course_status', 'created_at']
    const data = rows.map(row => [
      row.course_name,
      row.course_details,
      row.library_id,
      row.course_status,
      row.created_at,
    ])

    exportToCsv('course-modules.csv', headers, data)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <Card
      title="Course Module Management"
      toolbarRight={
        <>
          <Button variant="outline" size="md" aria-label="Add New Course" onClick={handleAddNew}>Add New Course</Button>
          <Button variant="outline" size="md" aria-label="Export" onClick={handleExport}>Export</Button>
          <Button variant="outline" size="md" aria-label="Print" onClick={handlePrint}>Print</Button>
        </>
      }
    >
      <DataTable<Row>
        columns={columns}
        rows={rows}
        renderActions={(row: Row) => {
          const courseId = row.library_id
          return (
            <div className="flex items-center gap-1">
              <EditButton onClick={() => handleEdit(courseId)} />
              <DeleteButton onClick={() => handleDelete(courseId)} />
              <ViewButton onClick={() => handleView(courseId)} />
            </div>
          )
        }}
        minWidthPx={1200}
      />

      {error && !error.includes('Failed to load packages') && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 font-semibold">Error: {error}</p>
          <button
            onClick={fetchCourses}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="text-gray-600">Loading courses...</div>
        </div>
      ) : (
        <>
          <FiltersBar>
            <TextInput id="course-name-filter" label="Filter by Course Name:" value={courseFilter} onChange={setCourseFilter} placeholder="Enter course name..." />
            <PrimaryButton type="button" onClick={fetchCourses}>Search</PrimaryButton>
            <SecondaryButton type="button" onClick={() => {
              setCourseFilter('')
              setPage(1)
            }}>Clear filtering</SecondaryButton>
          </FiltersBar>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize)
              setPage(1)
            }}
            pageSizeOptions={[10, 25, 50]}
          />
        </>
      )}

      {/* Add Course Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingCourseId ? 'Edit Course' : 'Add New Course'}
        size="lg"
        footer={
          <>
            <Button variant="outline" size="md" onClick={handleCloseModal} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting ? (editingCourseId ? 'Updating...' : 'Creating...') : (editingCourseId ? 'Update Course' : 'Create Course')}
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
          <div className="grid grid-cols-2 gap-4">
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
                placeholder="e.g., Complete Web Development"
                className={`px-3 py-2.5 border rounded-md ${
                  formErrors.title ? 'border-red-500' : 'border-[#ccc]'
                }`}
              />
              {formErrors.title && <span className="text-red-500 text-sm">{formErrors.title}</span>}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="category" className="font-semibold">
                Category <span className="text-red-500">*</span>
              </label>
              <input
                id="category"
                type="text"
                required
                value={formData.category}
                onChange={(e) => {
                  setFormData({ ...formData, category: e.target.value })
                  setFormErrors({ ...formErrors, category: '' })
                }}
                placeholder="e.g., Programming, Business"
                className={`px-3 py-2.5 border rounded-md ${
                  formErrors.category ? 'border-red-500' : 'border-[#ccc]'
                }`}
              />
              {formErrors.category && <span className="text-red-500 text-sm">{formErrors.category}</span>}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="short_description" className="font-semibold">
              Short Description
            </label>
            <textarea
              id="short_description"
              value={formData.short_description}
              onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
              placeholder="Brief description of the course"
              rows={2}
              className="px-3 py-2.5 border border-[#ccc] rounded-md"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="long_description" className="font-semibold">
              Long Description
            </label>
            <textarea
              id="long_description"
              value={formData.long_description}
              onChange={(e) => setFormData({ ...formData, long_description: e.target.value })}
              placeholder="Detailed description of the course"
              rows={4}
              className="px-3 py-2.5 border border-[#ccc] rounded-md"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="price" className="font-semibold">
                Price <span className="text-red-500">*</span>
              </label>
              <input
                id="price"
                type="number"
                step="0.01"
                required
                value={formData.price}
                onChange={(e) => {
                  setFormData({ ...formData, price: e.target.value })
                  setFormErrors({ ...formErrors, price: '' })
                }}
                placeholder="0.00"
                className={`px-3 py-2.5 border rounded-md ${
                  formErrors.price ? 'border-red-500' : 'border-[#ccc]'
                }`}
              />
              {formErrors.price && <span className="text-red-500 text-sm">{formErrors.price}</span>}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="original_price" className="font-semibold">
                Original Price
              </label>
              <input
                id="original_price"
                type="number"
                step="0.01"
                value={formData.original_price}
                onChange={(e) => {
                  setFormData({ ...formData, original_price: e.target.value })
                  setFormErrors({ ...formErrors, original_price: '' })
                }}
                placeholder="0.00"
                className={`px-3 py-2.5 border rounded-md ${
                  formErrors.original_price ? 'border-red-500' : 'border-[#ccc]'
                }`}
              />
              {formErrors.original_price && <span className="text-red-500 text-sm">{formErrors.original_price}</span>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="package_id" className="font-semibold">
                Package <span className="text-red-500">*</span>
              </label>
              <select
                id="package_id"
                required
                value={formData.package_id}
                onChange={(e) => {
                  setFormData({ ...formData, package_id: e.target.value })
                  setFormErrors({ ...formErrors, package_id: '' })
                }}
                className={`px-3 py-2.5 border rounded-md ${
                  formErrors.package_id ? 'border-red-500' : 'border-[#ccc]'
                }`}
              >
                <option value="">Select a package</option>
                {/* Show active packages first, then inactive */}
                {packages
                  .sort((a, b) => {
                    // Sort: active packages first, then by name
                    if (a.status === 'active' && b.status === 'inactive') return -1
                    if (a.status === 'inactive' && b.status === 'active') return 1
                    return a.name.localeCompare(b.name)
                  })
                  .map((pkg) => (
                    <option key={pkg.id} value={pkg.id.toString()}>
                      {pkg.name} - ₹{pkg.price} {pkg.status === 'inactive' ? '(Inactive)' : ''}
                  </option>
                ))}
              </select>
              {formData.package_id && !packages.some(pkg => pkg.id.toString() === formData.package_id) && (
                <span className="text-yellow-600 text-sm">
                  ⚠️ Current package not found in list. It may have been deleted or is inactive.
                </span>
              )}
              {packages.length === 0 && (
                <span className="text-red-500 text-sm">
                  No packages available. Please create packages first.
                </span>
              )}
              {formErrors.package_id && <span className="text-red-500 text-sm">{formErrors.package_id}</span>}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="language" className="font-semibold">
                Language <span className="text-red-500">*</span>
              </label>
              <select
                id="language"
                required
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value as any })}
                className="px-3 py-2.5 border border-[#ccc] rounded-md"
              >
                <option value="HINDI">Hindi</option>
                <option value="ENGLISH">English</option>
                <option value="BILINGUAL">Bilingual</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="level" className="font-semibold">
                Level <span className="text-red-500">*</span>
              </label>
              <select
                id="level"
                required
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: e.target.value as any })}
                className="px-3 py-2.5 border border-[#ccc] rounded-md"
              >
                <option value="BASIC">Basic</option>
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
                <option value="EXPERT">Expert</option>
                <option value="PROFESSIONAL">Professional</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="thumbnail_file" className="font-semibold">
                Thumbnail Image
              </label>
              <input
                id="thumbnail_file"
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleThumbnailFileSelect}
                disabled={isUploadingThumbnail}
                className="px-3 py-2.5 border border-[#ccc] rounded-md"
              />
              {isUploadingThumbnail && (
                <p className="text-sm text-blue-600">Uploading thumbnail...</p>
              )}
              {thumbnailPreview && (
                <div className="mt-2">
                  <img 
                    src={thumbnailPreview} 
                    alt="Thumbnail preview" 
                    className="max-w-xs rounded border border-gray-300"
                  />
                </div>
              )}
              {formData.thumbnail_url && !thumbnailPreview && (
                <div className="mt-2">
                  <p className="text-sm text-gray-600 mb-1">Current thumbnail:</p>
                  <img 
                    src={formData.thumbnail_url} 
                    alt="Current thumbnail" 
                    className="max-w-xs rounded border border-gray-300"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="is_published"
              type="checkbox"
              checked={formData.is_published}
              onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="is_published" className="font-semibold">
              Publish immediately
            </label>
          </div>
        </form>
      </Modal>

      {/* View Course Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false)
          setViewingCourse(null)
        }}
        title="Course Details"
        size="lg"
        footer={
          <Button variant="outline" size="md" onClick={() => {
            setIsViewModalOpen(false)
            setViewingCourse(null)
          }}>
            Close
          </Button>
        }
      >
        {viewingCourse && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-gray-700">Title:</label>
                <p className="mt-1">{viewingCourse.title}</p>
              </div>
              <div>
                <label className="font-semibold text-gray-700">Category:</label>
                <p className="mt-1">{viewingCourse.category}</p>
              </div>
              <div>
                <label className="font-semibold text-gray-700">Price:</label>
                <p className="mt-1">₹{viewingCourse.price.toLocaleString()}</p>
              </div>
              {viewingCourse.original_price && (
                <div>
                  <label className="font-semibold text-gray-700">Original Price:</label>
                  <p className="mt-1">₹{viewingCourse.original_price.toLocaleString()}</p>
                </div>
              )}
              <div>
                <label className="font-semibold text-gray-700">Language:</label>
                <p className="mt-1">{viewingCourse.language}</p>
              </div>
              <div>
                <label className="font-semibold text-gray-700">Level:</label>
                <p className="mt-1">{viewingCourse.level}</p>
              </div>
              <div>
                <label className="font-semibold text-gray-700">Status:</label>
                <p className="mt-1">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    viewingCourse.is_published
                      ? 'bg-[#d4edda] text-[#155724]'
                      : 'bg-[#f8d7da] text-[#721c24]'
                  }`}>
                    {viewingCourse.is_published ? 'Active' : 'Inactive'}
                  </span>
                </p>
              </div>
              <div>
                <label className="font-semibold text-gray-700">Package ID:</label>
                <p className="mt-1">{viewingCourse.package_id || 'N/A'}</p>
              </div>
            </div>
            {viewingCourse.short_description && (
              <div>
                <label className="font-semibold text-gray-700">Short Description:</label>
                <p className="mt-1">{viewingCourse.short_description}</p>
              </div>
            )}
            {viewingCourse.long_description && (
              <div>
                <label className="font-semibold text-gray-700">Long Description:</label>
                <p className="mt-1">{viewingCourse.long_description}</p>
              </div>
            )}
            {viewingCourse.thumbnail_url && (
              <div>
                <label className="font-semibold text-gray-700">Thumbnail:</label>
                <img src={viewingCourse.thumbnail_url} alt={viewingCourse.title} className="mt-1 max-w-xs rounded" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <label className="font-semibold text-gray-700">Total Modules:</label>
                <p className="mt-1">{viewingCourse.module_count || 0}</p>
              </div>
              <div>
                <label className="font-semibold text-gray-700">Total Videos:</label>
                <p className="mt-1">{viewingCourse.video_count || 0}</p>
              </div>
              <div>
                <label className="font-semibold text-gray-700">Total Lessons:</label>
                <p className="mt-1">{viewingCourse.total_lessons || 0}</p>
              </div>
              <div>
                <label className="font-semibold text-gray-700">Total Duration:</label>
                <p className="mt-1">{Math.floor((viewingCourse.total_duration || 0) / 60)} minutes</p>
              </div>
            </div>
            <div className="pt-4 border-t">
              <label className="font-semibold text-gray-700">Created At:</label>
              <p className="mt-1">{new Date(viewingCourse.created_at).toLocaleString()}</p>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  )
}