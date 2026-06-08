"use client"

import React, { useMemo, useState } from 'react'
import Card, { ToolbarButton } from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, SearchInput, TextInput, DateRangeInput } from '../../../components/ui/FiltersBar'
import Pagination from '../../../components/ui/Pagination'
import { ViewButton } from '../../../components/ui/ActionButtons'
import StatusBadge from '../../../components/ui/StatusBadge'

type Row = {
  invoice_id: string
  package_id: string
  expiry_status: 'expired' | 'active' | 'rejected'
  from_id: string
  user_id: string
  activate_id: string
  amt: string
  utr_no: string
  proof: React.ReactNode
  order_id: string
  payment_id: string
  payment_type: string
  activation_status: 'activated' | 'rejected'
  date: string
}

export default function ActivationHistoryPage() {
  const [search, setSearch] = useState('')
  const [pkg, setPkg] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const columns: Array<DataTableColumn<Row>> = useMemo(() => [
    { key: 'invoice_id', title: 'invoice_id' },
    { key: 'package_id', title: 'package_id' },
    { key: 'expiry_status', title: 'Expiry_status', render: r => <StatusBadge variant={r.expiry_status}>{r.expiry_status}</StatusBadge> },
    { key: 'from_id', title: 'From_id' },
    { key: 'user_id', title: 'user_id' },
    { key: 'activate_id', title: 'Activate id' },
    { key: 'amt', title: 'Amt' },
    { key: 'utr_no', title: 'Utr_no' },
    { key: 'proof', title: 'proof image' },
    { key: 'order_id', title: 'order_id' },
    { key: 'payment_id', title: 'payment_id' },
    { key: 'payment_type', title: 'payment_type' },
    { key: 'activation_status', title: 'activation_status', render: r => <StatusBadge variant={r.activation_status === 'activated' ? 'active' : 'rejected'}>{r.activation_status}</StatusBadge> },
    { key: 'date', title: 'date' },
  ], [])

  const rows: Row[] = [
    { invoice_id: '1', package_id: 'SIA00904', expiry_status: 'expired', from_id: 'admin - admin', user_id: '1', activate_id: 'admin - admin', amt: '2500.00', utr_no: '984518964287', proof: <a href="#" className="text-[#007bff] hover:underline font-medium">View img</a>, order_id: '20251028...', payment_id: 'PAY_abc...', payment_type: 'UPI', activation_status: 'activated', date: '2025-10-28 09:30' },
    { invoice_id: '2', package_id: 'SIA00517', expiry_status: 'expired', from_id: 'SIA00021 - Mariyam', user_id: '21', activate_id: 'SIA00021 - Mariyam', amt: '15000.00', utr_no: '566669289506', proof: <a href="#" className="text-[#007bff] hover:underline font-medium">View img</a>, order_id: '20251028...', payment_id: 'PAY_xyz...', payment_type: 'Bank', activation_status: 'rejected', date: '2025-10-28 10:15' },
  ]

  return (
    <Card
      title="Activation Request History"
      toolbarRight={
        <>
          <ToolbarButton aria-label="Export">Export</ToolbarButton>
          <ToolbarButton aria-label="Print">Print</ToolbarButton>
        </>
      }
    >
      <DataTable<Row>
        columns={columns}
        rows={rows}
        renderActions={() => <ViewButton />}
        minWidthPx={1800}
      />

      <FiltersBar>
        <SearchInput value={search} onChange={setSearch} />
        <TextInput id="package-id" label="Package id" value={pkg} onChange={setPkg} placeholder="Package ID..." />
        <DateRangeInput
          id="date-range"
          label="Date Range:"
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />
        <PrimaryButton type="button">Search</PrimaryButton>
        <SecondaryButton type="button" onClick={() => { setSearch(''); setPkg(''); setStartDate(''); setEndDate(''); }}>Clear filtering</SecondaryButton>
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
  )
}


