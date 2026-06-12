"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Card, { ToolbarButton } from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, TextInput } from '../../../components/ui/FiltersBar'
import { EditButton, DeleteButton } from '../../../components/ui/ActionButtons'
import Pagination from '../../../components/ui/Pagination'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import { getPackages, getPackageById, createPackage, updatePackage, deletePackage, type Package } from '../../../lib/mock/packages'
import { exportToCsv } from '../../../lib/export'

type Row = {
  package_name: string
  package_price: string
  self_roi_percentage: string
  global_helping: 'Yes' | 'No'
  show_status: 'Show' | 'Hide'
  direct_spot_percent: string
  direct_monthly_royalty_percent: string
  package_id: string
}

export default function PackageSettingPage() {
  const [packageFilter, setPackageFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)  // Increased to show all packages on one page
  const [packages, setPackages] = useState<Package[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPackageId, setEditingPackageId] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    package_name: '',
    price: '',
    self_roi_percentage: '',
    global_helping: 'No' as 'Yes' | 'No',
    global_ids: '' as string,
    show_status: 'Show' as 'Show' | 'Hide',
    direct_spot_percent: '',
    direct_monthly_royalty_percent: '',
  })

  // Fetch packages from API
  const fetchPackages = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const params: any = {
        page,
        limit: pageSize,
        sort: 'price',  // Sort by price to show packages in order
        order: 'asc',   // Ascending order (lowest to highest)
      }
      
      // Apply search filter if provided
      if (packageFilter.trim()) {
        params.search = packageFilter.trim()
      }
      
      const response = await getPackages(params)
      setPackages(response.items)
      setTotal(response.total)
    } catch (err: any) {
      console.error('Error fetching packages:', err)
      setError(err.message || 'Failed to fetch packages')
      setPackages([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, packageFilter])

  // Fetch packages on mount and when filters change
  useEffect(() => {
    fetchPackages()
  }, [fetchPackages])

  // Map API response to UI format
  const rows: Row[] = useMemo(() => {
    return packages.map((pkg) => {
      // Map global_helping: global_ids > 0 → 'Yes', else 'No'
      const globalHelping: 'Yes' | 'No' = (pkg.global_ids && pkg.global_ids > 0) ? 'Yes' : 'No'
      
      // Map show_status: status 'active' → 'Show', 'inactive' → 'Hide'
      const showStatus: 'Show' | 'Hide' = pkg.status === 'active' ? 'Show' : 'Hide'
      
      // Format self_roi_percent as percentage string
      const selfRoiPercentage = pkg.self_roi_percent !== null && pkg.self_roi_percent !== undefined
        ? `${pkg.self_roi_percent}%`
        : '0%'
      
      // Format price with ₹ symbol and 2 decimal places
      const formattedPrice = `₹${pkg.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      
      // Format direct level percentages
      const directSpotPercent = pkg.direct_spot_percent !== null && pkg.direct_spot_percent !== undefined
        ? `${pkg.direct_spot_percent}%`
        : '-'
      
      const directMonthlyRoyaltyPercent = pkg.direct_monthly_royalty_percent !== null && pkg.direct_monthly_royalty_percent !== undefined
        ? `${pkg.direct_monthly_royalty_percent}%`
        : (pkg.recurring_rate_percent !== null && pkg.recurring_rate_percent !== undefined
          ? `${pkg.recurring_rate_percent}%`
          : '-')
      
      return {
        package_name: pkg.name,
        package_price: formattedPrice,
        self_roi_percentage: selfRoiPercentage,
        global_helping: globalHelping,
        show_status: showStatus,
        direct_spot_percent: directSpotPercent,
        direct_monthly_royalty_percent: directMonthlyRoyaltyPercent,
        package_id: pkg.id.toString(),
      }
    })
  }, [packages])

  // Handle edit - load package data into form
  const handleEdit = useCallback(async (packageId: string) => {
    try {
      const pkgId = parseInt(packageId, 10)
      if (isNaN(pkgId)) {
        alert('Invalid package ID')
        return
      }
      
      setIsLoading(true)
      const pkg = await getPackageById(pkgId)
      
      // Map API data to form format
      setFormData({
        package_name: pkg.name,
        price: pkg.price.toString(),
        self_roi_percentage: pkg.self_roi_percent?.toString() || '',
        global_helping: (pkg.global_ids && pkg.global_ids > 0) ? 'Yes' : 'No',
        global_ids: pkg.global_ids?.toString() || '',
        show_status: pkg.status === 'active' ? 'Show' : 'Hide',
        direct_spot_percent: pkg.direct_spot_percent?.toString() || '',
        direct_monthly_royalty_percent: pkg.direct_monthly_royalty_percent?.toString() || pkg.recurring_rate_percent?.toString() || '',
      })
      
      setEditingPackageId(pkgId)
      setIsModalOpen(true)
    } catch (err: any) {
      console.error('Error loading package:', err)
      alert(`Error loading package: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Handle delete
  const handleDelete = useCallback(async (packageName: string, packageId: string) => {
    if (!confirm(`Are you sure you want to delete the package "${packageName}"? This action cannot be undone.`)) {
      return
    }

    try {
      const pkgId = parseInt(packageId, 10)
      if (isNaN(pkgId)) {
        alert('Invalid package ID')
        return
      }
      
      setIsLoading(true)
      await deletePackage(pkgId)
      await fetchPackages() // Refresh list
      alert(`Package "${packageName}" deleted successfully!`)
    } catch (err: any) {
      console.error('Error deleting package:', err)
      alert(`Error deleting package: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }, [fetchPackages])

  // Handle save (create or update)
  const handleSavePackage = useCallback(async () => {
    // Validation
    if (!formData.package_name.trim()) {
      alert('Please enter package name')
      return
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      alert('Please enter a valid price')
      return
    }

    try {
      setIsSubmitting(true)
      
      // Validate mandatory Direct Level commission fields
      if (!formData.direct_spot_percent || formData.direct_spot_percent.trim() === '') {
        alert('⚠️ Error: Direct Level Spot % is required!\n\nThis field is mandatory. Direct referrers will NOT receive SPOT commissions if this value is not set.')
        setIsSubmitting(false)
        return
      }
      
      if (!formData.direct_monthly_royalty_percent || formData.direct_monthly_royalty_percent.trim() === '') {
        alert('⚠️ Error: Direct Level Monthly Royalty % is required!\n\nThis field is mandatory. Direct referrers will NOT receive MONTHLY commissions if this value is not set.')
        setIsSubmitting(false)
        return
      }
      
      // Validate numeric values
      const spotPercent = parseFloat(formData.direct_spot_percent)
      const monthlyPercent = parseFloat(formData.direct_monthly_royalty_percent)
      
      if (isNaN(spotPercent) || spotPercent < 0 || spotPercent > 100) {
        alert('⚠️ Error: Direct Level Spot % must be a valid number between 0 and 100.')
        setIsSubmitting(false)
        return
      }
      
      if (isNaN(monthlyPercent) || monthlyPercent < 0 || monthlyPercent > 100) {
        alert('⚠️ Error: Direct Level Monthly Royalty % must be a valid number between 0 and 100.')
        setIsSubmitting(false)
        return
      }
      
      // Map UI form data to API format
      const apiData: any = {
        name: formData.package_name.trim(),
        price: parseFloat(formData.price),
        self_roi_percent: formData.self_roi_percentage ? parseFloat(formData.self_roi_percentage.replace('%', '')) : null,
        global_ids: formData.global_ids && formData.global_ids.trim() ? parseInt(formData.global_ids, 10) : (formData.global_helping === 'Yes' ? 1 : null), // Use global_ids if provided, else fallback to Yes/No logic
        status: formData.show_status === 'Show' ? 'active' : 'inactive',
        validity_months: 12, // Default value
        direct_spot_percent: spotPercent,
        direct_monthly_royalty_percent: monthlyPercent,
      }
      
      if (editingPackageId) {
        // Update existing package
        await updatePackage(editingPackageId, apiData)
        alert('Package updated successfully!')
      } else {
        // Create new package
        await createPackage(apiData)
        alert('Package created successfully!')
      }
      
      // Reset form and close modal
      setFormData({
        package_name: '',
        price: '',
        self_roi_percentage: '',
        global_helping: 'No',
        global_ids: '',
        show_status: 'Show',
        direct_spot_percent: '',
        direct_monthly_royalty_percent: '',
      })
      setEditingPackageId(null)
      setIsModalOpen(false)
      
      // Refresh packages list
      await fetchPackages()
    } catch (err: any) {
      console.error('Error saving package:', err)
      alert(`Error saving package: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, editingPackageId, fetchPackages])

  const columns: Array<DataTableColumn<Row>> = useMemo(() => [
    {
      key: 'action',
      title: 'Action',
      render: (row: Row): React.ReactNode => (
        <div className="flex items-center gap-1">
          <EditButton onClick={() => handleEdit(row.package_id)} />
          <DeleteButton onClick={() => handleDelete(row.package_name, row.package_id)} />
        </div>
      )
    },
    { 
      key: 'package_name', 
      title: 'Package name',
      render: (r: Row) => (
        <span className="font-semibold">{r.package_name}</span>
      )
    },
    { 
      key: 'package_price', 
      title: 'Package price',
      render: (r: Row) => (
        <span className="font-medium">{r.package_price}</span>
      )
    },
    { 
      key: 'self_roi_percentage', 
      title: 'Self roi in percentage'
    },
    { 
      key: 'global_helping', 
      title: 'Global helping'
    },
    { 
      key: 'show_status', 
      title: 'Show status',
      render: (r: Row) => (
        <span className={`px-2 py-1 rounded text-xs font-semibold ${
          r.show_status === 'Show'
            ? 'bg-[#d4edda] text-[#155724]'
            : 'bg-[#f8d7da] text-[#721c24]'
        }`}>
          {r.show_status}
        </span>
      )
    },
    { 
      key: 'direct_spot_percent', 
      title: 'Direct spot %',
      render: (r: Row) => (
        <span className="font-medium text-blue-700">
          {r.direct_spot_percent}
        </span>
      )
    },
    { 
      key: 'direct_monthly_royalty_percent', 
      title: 'Direct monthly royalty %',
      render: (r: Row) => (
        <span className="font-medium text-green-700">
          {r.direct_monthly_royalty_percent}
        </span>
      )
    },
  ], [handleEdit, handleDelete])

  // Filter rows based on packageFilter (client-side for now)
  const filteredRows = useMemo(() => {
    if (!packageFilter.trim()) {
      return rows
    }
    return rows.filter(row => 
      row.package_name.toLowerCase().includes(packageFilter.toLowerCase().trim())
    )
  }, [rows, packageFilter])

  // Paginate filtered rows
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    const end = start + pageSize
    return filteredRows.slice(start, end)
  }, [filteredRows, page, pageSize])

  const handleExport = () => {
    if (!packages.length) {
      alert('No package records available to export.')
      return
    }

    const headers = ['Package Name', 'Price', 'Self ROI %', 'Global Helping', 'Show Status']
    const data = packages.map((pkg: Package) => {
      const globalHelping = (pkg.global_ids && pkg.global_ids > 0) ? 'Yes' : 'No'
      const showStatus = pkg.status === 'active' ? 'Show' : 'Hide'
      const selfRoiPercent = pkg.self_roi_percent !== null && pkg.self_roi_percent !== undefined
        ? `${pkg.self_roi_percent}%`
        : '0%'
      
      return [
        pkg.name,
        pkg.price.toFixed(2),
        selfRoiPercent,
        globalHelping,
        showStatus,
      ]
    })

    exportToCsv('package-settings.csv', headers, data)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSearch = () => {
    setPage(1) // Reset to first page when searching
    fetchPackages() // Fetch with search filter                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           
  }

  const handleClearFilters = () => {
    setPackageFilter('')
    setPage(1)
  }

  const handleAddNew = () => {
    setEditingPackageId(null)
    setFormData({
      package_name: '',
      price: '',
      self_roi_percentage: '',
      global_helping: 'No',
      global_ids: '',
      show_status: 'Show',
      direct_spot_percent: '',
      direct_monthly_royalty_percent: '',
    })
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    if (!isSubmitting) {
      setIsModalOpen(false)
      setEditingPackageId(null)
      setFormData({
        package_name: '',
        price: '',
        self_roi_percentage: '',
        global_helping: 'No',
        global_ids: '',
        show_status: 'Show',
        direct_spot_percent: '',
        direct_monthly_royalty_percent: '',
      })
    }
  }

  return (
    <>
      <Card
        title="Package Setting"
        toolbarRight={
          <>
            <Button
              variant="outline"
              size="md"
              onClick={handleAddNew}
              aria-label="Add Package Setting"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>Add Package Setting</span>
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
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-gray-600">Loading packages...</div>
          </div>
        ) : (
        <DataTable<Row>
          columns={columns}
            rows={paginatedRows}
            minWidthPx={1200}
        />
        )}

        <FiltersBar>
          <TextInput 
            id="package-name-filter" 
            label="Filter by Package Name:" 
            value={packageFilter} 
            onChange={setPackageFilter} 
            placeholder="Enter package name..." 
          />
          <PrimaryButton type="button" onClick={handleSearch} disabled={isLoading}>
            Search
          </PrimaryButton>
          <SecondaryButton type="button" onClick={handleClearFilters} disabled={isLoading}>
            Clear filtering
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
      </Card>

      {/* Add/Edit Package Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingPackageId ? "Edit Package Setting" : "Add Package Setting"}
        size="xl"
        footer={
          <>
            <Button
              variant="outline"
              size="md"
              onClick={handleCloseModal}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSavePackage}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : editingPackageId ? 'Update' : 'Save'}
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSavePackage(); }} className="grid grid-cols-2 gap-4">
                <div className="col-span-2 flex flex-col gap-2">
                  <label htmlFor="pkg_name" className="font-semibold">Package Name <span className="text-red-500">*</span></label>
                  <input
                    id="pkg_name"
                    type="text"
                    required
                    value={formData.package_name}
                    onChange={(e) => setFormData({ ...formData, package_name: e.target.value })}
                    placeholder="Enter package name"
                    className="px-3 py-2.5 border border-[#ccc] rounded-md"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="price" className="font-semibold">Price <span className="text-red-500">*</span></label>
                  <input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="e.g., 2500.00"
                    className="px-3 py-2.5 border border-[#ccc] rounded-md"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="roi_percentage" className="font-semibold">Self ROI %</label>
                  <input
                    id="roi_percentage"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.self_roi_percentage.replace('%', '')}
                    onChange={(e) => setFormData({ ...formData, self_roi_percentage: e.target.value })}
                    placeholder="e.g., 1.5 (without % sign)"
                    className="px-3 py-2.5 border border-[#ccc] rounded-md"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="global_helping" className="font-semibold">Global Helping</label>
                  <select
                    id="global_helping"
                    value={formData.global_helping}
                    onChange={(e) => setFormData({ ...formData, global_helping: e.target.value as 'Yes' | 'No' })}
                    className="px-3 py-2.5 border border-[#ccc] rounded-md"
                    disabled={isSubmitting}
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="global_ids" className="font-semibold">Global IDs (Cap) <span className="text-red-500">*</span></label>
                  <input
                    id="global_ids"
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={formData.global_ids}
                    onChange={(e) => setFormData({ ...formData, global_ids: e.target.value })}
                    placeholder="e.g., 55, 325, 1100 (package cap for global IDs)"
                    className="px-3 py-2.5 border border-[#ccc] rounded-md"
                    disabled={isSubmitting}
                  />
                  <small className="text-gray-500 text-xs">Maximum number of global IDs allowed for this package (used for commission calculations)</small>
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="show_status" className="font-semibold">Show Status</label>
                  <select
                    id="show_status"
                    value={formData.show_status}
                    onChange={(e) => setFormData({ ...formData, show_status: e.target.value as 'Show' | 'Hide' })}
                    className="px-3 py-2.5 border border-[#ccc] rounded-md"
                    disabled={isSubmitting}
                  >
                    <option value="Show">Show</option>
                    <option value="Hide">Hide</option>
                  </select>
                </div>
                <div className="col-span-2 border-t pt-4 mt-2">
                  <h3 className="font-semibold text-lg text-gray-900 mb-2">Direct Level (Field Worker) Commission Settings</h3>
                  
                  {/* Important Warning Box */}
                  <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-4 rounded">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h4 className="text-sm font-semibold text-amber-800 mb-1">⚠️ Mandatory Fields - Required for Commission Calculation</h4>
                        <p className="text-sm text-amber-700">
                          These values are <strong>mandatory</strong> and must be set for every package. 
                          <strong> If not set, direct referrers (Field Worker - Level 0) will NOT receive any SPOT or MONTHLY commissions</strong> when someone purchases this package.
                        </p>
                        <p className="text-sm text-amber-700 mt-1">
                          <strong>Why?</strong> Direct commissions are package-specific. Each package can have different commission rates for its direct referrers. 
                          These values override any default settings and give you full control over commission rates per package.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label htmlFor="direct_spot_percent" className="font-semibold">
                        Direct Level Spot % <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="direct_spot_percent"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        required
                        value={formData.direct_spot_percent}
                        onChange={(e) => setFormData({ ...formData, direct_spot_percent: e.target.value })}
                        placeholder="e.g., 5.0 (for 5%)"
                        className={`px-3 py-2.5 border rounded-md ${
                          !formData.direct_spot_percent ? 'border-red-300 bg-red-50' : 'border-[#ccc]'
                        }`}
                        disabled={isSubmitting}
                      />
                      <small className="text-gray-600 text-xs">
                        <strong>Required:</strong> One-time SPOT commission percentage paid to direct referrer when someone purchases this package. 
                        <br />Example: 5.0 = 5% of purchase amount (₹1,00,000 purchase = ₹5,000 SPOT commission)
                      </small>
                      {!formData.direct_spot_percent && (
                        <small className="text-red-600 text-xs font-medium">
                          ⚠️ This field is required. Direct referrers will NOT receive SPOT commission if left empty.
                        </small>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="direct_monthly_royalty_percent" className="font-semibold">
                        Direct Level Monthly Royalty % <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="direct_monthly_royalty_percent"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        required
                        value={formData.direct_monthly_royalty_percent}
                        onChange={(e) => setFormData({ ...formData, direct_monthly_royalty_percent: e.target.value })}
                        placeholder="e.g., 0.5 (for 0.5%)"
                        className={`px-3 py-2.5 border rounded-md ${
                          !formData.direct_monthly_royalty_percent ? 'border-red-300 bg-red-50' : 'border-[#ccc]'
                        }`}
                        disabled={isSubmitting}
                      />
                      <small className="text-gray-600 text-xs">
                        <strong>Required:</strong> Monthly recurring royalty percentage paid to direct referrer. 
                        <br />Example: 0.5 = 0.5% monthly (₹1,00,000 purchase = ₹500/month royalty, credited daily)
                      </small>
                      {!formData.direct_monthly_royalty_percent && (
                        <small className="text-red-600 text-xs font-medium">
                          ⚠️ This field is required. Direct referrers will NOT receive MONTHLY commission if left empty.
                        </small>
                      )}
                    </div>
                  </div>
                </div>
              </form>
      </Modal>
    </>
  )
}
