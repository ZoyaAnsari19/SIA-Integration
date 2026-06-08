"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, TextInput, SelectInput, DateRangeInput } from '../../../components/ui/FiltersBar'
import Pagination from '../../../components/ui/Pagination'
import Button from '../../../components/ui/Button'
import { getDirectIncome, type IncomeHistoryItem } from '../../../lib/api/incomeHistory'
import { getPackages, type Package } from '../../../lib/api/packages'
import { exportToCsv } from '../../../lib/export'
import { ToastContainer, useToast } from '../../../components/ui/Toast'

type DirectIncomeRow = {
  user_id: string
  user_name: string | null // Receiver name
  package_id: string
  package_investment: number | null
  from_id: string
  from_name: string | null // Source name
  income_amount: number
  created_at: string
}

export default function DirectIncomePage() {
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
  const [packagesPriceMap, setPackagesPriceMap] = useState<Map<number, number>>(new Map())
  
  const { toasts, showToast, closeToast } = useToast()

  // Fetch package list once to map package_id -> package_name and price
  useEffect(() => {
    let isMounted = true
    const fetchPackages = async () => {
      try {
        const res = await getPackages({ page: 1, limit: 100, status: 'active' })
        if (!isMounted) return
        const nameMap = new Map<number, string>()
        const priceMap = new Map<number, number>()
        res.items.forEach((pkg: Package) => {
          nameMap.set(pkg.id, pkg.name)
          priceMap.set(pkg.id, pkg.price)
        })
        setPackagesMap(nameMap)
        setPackagesPriceMap(priceMap)
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

  // Fetch direct income from API
  const fetchDirectIncome = useCallback(async () => {
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
      
      const response = await getDirectIncome(params)
      setIncomeData(response.items || [])
      setTotal(response.total || 0)
      setTotalPages(response.total_pages || 0)
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to fetch direct income'
      setError(errorMessage)
      showToast(errorMessage, 'error')
      setIncomeData([])
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, userIdFilter, packageFilter, startDate, endDate, showToast])

  useEffect(() => {
    fetchDirectIncome()
  }, [fetchDirectIncome])

  // Create package options for dropdown
  const packageOptions = useMemo(() => {
    const options = Array.from(packagesMap.entries()).map(([id, name]) => ({
      value: id.toString(),
      label: name
    }))
    return options.sort((a, b) => a.label.localeCompare(b.label))
  }, [packagesMap])

  // Map API response to table rows (package filter is now server-side)
  const rows: DirectIncomeRow[] = useMemo(() => {
    let mappedRows = incomeData
      .map(item => {
        // Receiver: user who received the direct income
        const displayId = item.user_display_id || (() => {
          const itemUserId = item.user_id || item.receiver_user_id || '-'
          const numericId = itemUserId ? itemUserId.toString() : '-'
          return numericId && numericId !== '-'
            ? `SIA${numericId.padStart(5, '0')}`
            : '-'
        })()
        
        // Get package name and investment amount (like user-side shows)
        let packageName = '-'
        let investmentAmount: number | null = null
        
        if (item.package_id) {
          packageName = packagesMap.get(item.package_id) || item.package_name || `Package #${item.package_id}`
          // Get price from packagesPriceMap or use package_amount/investment from API
          investmentAmount = item.package_amount ?? item.investment ?? packagesPriceMap.get(item.package_id) ?? null
        } else if (item.package_name) {
          packageName = item.package_name
          investmentAmount = item.package_amount ?? item.investment ?? null
        }
        
        // Source: user who made the purchase (from whom the income came)
        const sourceDisplayId = item.source_user_display_id || (() => {
          const sourceUserId = item.source_user_id || '-'
          if (!sourceUserId || sourceUserId === '-') {
            console.warn('Direct Income: Missing source_user_id', item)
            return '-'
          }
          const numericId = sourceUserId.toString()
          return numericId && numericId !== '-'
            ? `SIA${numericId.padStart(5, '0')}`
            : '-'
        })()
        
        // Debug log to verify source vs receiver
        if (displayId === sourceDisplayId && displayId !== '-') {
          console.warn('Direct Income: Receiver and Source are the same!', {
            item_id: item.id,
            receiver_user_id: item.user_id,
            receiver_display_id: displayId,
            source_user_id: item.source_user_id,
            source_display_id: sourceDisplayId,
            full_item: item,
          })
        }
        
        // Get receiver name from API response (item.user_name from admin/commissions endpoint)
        const receiverName = item.user_name ?? null
        
        return {
          user_id: displayId, // Receiver (who got the income)
          user_name: receiverName, // Receiver name from API
          package_id: packageName,
          package_investment: investmentAmount, // Investment amount (package price)
          from_id: sourceDisplayId, // Source (who made the purchase)
          from_name: item.source_user_name ?? null, // Source name
          income_amount: item.amount || 0,
          created_at: formatDate(item.credited_at),
        }
      })
    
    // Apply name filter (client-side)
    if (nameFilter.trim()) {
      const nameFilterLower = nameFilter.trim().toLowerCase()
      mappedRows = mappedRows.filter(row => {
        const receiverName = row.user_name?.toLowerCase() || ''
        const sourceName = row.from_name?.toLowerCase() || ''
        return receiverName.includes(nameFilterLower) || sourceName.includes(nameFilterLower)
      })
    }
    
    return mappedRows
  }, [incomeData, packagesMap, packagesPriceMap, nameFilter])

  const columns: Array<DataTableColumn<DirectIncomeRow>> = useMemo(() => [
    { 
      key: 'user_id', 
      title: 'user_id (Receiver)',
      render: (r: DirectIncomeRow) => (
        <div className="flex flex-col">
          <span className="font-semibold">{r.user_id}</span>
          {r.user_name && (
            <span className="text-sm text-gray-600">{r.user_name}</span>
          )}
        </div>
      )
    },
    { 
      key: 'package_id', 
      title: 'Package',
      render: (r: DirectIncomeRow) => (
        <div className="flex flex-col">
          <span>{r.package_id}</span>
          {r.package_investment != null && (
            <span className="text-sm font-semibold text-blue-600">
              ₹{r.package_investment.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </div>
      )
    },
    { 
      key: 'from_id', 
      title: 'from_id (Source)',
      render: (r: DirectIncomeRow) => (
        <div className="flex flex-col">
          <span className="font-semibold">{r.from_id}</span>
          {r.from_name && (
            <span className="text-sm text-gray-600">{r.from_name}</span>
          )}
        </div>
      )
    },
    { 
      key: 'income_amount', 
      title: 'income_amount',
      render: (r: DirectIncomeRow) => (
        <span className="font-semibold">₹ {r.income_amount.toFixed(2)}</span>
      )
    },
    { 
      key: 'created_at', 
      title: 'created_at'
    },
  ], [])


  const handleExport = async () => {
    try {
      showToast('Preparing direct income export (all records)...', 'info')

      const exportPageSize = 1000
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

      const firstResponse = await getDirectIncome(baseParams)
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

      for (let exportPage = 2; exportPage <= totalPagesForExport; exportPage++) {
        const params = { ...baseParams, page: exportPage }
        const response = await getDirectIncome(params)
        if (response.items?.length) {
          allItems.push(...response.items)
        }
        if (!response.items || response.items.length === 0) {
          break
        }
      }

      if (!allItems.length) {
        alert('No direct income records available to export.')
        return
      }

      let exportRows: DirectIncomeRow[] = allItems.map(item => {
        const displayId = item.user_display_id || (() => {
          const itemUserId = item.user_id || item.receiver_user_id || '-'
          const numericId = itemUserId ? itemUserId.toString() : '-'
          return numericId && numericId !== '-'
            ? `SIA${numericId.padStart(5, '0')}`
            : '-'
        })()

        let packageName = '-'
        let investmentAmount: number | null = null

        if (item.package_id) {
          packageName =
            packagesMap.get(item.package_id) ||
            item.package_name ||
            `Package #${item.package_id}`
          investmentAmount =
            item.package_amount ??
            item.investment ??
            packagesPriceMap.get(item.package_id) ??
            null
        } else if (item.package_name) {
          packageName = item.package_name
          investmentAmount = item.package_amount ?? item.investment ?? null
        }

        const sourceDisplayId = item.source_user_display_id || (() => {
          const sourceUserId = item.source_user_id || '-'
          if (!sourceUserId || sourceUserId === '-') {
            return '-'
          }
          const numericId = sourceUserId.toString()
          return numericId && numericId !== '-'
            ? `SIA${numericId.padStart(5, '0')}`
            : '-'
        })()

        const receiverName = item.user_name ?? null

        return {
          user_id: displayId,
          user_name: receiverName,
          package_id: packageName,
          package_investment: investmentAmount,
          from_id: sourceDisplayId,
          from_name: item.source_user_name ?? null,
          income_amount: item.amount || 0,
          created_at: formatDate(item.credited_at),
        }
      })

      if (nameFilter.trim()) {
        const nameFilterLower = nameFilter.trim().toLowerCase()
        exportRows = exportRows.filter(row => {
          const receiverName = row.user_name?.toLowerCase() || ''
          const sourceName = row.from_name?.toLowerCase() || ''
          return (
            receiverName.includes(nameFilterLower) ||
            sourceName.includes(nameFilterLower)
          )
        })
      }

      if (!exportRows.length) {
        alert(
          'No direct income records available to export for the selected filters.',
        )
        return
      }

      const headers = [
        'user_id',
        'user_name',
        'package_id',
        'package_investment',
        'from_id',
        'from_name',
        'income_amount',
        'created_at',
      ]
      const data = exportRows.map(row => [
        row.user_id,
        row.user_name || '',
        row.package_id,
        row.package_investment != null
          ? row.package_investment.toFixed(2)
          : '-',
        row.from_id,
        row.from_name || '',
        row.income_amount.toFixed(2),
        row.created_at,
      ])

      exportToCsv('direct-income-transactions.csv', headers, data)
      showToast(
        `Exported ${exportRows.length} direct income records successfully.`,
        'success',
      )
    } catch (err: any) {
      console.error('❌ Error exporting direct income:', err)
      const message = err?.message || 'Failed to export direct income records.'
      showToast(message, 'error')
      alert(message)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSearch = () => {
    setPage(1) // Reset to first page when searching
    // Filter will be applied via API call in fetchDirectIncome
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
      title="Direct Income Transaction Report"
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
            <p className="text-sm text-gray-600">Loading direct income data...</p>
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
          <p className="text-sm text-yellow-600">No direct income records found.</p>
        </div>
      )}

      <DataTable<DirectIncomeRow>
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