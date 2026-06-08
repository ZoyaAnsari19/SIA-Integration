"use client"

import React, { useMemo, useState } from 'react'
import Card from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, TextInput } from '../../../components/ui/FiltersBar'
import { EditButton, DeleteButton } from '../../../components/ui/ActionButtons'
import Pagination from '../../../components/ui/Pagination'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'

type Row = {
  level: number
  amt_percentage: number
  associated_package: string
  income_id: string
}

export default function SpotIncomePage() {
  const [packageFilter, setPackageFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    level: '',
    amt_percentage: '',
    package: 'default' as 'default' | 'pro' | 'premium',
  })

  const packageLabel = (val: string): string => {
    if (val === 'default') return 'Default Package'
    if (val === 'pro') return 'Pro Plan'
    if (val === 'premium') return 'Premium Tier'
    return val
  }

  const columns: Array<DataTableColumn<Row>> = useMemo(() => [
    { 
      key: 'level', 
      title: 'level',
      render: (r: Row) => (
        <span className="font-semibold">**{r.level}**</span>
      )
    },
    { 
      key: 'amt_percentage', 
      title: 'amt. [in %]',
      render: (r: Row) => `${r.amt_percentage.toFixed(1)}%`
    },
    { 
      key: 'associated_package', 
      title: 'Associated Package'
    },
  ], [])

  const [rows, setRows] = useState<Row[]>([
    { level: 1, amt_percentage: 5.0, associated_package: 'Default Package', income_id: '1' },
    { level: 2, amt_percentage: 3.0, associated_package: 'Default Package', income_id: '2' },
    { level: 3, amt_percentage: 2.0, associated_package: 'Default Package', income_id: '3' },
    { level: 4, amt_percentage: 1.5, associated_package: 'Default Package', income_id: '4' },
    { level: 5, amt_percentage: 1.0, associated_package: 'Default Package', income_id: '5' },
    { level: 1, amt_percentage: 6.0, associated_package: 'Pro Plan', income_id: '6' },
    { level: 2, amt_percentage: 4.0, associated_package: 'Pro Plan', income_id: '7' },
    { level: 3, amt_percentage: 3.0, associated_package: 'Pro Plan', income_id: '8' },
    { level: 1, amt_percentage: 7.0, associated_package: 'Premium Tier', income_id: '9' },
    { level: 2, amt_percentage: 5.0, associated_package: 'Premium Tier', income_id: '10' },
    { level: 3, amt_percentage: 3.5, associated_package: 'Premium Tier', income_id: '11' },
    { level: 6, amt_percentage: 0.5, associated_package: 'Default Package', income_id: '12' },
    { level: 7, amt_percentage: 0.3, associated_package: 'Default Package', income_id: '13' },
    { level: 8, amt_percentage: 0.2, associated_package: 'Default Package', income_id: '14' },
    { level: 9, amt_percentage: 0.1, associated_package: 'Default Package', income_id: '15' },
  ])

  const handleEdit = (incomeId: string) => {
    const row = rows.find(r => r.income_id === incomeId)
    if (row) {
      // Extract package code from label
      const packageCode = row.associated_package.includes('Pro Plan') ? 'pro' : 
                         row.associated_package.includes('Premium') ? 'premium' : 'default'
      setFormData({
        level: row.level.toString(),
        amt_percentage: row.amt_percentage.toString(),
        package: packageCode as 'default' | 'pro' | 'premium',
      })
      setIsModalOpen(true)
    }
    alert(`Editing Spot Income Setting for Level: ${row?.level}`)
  }

  const handleDelete = (incomeId: string) => {
    const row = rows.find(r => r.income_id === incomeId)
    if (row && confirm(`Are you sure you want to delete the Spot Income Set for Level: ${row.level}?`)) {
      setRows(rows.filter(r => r.income_id !== incomeId))
      alert(`Spot Income Set for Level ${row.level} deleted.`)
    }
  }

  const handleExport = () => {
    alert('Exporting spot income data...')
    // In a real app: Trigger export/download
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSearch = () => {
    alert(`Applying filter by Package Name: ${packageFilter}`)
    // In a real app: Filter table data based on packageFilter
  }

  const handleClearFilters = () => {
    setPackageFilter('')
    alert('Filters cleared! Ready to fetch unfiltered data.')
  }

  const handleAddNew = () => {
    setFormData({
      level: '',
      amt_percentage: '',
      package: 'default',
    })
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setFormData({
      level: '',
      amt_percentage: '',
      package: 'default',
    })
  }

  const handleSaveIncome = () => {
    if (!formData.level || !formData.amt_percentage) {
      alert('Please fill in all required fields (Level and Amount).')
      return
    }

    const newIncome: Row = {
      level: parseInt(formData.level),
      amt_percentage: parseFloat(formData.amt_percentage),
      associated_package: packageLabel(formData.package),
      income_id: Date.now().toString(),
    }

    setRows([newIncome, ...rows])
    handleCloseModal()
    alert('Spot Income setting added successfully!')
  }

  return (
    <>
      <Card
        title="Spot Income Settings (Level-wise)"
        toolbarRight={
          <>
            <Button
              variant="success"
              size="md"
              onClick={handleAddNew}
              aria-label="Add Spot Income Setting"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>Add Spot Income Setting</span>
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
        <DataTable<Row>
          columns={columns}
          rows={rows}
          renderActions={(row) => (
            <div className="flex items-center gap-1">
              <EditButton onClick={() => handleEdit(row.income_id)} />
              <DeleteButton onClick={() => handleDelete(row.income_id)} />
            </div>
          )}
          minWidthPx={600}
        />

        <FiltersBar>
          <TextInput 
            id="package-name-filter" 
            label="Filter by Package Name:" 
            value={packageFilter} 
            onChange={setPackageFilter} 
            placeholder="Enter package name or level..." 
          />
          <PrimaryButton type="button" onClick={handleSearch}>Search</PrimaryButton>
          <SecondaryButton type="button" onClick={handleClearFilters}>Clear filtering</SecondaryButton>
        </FiltersBar>

        <Pagination
          page={page}
          pageSize={pageSize}
          total={rows.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 25, 50]}
        />
      </Card>

      {/* Add Spot Income Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Add New Spot Income Setting"
        size="sm"
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
              onClick={handleSaveIncome}
            >
              Save
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSaveIncome(); }} className="space-y-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="modal-level" className="font-semibold">Level (e.g., 1, 2, 3):</label>
            <input
              id="modal-level"
              type="number"
              required
              value={formData.level}
              onChange={(e) => setFormData({ ...formData, level: e.target.value })}
              placeholder="Enter income level"
              className="px-3 py-2.5 border border-[#ccc] rounded-md"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="modal-amt-percentage" className="font-semibold">Amount in Percentage (%):</label>
            <input
              id="modal-amt-percentage"
              type="number"
              step="0.01"
              required
              value={formData.amt_percentage}
              onChange={(e) => setFormData({ ...formData, amt_percentage: e.target.value })}
              placeholder="Enter income percentage"
              className="px-3 py-2.5 border border-[#ccc] rounded-md"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="modal-package" className="font-semibold">Associate with Package (Optional):</label>
            <select
              id="modal-package"
              value={formData.package}
              onChange={(e) => setFormData({ ...formData, package: e.target.value as 'default' | 'pro' | 'premium' })}
              className="px-3 py-2.5 border border-[#ccc] rounded-md"
            >
              <option value="default">Default Package</option>
              <option value="pro">Pro Plan</option>
              <option value="premium">Premium Tier</option>
            </select>
          </div>
        </form>
      </Modal>
    </>
  )
}
