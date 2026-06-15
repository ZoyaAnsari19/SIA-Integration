"use client"

import React, { useMemo, useState, useEffect } from 'react'
import Card, { ToolbarButton } from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, TextInput } from '../../../components/ui/FiltersBar'
import { EditButton, DeleteButton } from '../../../components/ui/ActionButtons'
import Pagination from '../../../components/ui/Pagination'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import {
  getFeeRules,
  updateFeeRule,
  createFeeRule,
  deleteFeeRule,
  type FeeRule,
  type UpdateFeeRuleRequest,
  type CreateFeeRuleRequest,
} from '../../../lib/api/feeRules'
import { exportToCsv } from '../../../lib/export'

type Row = FeeRule

export default function FeeRulesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingRule, setEditingRule] = useState<FeeRule | null>(null)
  const [rules, setRules] = useState<FeeRule[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  const [formData, setFormData] = useState({
    amount: '',
  })

  const [createFormData, setCreateFormData] = useState({
    rule_code: '',
    rule_name: '',
    description: '',
    amount: '',
    is_active: true,
    applies_to: 'all_users',
  })

  const [createFormErrors, setCreateFormErrors] = useState<Record<string, string>>({})

  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Fetch fee rules from API
  const fetchFeeRules = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params: {
        page: number
        limit: number
      } = {
        page,
        limit: pageSize,
      }

      const response = await getFeeRules(params)
      setRules(response.items)
      setTotal(response.total)
      setTotalPages(response.total_pages)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch fee rules')
      console.error('Error fetching fee rules:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Load data on mount and when filters/pagination change
  useEffect(() => {
    fetchFeeRules()
  }, [page, pageSize])

  // Filter rules by search query (client-side for now)
  const filteredRules = useMemo(() => {
    if (!searchQuery.trim()) return rules

    const query = searchQuery.toLowerCase()
    return rules.filter(
      (rule) =>
        rule.rule_code.toLowerCase().includes(query) ||
        rule.rule_name.toLowerCase().includes(query) ||
        (rule.description && rule.description.toLowerCase().includes(query))
    )
  }, [rules, searchQuery])

  const columns: Array<DataTableColumn<Row>> = useMemo(
    () => [
      {
        key: 'rule_code',
        title: 'Rule Code',
        render: (r: Row) => <span className="font-semibold">{r.rule_code}</span>,
      },
      {
        key: 'rule_name',
        title: 'Rule Name',
        render: (r: Row) => r.rule_name,
      },
      {
        key: 'description',
        title: 'Description',
        render: (r: Row) => (
          <span className="max-w-xs truncate block" title={r.description || ''}>
            {r.description || '-'}
          </span>
        ),
      },
      {
        key: 'amount',
        title: 'Amount',
        render: (r: Row) => <span className="font-semibold">₹{r.amount.toFixed(2)}</span>,
      },
      {
        key: 'applies_to',
        title: 'Applies To',
        render: (r: Row) => r.applies_to,
      },
      {
        key: 'created_at',
        title: 'Created At',
        render: (r: Row) => new Date(r.created_at).toLocaleDateString('en-IN'),
      },
    ],
    []
  )

  const handleEdit = (rule: FeeRule) => {
    setEditingRule(rule)
    setFormData({
      amount: rule.amount.toString(),
    })
    setFormErrors({})
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingRule(null)
    setFormData({
      amount: '',
    })
    setFormErrors({})
  }

  const handleOpenCreateModal = () => {
    setCreateFormData({
      rule_code: '',
      rule_name: '',
      description: '',
      amount: '',
      is_active: true,
      applies_to: 'all_users',
    })
    setCreateFormErrors({})
    setIsCreateModalOpen(true)
  }

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false)
    setCreateFormData({
      rule_code: '',
      rule_name: '',
      description: '',
      amount: '',
      is_active: true,
      applies_to: 'all_users',
    })
    setCreateFormErrors({})
  }

  const validateCreateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!createFormData.rule_code.trim()) {
      errors.rule_code = 'Rule code is required'
    }

    if (!createFormData.rule_name.trim()) {
      errors.rule_name = 'Rule name is required'
    }

    const amount = parseFloat(createFormData.amount)
    if (isNaN(amount) || amount < 0) {
      errors.amount = 'Amount must be a valid number >= 0'
    }

    setCreateFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreate = async () => {
    if (!validateCreateForm()) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const createData: CreateFeeRuleRequest = {
        rule_code: createFormData.rule_code.trim(),
        rule_name: createFormData.rule_name.trim(),
        description: createFormData.description.trim() || undefined,
        amount: parseFloat(createFormData.amount),
        is_active: createFormData.is_active,
        applies_to: createFormData.applies_to,
      }
      await createFeeRule(createData)
      alert('Fee rule created successfully!')
      handleCloseCreateModal()
      fetchFeeRules()
    } catch (err: any) {
      setError(err.message || 'Failed to create fee rule')
      alert(`Error: ${err.message || 'Failed to create fee rule'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (rule: FeeRule) => {
    if (!confirm(`Are you sure you want to delete fee rule "${rule.rule_name}" (${rule.rule_code})?`)) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await deleteFeeRule(rule.id)
      alert('Fee rule deleted successfully!')
      fetchFeeRules()
    } catch (err: any) {
      setError(err.message || 'Failed to delete fee rule')
      alert(`Error: ${err.message || 'Failed to delete fee rule'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    const amount = parseFloat(formData.amount)
    if (isNaN(amount) || amount < 0) {
      errors.amount = 'Amount must be a valid number >= 0'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!editingRule) {
      return // Should not happen, but safety check
    }

    if (!validateForm()) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Only update amount (as per business rules)
      const updateData: UpdateFeeRuleRequest = {
        amount: parseFloat(formData.amount),
      }
      await updateFeeRule(editingRule.id, updateData)
      alert('Fee rule updated successfully!')
      handleCloseModal()
      fetchFeeRules()
    } catch (err: any) {
      setError(err.message || 'Failed to save fee rule')
      alert(`Error: ${err.message || 'Failed to save fee rule'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = () => {
    // Search is handled client-side via filteredRules
    // Could be moved to server-side if needed
  }

  const handleClearFilters = () => {
    setSearchQuery('')
    setPage(1)
  }

  const handleExport = () => {
    if (!filteredRules.length) {
      alert('No fee rules available to export.')
      return
    }

    const headers = ['Rule Code', 'Rule Name', 'Description', 'Amount', 'Applies To', 'Created At']
    const data = filteredRules.map(rule => [
      rule.rule_code,
      rule.rule_name,
      rule.description || '',
      rule.amount.toFixed(2),
      rule.applies_to,
      new Date(rule.created_at).toLocaleString('en-IN'),
    ])

    exportToCsv('fee-rules.csv', headers, data)
  }

  return (
    <>
      <Card
        title="Fee Rules Management"
        toolbarRight={
          <>
            <Button variant="primary" size="md" aria-label="Create New" onClick={handleOpenCreateModal}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>Create New</span>
            </Button>
          <Button variant="outline" size="md" aria-label="Export" onClick={handleExport}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <span>Export</span>
          </Button>
          </>
        }
      >
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {isLoading && !rules.length ? (
          <div className="text-center py-8">Loading fee rules...</div>
        ) : (
          <>
            <DataTable<Row>
              columns={columns}
              rows={filteredRules}
              renderActions={(row) => (
                <div className="flex items-center gap-1">
                  <EditButton onClick={() => handleEdit(row)} />
                  <DeleteButton onClick={() => handleDelete(row)} />
                </div>
              )}
              minWidthPx={1200}
            />

            <FiltersBar>
              <TextInput
                id="search-query"
                label="Search:"
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by rule code or name..."
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

      {/* Edit Modal - Only for editing amount */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Edit Fee Rule"
        size="lg"
        footer={
          <>
            <Button variant="outline" size="md" onClick={handleCloseModal} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={handleSave} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save'}
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
          {/* Display rule info (read-only) */}
          {editingRule && (
            <div className="bg-gray-50 p-4 rounded-md border border-gray-200 mb-4">
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium text-gray-600">Rule Code:</span>
                  <span className="ml-2 font-semibold text-gray-800">{editingRule.rule_code}</span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Rule Name:</span>
                  <span className="ml-2 text-gray-800">{editingRule.rule_name}</span>
                </div>
                {editingRule.description && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">Description:</span>
                    <span className="ml-2 text-gray-800">{editingRule.description}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Only editable field - Amount */}
          <div className="flex flex-col gap-2">
            <label htmlFor="amount" className="font-semibold">
              Amount (₹) <span className="text-red-500">*</span>
            </label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              required
              value={formData.amount}
              onChange={(e) => {
                setFormData({ ...formData, amount: e.target.value })
                setFormErrors({ ...formErrors, amount: '' })
              }}
              placeholder="e.g., 10.00"
              className={`px-3 py-2.5 border rounded-md ${
                formErrors.amount ? 'border-red-500' : 'border-[#ccc]'
              }`}
            />
            {formErrors.amount && <span className="text-red-500 text-sm">{formErrors.amount}</span>}
          </div>
        </form>
      </Modal>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        title="Create New Fee Rule"
        size="lg"
        footer={
          <>
            <Button variant="outline" size="md" onClick={handleCloseCreateModal} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={handleCreate} disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create'}
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleCreate()
          }}
          className="space-y-4"
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="rule_code" className="font-semibold">
              Rule Code <span className="text-red-500">*</span>
            </label>
            <input
              id="rule_code"
              type="text"
              required
              value={createFormData.rule_code}
              onChange={(e) => {
                setCreateFormData({ ...createFormData, rule_code: e.target.value })
                setCreateFormErrors({ ...createFormErrors, rule_code: '' })
              }}
              placeholder="e.g., ACCOUNT_CHANGE"
              className={`px-3 py-2.5 border rounded-md ${
                createFormErrors.rule_code ? 'border-red-500' : 'border-[#ccc]'
              }`}
            />
            {createFormErrors.rule_code && <span className="text-red-500 text-sm">{createFormErrors.rule_code}</span>}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="rule_name" className="font-semibold">
              Rule Name <span className="text-red-500">*</span>
            </label>
            <input
              id="rule_name"
              type="text"
              required
              value={createFormData.rule_name}
              onChange={(e) => {
                setCreateFormData({ ...createFormData, rule_name: e.target.value })
                setCreateFormErrors({ ...createFormErrors, rule_name: '' })
              }}
              placeholder="e.g., Account Details Change Fee"
              className={`px-3 py-2.5 border rounded-md ${
                createFormErrors.rule_name ? 'border-red-500' : 'border-[#ccc]'
              }`}
            />
            {createFormErrors.rule_name && <span className="text-red-500 text-sm">{createFormErrors.rule_name}</span>}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="description" className="font-semibold">
              Description
            </label>
            <textarea
              id="description"
              value={createFormData.description}
              onChange={(e) => {
                setCreateFormData({ ...createFormData, description: e.target.value })
              }}
              placeholder="Optional description"
              rows={3}
              className="px-3 py-2.5 border border-[#ccc] rounded-md"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="create_amount" className="font-semibold">
              Amount (₹) <span className="text-red-500">*</span>
            </label>
            <input
              id="create_amount"
              type="number"
              step="0.01"
              min="0"
              required
              value={createFormData.amount}
              onChange={(e) => {
                setCreateFormData({ ...createFormData, amount: e.target.value })
                setCreateFormErrors({ ...createFormErrors, amount: '' })
              }}
              placeholder="e.g., 10.00"
              className={`px-3 py-2.5 border rounded-md ${
                createFormErrors.amount ? 'border-red-500' : 'border-[#ccc]'
              }`}
            />
            {createFormErrors.amount && <span className="text-red-500 text-sm">{createFormErrors.amount}</span>}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="applies_to" className="font-semibold">
              Applies To
            </label>
            <select
              id="applies_to"
              value={createFormData.applies_to}
              onChange={(e) => {
                setCreateFormData({ ...createFormData, applies_to: e.target.value })
              }}
              className="px-3 py-2.5 border border-[#ccc] rounded-md"
            >
              <option value="all_users">All Users</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="is_active"
              type="checkbox"
              checked={createFormData.is_active}
              onChange={(e) => {
                setCreateFormData({ ...createFormData, is_active: e.target.checked })
              }}
              className="w-4 h-4"
            />
            <label htmlFor="is_active" className="font-semibold">
              Active
            </label>
          </div>
        </form>
      </Modal>
    </>
  )
}

