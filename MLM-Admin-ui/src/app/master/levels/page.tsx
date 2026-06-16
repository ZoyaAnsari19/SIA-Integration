"use client"

import React, { useMemo, useState, useEffect } from 'react'
import Card from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, TextInput } from '../../../components/ui/FiltersBar'
import { EditButton } from '../../../components/ui/ActionButtons'
import Pagination from '../../../components/ui/Pagination'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import {
  getLevels,
  updateLevel,
  type Level,
  type UpdateLevelRequest,
  type BusinessRequirement,
} from '../../../lib/api/levels'

type Row = Level

export default function LevelsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingLevel, setEditingLevel] = useState<Level | null>(null)
  const [levels, setLevels] = useState<Level[]>([])
  const [total, setTotal] = useState(0)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    reward: '',
    spot_commission_percent: '',
    monthly_royalty_percent: '',
    required_leg_count: '',
    required_leg_min_amount: '',
    total_business: '',
    icon_url: '',
    color: '',
  })

  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Fetch levels from API
  const fetchLevels = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await getLevels()
      // Ensure items is always an array
      setLevels(response?.items || [])
      setTotal(response?.count || 0)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch levels')
      console.error('Error fetching levels:', err)
      // Set empty array on error to prevent undefined
      setLevels([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }

  // Load data on mount
  useEffect(() => {
    fetchLevels()
  }, [])

  // Filter levels by search query (client-side)
  const filteredLevels = useMemo(() => {
    if (!searchQuery.trim()) return levels

    const query = searchQuery.toLowerCase()
    return levels.filter(
      (level) =>
        level.level.toString().includes(query) ||
        level.title.toLowerCase().includes(query) ||
        (level.description && level.description.toLowerCase().includes(query))
    )
  }, [levels, searchQuery])

  // Get level badge color
  const getLevelBadgeColor = (level: number): string => {
    const colors = [
      'bg-blue-100 text-blue-800 border-blue-300', // Level 0
      'bg-green-100 text-green-800 border-green-300', // Level 1
      'bg-purple-100 text-purple-800 border-purple-300', // Level 2
      'bg-yellow-100 text-yellow-800 border-yellow-300', // Level 3
      'bg-orange-100 text-orange-800 border-orange-300', // Level 4
      'bg-red-100 text-red-800 border-red-300', // Level 5
      'bg-pink-100 text-pink-800 border-pink-300', // Level 6
      'bg-indigo-100 text-indigo-800 border-indigo-300', // Level 7
      'bg-teal-100 text-teal-800 border-teal-300', // Level 8
      'bg-amber-100 text-amber-800 border-amber-300', // Level 9
    ]
    return colors[level] || 'bg-gray-100 text-gray-800 border-gray-300'
  }

  // Format business requirement summary with better UI
  const formatBusinessRequirement = (req: BusinessRequirement | null | undefined): React.ReactNode => {
    if (!req) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300">
          Direct
        </span>
      )
    }
    
    // Check if leg requirements exist - show this first as it's more descriptive
    if (req.required_leg_count != null && req.required_leg_count > 0 && req.required_leg_min_amount != null && req.required_leg_min_amount > 0) {
      const legAmount = (req.required_leg_min_amount / 100000).toFixed(2)
      let totalBusinessText = ''
      if (req.total_business != null && req.total_business > 0) {
        const total = req.total_business
        if (total >= 10000000) {
          totalBusinessText = ` (Total: ₹${(total / 10000000).toFixed(2)} Cr)`
        } else if (total >= 100000) {
          totalBusinessText = ` (Total: ₹${(total / 100000).toFixed(2)} L)`
        } else {
          totalBusinessText = ` (Total: ₹${total.toLocaleString('en-IN')})`
        }
      }
      return (
        <div className="flex flex-col gap-1">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-300">
            {req.required_leg_count} leg(s) × ₹{legAmount}L{totalBusinessText}
          </span>
        </div>
      )
    }
    
    // Check if only total_business exists
    if (req.total_business != null && req.total_business > 0) {
      const amount = req.total_business
      let formatted = ''
      if (amount >= 10000000) {
        formatted = `₹${(amount / 10000000).toFixed(2)} Crore`
      } else if (amount >= 100000) {
        formatted = `₹${(amount / 100000).toFixed(2)} Lakh`
      } else {
        formatted = `₹${amount.toLocaleString('en-IN')}`
      }
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-300">
          {formatted}
        </span>
      )
    }
    
    // Default: Direct level
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300">
        Direct
      </span>
    )
  }

  const columns: Array<DataTableColumn<Row>> = useMemo(
    () => [
      {
        key: 'level',
        title: 'Level',
        render: (r: Row) => (
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full font-bold text-base border-2 ${getLevelBadgeColor(r.level)}`}>
              {r.level}
            </span>
          </div>
        ),
      },
      {
        key: 'title',
        title: 'Title',
        render: (r: Row) => (
          <div className="flex flex-col">
            <span className="font-semibold text-gray-900">{r.title}</span>
            {r.description && (
              <span className="text-xs text-gray-500 mt-0.5 line-clamp-1">{r.description}</span>
            )}
          </div>
        ),
      },
      {
        key: 'spot_commission_percent',
        title: 'Spot Commission',
        render: (r: Row) => (
          <div className="flex flex-col gap-1">
            {r.level === 0 ? (
              <div className="flex flex-col gap-1">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  Package Specific
                </span>
                <span className="text-xs text-gray-500">Set in Package Settings</span>
              </div>
            ) : r.spot_commission_percent !== null && r.spot_commission_percent !== undefined ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {r.spot_commission_percent}%
                </span>
              </div>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </div>
        ),
      },
      {
        key: 'monthly_royalty_percent',
        title: 'Monthly Royalty',
        render: (r: Row) => (
          <div className="flex flex-col gap-1">
            {r.level === 0 ? (
              <div className="flex flex-col gap-1">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-bold bg-green-50 text-green-700 border border-green-200">
                  Package Specific
                </span>
                <span className="text-xs text-gray-500">Set in Package Settings</span>
              </div>
            ) : r.monthly_royalty_percent !== null && r.monthly_royalty_percent !== undefined ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-bold bg-green-50 text-green-700 border border-green-200">
                  {r.monthly_royalty_percent}%
                </span>
              </div>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </div>
        ),
      },
      {
        key: 'business_requirement',
        title: 'Business Requirement',
        render: (r: Row) => formatBusinessRequirement(r.business_requirement),
      },
      {
        key: 'reward',
        title: 'Reward',
        render: (r: Row) => (
          r.reward ? (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="max-w-xs truncate block font-medium text-gray-700" title={r.reward}>
                {r.reward}
              </span>
            </div>
          ) : (
            <span className="text-gray-400">-</span>
          )
        ),
      },
    ],
    []
  )

  const handleEdit = (level: Level) => {
    setEditingLevel(level)
    const businessReq = level.business_requirement || {}
    setFormData({
      title: level.title || '',
      description: level.description || '',
      reward: level.reward || '',
      spot_commission_percent: level.spot_commission_percent?.toString() || '',
      monthly_royalty_percent: level.monthly_royalty_percent?.toString() || '',
      required_leg_count: businessReq.required_leg_count?.toString() || '',
      required_leg_min_amount: businessReq.required_leg_min_amount?.toString() || '',
      total_business: businessReq.total_business?.toString() || '',
      icon_url: level.icon_url || '',
      color: level.color || '',
    })
    setFormErrors({})
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingLevel(null)
    setFormData({
      title: '',
      description: '',
      reward: '',
      spot_commission_percent: '',
      monthly_royalty_percent: '',
      required_leg_count: '',
      required_leg_min_amount: '',
      total_business: '',
      icon_url: '',
      color: '',
    })
    setFormErrors({})
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.title.trim()) {
      errors.title = 'Title is required'
    }

    const spotPercent = parseFloat(formData.spot_commission_percent)
    if (formData.spot_commission_percent && (isNaN(spotPercent) || spotPercent < 0 || spotPercent > 100)) {
      errors.spot_commission_percent = 'Spot commission must be between 0 and 100'
    }

    const monthlyPercent = parseFloat(formData.monthly_royalty_percent)
    if (formData.monthly_royalty_percent && (isNaN(monthlyPercent) || monthlyPercent < 0 || monthlyPercent > 100)) {
      errors.monthly_royalty_percent = 'Monthly royalty must be between 0 and 100'
    }

    const legCount = formData.required_leg_count ? parseInt(formData.required_leg_count) : null
    if (formData.required_leg_count && (isNaN(legCount!) || legCount! < 0)) {
      errors.required_leg_count = 'Leg count must be a non-negative integer'
    }

    const legAmount = formData.required_leg_min_amount ? parseFloat(formData.required_leg_min_amount) : null
    if (formData.required_leg_min_amount && (isNaN(legAmount!) || legAmount! < 0)) {
      errors.required_leg_min_amount = 'Leg amount must be >= 0'
    }

    const totalBusiness = formData.total_business ? parseFloat(formData.total_business) : null
    if (formData.total_business && (isNaN(totalBusiness!) || totalBusiness! < 0)) {
      errors.total_business = 'Total business must be >= 0'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!editingLevel) {
      return
    }

    if (!validateForm()) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Build business requirement object
      const businessRequirement: BusinessRequirement | null = 
        formData.required_leg_count || formData.required_leg_min_amount || formData.total_business
          ? {
              required_leg_count: formData.required_leg_count ? parseInt(formData.required_leg_count) : undefined,
              required_leg_min_amount: formData.required_leg_min_amount ? parseFloat(formData.required_leg_min_amount) : undefined,
              total_business: formData.total_business ? parseFloat(formData.total_business) : undefined,
            }
          : null

      const updateData: UpdateLevelRequest = {
        title: formData.title,
        description: formData.description || null,
        reward: formData.reward || null,
        spot_commission_percent: formData.spot_commission_percent ? parseFloat(formData.spot_commission_percent) : null,
        monthly_royalty_percent: formData.monthly_royalty_percent ? parseFloat(formData.monthly_royalty_percent) : null,
        business_requirement: businessRequirement,
        icon_url: formData.icon_url || null,
        color: formData.color || null,
      }

      await updateLevel(editingLevel.level, updateData)
      alert('Level updated successfully!')
      handleCloseModal()
      fetchLevels()
    } catch (err: any) {
      setError(err.message || 'Failed to save level')
      alert(`Error: ${err.message || 'Failed to save level'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = () => {
    // Search is handled client-side via filteredLevels
  }

  const handleClearFilters = () => {
    setSearchQuery('')
    setPage(1)
  }

  return (
    <>
      <Card
        title={
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Levels & Commission Management</h1>
              <p className="text-sm text-gray-500 mt-0.5">Manage commission rates and level requirements</p>
            </div>
          </div>
        }
      >
        {error && (
          <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-md flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-semibold">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {isLoading && !levels.length ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-primary mb-4"></div>
            <p className="text-gray-600">Loading levels...</p>
          </div>
        ) : (
          <>
            <DataTable<Row>
              columns={columns}
              rows={filteredLevels}
              renderActions={(row) => (
                <div className="flex items-center gap-1">
                  {row.level === 0 ? (
                    <span className="text-gray-400 text-sm" title="Field Worker (Level 0) cannot be edited">
                      View Only
                    </span>
                  ) : (
                    <EditButton onClick={() => handleEdit(row)} />
                  )}
                </div>
              )}
              minWidthPx={1400}
            />

            <FiltersBar>
              <TextInput
                id="search-query"
                label="Search:"
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by level, title, or description..."
              />
              <PrimaryButton type="button" onClick={handleSearch}>
                Search
              </PrimaryButton>
              <SecondaryButton type="button" onClick={handleClearFilters}>
                Clear Filters
              </SecondaryButton>
            </FiltersBar>

            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 25, 50]}
            />
          </>
        )}
      </Card>

      {/* Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={
          editingLevel ? (
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${getLevelBadgeColor(editingLevel.level)}`}>
                <span className="font-bold text-lg">{editingLevel.level}</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Edit Level {editingLevel.level}</h2>
                <p className="text-sm text-gray-500">{editingLevel.title}</p>
              </div>
            </div>
          ) : (
            'Edit Level'
          )
        }
        size="lg"
        footer={
          <>
            <Button variant="outline" size="md" onClick={handleCloseModal} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={handleSave} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
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
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="font-semibold text-lg text-gray-900">Basic Information</h3>
            </div>
            
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
                placeholder="e.g., Field Worker, Company Representative"
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
                onChange={(e) => {
                  setFormData({ ...formData, description: e.target.value })
                }}
                placeholder="Level description..."
                rows={3}
                className="px-3 py-2.5 border border-[#ccc] rounded-md"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="reward" className="font-semibold">
                Reward
              </label>
              <input
                id="reward"
                type="text"
                value={formData.reward}
                onChange={(e) => {
                  setFormData({ ...formData, reward: e.target.value })
                }}
                placeholder="e.g., T-shirt and Diary, 5G Mobile"
                className="px-3 py-2.5 border border-[#ccc] rounded-md"
              />
            </div>
          </div>

          {/* Commission Percentages */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="font-semibold text-lg text-gray-900">Commission Percentages</h3>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="spot_commission_percent" className="font-semibold">
                  Spot Commission % <span className="text-red-500">*</span>
                </label>
                <input
                  id="spot_commission_percent"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.spot_commission_percent}
                  onChange={(e) => {
                    setFormData({ ...formData, spot_commission_percent: e.target.value })
                    setFormErrors({ ...formErrors, spot_commission_percent: '' })
                  }}
                  placeholder="e.g., 5.0, 2.5"
                  className={`px-3 py-2.5 border rounded-md ${
                    formErrors.spot_commission_percent ? 'border-red-500' : 'border-[#ccc]'
                  }`}
                />
                {formErrors.spot_commission_percent && (
                  <span className="text-red-500 text-sm">{formErrors.spot_commission_percent}</span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="monthly_royalty_percent" className="font-semibold">
                  Monthly Royalty % <span className="text-red-500">*</span>
                </label>
                <input
                  id="monthly_royalty_percent"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.monthly_royalty_percent}
                  onChange={(e) => {
                    setFormData({ ...formData, monthly_royalty_percent: e.target.value })
                    setFormErrors({ ...formErrors, monthly_royalty_percent: '' })
                  }}
                  placeholder="e.g., 0.75, 0.30"
                  className={`px-3 py-2.5 border rounded-md ${
                    formErrors.monthly_royalty_percent ? 'border-red-500' : 'border-[#ccc]'
                  }`}
                />
                {formErrors.monthly_royalty_percent && (
                  <span className="text-red-500 text-sm">{formErrors.monthly_royalty_percent}</span>
                )}
              </div>
            </div>
          </div>

          {/* Business Requirement */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              <h3 className="font-semibold text-lg text-gray-900">Business Requirement (Level Achievement Criteria)</h3>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="required_leg_count" className="font-semibold">
                  Required Leg Count
                </label>
                <input
                  id="required_leg_count"
                  type="number"
                  min="0"
                  value={formData.required_leg_count}
                  onChange={(e) => {
                    setFormData({ ...formData, required_leg_count: e.target.value })
                    setFormErrors({ ...formErrors, required_leg_count: '' })
                  }}
                  placeholder="e.g., 1, 2, 3"
                  className={`px-3 py-2.5 border rounded-md ${
                    formErrors.required_leg_count ? 'border-red-500' : 'border-[#ccc]'
                  }`}
                />
                {formErrors.required_leg_count && (
                  <span className="text-red-500 text-sm">{formErrors.required_leg_count}</span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="required_leg_min_amount" className="font-semibold">
                  Required Leg Min Amount (₹)
                </label>
                <input
                  id="required_leg_min_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.required_leg_min_amount}
                  onChange={(e) => {
                    setFormData({ ...formData, required_leg_min_amount: e.target.value })
                    setFormErrors({ ...formErrors, required_leg_min_amount: '' })
                  }}
                  placeholder="e.g., 375000"
                  className={`px-3 py-2.5 border rounded-md ${
                    formErrors.required_leg_min_amount ? 'border-red-500' : 'border-[#ccc]'
                  }`}
                />
                {formErrors.required_leg_min_amount && (
                  <span className="text-red-500 text-sm">{formErrors.required_leg_min_amount}</span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="total_business" className="font-semibold">
                  Total Business (₹)
                </label>
                <input
                  id="total_business"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.total_business}
                  onChange={(e) => {
                    setFormData({ ...formData, total_business: e.target.value })
                    setFormErrors({ ...formErrors, total_business: '' })
                  }}
                  placeholder="e.g., 375000"
                  className={`px-3 py-2.5 border rounded-md ${
                    formErrors.total_business ? 'border-red-500' : 'border-[#ccc]'
                  }`}
                />
                {formErrors.total_business && (
                  <span className="text-red-500 text-sm">{formErrors.total_business}</span>
                )}
              </div>
            </div>
          </div>

          {/* Optional Fields */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <h3 className="font-semibold text-lg text-gray-900">Optional Settings</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="icon_url" className="font-semibold">
                  Icon URL
                </label>
                <input
                  id="icon_url"
                  type="url"
                  value={formData.icon_url}
                  onChange={(e) => {
                    setFormData({ ...formData, icon_url: e.target.value })
                  }}
                  placeholder="https://..."
                  className="px-3 py-2.5 border border-[#ccc] rounded-md"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="color" className="font-semibold">
                  Color
                </label>
                <input
                  id="color"
                  type="text"
                  value={formData.color}
                  onChange={(e) => {
                    setFormData({ ...formData, color: e.target.value })
                  }}
                  placeholder="e.g., #FF5733"
                  className="px-3 py-2.5 border border-[#ccc] rounded-md"
                />
              </div>
            </div>
          </div>
        </form>
      </Modal>
    </>
  )
}

