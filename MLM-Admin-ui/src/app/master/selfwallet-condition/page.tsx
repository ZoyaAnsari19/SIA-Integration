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
  amount: number
  directmember: number
  wallet_type: string
  condition_id: string
}

export default function SelfWalletConditionPage() {
  const [amountFilter, setAmountFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    amount: '',
    directmember: '',
    wallettype: '' as 'A' | 'B' | 'C' | '',
  })

  const walletTypeLabel = (val: string): string => {
    if (val === 'A') return 'Wallet A (E-Cash)'
    if (val === 'B') return 'Wallet B (Bonus)'
    if (val === 'C') return 'Wallet C (Reward)'
    return val
  }

  const columns: Array<DataTableColumn<Row>> = useMemo(() => [
    { 
      key: 'amount', 
      title: 'amount',
      render: (r: Row) => (
        <span className="font-semibold">**{r.amount.toFixed(2)}**</span>
      )
    },
    { 
      key: 'directmember', 
      title: 'directmember',
      render: (r: Row) => r.directmember.toString()
    },
    { 
      key: 'wallet_type', 
      title: 'wallet type',
      render: (r: Row) => r.wallet_type
    },
  ], [])

  const [rows, setRows] = useState<Row[]>([
    { amount: 1000.00, directmember: 2, wallet_type: 'Wallet A (E-Cash)', condition_id: '1' },
    { amount: 5000.00, directmember: 5, wallet_type: 'Wallet B (Bonus)', condition_id: '2' },
    { amount: 10000.00, directmember: 10, wallet_type: 'Wallet A (E-Cash)', condition_id: '3' },
    { amount: 2000.00, directmember: 3, wallet_type: 'Wallet C (Reward)', condition_id: '4' },
    { amount: 7500.00, directmember: 7, wallet_type: 'Wallet B (Bonus)', condition_id: '5' },
    { amount: 15000.00, directmember: 15, wallet_type: 'Wallet A (E-Cash)', condition_id: '6' },
    { amount: 3000.00, directmember: 4, wallet_type: 'Wallet C (Reward)', condition_id: '7' },
    { amount: 8000.00, directmember: 8, wallet_type: 'Wallet B (Bonus)', condition_id: '8' },
    { amount: 12000.00, directmember: 12, wallet_type: 'Wallet A (E-Cash)', condition_id: '9' },
    { amount: 25000.00, directmember: 25, wallet_type: 'Wallet C (Reward)', condition_id: '10' },
  ])

  const handleEdit = (conditionId: string) => {
    const row = rows.find(r => r.condition_id === conditionId)
    if (row) {
      // Extract wallet type code from label
      const walletCode = row.wallet_type.includes('E-Cash') ? 'A' : 
                        row.wallet_type.includes('Bonus') ? 'B' : 'C'
      setFormData({
        amount: row.amount.toString(),
        directmember: row.directmember.toString(),
        wallettype: walletCode as 'A' | 'B' | 'C',
      })
      setIsModalOpen(true)
      // In a real app: Track editing mode and update the correct row on save
    }
    alert(`Editing wallet condition for Amount: ${row?.amount.toFixed(2)}`)
  }

  const handleDelete = (conditionId: string) => {
    const row = rows.find(r => r.condition_id === conditionId)
    if (row && confirm(`Are you sure you want to delete the condition for Amount: ${row.amount.toFixed(2)}?`)) {
      setRows(rows.filter(r => r.condition_id !== conditionId))
      alert(`Condition for Amount ${row.amount.toFixed(2)} deleted.`)
    }
  }

  const handleExport = () => {
    alert('Exporting wallet condition data...')
    // In a real app: Trigger export/download
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSearch = () => {
    alert(`Applying filter by Amount: ${amountFilter}`)
    // In a real app: Filter table data based on amountFilter
  }

  const handleClearFilters = () => {
    setAmountFilter('')
    alert('Filters cleared! Ready to fetch unfiltered data.')
  }

  const handleAddNew = () => {
    setFormData({
      amount: '',
      directmember: '',
      wallettype: '',
    })
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setFormData({
      amount: '',
      directmember: '',
      wallettype: '',
    })
  }

  const handleSaveCondition = (closeAfterSave: boolean = true) => {
    if (!formData.amount || !formData.directmember || !formData.wallettype) {
      alert('Please fill in all fields.')
      return
    }

    const newCondition: Row = {
      amount: parseFloat(formData.amount),
      directmember: parseInt(formData.directmember),
      wallet_type: walletTypeLabel(formData.wallettype),
      condition_id: Date.now().toString(),
    }

    setRows([newCondition, ...rows])
    
    if (closeAfterSave) {
      handleCloseModal()
    } else {
      // Reset form but keep modal open
      setFormData({
        amount: '',
        directmember: '',
        wallettype: '',
      })
    }
    alert('Wallet condition added successfully!')
  }

  return (
    <>
      <Card
        title="Wallet Income"
        toolbarRight={
          <>
            <Button
              variant="primary"
              size="md"
              onClick={handleAddNew}
              aria-label="Add Wallet Condition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>Add Wallet Condition</span>
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
              <EditButton onClick={() => handleEdit(row.condition_id)} />
              <DeleteButton onClick={() => handleDelete(row.condition_id)} />
            </div>
          )}
          minWidthPx={700}
        />

        <FiltersBar>
          <TextInput 
            id="amount-filter" 
            label="Filter by Amount:" 
            value={amountFilter} 
            onChange={setAmountFilter} 
            placeholder="Enter minimum amount..." 
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

      {/* Add Wallet Condition Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Add New Wallet Condition"
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
              variant="primary"
              size="md"
              onClick={() => handleSaveCondition(true)}
            >
              Save and Go Back to List
            </Button>
            <Button
              variant="success"
              size="md"
              onClick={() => handleSaveCondition(false)}
            >
              Save
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSaveCondition(); }} className="space-y-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="modal-amount" className="font-semibold">Amount (e.g., Target Amount):</label>
            <input
              id="modal-amount"
              type="number"
              step="0.01"
              required
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="Enter target amount"
              className="px-3 py-2.5 border border-[#ccc] rounded-md"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="modal-directmember" className="font-semibold">Required Direct Members:</label>
            <input
              id="modal-directmember"
              type="number"
              required
              value={formData.directmember}
              onChange={(e) => setFormData({ ...formData, directmember: e.target.value })}
              placeholder="Enter required direct members"
              className="px-3 py-2.5 border border-[#ccc] rounded-md"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="modal-wallet-type" className="font-semibold">Wallet Type:</label>
            <select
              id="modal-wallet-type"
              required
              value={formData.wallettype}
              onChange={(e) => setFormData({ ...formData, wallettype: e.target.value as 'A' | 'B' | 'C' })}
              className="px-3 py-2.5 border border-[#ccc] rounded-md"
            >
              <option value="">-- Select Wallet Type --</option>
              <option value="A">Wallet A (E-Cash)</option>
              <option value="B">Wallet B (Bonus)</option>
              <option value="C">Wallet C (Reward)</option>
            </select>
          </div>
        </form>
      </Modal>
    </>
  )
}