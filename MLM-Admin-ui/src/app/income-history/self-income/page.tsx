"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, TextInput, SelectInput, DateRangeInput } from '../../../components/ui/FiltersBar'
import Pagination from '../../../components/ui/Pagination'
import Button from '../../../components/ui/Button'
import { getSelfIncome, type IncomeHistoryItem } from '../../../lib/api/incomeHistory'
import { getPackages, type Package } from '../../../lib/api/packages'
import { exportToCsv } from '../../../lib/export'
import { ToastContainer, useToast } from '../../../components/ui/Toast'

type SelfIncomeRow = {
  user_id: string // Display ID (e.g., SIA00050)
  user_name: string | null // User name
  package_name: string
  package_price: number | null
  income_limit_2x: number | null
  total_income_for_package: number | null
  income_amount: number
  created_at: string
}

export default function SelfIncomePage() {
  const [userIdFilter, setUserIdFilter] = useState('')
  const [packageFilter, setPackageFilter] = useState('')
  const [nameFilter, setNameFilter] = useState('')
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
        console.error('❌ Error fetching packages for self income view:', err)
      }
    }
    fetchPackages()
    return () => {
      isMounted = false
    }
  }, [])

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

  // Fetch self income from API
  const fetchSelfIncome = useCallback(async () => {
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
      if (packageFilter) {
        params.package_id = parseInt(packageFilter, 10) // Pass package_id to API for server-side filtering
      }
      if (startDate) {
        params.start_date = startDate
      }
      if (endDate) {
        params.end_date = endDate
      }
      
      console.log('📥 Fetching Self Income with params:', params)
      console.log('📥 API will call: GET /api/v1/admin/commissions?commission_type=SELF')
      const response = await getSelfIncome(params)
      console.log('✅ Self Income Response:', {
        count: response.count,
        total: response.total,
        total_pages: response.total_pages,
        itemsCount: response.items?.length,
        firstItem: response.items?.[0]
      })
      
      setIncomeData(response.items || [])
      setTotal(response.total || 0)
      setTotalPages(response.total_pages || 0)
    } catch (err: any) {
      console.error('❌ Error fetching self income:', err)
      console.error('❌ Error details:', {
        message: err?.message,
        stack: err?.stack,
        name: err?.name
      })
      const errorMessage = err?.message || 'Failed to fetch self income'
      setError(errorMessage)
      showToast(errorMessage, 'error')
      setIncomeData([])
      
      // If 404 error, provide helpful message
      if (errorMessage.includes('not found') || errorMessage.includes('404')) {
        console.error('💡 Troubleshooting:');
        console.error('  1. Check if API server is running on http://localhost:3006');
        console.error('  2. Verify endpoint exists: GET /api/v1/admin/commissions');
        console.error('  3. Check Swagger UI: http://localhost:3006/docs');
        console.error('  4. Try restarting API server');
      }
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, userIdFilter, packageFilter, startDate, endDate, showToast])

  useEffect(() => {
    fetchSelfIncome()
  }, [fetchSelfIncome])

  // Create package options for dropdown
  const packageOptions = useMemo(() => {
    const options = Array.from(packagesMap.entries()).map(([id, name]) => ({
      value: id.toString(),
      label: name
    }))
    return options.sort((a, b) => a.label.localeCompare(b.label))
  }, [packagesMap])

  // Map API response to table rows (package filter is now server-side)
  const rows: SelfIncomeRow[] = useMemo(() => {
    let mappedRows = incomeData
      .map(item => {
        // Use display_id from API if available, otherwise convert numeric ID
        const displayId = item.user_display_id || (() => {
        const itemUserId = item.user_id || item.receiver_user_id || '-'
        const numericId = itemUserId ? itemUserId.toString() : '-'
          return numericId && numericId !== '-'
            ? `SIA${numericId.padStart(5, '0')}`
            : '-'
        })()

        const itemAny = item as any
        const pkgId: number | null = itemAny.package_id ?? null
        const pkgNameFromMap =
          pkgId != null ? packagesMap.get(pkgId) ?? null : null
       const packageName =
          itemAny.package_name ||
          pkgNameFromMap ||
          (pkgId != null ? `Package #${pkgId}` : '-')

        const priceFromPurchase = item.package_amount ?? null
        const packagePrice = priceFromPurchase ?? null

        const limit2xBackend = item.package_target_2x ?? null
        const limit2x =
          limit2xBackend != null
            ? limit2xBackend
            : packagePrice != null
            ? packagePrice * 2
            : null

        const totalIncomeForPackage = item.package_income ?? null

        return {
          user_id: displayId,
          user_name: item.source_user_name ?? null, // For Self Income, source_user_name contains the user's name
          package_name: packageName,
          package_price: packagePrice,
          income_limit_2x: limit2x,
          total_income_for_package: totalIncomeForPackage,
          income_amount: item.amount || 0,
          created_at: formatDate(item.credited_at),
        }
      })
    
    // Apply name filter (client-side)
    if (nameFilter.trim()) {
      const nameFilterLower = nameFilter.trim().toLowerCase()
      mappedRows = mappedRows.filter(row => {
        const userName = row.user_name?.toLowerCase() || ''
        return userName.includes(nameFilterLower)
      })
    }
    
    return mappedRows
  }, [incomeData, packagesMap, nameFilter])

  const columns: Array<DataTableColumn<SelfIncomeRow>> = useMemo(() => [
    { 
      key: 'user_id', 
      title: 'User ID',
      render: (r: SelfIncomeRow) => (
        <div className="flex flex-col">
          <span className="font-semibold">{r.user_id}</span>
          {r.user_name && (
            <span className="text-sm text-gray-600">{r.user_name}</span>
          )}
        </div>
      )
    },
    { 
      key: 'package_name', 
      title: 'Package',
      render: (r: SelfIncomeRow) => (
        <div className="flex flex-col">
          <span>{r.package_name}</span>
          {r.package_price != null && (
            <span className="text-sm font-semibold text-blue-600">
              ₹{r.package_price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </div>
      ),
    },
    { 
      key: 'income_limit_2x',
      title: 'Income Limit (2x)',
      render: (r: SelfIncomeRow) => (
        <span>{r.income_limit_2x != null ? `₹ ${r.income_limit_2x.toFixed(2)}` : '-'}</span>
      ),
    },
    { 
      key: 'package_progress',
      title: 'Package Progress',
      render: (r: SelfIncomeRow) => {
        if (
          r.package_price == null ||
          r.income_limit_2x == null ||
          r.total_income_for_package == null ||
          r.income_limit_2x <= 0
        ) {
          return <span>-</span>
        }

        const pricePct = Math.max(
          0,
          Math.min(100, (r.package_price / r.income_limit_2x) * 100),
        )
        const totalPct = Math.max(
          0,
          Math.min(100, (r.total_income_for_package / r.income_limit_2x) * 100),
        )

        return (
          <div className="min-w-[220px]">
            <div className="relative h-2 rounded-full bg-gray-200 overflow-hidden">
              {/* Filled segment: total income progress */}
              <div
                className="absolute left-0 top-0 h-2 bg-green-500"
                style={{ width: `${totalPct}%` }}
              />
              {/* Marker: package price */}
              <div
                className="absolute top-[-1px] h-4 w-[2px] bg-blue-600"
                style={{ left: `${pricePct}%` }}
                title="Package Price"
              />
              {/* Marker: income limit (2x) at 100% (right end) */}
              <div
                className="absolute right-0 top-[-1px] h-4 w-[2px] bg-gray-700"
                title="Income Limit (2x)"
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-gray-600">
              <span>Price: ₹ {r.package_price.toFixed(0)}</span>
              <span>Total: ₹ {r.total_income_for_package.toFixed(0)}</span>
              <span>Limit: ₹ {r.income_limit_2x.toFixed(0)}</span>
            </div>
          </div>
        )
      },
    },
    { 
      key: 'income_amount', 
      title: 'Amount Credited',
      render: (r: SelfIncomeRow) => (
        <div className="flex flex-col">
          <span className="font-semibold">₹ {r.income_amount.toFixed(2)}</span>
          {r.total_income_for_package != null && (
            <span className="text-xs text-gray-600">
              Total so far: ₹ {r.total_income_for_package.toFixed(2)}
            </span>
          )}
        </div>
      )
    },
    { 
      key: 'created_at', 
      title: 'Credited At'
    },
    // Placeholder column for future 2x progress bar
    // { 
    //   key: 'double_progress', 
    //   title: '2x Progress',
    //   render: (r: SelfIncomeRow) => (
    //     <div className="w-full bg-gray-200 rounded-full h-2.5">
    //       <div
    //         className="bg-green-500 h-2.5 rounded-full"
    //         style={{ width: `${Math.min(100, Math.max(0, r.double_progress * 100))}%` }}
    //       />
    //     </div>
    //   ),
    // },
  ], [])


  const handleExport = async () => {
    try {
      showToast('Preparing self income export (all records)...', 'info')

      const exportPageSize = 1000 // Maximum allowed by backend
      const userId = extractUserId(userIdFilter)
      const baseParams: any = {
        page: 1,
        limit: exportPageSize,
      }
      if (userId) {
        baseParams.user_id = userId
      }
      if (packageFilter) {
        baseParams.package_id = parseInt(packageFilter, 10)
      }
      if (startDate) {
        baseParams.start_date = startDate
      }
      if (endDate) {
        baseParams.end_date = endDate
      }

      // First page (also gives us accurate total + total_pages from backend)
      const firstResponse = await getSelfIncome(baseParams)
      const allItems: IncomeHistoryItem[] = []

      if (firstResponse.items?.length) {
        allItems.push(...firstResponse.items)
      }

      const totalRecords =
        firstResponse.total ?? firstResponse.count ?? firstResponse.items.length
      const totalPagesForExport = Math.max(
        firstResponse.total_pages ||
          Math.ceil(totalRecords / exportPageSize) ||
          1,
        1,
      )

      // Remaining pages (if any)
      for (let exportPage = 2; exportPage <= totalPagesForExport; exportPage++) {
        const params = { ...baseParams, page: exportPage }
        const response = await getSelfIncome(params)
        if (response.items?.length) {
          allItems.push(...response.items)
        }
        if (!response.items || response.items.length === 0) {
          break
        }
      }

      if (!allItems.length) {
        alert('No self income records available to export.')
        return
      }

      // Map API items to SelfIncomeRow, mirroring the rows memo logic
      let exportRows: SelfIncomeRow[] = allItems.map(item => {
        const displayId = item.user_display_id || (() => {
          const itemUserId = item.user_id || item.receiver_user_id || '-'
          const numericId = itemUserId ? itemUserId.toString() : '-'
          return numericId && numericId !== '-'
            ? `SIA${numericId.padStart(5, '0')}`
            : '-'
        })()

        const itemAny = item as any
        const pkgId: number | null = itemAny.package_id ?? null
        const pkgNameFromMap =
          pkgId != null ? packagesMap.get(pkgId) ?? null : null
        const packageName =
          itemAny.package_name ||
          pkgNameFromMap ||
          (pkgId != null ? `Package #${pkgId}` : '-')

        const priceFromPurchase = item.package_amount ?? null
        const packagePrice = priceFromPurchase ?? null

        const limit2xBackend = item.package_target_2x ?? null
        const limit2x =
          limit2xBackend != null
            ? limit2xBackend
            : packagePrice != null
            ? packagePrice * 2
            : null

        const totalIncomeForPackage = item.package_income ?? null

        return {
          user_id: displayId,
          user_name: item.source_user_name ?? null,
          package_name: packageName,
          package_price: packagePrice,
          income_limit_2x: limit2x,
          total_income_for_package: totalIncomeForPackage,
          income_amount: item.amount || 0,
          created_at: formatDate(item.credited_at),
        }
      })

      // Apply client-side name filter for export as well
      if (nameFilter.trim()) {
        const nameFilterLower = nameFilter.trim().toLowerCase()
        exportRows = exportRows.filter(row => {
          const userName = row.user_name?.toLowerCase() || ''
          return userName.includes(nameFilterLower)
        })
      }

      if (!exportRows.length) {
        alert('No self income records available to export for the selected filters.')
        return
      }

      const headers = [
        'user_id',
        'user_name',
        'package_name',
        'package_price',
        'income_limit_2x',
        'amount_credited',
        'total_income_for_package',
        'created_at',
      ]
      const data = exportRows.map(row => [
        row.user_id,
        row.user_name || '',
        row.package_name,
        row.package_price != null ? row.package_price.toFixed(2) : '',
        row.income_limit_2x != null ? row.income_limit_2x.toFixed(2) : '',
        row.income_amount.toFixed(2),
        row.total_income_for_package != null
          ? row.total_income_for_package.toFixed(2)
          : '',
        row.created_at,
      ])

      exportToCsv('self-income-transactions.csv', headers, data)
      showToast(
        `Exported ${exportRows.length} self income records successfully.`,
        'success',
      )
    } catch (err: any) {
      console.error('❌ Error exporting self income:', err)
      const message = err?.message || 'Failed to export self income records.'
      showToast(message, 'error')
      alert(message)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSearch = () => {
    setPage(1) // Reset to first page when searching
    // Filter will be applied via API call in fetchSelfIncome
  }

  const handleClearFilters = () => {
    setUserIdFilter('')
    setPackageFilter('')
    setNameFilter('')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  return (
    <Card
      title="Self Income Transaction Report"
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
            <p className="text-sm text-gray-600">Loading self income data...</p>
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
          <p className="text-sm text-yellow-600">No self income records found.</p>
        </div>
      )}

      <DataTable<SelfIncomeRow>
        columns={columns}
        rows={rows}
        minWidthPx={700}
      />

      <FiltersBar>
        <TextInput 
          id="user-id-filter" 
          label="Filter by User ID:" 
          value={userIdFilter} 
          onChange={setUserIdFilter} 
          placeholder="Enter User ID (e.g., SIA00050)" 
        />
        <TextInput 
          id="name-filter" 
          label="Filter by Name:" 
          value={nameFilter} 
          onChange={setNameFilter} 
          placeholder="Enter Name (e.g., John Doe)" 
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

      <Pagination
        page={page}
        pageSize={pageSize}
          total={total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[10, 25, 50, 100, 250, 500, 1000]}
      />

      <ToastContainer toasts={toasts} onClose={closeToast} />
    </Card>
  )
}