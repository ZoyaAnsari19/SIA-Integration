"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, TextInput, SelectInput, DateRangeInput } from '../../../components/ui/FiltersBar'
import Pagination from '../../../components/ui/Pagination'
import Button from '../../../components/ui/Button'
import { getSpotIncome, type IncomeHistoryItem } from '../../../lib/api/incomeHistory'
import { getPackages, type Package } from '../../../lib/api/packages'
import { ToastContainer, useToast } from '../../../components/ui/Toast'

type PyramidIncomeRow = {
  user_id: string
  direct: string
  package_id: string
  members: string
  income_amount: number
  created_at: string
}

export default function PyramidIncomePage() {
  const [userIdFilter, setUserIdFilter] = useState('')
  const [packageFilter, setPackageFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [incomeData, setIncomeData] = useState<IncomeHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [packagesMap, setPackagesMap] = useState<Map<number, string>>(new Map())
  
  const { toasts, showToast, closeToast } = useToast()

  // Fetch package list once to map package_id -> package_name
  useEffect(() => {
    let isMounted = true
    const fetchPackages = async () => {
      try {
        const res = await getPackages({ page: 1, limit: 100, status: 'active' })
        if (!isMounted) return
        const map = new Map<number, string>()
        res.items.forEach((pkg: Package) => {
          map.set(pkg.id, pkg.name)
        })
        setPackagesMap(map)
      } catch (err) {
        console.error('❌ Error fetching packages:', err)
      }
    }
    fetchPackages()
    return () => {
      isMounted = false
    }
  }, [])

  // Format date
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString)
      return date.toLocaleString('en-IN', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    } catch {
      return dateString
    }
  }

  // Helper to extract user ID from filter input
  // API now supports both display_id (SIA02047) and numeric ID
  const extractUserId = (input: string): string | undefined => {
    const trimmed = input.trim()
    if (!trimmed) return undefined
    // If it starts with "SIA" (case-insensitive), pass it as-is (API will handle display_id lookup)
    if (trimmed.toUpperCase().startsWith('SIA')) {
      return trimmed // Pass display_id as-is without forcing uppercase
    }
    // Otherwise, treat as numeric ID
    const numeric = parseInt(trimmed, 10)
    return isNaN(numeric) ? undefined : numeric.toString()
  }

  // Fetch pyramid income from API (using SPOT income endpoint)
  // Note: Pyramid income is calculated from SPOT commissions according to dashboard
  const fetchPyramidIncome = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const userId = extractUserId(userIdFilter)
      const params: any = {
        page,
        limit: pageSize,
      }
      if (userId) {
        params.user_id = userId // Can be display_id (SIA02047) or numeric ID
      }
      if (startDate) {
        params.start_date = startDate
      }
      if (endDate) {
        params.end_date = endDate
      }
      
      const response = await getSpotIncome(params)
      setIncomeData(response.items || [])
      setTotal(response.total || 0)
      setTotalPages(response.total_pages || 0)
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to fetch pyramid income'
      setError(errorMessage)
      showToast(errorMessage, 'error')
      setIncomeData([])
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, userIdFilter, startDate, endDate, showToast])

  useEffect(() => {
    fetchPyramidIncome()
  }, [fetchPyramidIncome])

  // Create package options for dropdown
  const packageOptions = useMemo(() => {
    const options = Array.from(packagesMap.entries()).map(([id, name]) => ({
      value: id.toString(),
      label: name
    }))
    return options.sort((a, b) => a.label.localeCompare(b.label))
  }, [packagesMap])

  // Map API response to table rows (filter by package_id if selected)
  const rows: PyramidIncomeRow[] = useMemo(() => {
    return incomeData
      .filter(item => {
        // Filter by package_id if provided
        if (packageFilter) {
          const packageId = parseInt(packageFilter, 10)
          return item.package_id === packageId
        }
        return true
      })
      .map(item => ({
      user_id: '-', // Pyramid income is for authenticated user
      direct: item.source_user_id || '-',
      package_id: item.purchase_id ? `PKG-${item.purchase_id}` : '-',
      members: item.level ? `Level ${item.level}` : '-',
      income_amount: item.amount || 0,
      created_at: formatDate(item.credited_at),
    }))
  }, [incomeData, packageFilter])

  const columns: Array<DataTableColumn<PyramidIncomeRow>> = useMemo(() => [
    { 
      key: 'user_id', 
      title: 'user_id (Receiver)',
      render: (r: PyramidIncomeRow) => (
        <span className="font-semibold">{r.user_id}</span>
      )
    },
    { 
      key: 'direct', 
      title: 'direct (Source ID)'
    },
    { 
      key: 'package_id', 
      title: 'package_id'
    },
    { 
      key: 'members', 
      title: 'members (Level/Tier)'
    },
    { 
      key: 'income_amount', 
      title: 'income_amount',
      render: (r: PyramidIncomeRow) => (
        <span className="font-semibold">₹ {r.income_amount.toFixed(2)}</span>
      )
    },
    { 
      key: 'created_at', 
      title: 'created_at'
    },
  ], [])


  const handleExport = () => {
    alert('Exporting pyramid income transaction data...')
    // In a real app: Trigger export/download
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSearch = () => {
    setPage(1) // Reset to first page when searching
    // Filter will be applied via API call in fetchPyramidIncome
  }

  const handleClearFilters = () => {
    setUserIdFilter('')
    setPackageFilter('')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  return (
    <Card
      title="Pyramid Income Report"
      toolbarRight={
        <>
          <Button
            variant="outline"
            size="md"
            aria-label="Export"
            onClick={handleExport}
          >
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
      {loading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
            <p className="text-sm text-gray-600">Loading pyramid income data...</p>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-600">No pyramid income records found.</p>
        </div>
      )}

      <DataTable<PyramidIncomeRow>
        columns={columns}
        rows={rows}
        minWidthPx={900}
      />

      <FiltersBar>
        <TextInput 
          id="user-id-filter" 
          label="Filter by User ID:" 
          value={userIdFilter} 
          onChange={setUserIdFilter} 
          placeholder="Enter User ID (e.g., SIA00050)" 
        />
        <SelectInput
          id="package-filter"
          label="Filter by Package:"
          value={packageFilter}
          onChange={setPackageFilter}
          options={packageOptions}
          placeholder="All Packages"
        />
        <DateRangeInput
          id="date-range"
          label="Date Range:"
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />
        <PrimaryButton type="button" onClick={handleSearch}>Search</PrimaryButton>
        <SecondaryButton type="button" onClick={handleClearFilters}>Clear filtering</SecondaryButton>
      </FiltersBar>

      {totalPages > 1 && (
      <Pagination
        page={page}
        pageSize={pageSize}
          total={total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[10, 25, 50]}
      />
      )}

      <ToastContainer toasts={toasts} onClose={closeToast} />
    </Card>
  )
}