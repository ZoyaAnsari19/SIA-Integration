"use client"

import React, { useMemo, useState, useEffect, useCallback } from 'react'
import Card, { ToolbarButton } from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton } from '../../../components/ui/FiltersBar'
import { EditButton, DeleteButton, ViewButton } from '../../../components/ui/ActionButtons'
import Pagination from '../../../components/ui/Pagination'
import Modal from '../../../components/ui/Modal'
import Button from '../../../components/ui/Button'
import { getAllVideos, getCourses, getCourseById, createModule, createVideo, updateVideo, deleteVideo, uploadCourseVideo, uploadCourseVideoDirect, type Course, type CourseModule, type CourseVideo } from '../../../lib/api/courses'
import { exportToCsv } from '../../../lib/export'

type Row = {
  course_id: string
  topic_name: string
  topic_vedio_id: string
}

// Helper function to format duration in readable format
const formatDuration = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return '0 seconds'
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`)
  
  return parts.join(' ')
}

export default function CourseVediosPage() {
  const [courseFilter, setCourseFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [videos, setVideos] = useState<any[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null)
  const [viewingVideo, setViewingVideo] = useState<any | null>(null)
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [modules, setModules] = useState<CourseModule[]>([])
  const [showCreateModule, setShowCreateModule] = useState(false)
  const [newModuleTitle, setNewModuleTitle] = useState('')
  const [newModuleOrder, setNewModuleOrder] = useState('1')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [isUploadingVideo, setIsUploadingVideo] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isExtractingDuration, setIsExtractingDuration] = useState(false)
  const [uploadAbort, setUploadAbort] = useState<(() => void) | null>(null)
  const [formData, setFormData] = useState({
    course_id: '',
    module_id: '',
    title: '',
    description: '',
    video_url: '',
    video_provider: 'BUNNY',
    duration_seconds: '',
    order_index: '1',
    is_preview: false,
    is_published: true,
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Fetch courses for dropdown
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await getCourses({ page: 1, limit: 100 })
        setCourses(response.courses)
      } catch (err) {
        console.error('Error fetching courses:', err)
      }
    }
    fetchCourses()
  }, [])

  const fetchVideos = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await getAllVideos({
        page,
        limit: pageSize,
        courseId: courseFilter || undefined,
      })
      setVideos(response.videos)
      setTotal(response.pagination.total)
    } catch (err: any) {
      console.error('Error fetching videos:', err)
      setError(err.message || 'Failed to load videos')
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, courseFilter])

  useEffect(() => {
    fetchVideos()
  }, [fetchVideos])

  // Fetch modules when course is selected
  useEffect(() => {
    const fetchModules = async () => {
      if (selectedCourseId) {
        try {
          const courseDetail = await getCourseById(selectedCourseId)
          // Map modules to CourseModule format
          const mappedModules: CourseModule[] = (courseDetail.course.modules || []).map((m: any) => ({
            id: m.id,
            course_id: selectedCourseId,
            title: m.title,
            description: m.description || null,
            order_index: m.order_index || 0,
            created_at: '',
            updated_at: '',
          }))
          setModules(mappedModules)
        } catch (err) {
          console.error('Error fetching modules:', err)
          setModules([])
        }
      } else {
        setModules([])
      }
    }
    fetchModules()
  }, [selectedCourseId])

  const handleAddNew = () => {
    setEditingVideoId(null)
    setFormData({
      course_id: '',
      module_id: '',
      title: '',
      description: '',
      video_url: '',
      video_provider: 'BUNNY',
      duration_seconds: '',
      order_index: '1',
      is_preview: false,
      is_published: true,
    })
    setFormErrors({})
    setSelectedCourseId('')
    setShowCreateModule(false)
    setNewModuleTitle('')
    setNewModuleOrder('1')
    setIsModalOpen(true)
  }

  const handleEdit = async (videoId: string) => {
    try {
      setIsLoading(true)
      // Find video from current videos list
      const video = videos.find(v => v.id === videoId)
      if (!video) {
        setError('Video not found')
        return
      }

      // Load course detail to get modules
      const courseDetail = await getCourseById(video.course_id)
      // Map modules to CourseModule format
      const mappedModules: CourseModule[] = (courseDetail.course.modules || []).map((m: any) => ({
        id: m.id,
        course_id: video.course_id,
        title: m.title,
        description: m.description || null,
        order_index: m.order_index || 0,
        created_at: '',
        updated_at: '',
      }))
      setModules(mappedModules)
      
      setEditingVideoId(videoId)
      setSelectedCourseId(video.course_id)
      setFormData({
        course_id: video.course_id,
        module_id: video.module_id,
        title: video.title,
        description: video.description || '',
        video_url: video.video_url,
        video_provider: video.video_provider || 'BUNNY',
        duration_seconds: video.duration_seconds?.toString() || '',
        order_index: video.order_index?.toString() || '1',
        is_preview: video.is_preview || false,
        is_published: video.is_published !== undefined ? video.is_published : true,
      })
      setVideoFile(null)
      setIsUploadingVideo(false)
      setFormErrors({})
      setIsModalOpen(true)
    } catch (err: any) {
      console.error('Error loading video:', err)
      setError(err.message || 'Failed to load video')
    } finally {
      setIsLoading(false)
    }
  }

  const handleView = async (videoId: string) => {
    try {
      setIsLoading(true)
      // Find video from current videos list
      const video = videos.find(v => v.id === videoId)
      if (!video) {
        setError('Video not found')
        return
      }
      setViewingVideo(video)
      setIsViewModalOpen(true)
    } catch (err: any) {
      console.error('Error loading video:', err)
      setError(err.message || 'Failed to load video')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (videoId: string) => {
    if (!confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      // Find video from current videos list
      const video = videos.find(v => v.id === videoId)
      if (!video) {
        setError('Video not found')
        return
      }

      try {
        await deleteVideo(videoId)
      } catch (err: any) {
        console.error('Error deleting video from API:', err)
        // If backend route is missing or returns 404, treat as already-deleted
        if (err?.message?.includes('Resource not found')) {
          console.warn('Video not found on server, removing from UI list only.')
        } else {
          throw err
        }
      }

      // Optimistically remove from local list so UI stays in sync
      setVideos(prev => prev.filter(v => v.id !== videoId))
    } catch (err: any) {
      console.error('Error deleting video:', err)
      setError(err.message || 'Failed to delete video')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCloseModal = () => {
    // If upload is in progress, ask for confirmation
    if (isUploadingVideo && uploadAbort) {
      const confirmed = window.confirm(
        'Video upload is in progress. Do you want to cancel the upload and close this form?\n\n' +
        '⚠️ Warning: Cancelling will stop the upload and the video will not be saved.'
      )
      
      if (confirmed) {
        // Cancel the upload
        uploadAbort()
        console.log('🛑 Upload cancelled by user')
        setIsUploadingVideo(false)
        setUploadProgress(0)
        setUploadAbort(null)
      } else {
        // User chose not to cancel, keep modal open
        return
      }
    }
    
    // Clean up and close modal
    setIsModalOpen(false)
    setEditingVideoId(null)
    setFormData({
      course_id: '',
      module_id: '',
      title: '',
      description: '',
      video_url: '',
      video_provider: 'BUNNY',
      duration_seconds: '',
      order_index: '1',
      is_preview: false,
      is_published: true,
    })
    setFormErrors({})
    setSelectedCourseId('')
    setShowCreateModule(false)
    setNewModuleTitle('')
    setNewModuleOrder('1')
    setVideoFile(null)
    setIsUploadingVideo(false)
    setUploadProgress(0)
    setUploadAbort(null)
    setIsExtractingDuration(false)
  }

  const handleVideoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setVideoFile(null)
      setFormData(prev => ({ ...prev, duration_seconds: '', video_url: '' }))
      return
    }

    // Validate file type
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Allowed: MP4, WebM, MOV, AVI')
      e.target.value = ''
      setFormData(prev => ({ ...prev, duration_seconds: '', video_url: '' }))
      return
    }

    // Validate file size (5GB max for admin uploads)
    const maxSizeMB = 5000 // 5GB limit
    if (file.size > maxSizeMB * 1024 * 1024) {
      alert(`File too large. Maximum size: ${maxSizeMB}MB (5GB)`)
      e.target.value = ''
      setFormData(prev => ({ ...prev, duration_seconds: '', video_url: '' }))
      return
    }

    // Check if course and module are selected
    if (!formData.course_id || !formData.module_id) {
      alert('Please select course and module first')
      e.target.value = ''
      setFormData(prev => ({ ...prev, duration_seconds: '', video_url: '' }))
      return
    }

    setVideoFile(file)
    setIsExtractingDuration(true)
    // Clear previous duration while extracting new one
    setFormData(prev => ({ ...prev, duration_seconds: '', video_url: '' }))

    // Extract video duration from file metadata
    const extractVideoDuration = (videoFile: File): Promise<number> => {
      return new Promise((resolve, reject) => {
        const video = document.createElement('video')
        video.preload = 'metadata'
        video.muted = true // Mute to avoid autoplay issues
        video.playsInline = true
        
        const blobUrl = URL.createObjectURL(videoFile)
        let timeout: NodeJS.Timeout
        let resolved = false
        
        const cleanup = () => {
          if (timeout) clearTimeout(timeout)
          window.URL.revokeObjectURL(blobUrl)
          video.remove()
        }
        
        const handleSuccess = (duration: number) => {
          if (resolved) return
          resolved = true
          clearTimeout(timeout)
          cleanup()
          resolve(duration)
        }
        
        const handleError = (error: Error) => {
          if (resolved) return
          resolved = true
          clearTimeout(timeout)
          cleanup()
          reject(error)
        }
        
        // Set timeout for large files (30 seconds)
        timeout = setTimeout(() => {
          handleError(new Error('Timeout loading video metadata'))
        }, 30000)
        
        video.onloadedmetadata = () => {
          try {
            let duration = video.duration
            console.log('📹 Video metadata loaded, raw duration:', duration)
            
            // Check if duration is immediately available and valid
            if (!isNaN(duration) && isFinite(duration) && duration > 0) {
              const roundedDuration = Math.round(duration)
              console.log('✅ Duration available immediately:', roundedDuration, 'seconds')
              handleSuccess(roundedDuration)
              return
            }
            
            // Sometimes duration is NaN initially, try seeking to end
            console.log('⏳ Duration not available, trying to seek to end...')
            let seekTimeout: NodeJS.Timeout
            
            video.onseeked = () => {
              if (seekTimeout) clearTimeout(seekTimeout)
              duration = video.duration
              console.log('📹 After seek, duration:', duration)
              
              if (isNaN(duration) || !isFinite(duration) || duration <= 0) {
                handleError(new Error('Invalid video duration after seek'))
                return
              }
              
              const roundedDuration = Math.round(duration)
              console.log('✅ Rounded duration:', roundedDuration, 'seconds')
              handleSuccess(roundedDuration)
            }
            
            // Set timeout for seek operation
            seekTimeout = setTimeout(() => {
              // If seek takes too long, try with available duration
              if (!isNaN(video.duration) && isFinite(video.duration) && video.duration > 0) {
                const roundedDuration = Math.round(video.duration)
                console.log('✅ Duration after seek timeout:', roundedDuration, 'seconds')
                handleSuccess(roundedDuration)
              } else {
                handleError(new Error('Could not determine video duration'))
              }
            }, 5000)
            
            // Try to seek to end to force duration calculation
            video.currentTime = 1e10 // Large number to seek to end
          } catch (err: any) {
            handleError(err)
          }
        }
        
        video.onerror = (e) => {
          console.error('Video load error:', e, video.error)
          handleError(new Error('Failed to load video metadata'))
        }
        
        // Set source and load
        video.src = blobUrl
        video.load()
      })
    }

    // Extract duration first (before upload) - wait for it to complete
    try {
      console.log('🎬 Starting duration extraction from video file:', file.name, 'Size:', (file.size / 1024 / 1024).toFixed(2), 'MB')
      const duration = await extractVideoDuration(file)
      console.log('✅ Duration extracted successfully:', duration, 'seconds')
      
      // Auto-fill duration field immediately
      if (duration > 0 && !isNaN(duration) && isFinite(duration)) {
        const durationString = Math.round(duration).toString()
        console.log('📝 Setting duration field to:', durationString)
        
        // Force state update - use both direct update and functional update
        setFormData(prev => {
          const updated = { ...prev, duration_seconds: durationString }
          console.log('📝 Form data updated with duration:', updated.duration_seconds)
          // Force re-render by returning new object
          return { ...updated }
        })
        setFormErrors(prev => ({ ...prev, duration_seconds: '' }))
        
        // Double-check the update worked
        setTimeout(() => {
          setFormData(current => {
            if (current.duration_seconds !== durationString) {
              console.log('⚠️ Duration not set, retrying...')
              return { ...current, duration_seconds: durationString }
            }
            return current
          })
        }, 200)
        
        console.log('✅ Duration field updated successfully')
      } else {
        console.warn('⚠️ Invalid duration extracted:', duration)
      }
    } catch (err: any) {
      console.error('❌ Could not extract video duration:', err)
      // Don't block upload - user can enter manually
    } finally {
      setIsExtractingDuration(false)
    }

    // Start upload after duration extraction completes
    setIsUploadingVideo(true)
    setUploadProgress(0)

    try {
      // Use direct upload for faster uploads with progress tracking
      const { promise, abort } = uploadCourseVideoDirect(
        formData.course_id,
        formData.module_id,
        file,
        (progress) => {
          setUploadProgress(progress)
        }
      )
      
      // Store abort function so we can cancel if needed
      setUploadAbort(() => abort)
      
      const result = await promise
      
      // If duration wasn't extracted before, try extracting from uploaded URL
      if (!formData.duration_seconds || formData.duration_seconds === '0') {
        console.log('Duration not found, trying to extract from uploaded video URL...')
        setIsExtractingDuration(true)
        try {
          const extractFromUrl = (videoUrl: string): Promise<number> => {
            return new Promise((resolve, reject) => {
              const video = document.createElement('video')
              video.preload = 'metadata'
              video.muted = true
              video.crossOrigin = 'anonymous'
              
              let timeout: NodeJS.Timeout
              timeout = setTimeout(() => {
                video.remove()
                reject(new Error('Timeout'))
              }, 30000)
              
              video.onloadedmetadata = () => {
                clearTimeout(timeout)
                const duration = Math.round(video.duration)
                video.remove()
                resolve(duration)
              }
              
              video.onerror = () => {
                clearTimeout(timeout)
                video.remove()
                reject(new Error('Failed to load'))
              }
              
              video.src = videoUrl
              video.load()
            })
          }
          
          const duration = await extractFromUrl(result.video_url)
          if (duration > 0) {
            setFormData(prev => ({ ...prev, duration_seconds: duration.toString() }))
            console.log('Duration extracted from uploaded video:', duration)
          }
        } catch (err) {
          console.warn('Could not extract duration from uploaded video:', err)
        } finally {
          setIsExtractingDuration(false)
        }
      }
      
      setFormData(prev => ({ ...prev, video_url: result.video_url }))
      setFormErrors(prev => ({ ...prev, video_url: '' }))
      setUploadProgress(100)
      setUploadAbort(null) // Clear abort function after successful upload
    } catch (err: any) {
      console.error('Error uploading video:', err)
      
      // Don't show alert if upload was cancelled by user
      if (err?.message !== 'Upload cancelled') {
        alert(err?.message || 'Failed to upload video file')
      }
      
      setFormData(prev => ({ ...prev, video_url: '' }))
      e.target.value = ''
      setUploadProgress(0)
      setUploadAbort(null)
    } finally {
      setIsUploadingVideo(false)
      // Reset progress after a short delay (only if not cancelled)
      if (uploadProgress > 0) {
        setTimeout(() => setUploadProgress(0), 2000)
      }
    }
  }

  const handleCreateModule = async () => {
    if (!newModuleTitle.trim() || !selectedCourseId) {
      alert('Please enter module title and select a course')
      return
    }

    try {
      setIsSubmitting(true)
      const response = await createModule(selectedCourseId, {
        title: newModuleTitle.trim(),
        description: '',
        order_index: parseInt(newModuleOrder, 10),
      })
      setModules([...modules, response.module])
      setFormData({ ...formData, module_id: response.module.id })
      setShowCreateModule(false)
      setNewModuleTitle('')
      setNewModuleOrder('1')
      alert('Module created successfully!')
    } catch (err: any) {
      console.error('Error creating module:', err)
      alert(err.message || 'Failed to create module')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSave = async () => {
    // Validate form
    const errors: Record<string, string> = {}
    if (!formData.course_id) errors.course_id = 'Course is required'
    if (!formData.module_id) errors.module_id = 'Module is required'
    if (!formData.title.trim()) errors.title = 'Title is required'
    if (!formData.video_url.trim()) errors.video_url = 'Video URL is required'
    if (!formData.duration_seconds) errors.duration_seconds = 'Duration is required'
    if (formData.duration_seconds && isNaN(parseInt(formData.duration_seconds, 10))) {
      errors.duration_seconds = 'Duration must be a valid number'
    }
    if (formData.order_index && isNaN(parseInt(formData.order_index, 10))) {
      errors.order_index = 'Order index must be a valid number'
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)
      
      if (editingVideoId) {
        // Update existing video
        const video = videos.find(v => v.id === editingVideoId)
        if (!video) {
          setError('Video not found')
          return
        }
        
        const durationSeconds = parseInt(formData.duration_seconds, 10)
        if (isNaN(durationSeconds) || durationSeconds < 0) {
          setFormErrors({ ...formErrors, duration_seconds: 'Duration must be a valid number' })
          return
        }
        
        await updateVideo(video.course_id, video.module_id, editingVideoId, {
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          video_url: formData.video_url.trim(),
          duration_seconds: durationSeconds,
          order_index: parseInt(formData.order_index, 10),
        })
      } else {
        // Create new video
        const durationSeconds = parseInt(formData.duration_seconds, 10)
        if (isNaN(durationSeconds) || durationSeconds < 0) {
          setFormErrors({ ...formErrors, duration_seconds: 'Duration must be a valid number' })
          return
        }
        
        await createVideo(formData.course_id, formData.module_id, {
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          video_url: formData.video_url.trim(),
          duration_seconds: durationSeconds,
          order_index: parseInt(formData.order_index, 10),
        })
      }

      handleCloseModal()
      fetchVideos() // Refresh the list
    } catch (err: any) {
      console.error('Error saving video:', err)
      setError(err.message || 'Failed to save video')
    } finally {
      setIsSubmitting(false)
    }
  }

  const columns: Array<DataTableColumn<Row>> = useMemo(() => [
    { key: 'course_id', title: 'course_id' },
    { key: 'topic_name', title: 'topic_name' },
    { key: 'topic_vedio_id', title: 'topic vedio_id' },
  ], [])

  // Map videos to rows format
  const rows: Row[] = useMemo(() => {
    return videos.map(video => ({
      course_id: video.course_id,
      topic_name: video.title,
      topic_vedio_id: video.id,
    }))
  }, [videos])

  const handleExport = () => {
    if (!rows.length) {
      alert('No video data available to export.')
      return
    }

    const headers = ['course_id', 'topic_name', 'topic_vedio_id']
    const data = rows.map(row => [row.course_id, row.topic_name, row.topic_vedio_id])

    exportToCsv('course-videos.csv', headers, data)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <Card
      title="Course Videos Management"
      toolbarRight={
        <>
          <ToolbarButton aria-label="Add New Video" onClick={handleAddNew}>Add New Video</ToolbarButton>
          <ToolbarButton aria-label="Export" onClick={handleExport}>Export</ToolbarButton>
          <ToolbarButton aria-label="Print" onClick={handlePrint}>Print</ToolbarButton>
        </>
      }
    >
      <DataTable<Row>
        columns={columns}
        rows={rows}
        renderActions={(row: Row) => {
          const videoId = row.topic_vedio_id
          return (
            <div className="flex items-center gap-1">
              <EditButton onClick={() => handleEdit(videoId)} />
              <DeleteButton onClick={() => handleDelete(videoId)} />
              <ViewButton onClick={() => handleView(videoId)} />
            </div>
          )
        }}
        minWidthPx={800}
      />

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 font-semibold">Error: {error}</p>
          <button
            onClick={fetchVideos}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="text-gray-600">Loading videos...</div>
        </div>
      ) : (
        <>
          <FiltersBar>
            <div className="flex items-center gap-2">
              <label htmlFor="course-name-filter" className="font-medium">Filter by Course:</label>
              <select
                id="course-name-filter"
                className="px-3 py-2 border border-[#ccc] rounded-md text-sm min-w-[180px] bg-white"
                value={courseFilter}
                onChange={(e) => {
                  setCourseFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">-- All Courses --</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
            </div>
            <PrimaryButton type="button" onClick={fetchVideos}>Search</PrimaryButton>
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

      {/* Add Video Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingVideoId ? 'Edit Video' : 'Add New Video'}
        size="lg"
        footer={
          <>
            <Button 
              variant="outline" 
              size="md" 
              onClick={handleCloseModal} 
              disabled={isSubmitting}
              className={isUploadingVideo ? 'border-red-500 text-red-600 hover:bg-red-50' : ''}
            >
              {isUploadingVideo ? 'Cancel Upload' : 'Cancel'}
            </Button>
            <Button 
              variant="primary" 
              size="md" 
              onClick={handleSave} 
              disabled={isSubmitting || isUploadingVideo}
            >
              {isSubmitting ? (editingVideoId ? 'Updating...' : 'Creating...') : (editingVideoId ? 'Update Video' : 'Create Video')}
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
          {/* Upload Warning */}
          {isUploadingVideo && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <span className="text-yellow-600 text-sm font-medium">⚠️</span>
                <div className="flex-1">
                  <p className="text-sm text-yellow-800 font-medium">
                    Video upload in progress ({uploadProgress}%)
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Clicking "Cancel Upload" will stop the upload and the video will not be saved.
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <label htmlFor="course_id" className="font-semibold">
              Course <span className="text-red-500">*</span>
            </label>
            <select
              id="course_id"
              required
              disabled={!!editingVideoId}
              value={formData.course_id}
              onChange={(e) => {
                setFormData({ ...formData, course_id: e.target.value, module_id: '' })
                setSelectedCourseId(e.target.value)
                setFormErrors({ ...formErrors, course_id: '' })
              }}
              className={`px-3 py-2.5 border rounded-md ${
                formErrors.course_id ? 'border-red-500' : 'border-[#ccc]'
              } ${editingVideoId ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            >
              <option value="">Select a course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
            {formErrors.course_id && <span className="text-red-500 text-sm">{formErrors.course_id}</span>}
          </div>

          {selectedCourseId && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label htmlFor="module_id" className="font-semibold">
                  Module <span className="text-red-500">*</span>
                </label>
                {!editingVideoId && (
                  <button
                    type="button"
                    onClick={() => setShowCreateModule(!showCreateModule)}
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    {showCreateModule ? 'Cancel' : '+ Create New Module'}
                  </button>
                )}
              </div>

              {showCreateModule ? (
                <div className="p-4 border border-blue-200 rounded-md bg-blue-50 space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Module Title</label>
                    <input
                      type="text"
                      value={newModuleTitle}
                      onChange={(e) => setNewModuleTitle(e.target.value)}
                      placeholder="Enter module title"
                      className="w-full px-3 py-2 border border-[#ccc] rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Order Index</label>
                    <input
                      type="number"
                      value={newModuleOrder}
                      onChange={(e) => setNewModuleOrder(e.target.value)}
                      placeholder="1"
                      className="w-full px-3 py-2 border border-[#ccc] rounded-md"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleCreateModule}
                    disabled={isSubmitting}
                  >
                    Create Module
                  </Button>
                </div>
              ) : (
                <select
                  id="module_id"
                  required
                  disabled={!!editingVideoId}
                  value={formData.module_id}
                  onChange={(e) => {
                    setFormData({ ...formData, module_id: e.target.value })
                    setFormErrors({ ...formErrors, module_id: '' })
                  }}
                  className={`px-3 py-2.5 border rounded-md ${
                    formErrors.module_id ? 'border-red-500' : 'border-[#ccc]'
                  } ${editingVideoId ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                >
                  <option value="">Select a module</option>
                  {modules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.title}
                    </option>
                  ))}
                </select>
              )}
              {formErrors.module_id && <span className="text-red-500 text-sm">{formErrors.module_id}</span>}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label htmlFor="title" className="font-semibold">
              Video Title <span className="text-red-500">*</span>
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
              placeholder="e.g., Introduction to Trading"
              className={`px-3 py-2.5 border rounded-md ${
                formErrors.title ? 'border-red-500' : 'border-[#ccc]'
              }`}
            />
            {formErrors.title && <span className="text-red-500 text-sm">{formErrors.title}</span>}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="description" className="font-semibold">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Video description"
              rows={3}
              className="px-3 py-2.5 border border-[#ccc] rounded-md"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="video_url" className="font-semibold">
              Video File <span className="text-red-500">*</span>
            </label>
            <input
              id="video_url"
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
              onChange={handleVideoFileSelect}
              disabled={isUploadingVideo || !formData.course_id || !formData.module_id}
              className={`px-3 py-2.5 border rounded-md ${
                formErrors.video_url ? 'border-red-500' : 'border-[#ccc]'
              } ${isUploadingVideo || !formData.course_id || !formData.module_id ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
            {isUploadingVideo && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-600 font-medium">Uploading video...</span>
                  <span className="text-blue-600 font-semibold">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">
                  Uploading directly to CDN for faster transfer...
                </span>
              </div>
            )}
            {formData.video_url && !isUploadingVideo && uploadProgress === 0 && (
              <span className="text-sm text-green-600">✓ Video uploaded successfully</span>
            )}
            {!formData.course_id || !formData.module_id ? (
              <span className="text-sm text-gray-500">Please select course and module first</span>
            ) : null}
            {formErrors.video_url && <span className="text-red-500 text-sm">{formErrors.video_url}</span>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="duration_seconds" className="font-semibold">
                Duration (seconds) <span className="text-red-500">*</span>
              </label>
              <input
                id="duration_seconds"
                type="number"
                required
                value={formData.duration_seconds}
                onChange={(e) => {
                  setFormData({ ...formData, duration_seconds: e.target.value })
                  setFormErrors({ ...formErrors, duration_seconds: '' })
                }}
                placeholder="Auto-detected from video"
                disabled={isExtractingDuration}
                className={`px-3 py-2.5 border rounded-md ${
                  formErrors.duration_seconds ? 'border-red-500' : 'border-[#ccc]'
                } ${isExtractingDuration ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}
              />
              {isExtractingDuration && (
                <span className="text-xs text-blue-600">⏳ Extracting duration from video...</span>
              )}
              {formData.duration_seconds && formData.duration_seconds !== '0' && !isExtractingDuration && (
                <span className="text-xs text-green-600">
                  ✓ Duration auto-detected: {formatDuration(parseInt(formData.duration_seconds, 10))} ({formData.duration_seconds} seconds)
                </span>
              )}
              {!formData.duration_seconds && !isExtractingDuration && (
                <span className="text-xs text-gray-500">
                  Duration will be auto-detected when you select a video file
                </span>
              )}
              {formErrors.duration_seconds && <span className="text-red-500 text-sm">{formErrors.duration_seconds}</span>}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="order_index" className="font-semibold">
                Order Index <span className="text-red-500">*</span>
              </label>
              <input
                id="order_index"
                type="number"
                required
                value={formData.order_index}
                onChange={(e) => {
                  setFormData({ ...formData, order_index: e.target.value })
                  setFormErrors({ ...formErrors, order_index: '' })
                }}
                placeholder="1"
                className={`px-3 py-2.5 border rounded-md ${
                  formErrors.order_index ? 'border-red-500' : 'border-[#ccc]'
                }`}
              />
              {formErrors.order_index && <span className="text-red-500 text-sm">{formErrors.order_index}</span>}
            </div>
          </div>

        </form>
      </Modal>

      {/* View Video Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false)
          setViewingVideo(null)
        }}
        title="Video Details"
        size="lg"
        footer={
          <Button variant="outline" size="md" onClick={() => {
            setIsViewModalOpen(false)
            setViewingVideo(null)
          }}>
            Close
          </Button>
        }
      >
        {viewingVideo && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-gray-700">Title:</label>
                <p className="mt-1">{viewingVideo.title}</p>
              </div>
              <div>
                <label className="font-semibold text-gray-700">Course:</label>
                <p className="mt-1">{viewingVideo.course_title}</p>
              </div>
              <div>
                <label className="font-semibold text-gray-700">Module:</label>
                <p className="mt-1">{viewingVideo.module_title}</p>
              </div>
              <div>
                <label className="font-semibold text-gray-700">Duration:</label>
                <p className="mt-1">{viewingVideo.duration_seconds} seconds ({Math.floor(viewingVideo.duration_seconds / 60)} min)</p>
              </div>
              <div>
                <label className="font-semibold text-gray-700">Order Index:</label>
                <p className="mt-1">{viewingVideo.order_index}</p>
              </div>
              <div>
                <label className="font-semibold text-gray-700">Status:</label>
                <p className="mt-1">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    viewingVideo.is_published
                      ? 'bg-[#d4edda] text-[#155724]'
                      : 'bg-[#f8d7da] text-[#721c24]'
                  }`}>
                    {viewingVideo.is_published ? 'Published' : 'Unpublished'}
                  </span>
                </p>
              </div>
              <div>
                <label className="font-semibold text-gray-700">Preview:</label>
                <p className="mt-1">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    viewingVideo.is_preview
                      ? 'bg-[#d4edda] text-[#155724]'
                      : 'bg-[#f8d7da] text-[#721c24]'
                  }`}>
                    {viewingVideo.is_preview ? 'Yes' : 'No'}
                  </span>
                </p>
              </div>
            </div>
            {viewingVideo.description && (
              <div>
                <label className="font-semibold text-gray-700">Description:</label>
                <p className="mt-1">{viewingVideo.description}</p>
              </div>
            )}
            <div>
              <label className="font-semibold text-gray-700">Video URL:</label>
              <p className="mt-1 break-all text-sm text-blue-600">
                <a href={viewingVideo.video_url} target="_blank" rel="noopener noreferrer" className="underline">
                  {viewingVideo.video_url}
                </a>
              </p>
            </div>
            <div className="pt-4 border-t">
              <label className="font-semibold text-gray-700">Video ID:</label>
              <p className="mt-1 text-sm text-gray-600">{viewingVideo.id}</p>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  )
}