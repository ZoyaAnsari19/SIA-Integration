"use client"

import React, { useEffect, useMemo, useState } from 'react'
import Card from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, SearchInput } from '../../../components/ui/FiltersBar'
import Pagination from '../../../components/ui/Pagination'
import { getLegacySpotHistory, LegacyHistoryItem } from '../../../lib/api/legacy'
import { ToastContainer, useToast } from '../../../components/ui/Toast'

type Row = LegacyHistoryItem & {
  user_label: string
  file_and_row: string
}

export default function LegacySpotHistoryPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [searchUser, setSearchUser] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { toasts, showToast, closeToast } = useToast()

  // Show columns similar to the original Excel sheet (same structure as activation)
  const columns: Array<DataTableColumn<Row>> = useMemo(() => {
    const excelColumns: Array<{ key: string; title: string; dataKey: string }> = [
      { key: 'excel_user_id', title: 'User ID', dataKey: 'excel_user_id' },
      { key: 'excel_income_level', title: 'Income Level', dataKey: 'excel_income_level' },
      { key: 'excel_income_amount', title: 'Income Amount', dataKey: 'excel_income_amount' },
      { key: 'excel_from_id', title: 'From ID', dataKey: 'excel_from_id' },
      { key: 'excel_package_name', title: 'Package Name', dataKey: 'excel_package_name' },
      { key: 'excel_investment_amount', title: 'Investment Amount', dataKey: 'excel_investment_amount' },
      { key: 'excel_status', title: 'Status', dataKey: 'excel_status' },
      { key: 'excel_credited_date', title: 'Credited Date', dataKey: 'excel_credited_date' },
      { key: 'excel_investment_type', title: 'Investment Type', dataKey: 'excel_investment_type' },
    ]

    const fromExcel: Array<DataTableColumn<Row>> = excelColumns.map((col) => ({
      key: col.key,
      title: col.title,
      render: (row) => {
        const raw = (row as any)[col.dataKey]
        return raw == null ? '' : String(raw)
      },
    }))

    const metaColumns: Array<DataTableColumn<Row>> = [
      {
        key: 'excel_row_index',
        title: 'Row #',
        render: (row) => row.row_index.toString(),
      },
      {
        key: 'imported_at',
        title: 'Imported At',
        render: (row) => row.imported_at,
      },
    ]

    return [...fromExcel, ...metaColumns]
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const data = await getLegacySpotHistory({
        page,
        limit: pageSize,
        user_id: searchUser || undefined,
      })

      const mapped: Row[] = data.items.map((item) => ({
        ...item,
        user_label: `${item.display_id} - ${item.user_name || 'N/A'}`,
        file_and_row: `${item.source_file} (#${item.row_index})`,
      }))

      setRows(mapped)
      setTotal(data.total)
    } catch (err: any) {
      const message = err?.message || 'Failed to load legacy spot history'
      setError(message)
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize])

  const handleSearch = () => {
    setPage(1)
    fetchData()
  }

  const handleClear = () => {
    setSearchUser('')
    setPage(1)
    fetchData()
  }

  return (
    <>
      <ToastContainer toasts={toasts} onClose={closeToast} />
      <Card title="Legacy Spot History (Old System)">
        <DataTable<Row>
          columns={columns}
          rows={rows}
          minWidthPx={800}
        />

        <FiltersBar>
          <SearchInput
            value={searchUser}
            onChange={setSearchUser}
            placeholder="User ID or Display ID (e.g. 280 or SIA00299)"
          />
          <PrimaryButton type="button" onClick={handleSearch} disabled={loading}>
            Search
          </PrimaryButton>
          <SecondaryButton type="button" onClick={handleClear} disabled={loading}>
            Clear
          </SecondaryButton>
        </FiltersBar>

        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 20, 50, 100]}
        />
      </Card>
    </>
  )
}

