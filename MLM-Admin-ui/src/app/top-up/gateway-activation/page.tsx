"use client"

import React, { useMemo, useState } from 'react'
import Card, { ToolbarButton } from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, SearchInput, TextInput, DateRangeInput } from '../../../components/ui/FiltersBar'
import Pagination from '../../../components/ui/Pagination'
import { ApproveReject, ViewButton } from '../../../components/ui/ActionButtons'
import StatusBadge from '../../../components/ui/StatusBadge'

type Row = {
  package_id: string
  from_id: string
  activate_id: string
  amt: string
  utr_no: string
  proof: React.ReactNode
  order_id: string
  payment_id: string
  activation_status: 'Success' | 'Pending' | 'Rejected'
  act_req_send_on: string
  updated_at: string
  payment_type: string
  spot_status: string
  expiry_status: 'Active' | 'Expired' | '-'
  total_amt_gains: string
  member_flush: string
}

export default function GatewayActivationPage() {
  const [search, setSearch] = useState('')
  const [pkg, setPkg] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const columns: Array<DataTableColumn<Row>> = useMemo(() => [
    { key: 'package_id', title: 'package_id' },
    { key: 'from_id', title: 'From_id' },
    { key: 'activate_id', title: 'Activate id' },
    { key: 'amt', title: 'Amt' },
    { key: 'utr_no', title: 'Utr_no' },
    { key: 'proof', title: 'proof image' },
    { key: 'order_id', title: 'order_id' },
    { key: 'payment_id', title: 'payment_id' },
    { key: 'activation_status', title: 'activation_status', render: r => (
      <span className={
        r.activation_status === 'Success'
          ? 'px-2 py-1 rounded text-xs font-semibold bg-[#d4edda] text-[#155724]'
          : r.activation_status === 'Pending'
          ? 'px-2 py-1 rounded text-xs font-semibold bg-[#fff3cd] text-[#856404]'
          : 'px-2 py-1 rounded text-xs font-semibold bg-[#f8d7da] text-[#721c24]'
      }>{r.activation_status}</span>
    ) },
    { key: 'act_req_send_on', title: 'act req send_on' },
    { key: 'updated_at', title: 'updated at' },
    { key: 'payment_type', title: 'payment_type' },
    { key: 'spot_status', title: 'spot status' },
    { key: 'expiry_status', title: 'expiry_status', render: r => (
      <span className={
        r.expiry_status === 'Active'
          ? 'px-2 py-1 rounded text-xs font-semibold bg-[#cce5ff] text-[#004085]'
          : r.expiry_status === 'Expired'
          ? 'px-2 py-1 rounded text-xs font-semibold bg-[#f8d7da] text-[#721c24]'
          : ''
      }>{r.expiry_status}</span>
    ) },
    { key: 'total_amt_gains', title: 'total amt gains' },
    { key: 'member_flush', title: 'member flush' },
  ], [])

  const rows: Row[] = [
    {
      package_id: 'SIA7500', from_id: 'SIA00904 - Bhumika', activate_id: 'SIA01528 - Vikas', amt: '7500.00', utr_no: '984518964287',
      proof: <a href="#" className="text-[#007bff] hover:underline font-medium">View img</a>, order_id: 'ORDER_12345', payment_id: 'PAY_67890', activation_status: 'Success',
      act_req_send_on: '2025-10-28 09:30', updated_at: '2025-10-28 09:35', payment_type: 'UPI', spot_status: 'Active', expiry_status: 'Active', total_amt_gains: '500.00', member_flush: 'No'
    },
    {
      package_id: 'SIA2500', from_id: 'SIA00517 - Induri', activate_id: 'SIA00517 - Induri', amt: '2500.00', utr_no: '566669289506',
      proof: <a href="#" className="text-[#007bff] hover:underline font-medium">View img</a>, order_id: 'ORDER_98765', payment_id: 'PAY_43210', activation_status: 'Pending',
      act_req_send_on: '2025-10-29 10:15', updated_at: '-', payment_type: 'Bank', spot_status: 'Pending', expiry_status: '-', total_amt_gains: '0.00', member_flush: 'No'
    },
    {
      package_id: 'SIA5000', from_id: 'SIA00021 - Mariyam', activate_id: 'SIA00021 - Mariyam', amt: '5000.00', utr_no: '-',
      proof: <span>-</span>, order_id: 'ORDER_55555', payment_id: 'PAY_55555', activation_status: 'Rejected',
      act_req_send_on: '2025-10-27 12:00', updated_at: '2025-10-27 12:05', payment_type: 'Wallet', spot_status: 'Expired', expiry_status: 'Expired', total_amt_gains: '0.00', member_flush: 'Yes'
    },
  ]

  return (
    <Card
      title="Gateway Activation"
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
        renderActions={(row) => (
          row.activation_status === 'Pending' ? <ApproveReject /> : <ViewButton />
        )}
        minWidthPx={2500}
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