"use client"

import React, { useEffect, useMemo, useState } from 'react'
import Card from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, SearchInput } from '../../../components/ui/FiltersBar'
import Pagination from '../../../components/ui/Pagination'
import { getLegacyActivationHistory, LegacyHistoryItem } from '../../../lib/api/legacy'
import { ToastContainer, useToast } from '../../../components/ui/Toast'

type Row = LegacyHistoryItem & {
  // Flattened display fields for table columns
  user_label: string
  file_and_row: string
}

export default function LegacyActivationHistoryPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [searchUser, setSearchUser] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { toasts, showToast, closeToast } = useToast()

  // Show columns similar to the original Excel sheet
  const columns: Array<DataTableColumn<Row>> = useMemo(() => {
    const excelColumns: Array<{ key: string; title: string; dataKey: string }> = [
      { key: 'excel_user_id', title: 'User ID', dataKey: 'excel_user_id' },
      { key: 'excel_user_name', title: 'User Name', dataKey: 'excel_user_name' },
      // In DB JSON, header is "Request Type"
      { key: 'excel_request_type', title: 'New Request Type', dataKey: 'excel_request_type' },
      { key: 'excel_package', title: 'New Package', dataKey: 'excel_new_package' },
      // In DB JSON, header is "UTR / Txn ID" (with spaces around '/')
      { key: 'excel_utr', title: 'UTR/Txn ID', dataKey: 'excel_utr_txn_id' },
      { key: 'excel_status', title: 'Status', dataKey: 'excel_status' },
      { key: 'excel_renewal_added', title: 'Renewal Added', dataKey: 'excel_renewal_added' },
      // Second Renewal column, if present
      { key: 'excel_renewal_added_1', title: 'Renewal Added (2)', dataKey: 'excel_renewal_added_1' },
      { key: 'excel_clarification', title: 'Clarification', dataKey: 'excel_clarification' },
    ]

    const fromExcel: Array<DataTableColumn<Row>> = excelColumns.map((col) => ({
      key: col.key,
      title: col.title,
      render: (row) => {
        const raw = (row as any)[col.dataKey]
        return raw == null ? '' : String(raw)
      },
    }))

    // Extra meta columns (optional)
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

      const data = await getLegacyActivationHistory({
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
      const message = err?.message || 'Failed to load legacy activation history'
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
      <Card title="Legacy Activation History (Old System)">
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

