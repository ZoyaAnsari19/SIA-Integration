"use client"

import React, { useMemo, useState, useEffect } from 'react'
import Card from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, TextInput } from '../../../components/ui/FiltersBar'
import { EditButton, DeleteButton, ViewButton } from '../../../components/ui/ActionButtons'
import Pagination from '../../../components/ui/Pagination'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import {
  getCompanyBankAccounts,
  createCompanyBankAccount,
  updateCompanyBankAccount,
  deleteCompanyBankAccount,
  uploadCompanyBankQR,
  type CompanyBankAccount,
  type CreateCompanyBankRequest,
  type UpdateCompanyBankRequest,
} from '../../../lib/mock/companyBank'
import { exportToCsv } from '../../../lib/export'

type Row = CompanyBankAccount & {
  bank_id: string // For compatibility with existing UI
}

export default function CompanyBankPage() {
  const [bankFilter, setBankFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<CompanyBankAccount[]>([])
  const [editingAccount, setEditingAccount] = useState<CompanyBankAccount | null>(null)
  const [viewQrAccount, setViewQrAccount] = useState<CompanyBankAccount | null>(null)
  const [qrImageFile, setQrImageFile] = useState<File | null>(null)
  const [qrImagePreview, setQrImagePreview] = useState<string | null>(null)
  const [isUploadingQR, setIsUploadingQR] = useState(false)

  // Fetch company bank accounts from API
  const fetchAccounts = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await getCompanyBankAccounts()
      setAccounts(response.items)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch company bank accounts')
      console.error('Error fetching company bank accounts:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Load data on mount
  useEffect(() => {
    fetchAccounts()
  }, [])

  // Filter accounts by search query (client-side)
  const filteredAccounts = useMemo(() => {
    if (!bankFilter.trim()) return accounts

    const query = bankFilter.toLowerCase()
    return accounts.filter(
      (account) =>
        account.bank_name.toLowerCase().includes(query) ||
        (account.bank_upi && account.bank_upi.toLowerCase().includes(query)) ||
        (account.bank_ac_holder && account.bank_ac_holder.toLowerCase().includes(query))
    )
  }, [accounts, bankFilter])

  // Paginate filtered accounts
  const paginatedAccounts = useMemo(() => {
    const start = (page - 1) * pageSize
    const end = start + pageSize
    return filteredAccounts.slice(start, end)
  }, [filteredAccounts, page, pageSize])

  // Convert to Row type for table
  const rows: Row[] = useMemo(() => {
    return paginatedAccounts.map(account => ({
      ...account,
      bank_id: account.id.toString(),
      qr_image: account.qr_image || '',
      bank_branch: account.bank_branch || '',
      bank_upi: account.bank_upi || '',
    }))
  }, [paginatedAccounts])

  const columns: Array<DataTableColumn<Row>> = useMemo(() => [
    { 
      key: 'qr_image', 
      title: 'qr',
      render: (r: Row) => (
        <button
          onClick={() => handleViewQr(r.id, r.bank_name)}
          className="border border-[#eee] rounded p-0 bg-white hover:opacity-90 transition-opacity"
          title="View QR Code"
          aria-label="View QR Code"
        >
          {r.qr_image ? (
            <img 
              src={r.qr_image} 
              alt="QR Code" 
              className="w-10 h-10 object-contain rounded"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40"%3E%3Crect width="40" height="40" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="8" fill="%23999"%3EQR%3C/text%3E%3C/svg%3E'
              }}
            />
          ) : (
            <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
              <span className="text-xs text-gray-500">QR</span>
            </div>
          )}
        </button>
      )
    },
    { 
      key: 'bank_name', 
      title: 'bank name',
      render: (r: Row) => (
        <span className="font-semibold">{r.bank_name}</span>
      )
    },
    { 
      key: 'bank_ac_holder', 
      title: 'bank ac holder',
      render: (r: Row) => r.bank_ac_holder || '-'
    },
    { 
      key: 'bank_ac_no', 
      title: 'bank ac no',
      render: (r: Row) => r.bank_ac_no || '-'
    },
    { 
      key: 'bank_ifsc', 
      title: 'bank ifsc',
      render: (r: Row) => r.bank_ifsc || '-'
    },
    { 
      key: 'bank_branch', 
      title: 'bank branch',
      render: (r: Row) => r.bank_branch || '-'
    },
    { 
      key: 'bank_upi', 
      title: 'bank upi',
      render: (r: Row) => r.bank_upi || '-'
    },
  ], [])

  const [formData, setFormData] = useState({
    bank_name: '',
    bank_ac_holder: '',
    bank_ac_no: '',
    bank_ifsc: '',
    bank_branch: '',
    bank_upi: '',
    qr_image: '',
    is_active: true,
  })

  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const handleEdit = (account: CompanyBankAccount) => {
    setEditingAccount(account)
    setFormData({
      bank_name: account.bank_name || '',
      bank_ac_holder: account.bank_ac_holder || '',
      bank_ac_no: account.bank_ac_no || '',
      bank_ifsc: account.bank_ifsc || '',
      bank_branch: account.bank_branch || '',
      bank_upi: account.bank_upi || '',
      qr_image: account.qr_image || '',
      is_active: account.is_active,
    })
    setQrImageFile(null)
    setQrImagePreview(account.qr_image || null)
    setFormErrors({})
    setIsModalOpen(true)
  }

  const handleCreate = () => {
    setEditingAccount(null)
    setFormData({
      bank_name: '',
      bank_ac_holder: '',
      bank_ac_no: '',
      bank_ifsc: '',
      bank_branch: '',
      bank_upi: '',
      qr_image: '',
      is_active: true,
    })
    setQrImageFile(null)
    setQrImagePreview(null)
    setFormErrors({})
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingAccount(null)
    setFormData({
      bank_name: '',
      bank_ac_holder: '',
      bank_ac_no: '',
      bank_ifsc: '',
      bank_branch: '',
      bank_upi: '',
      qr_image: '',
      is_active: true,
    })
    setQrImageFile(null)
    setQrImagePreview(null)
    setIsUploadingQR(false)
    setFormErrors({})
  }

  const handleQRFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setQrImageFile(null)
      setQrImagePreview(null)
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

    setQrImageFile(file)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setQrImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    // Upload file immediately
    setIsUploadingQR(true)
    try {
      const result = await uploadCompanyBankQR(file)
      setFormData({ ...formData, qr_image: result.qr_image_url })
      setQrImagePreview(result.qr_image_url)
    } catch (err: any) {
      console.error('Error uploading QR code:', err)
      alert(err?.message || 'Failed to upload QR code image')
      setQrImageFile(null)
      setQrImagePreview(null)
      e.target.value = ''
    } finally {
      setIsUploadingQR(false)
    }
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.bank_name.trim()) {
      errors.bank_name = 'Bank name is required'
    }
    if (!formData.bank_ac_holder.trim()) {
      errors.bank_ac_holder = 'Account holder name is required'
    }
    if (!formData.bank_ac_no.trim()) {
      errors.bank_ac_no = 'Account number is required'
    }
    if (!formData.bank_ifsc.trim()) {
      errors.bank_ifsc = 'IFSC code is required'
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
      if (editingAccount) {
        // Update existing account
        const updateData: UpdateCompanyBankRequest = {
          bank_name: formData.bank_name,
          bank_ac_holder: formData.bank_ac_holder,
          bank_ac_no: formData.bank_ac_no,
          bank_ifsc: formData.bank_ifsc,
          bank_branch: formData.bank_branch || undefined,
          bank_upi: formData.bank_upi || undefined,
          qr_image: formData.qr_image || undefined,
          is_active: formData.is_active,
        }
        await updateCompanyBankAccount(editingAccount.id, updateData)
        alert('Company bank account updated successfully!')
      } else {
        // Create new account
        const createData: CreateCompanyBankRequest = {
          bank_name: formData.bank_name,
          bank_ac_holder: formData.bank_ac_holder,
          bank_ac_no: formData.bank_ac_no,
          bank_ifsc: formData.bank_ifsc,
          bank_branch: formData.bank_branch || undefined,
          bank_upi: formData.bank_upi || undefined,
          qr_image: formData.qr_image || undefined,
          is_active: formData.is_active,
        }
        await createCompanyBankAccount(createData)
        alert('Company bank account created successfully!')
      }
      handleCloseModal()
      fetchAccounts()
    } catch (err: any) {
      setError(err.message || 'Failed to save company bank account')
      alert(`Error: ${err.message || 'Failed to save company bank account'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (account: CompanyBankAccount) => {
    if (!confirm(`Are you sure you want to delete the bank account: ${account.bank_name}?`)) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await deleteCompanyBankAccount(account.id)
      alert('Company bank account deleted successfully!')
      fetchAccounts()
    } catch (err: any) {
      setError(err.message || 'Failed to delete company bank account')
      alert(`Error: ${err.message || 'Failed to delete company bank account'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewQr = (accountId: number, bankName: string) => {
    const account = accounts.find(a => a.id === accountId)
    if (account && account.qr_image) {
      setViewQrAccount(account)
    } else {
      alert(`No QR code available for ${bankName}`)
    }
  }

  const handleExport = () => {
    if (!filteredAccounts.length) {
      alert('No company bank records available to export.')
      return
    }

    const headers = [
      'bank_name',
      'bank_ac_holder',
      'bank_ac_no',
      'bank_ifsc',
      'bank_branch',
      'bank_upi',
      'status',
    ]

    const data = filteredAccounts.map(account => [
      account.bank_name,
      account.bank_ac_holder || '',
      account.bank_ac_no || '',
      account.bank_ifsc || '',
      account.bank_branch || '',
      account.bank_upi || '',
      account.is_active ? 'Active' : 'Inactive',
    ])

    exportToCsv('company-bank-accounts.csv', headers, data)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSearch = () => {
    // Search is handled client-side via filteredAccounts
    setPage(1) // Reset to first page when searching
  }

  const handleClearFilters = () => {
    setBankFilter('')
    setPage(1)
  }

  return (
    <>
      <Card
        title="Company Bank Details"
        toolbarRight={
          <>
            <Button variant="primary" size="md" onClick={handleCreate} disabled={isLoading}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>Add Bank</span>
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

        {isLoading && !accounts.length ? (
          <div className="text-center py-8">Loading company bank accounts...</div>
        ) : (
          <>
            <DataTable<Row>
              columns={columns}
              rows={rows}
              renderActions={(row) => {
                const account = accounts.find(a => a.id === row.id)
                if (!account) return null
                return (
                  <div className="flex items-center gap-1">
                    <EditButton onClick={() => handleEdit(account)} />
                    <DeleteButton onClick={() => handleDelete(account)} />
                  </div>
                )
              }}
              minWidthPx={1400}
            />

            <FiltersBar>
              <TextInput 
                id="bank-name-filter" 
                label="Filter by Bank Name:" 
                value={bankFilter} 
                onChange={setBankFilter} 
                placeholder="Enter bank name or UPI ID..." 
              />
              <PrimaryButton type="button" onClick={handleSearch}>Search</PrimaryButton>
              <SecondaryButton type="button" onClick={handleClearFilters}>Clear filtering</SecondaryButton>
            </FiltersBar>

            <Pagination
              page={page}
              pageSize={pageSize}
              total={filteredAccounts.length}
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
        title={editingAccount ? 'Edit Company Bank Account' : 'Add Company Bank Account'}
        size="lg"
        footer={
          <>
            <Button variant="outline" size="md" onClick={handleCloseModal} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={handleSave} disabled={isLoading}>
              {isLoading ? 'Saving...' : editingAccount ? 'Update' : 'Create'}
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
              <label htmlFor="bank_name" className="font-semibold">
                Bank Name <span className="text-red-500">*</span>
              </label>
              <input
                id="bank_name"
                type="text"
                required
                value={formData.bank_name}
                onChange={(e) => {
                  setFormData({ ...formData, bank_name: e.target.value })
                  setFormErrors({ ...formErrors, bank_name: '' })
                }}
                placeholder="e.g., HDFC Bank"
                className={`px-3 py-2.5 border rounded-md ${
                  formErrors.bank_name ? 'border-red-500' : 'border-[#ccc]'
                }`}
              />
              {formErrors.bank_name && <span className="text-red-500 text-sm">{formErrors.bank_name}</span>}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="bank_ac_holder" className="font-semibold">
                Account Holder <span className="text-red-500">*</span>
              </label>
              <input
                id="bank_ac_holder"
                type="text"
                required
                value={formData.bank_ac_holder}
                onChange={(e) => {
                  setFormData({ ...formData, bank_ac_holder: e.target.value })
                  setFormErrors({ ...formErrors, bank_ac_holder: '' })
                }}
                placeholder="e.g., ABC Pvt Ltd"
                className={`px-3 py-2.5 border rounded-md ${
                  formErrors.bank_ac_holder ? 'border-red-500' : 'border-[#ccc]'
                }`}
              />
              {formErrors.bank_ac_holder && <span className="text-red-500 text-sm">{formErrors.bank_ac_holder}</span>}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="bank_ac_no" className="font-semibold">
                Account Number <span className="text-red-500">*</span>
              </label>
              <input
                id="bank_ac_no"
                type="text"
                required
                value={formData.bank_ac_no}
                onChange={(e) => {
                  setFormData({ ...formData, bank_ac_no: e.target.value })
                  setFormErrors({ ...formErrors, bank_ac_no: '' })
                }}
                placeholder="e.g., 1234567890123"
                className={`px-3 py-2.5 border rounded-md ${
                  formErrors.bank_ac_no ? 'border-red-500' : 'border-[#ccc]'
                }`}
              />
              {formErrors.bank_ac_no && <span className="text-red-500 text-sm">{formErrors.bank_ac_no}</span>}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="bank_ifsc" className="font-semibold">
                IFSC Code <span className="text-red-500">*</span>
              </label>
              <input
                id="bank_ifsc"
                type="text"
                required
                value={formData.bank_ifsc}
                onChange={(e) => {
                  setFormData({ ...formData, bank_ifsc: e.target.value })
                  setFormErrors({ ...formErrors, bank_ifsc: '' })
                }}
                placeholder="e.g., HDFC0001234"
                className={`px-3 py-2.5 border rounded-md ${
                  formErrors.bank_ifsc ? 'border-red-500' : 'border-[#ccc]'
                }`}
              />
              {formErrors.bank_ifsc && <span className="text-red-500 text-sm">{formErrors.bank_ifsc}</span>}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="bank_branch" className="font-semibold">
                Branch
              </label>
              <input
                id="bank_branch"
                type="text"
                value={formData.bank_branch}
                onChange={(e) => setFormData({ ...formData, bank_branch: e.target.value })}
                placeholder="e.g., Mumbai Central"
                className="px-3 py-2.5 border border-[#ccc] rounded-md"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="bank_upi" className="font-semibold">
                UPI ID
              </label>
              <input
                id="bank_upi"
                type="text"
                value={formData.bank_upi}
                onChange={(e) => setFormData({ ...formData, bank_upi: e.target.value })}
                placeholder="e.g., company@upi"
                className="px-3 py-2.5 border border-[#ccc] rounded-md"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="qr_image" className="font-semibold">
                QR Code Image
              </label>
              <input
                id="qr_image"
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleQRFileSelect}
                className="px-3 py-2.5 border border-[#ccc] rounded-md"
                disabled={isUploadingQR}
              />
              {isUploadingQR && (
                <span className="text-sm text-blue-600">Uploading QR code...</span>
              )}
              {qrImagePreview && (
                <div className="mt-2">
                  <img
                    src={qrImagePreview}
                    alt="QR Code Preview"
                    className="w-32 h-32 object-contain border border-[#ccc] rounded-md"
                  />
                  <p className="text-xs text-gray-500 mt-1">QR code uploaded successfully</p>
                </div>
              )}
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
          </div>
        </form>
      </Modal>

      {/* QR Code View Modal */}
      <Modal
        isOpen={viewQrAccount !== null}
        onClose={() => setViewQrAccount(null)}
        title={`QR Code - ${viewQrAccount?.bank_name}`}
        size="md"
        footer={
          <Button variant="outline" size="md" onClick={() => setViewQrAccount(null)}>
            Close
          </Button>
        }
      >
        {viewQrAccount && viewQrAccount.qr_image ? (
          <div className="flex justify-center">
            <img 
              src={viewQrAccount.qr_image} 
              alt={`QR Code for ${viewQrAccount.bank_name}`}
              className="max-w-full h-auto rounded"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect width="400" height="400" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="24" fill="%23999"%3EQR Code Not Available%3C/text%3E%3C/svg%3E'
              }}
            />
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No QR code available for this bank account
          </div>
        )}
      </Modal>
    </>
  )
}
