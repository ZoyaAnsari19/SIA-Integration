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
  min_invest: number
  max_invest: number
  amt_percentage: number
  condition_member: number
  condition_amount: number
  level_id: string
  income_id: string
}

export default function TeamIncomePage() {
  const [packageFilter, setPackageFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    min_invest: '',
    max_invest: '',
    amt_percentage: '',
    condition_member: '',
    condition_amount: '',
    level_id: '',
  })

  const columns: Array<DataTableColumn<Row>> = useMemo(() => [
    { 
      key: 'min_invest', 
      title: 'min_invest',
      render: (r: Row) => r.min_invest.toFixed(2)
    },
    { 
      key: 'max_invest', 
      title: 'max_invest',
      render: (r: Row) => r.max_invest.toFixed(2)
    },
    { 
      key: 'amt_percentage', 
      title: 'amt in percentage',
      render: (r: Row) => (
        <span className="font-semibold">**{r.amt_percentage.toFixed(1)}%**</span>
      )
    },
    { 
      key: 'condition_member', 
      title: 'condition member',
      render: (r: Row) => r.condition_member.toString()
    },
    { 
      key: 'condition_amount', 
      title: 'condition amount',
      render: (r: Row) => r.condition_amount.toFixed(2)
    },
    { 
      key: 'level_id', 
      title: 'Level/Tier ID'
    },
  ], [])

  const [rows, setRows] = useState<Row[]>([
    { min_invest: 500.00, max_invest: 5000.00, amt_percentage: 10.0, condition_member: 0, condition_amount: 0.00, level_id: 'LVL-1', income_id: '1' },
    { min_invest: 5000.01, max_invest: 15000.00, amt_percentage: 5.0, condition_member: 3, condition_amount: 10000.00, level_id: 'LVL-2', income_id: '2' },
    { min_invest: 15000.01, max_invest: 50000.00, amt_percentage: 3.0, condition_member: 5, condition_amount: 25000.00, level_id: 'LVL-3', income_id: '3' },
    { min_invest: 50000.01, max_invest: 100000.00, amt_percentage: 2.0, condition_member: 7, condition_amount: 75000.00, level_id: 'LVL-4', income_id: '4' },
    { min_invest: 100000.01, max_invest: 200000.00, amt_percentage: 1.5, condition_member: 10, condition_amount: 150000.00, level_id: 'LVL-5', income_id: '5' },
    { min_invest: 200000.01, max_invest: 500000.00, amt_percentage: 1.0, condition_member: 15, condition_amount: 300000.00, level_id: 'LVL-6', income_id: '6' },
    { min_invest: 500000.01, max_invest: 1000000.00, amt_percentage: 0.8, condition_member: 20, condition_amount: 750000.00, level_id: 'LVL-7', income_id: '7' },
    { min_invest: 1000000.01, max_invest: 5000000.00, amt_percentage: 0.5, condition_member: 30, condition_amount: 2000000.00, level_id: 'LVL-8', income_id: '8' },
    { min_invest: 25000.00, max_invest: 75000.00, amt_percentage: 4.0, condition_member: 4, condition_amount: 50000.00, level_id: 'LVL-2A', income_id: '9' },
    { min_invest: 75000.01, max_invest: 150000.00, amt_percentage: 3.5, condition_member: 6, condition_amount: 100000.00, level_id: 'LVL-3A', income_id: '10' },
    { min_invest: 150000.01, max_invest: 300000.00, amt_percentage: 2.5, condition_member: 8, condition_amount: 200000.00, level_id: 'LVL-4A', income_id: '11' },
    { min_invest: 300000.01, max_invest: 600000.00, amt_percentage: 1.8, condition_member: 12, condition_amount: 450000.00, level_id: 'LVL-5A', income_id: '12' },
    { min_invest: 600000.01, max_invest: 1200000.00, amt_percentage: 1.2, condition_member: 18, condition_amount: 900000.00, level_id: 'LVL-6A', income_id: '13' },
    { min_invest: 1200000.01, max_invest: 2500000.00, amt_percentage: 0.9, condition_member: 25, condition_amount: 1800000.00, level_id: 'LVL-7A', income_id: '14' },
    { min_invest: 2500000.01, max_invest: 10000000.00, amt_percentage: 0.6, condition_member: 40, condition_amount: 5000000.00, level_id: 'LVL-8A', income_id: '15' },
  ])

  const handleEdit = (incomeId: string) => {
    const row = rows.find(r => r.income_id === incomeId)
    if (row) {
      setFormData({
        min_invest: row.min_invest.toString(),
        max_invest: row.max_invest.toString(),
        amt_percentage: row.amt_percentage.toString(),
        condition_member: row.condition_member.toString(),
        condition_amount: row.condition_amount.toString(),
        level_id: row.level_id,
      })
      setIsModalOpen(true)
    }
    alert(`Editing Team Income Setting for Level/Tier: ${row?.level_id}`)
  }

  const handleDelete = (incomeId: string) => {
    const row = rows.find(r => r.income_id === incomeId)
    if (row && confirm(`Are you sure you want to delete the Team Income Set for ID: ${row.level_id}?`)) {
      setRows(rows.filter(r => r.income_id !== incomeId))
      alert(`Team Income Set ${row.level_id} deleted.`)
    }
  }

  const handleExport = () => {
    alert('Exporting team income data...')
    // In a real app: Trigger export/download
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSearch = () => {
    alert(`Applying filter by Package Name/Level: ${packageFilter}`)
    // In a real app: Filter table data based on packageFilter
  }

  const handleClearFilters = () => {
    setPackageFilter('')
    alert('Filters cleared! Ready to fetch unfiltered data.')
  }

  const handleAddNew = () => {
    setFormData({
      min_invest: '',
      max_invest: '',
      amt_percentage: '',
      condition_member: '',
      condition_amount: '',
      level_id: '',
    })
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setFormData({
      min_invest: '',
      max_invest: '',
      amt_percentage: '',
      condition_member: '',
      condition_amount: '',
      level_id: '',
    })
  }

  const handleSaveIncome = (closeAfterSave: boolean = true) => {
    if (!formData.min_invest || !formData.max_invest || !formData.amt_percentage || 
        !formData.condition_member || !formData.condition_amount || !formData.level_id) {
      alert('Please fill in all required fields.')
      return
    }

    const newIncome: Row = {
      min_invest: parseFloat(formData.min_invest),
      max_invest: parseFloat(formData.max_invest),
      amt_percentage: parseFloat(formData.amt_percentage),
      condition_member: parseInt(formData.condition_member),
      condition_amount: parseFloat(formData.condition_amount),
      level_id: formData.level_id,
      income_id: Date.now().toString(),
    }

    setRows([newIncome, ...rows])
    
    if (closeAfterSave) {
      handleCloseModal()
    } else {
      // Reset form but keep modal open
      setFormData({
        min_invest: '',
        max_invest: '',
        amt_percentage: '',
        condition_member: '',
        condition_amount: '',
        level_id: '',
      })
    }
    alert('Team Income setting added successfully!')
  }

  return (
    <>
      <Card
        title="Team Income Settings"
        toolbarRight={
          <>
            <Button
              variant="success"
              size="md"
              onClick={handleAddNew}
              aria-label="Add Team Level Income Set"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>Add Team Lvl Income Set</span>
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
          minWidthPx={1000}
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

      {/* Add Team Income Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Add Team Level Income Set"
        size="lg"
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
              variant="primary"
              size="md"
              onClick={() => handleSaveIncome(true)}
            >
              Save and Go Back to List
            </Button>
            <Button
              variant="success"
              size="md"
              onClick={() => handleSaveIncome(false)}
            >
              Save
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSaveIncome(); }} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="modal-min-invest" className="font-semibold text-sm">Min Invest (₹):</label>
              <input
                id="modal-min-invest"
                type="number"
                step="0.01"
                required
                value={formData.min_invest}
                onChange={(e) => setFormData({ ...formData, min_invest: e.target.value })}
                placeholder="Enter minimum investment"
                className="w-full px-3 py-2.5 border border-[#ccc] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="modal-max-invest" className="font-semibold text-sm">Max Invest (₹):</label>
              <input
                id="modal-max-invest"
                type="number"
                step="0.01"
                required
                value={formData.max_invest}
                onChange={(e) => setFormData({ ...formData, max_invest: e.target.value })}
                placeholder="Enter maximum investment"
                className="w-full px-3 py-2.5 border border-[#ccc] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="modal-level-id" className="font-semibold text-sm">Level/Tier ID:</label>
              <input
                id="modal-level-id"
                type="text"
                required
                value={formData.level_id}
                onChange={(e) => setFormData({ ...formData, level_id: e.target.value })}
                placeholder="Enter Level/Tier ID (e.g., LVL-4)"
                className="w-full px-3 py-2.5 border border-[#ccc] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <label htmlFor="modal-amt-percentage" className="font-semibold text-sm">Amount in Percentage (%):</label>
            <input
              id="modal-amt-percentage"
              type="number"
              step="0.01"
              required
              value={formData.amt_percentage}
              onChange={(e) => setFormData({ ...formData, amt_percentage: e.target.value })}
              placeholder="Enter income percentage"
              className="w-full px-3 py-2.5 border border-[#ccc] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="modal-condition-member" className="font-semibold text-sm">Condition Member (Directs):</label>
              <input
                id="modal-condition-member"
                type="number"
                required
                value={formData.condition_member}
                onChange={(e) => setFormData({ ...formData, condition_member: e.target.value })}
                placeholder="Required direct members"
                className="w-full px-3 py-2.5 border border-[#ccc] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="modal-condition-amount" className="font-semibold text-sm">Condition Amount (₹ Team Volume):</label>
              <input
                id="modal-condition-amount"
                type="number"
                step="0.01"
                required
                value={formData.condition_amount}
                onChange={(e) => setFormData({ ...formData, condition_amount: e.target.value })}
                placeholder="Required team business amount"
                className="w-full px-3 py-2.5 border border-[#ccc] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>
        </form>
      </Modal>
    </>
  )
}
