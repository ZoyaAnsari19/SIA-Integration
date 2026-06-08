"use client"

import React, { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Card from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, TextInput, SelectInput, DateRangeInput } from '../../../components/ui/FiltersBar'
import Pagination from '../../../components/ui/Pagination'
import Button from '../../../components/ui/Button'
import { getSpotIncome, type IncomeHistoryItem } from '../../../lib/api/incomeHistory'
import { getPackages, type Package } from '../../../lib/api/packages'
import { exportToCsv } from '../../../lib/export'

type SpotCommisionRow = {
  user_id: string
  user_name: string | null // Receiver user name
  income_lvl: number | null
  income_amount: number
  from_id: string
  from_name: string | null // Source user name
  package_name: string // Package name
  investment_amt: number // Investment amount
  investment_type?: string | null // 'activation' | 'reinvestment'
  spot_added: string
  credited_date: string // Date when commission was credited
}

export default function SpotCommisionPage() {
  const router = useRouter()
  const [userIdFilter, setUserIdFilter] = useState('')
  const [sourceIdFilter, setSourceIdFilter] = useState('') // Filter by source (from_id)
  const [statusFilter, setStatusFilter] = useState('') // Status filter: 'credited' or 'pending'
  const [levelFilter, setLevelFilter] = useState('') // Level filter: '1', '2', '3', etc.
  const [startDate, setStartDate] = useState('') // Date range start
  const [endDate, setEndDate] = useState('') // Date range end
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [commissions, setCommissions] = useState<IncomeHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [packagesMap, setPackagesMap] = useState<Map<number, Package>>(new Map()) // Store full Package objects

  // Fetch package list once to map package_id -> package_name and price
  useEffect(() => {
    let isMounted = true
    const fetchPackages = async () => {
      try {
        const res = await getPackages({ page: 1, limit: 100, status: 'active' })
        if (!isMounted) return
        const map = new Map<number, Package>()
        res.items.forEach((pkg: Package) => {
          map.set(pkg.id, pkg)
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

  // Helper to get level display text
  const getLevelDisplay = (level: number | null): string => {
    if (level === null || level === undefined) return 'N/A'
    if (level === 0) return 'Direct'
    return `Level ${level}`
  }

  // Helper to get level badge color
  const getLevelBadgeColor = (level: number | null): string => {
    if (level === null || level === undefined) return 'bg-gray-100 text-gray-600'
    if (level === 0) return 'bg-blue-100 text-blue-600'
    if (level === 1) return 'bg-green-100 text-green-600'
    if (level === 2) return 'bg-orange-100 text-orange-600'
    return 'bg-purple-100 text-purple-600'
  }

  const columns: Array<DataTableColumn<SpotCommisionRow>> = useMemo(() => [
    { 
      key: 'user_id', 
      title: 'User_id (Receiver)',
      render: (r: SpotCommisionRow) => {
        const userName = r.user_name || ''
        return (
          <div className="flex flex-col">
            <span className="font-semibold">{r.user_id}</span>
            {userName && (
              <span className="text-xs text-gray-600 mt-0.5">{userName}</span>
            )}
          </div>
        )
      }
    },
    { 
      key: 'income_lvl', 
      title: 'Through Level',
      render: (r: SpotCommisionRow) => (
        <div className="flex items-center gap-2">
          {r.income_lvl != null ? (
            <>
              <span className="font-semibold text-gray-600">←</span>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getLevelBadgeColor(r.income_lvl)}`}>
                {getLevelDisplay(r.income_lvl)}
              </span>
              <span className="font-semibold text-gray-600">←</span>
            </>
          ) : (
            <>
              <span className="font-semibold text-gray-600">←</span>
              <span className="text-gray-400 text-xs">N/A</span>
              <span className="font-semibold text-gray-600">←</span>
            </>
          )}
        </div>
      )
    },
    { 
      key: 'income_amount', 
      title: 'Income_amount',
      render: (r: SpotCommisionRow) => (
        <span className="font-semibold">₹ {r.income_amount.toFixed(2)}</span>
      )
    },
    { 
      key: 'from_id', 
      title: 'From_id (Source)',
      render: (r: SpotCommisionRow) => {
        const fromUserName = r.from_name || ''
        return (
          <div className="flex flex-col">
            <span className="font-semibold">{r.from_id}</span>
            {fromUserName && (
              <span className="text-xs text-gray-600 mt-0.5">{fromUserName}</span>
            )}
          </div>
        )
      }
    },
    { 
      key: 'investment_amt', 
      title: 'Package',
      render: (r: SpotCommisionRow) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-2 flex-wrap">
            <span>{r.package_name || '-'}</span>
            {r.investment_type && (
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                  r.investment_type === 'reinvestment'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {r.investment_type === 'reinvestment' ? 'Reinvestment' : 'Investment'}
              </span>
            )}
          </div>
          {r.investment_amt != null && r.investment_amt > 0 && (
            <span className="text-sm font-semibold text-blue-600">
              ₹{r.investment_amt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </div>
      )
    },
    { 
      key: 'spot_added', 
      title: 'Status',
      render: (r: SpotCommisionRow) => {
        const isPending = r.spot_added === 'pending'
        const isCredited = r.spot_added === 'credited'
        return (
          <span className={
            isPending 
              ? 'text-yellow-600 font-semibold' 
              : isCredited 
              ? 'text-green-700 font-semibold' 
              : 'text-gray-600 font-semibold'
          }>
            {r.spot_added.toUpperCase()}
          </span>
        )
      }
    },
    { 
      key: 'credited_date', 
      title: 'Credited Date',
      render: (r: SpotCommisionRow) => {
        if (!r.credited_date) return <span className="text-gray-400">-</span>
        try {
          const date = new Date(r.credited_date)
          // Format: DD/MM/YYYY HH:MM
          const formatted = date.toLocaleString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          })
          return (
            <div className="flex flex-col">
              <span className="font-medium">{formatted}</span>
            </div>
          )
        } catch {
          return <span className="text-gray-400">{r.credited_date}</span>
        }
      }
    },
  ], [])

  // Fetch package list once to map package_id -> package_name and price
  useEffect(() => {
    let isMounted = true
    const fetchPackages = async () => {
      try {
        const res = await getPackages({ page: 1, limit: 100, status: 'active' })
        if (!isMounted) return
        const map = new Map<number, Package>()
        res.items.forEach((pkg: Package) => {
          map.set(pkg.id, pkg)
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

  // Helper function to ensure date is in YYYY-MM-DD format (API expects 'date' format, not 'date-time')
  const formatDateForAPI = (dateString: string): string => {
    if (!dateString) return ''
    // If already in ISO format, extract just the date part
    if (dateString.includes('T')) {
      return dateString.split('T')[0]
    }
    // Already in YYYY-MM-DD format
    return dateString
  }

  // Fetch commissions from admin/commissions API
  const fetchCommissions = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const params: any = {
        // If level filter is active, fetch all data (large limit) for client-side filtering
        // Otherwise, use normal pagination
        page: levelFilter ? 1 : page, // When level filter active, start from page 1
        limit: levelFilter ? 100 : pageSize, // Use 100 limit when level filter is active (API max is 100)
      }
      
      // Add user_id filter if provided (can be display_id or numeric ID)
      if (userIdFilter.trim()) {
        params.user_id = userIdFilter.trim()
      }
      
      // Add source_user_id filter if provided (can be display_id or numeric ID)
      if (sourceIdFilter.trim()) {
        params.source_user_id = sourceIdFilter.trim()
      }
      
      // Add status filter if provided
      if (statusFilter) {
        params.status = statusFilter
      }
      
      // Add date range filters if provided (API expects 'date' format: YYYY-MM-DD)
      if (startDate) {
        params.start_date = formatDateForAPI(startDate)
        console.log('📅 Date filter - startDate:', startDate, '-> formatted:', params.start_date)
      }
      if (endDate) {
        params.end_date = formatDateForAPI(endDate)
        console.log('📅 Date filter - endDate:', endDate, '-> formatted:', params.end_date)
      }
      
      console.log('🔍 Fetching SPOT commissions from admin/commissions with params:', params)
      const response = await getSpotIncome(params)
      console.log('✅ SPOT Commissions from admin/commissions:', {
        count: response.count,
        total: response.total,
        total_pages: response.total_pages,
        items_count: response.items.length,
      })
      
      setCommissions(response.items || [])
      // Only update total and totalPages from API if no client-side pagination is used
      if (!levelFilter && !sourceIdFilter.trim()) {
        setTotal(response.total || 0)
        setTotalPages(response.total_pages || 0)
      } else if (levelFilter || sourceIdFilter.trim()) {
        // When using client-side filtering, base total on loaded items
        setTotal(response.items?.length || 0)
        setTotalPages(Math.ceil((response.items?.length || 0) / pageSize))
      }
    } catch (err: any) {
      console.error('❌ Error fetching SPOT commissions:', err)
      console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        name: err.name,
      })
      setError(err.message || 'Failed to fetch commissions')
      
      // Handle 401 - redirect to login
      if (err.message?.includes('Unauthorized') || err.message?.includes('401')) {
        router.push('/login')
        return
      }
    } finally {
      setLoading(false)
    }
  }

  // Fetch commissions on mount and when filters change
  useEffect(() => {
    // Reset to page 1 when date filters change
    if (startDate || endDate) {
      if (page !== 1) {
        setPage(1)
        return // Will trigger another fetch when page changes
      }
    }
    fetchCommissions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, statusFilter, levelFilter, sourceIdFilter, startDate, endDate])

  // Fetch commissions when user filter changes (debounced search)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) {
        fetchCommissions()
      } else {
        setPage(1) // Reset to page 1 when filter changes
      }
    }, 500) // Debounce search by 500ms

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIdFilter])

  // When level filter changes, refetch all data for client-side filtering
  useEffect(() => {
    if (levelFilter) {
      setPage(1) // Reset to first page when level filter changes
      // fetchCommissions will be called automatically via the dependency on levelFilter
    }
  }, [levelFilter])

  // Create level options for dropdown
  const levelOptions = useMemo(() => {
    return [
      { value: '0', label: 'Level 0 (Direct)' },
      { value: '1', label: 'Level 1' },
      { value: '2', label: 'Level 2' },
      { value: '3', label: 'Level 3' },
      { value: '4', label: 'Level 4' },
      { value: '5', label: 'Level 5' },
      { value: '6', label: 'Level 6' },
      { value: '7', label: 'Level 7' },
      { value: '8', label: 'Level 8' },
      { value: '9', label: 'Level 9' },
    ]
  }, [])

  // Map API entries to UI SpotCommisionRow (apply level & source filters client-side)
  const allRows: SpotCommisionRow[] = useMemo(() => {
    const mapped = commissions.map((entry) => {
      // Format receiver display ID
      const receiverDisplayId = entry.user_display_id || (() => {
        const userId = entry.user_id || entry.receiver_user_id || '-'
        if (!userId || userId === '-') return '-'
        const numericId = userId.toString()
        return numericId && numericId !== '-'
          ? `SIA${numericId.padStart(5, '0')}`
          : '-'
      })()
      
      // Format source display ID
      const sourceDisplayId = entry.source_user_display_id || (() => {
        const sourceUserId = entry.source_user_id || '-'
        if (!sourceUserId || sourceUserId === '-') return '-'
        const numericId = sourceUserId.toString()
        return numericId && numericId !== '-'
          ? `SIA${numericId.padStart(5, '0')}`
          : '-'
      })()
      
      // Get level from API response (same as Team Income)
      // The API already maps income_lvl to level field in IncomeHistoryItem
      const level = entry.level ?? null
      
      // Get status from API (should be 'credited' or 'pending')
      // API returns both 'status' and 'spot_added' fields, prefer 'status' then 'spot_added'
      const status = entry.status ?? (entry as any).spot_added ?? (entry.settled ? 'credited' : 'pending')
      // Normalize status to lowercase string
      const normalizedStatus = typeof status === 'string' ? status.toLowerCase() : (status ? 'credited' : 'pending')
      
      // Get income amount - check multiple possible fields
      const incomeAmount = entry.amount || (entry as any).income_amount || 0
      
      // Debug log for first entry to verify amount
      if (commissions.indexOf(entry) === 0) {
        console.log('🔍 First SPOT commission entry:', {
          entry_id: entry.id,
          amount: entry.amount,
          income_amount: (entry as any).income_amount,
          final_income_amount: incomeAmount,
          full_entry: entry,
        })
      }
      
      // Get package name and investment amount (like Direct Income shows)
      let packageName = '-'
      let investmentAmt: number = 0
      
      if (entry.package_id) {
        const pkg = packagesMap.get(entry.package_id)
        packageName = pkg?.name || entry.package_name || `Package #${entry.package_id}`
        investmentAmt = (entry as any).investment_amt ?? entry.investment ?? entry.package_amount ?? pkg?.price ?? 0
      } else if (entry.package_name) {
        packageName = entry.package_name
        investmentAmt = (entry as any).investment_amt ?? entry.investment ?? entry.package_amount ?? 0
      } else {
        investmentAmt = (entry as any).investment_amt ?? entry.investment ?? 0
      }
      
      // Get credited date from entry
      const creditedDate = entry.credited_at || (entry as any).created_at || (entry as any).date || ''
      
      const row: SpotCommisionRow = {
        user_id: receiverDisplayId, // Receiver display ID
        user_name: entry.user_name || null, // Receiver user name
        income_lvl: level, // Numeric level (null if not available)
        income_amount: incomeAmount, // Use the determined income amount
        from_id: sourceDisplayId, // Source display ID
        from_name: entry.source_user_name || null, // Source user name
        package_name: packageName, // Package name
        investment_amt: investmentAmt, // Investment amount
        investment_type: (entry as any).investment_type ?? null,
        spot_added: normalizedStatus, // Status from API: 'credited' or 'pending'
        credited_date: creditedDate, // Date when commission was credited
      }
      return row
    })

    let filtered = mapped

    // Apply level filter if provided (source filter now handled entirely by backend)
    if (levelFilter) {
      const filterLevel = parseInt(levelFilter, 10)
      filtered = filtered.filter(row => row.income_lvl === filterLevel)
    }

    return filtered
  }, [commissions, packagesMap, levelFilter])

  // Apply client-side pagination when level filter is active
  const rows: SpotCommisionRow[] = useMemo(() => {
    if (levelFilter) {
      // Client-side pagination for filtered data
      const start = (page - 1) * pageSize
      const end = start + pageSize
      return allRows.slice(start, end)
    }
    // No level filter - use all rows (API handles pagination)
    return allRows
  }, [allRows, page, pageSize, levelFilter])

  // Calculate total for pagination
  const paginationTotal = useMemo(() => {
    if (levelFilter) {
      // Use filtered count for client-side pagination
      return allRows.length
    }
    // Use API total when no level filter
    return total
  }, [levelFilter, allRows.length, total])

  const handleExport = async () => {
    try {
      const hasAnyFilter =
        userIdFilter.trim() ||
        sourceIdFilter.trim() ||
        statusFilter ||
        levelFilter

      if (!hasAnyFilter) {
        alert(
          'Please apply at least one filter (User, Source, Status, or Level) before exporting to avoid extremely large files.',
        )
        return
      }

      const exportPageSize = 1000
      const baseParams: any = {
        page: 1,
        limit: exportPageSize,
      }
      if (userIdFilter.trim()) {
        baseParams.user_id = userIdFilter.trim()
      }
      if (sourceIdFilter.trim()) {
        baseParams.source_user_id = sourceIdFilter.trim()
      }
      if (statusFilter) {
        baseParams.status = statusFilter
      }

      const firstResponse = await getSpotIncome(baseParams)
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
        const response = await getSpotIncome(params)
        if (response.items?.length) {
          allItems.push(...response.items)
        }
        if (!response.items || response.items.length === 0) {
          break
        }
      }

      if (!allItems.length) {
        alert('No spot commission records available to export.')
        return
      }

      let exportRows: SpotCommisionRow[] = allItems.map(entry => {
        const receiverDisplayId = entry.user_display_id || (() => {
          const userId = entry.user_id || entry.receiver_user_id || '-'
          if (!userId || userId === '-') return '-'
          const numericId = userId.toString()
          return numericId && numericId !== '-'
            ? `SIA${numericId.padStart(5, '0')}`
            : '-'
        })()

        const sourceDisplayId = entry.source_user_display_id || (() => {
          const sourceUserId = entry.source_user_id || '-'
          if (!sourceUserId || sourceUserId === '-') return '-'
          const numericId = sourceUserId.toString()
          return numericId && numericId !== '-'
            ? `SIA${numericId.padStart(5, '0')}`
            : '-'
        })()

        const level = entry.level ?? null
        const status =
          entry.status ??
          (entry as any).spot_added ??
          (entry.settled ? 'credited' : 'pending')
        const normalizedStatus =
          typeof status === 'string'
            ? status.toLowerCase()
            : status
            ? 'credited'
            : 'pending'

        let packageName = '-'
        let investmentAmt = 0

        if (entry.package_id) {
          const pkg = packagesMap.get(entry.package_id)
          packageName =
            pkg?.name || entry.package_name || `Package #${entry.package_id}`
          investmentAmt =
            (entry as any).investment_amt ??
            entry.investment ??
            entry.package_amount ??
            pkg?.price ??
            0
        } else if (entry.package_name) {
          packageName = entry.package_name
          investmentAmt =
            (entry as any).investment_amt ??
            entry.investment ??
            entry.package_amount ??
            0
        } else {
          investmentAmt =
            (entry as any).investment_amt ?? entry.investment ?? 0
        }

        const incomeAmount = entry.amount || (entry as any).income_amount || 0
        
        // Get credited date from entry
        const creditedDate = entry.credited_at || (entry as any).created_at || (entry as any).date || ''

        return {
          user_id: receiverDisplayId,
          user_name: entry.user_name || null,
          income_lvl: level,
          income_amount: incomeAmount,
          from_id: sourceDisplayId,
          from_name: entry.source_user_name || null,
          package_name: packageName,
          investment_amt: investmentAmt,
          spot_added: normalizedStatus,
          credited_date: creditedDate,
        }
      })

      if (levelFilter) {
        const filterLevel = parseInt(levelFilter, 10)
        exportRows = exportRows.filter(row => row.income_lvl === filterLevel)
      }

      if (!exportRows.length) {
        alert(
          'No spot commission records available to export for the selected filters.',
        )
        return
      }

      const headers = [
        'user_id',
        'income_lvl',
        'income_amount',
        'from_id',
        'package_name',
        'investment_amt',
        'status',
        'credited_date',
      ]
      
      // Helper to format date for export
      const formatDateForExport = (dateString: string): string => {
        if (!dateString) return '-'
        try {
          const date = new Date(dateString)
          return date.toLocaleString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          })
        } catch {
          return dateString
        }
      }
      
      const data = exportRows.map(row => [
        row.user_id,
        row.income_lvl != null ? getLevelDisplay(row.income_lvl) : 'N/A',
        row.income_amount.toFixed(2),
        row.from_id,
        row.package_name,
        row.investment_amt.toFixed(2),
        row.spot_added.toUpperCase(),
        formatDateForExport(row.credited_date),
      ])

      exportToCsv('spot-commission-transactions.csv', headers, data)
    } catch (err: any) {
      console.error('❌ Error exporting spot commissions:', err)
      alert(err?.message || 'Failed to export spot commission records.')
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSearch = () => {
    setPage(1)
    fetchCommissions()
  }

  const handleClearFilters = () => {
    setUserIdFilter('')
    setSourceIdFilter('')
    setStatusFilter('')
    setLevelFilter('')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  // Create status options for dropdown
  const statusOptions = useMemo(() => {
    return [
      { value: '', label: 'All Status' },
      { value: 'credited', label: 'Credited' },
      { value: 'pending', label: 'Pending' },
    ]
  }, [])

  if (loading && commissions.length === 0) {
    return (
      <Card title="Spot Commission Report">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-4"></div>
            <p className="text-gray-600">Loading commissions...</p>
          </div>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card title="Spot Commission Report">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button variant="outline" onClick={fetchCommissions}>
              Retry
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card
      title="Spot Commission Report"
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
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mb-2"></div>
            <p className="text-sm text-gray-600">Refreshing...</p>
          </div>
        </div>
      )}
      
      <DataTable<SpotCommisionRow>
        columns={columns}
        rows={rows}
        minWidthPx={1100}
      />

      <FiltersBar>
        <TextInput 
          id="user-id-filter" 
          label="Filter by User ID (Receiver):" 
          value={userIdFilter} 
          onChange={setUserIdFilter} 
          placeholder="Enter User ID (e.g., SIA00050 or 50)" 
        />
        <TextInput 
          id="source-id-filter" 
          label="Filter by Source ID:" 
          value={sourceIdFilter} 
          onChange={setSourceIdFilter} 
          placeholder="Enter Source User ID or Display (e.g., SIA02080)" 
        />
        <SelectInput
          id="level-filter"
          label="Filter by Level:"
          value={levelFilter}
          onChange={setLevelFilter}
          options={levelOptions}
          placeholder="All Levels"
        />
        <SelectInput
          id="status-filter"
          label="Filter by Status:"
          value={statusFilter}
          onChange={setStatusFilter}
          options={statusOptions}
          placeholder="All Status"
        />
        <DateRangeInput
          id="date-range"
          label="Date Range:"
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />
        <PrimaryButton type="button" onClick={handleSearch} disabled={loading}>
          Search
        </PrimaryButton>
        <SecondaryButton type="button" onClick={handleClearFilters} disabled={loading}>
          Clear filtering
        </SecondaryButton>
      </FiltersBar>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={paginationTotal}
        onPageChange={setPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize)
          setPage(1)
        }}
        pageSizeOptions={[10, 25, 50, 100, 250, 500, 1000]}
      />
    </Card>
  )
}
