"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, TextInput, SelectInput, DateRangeInput } from '../../../components/ui/FiltersBar'
import Pagination from '../../../components/ui/Pagination'
import Button from '../../../components/ui/Button'
import { getTeamIncome, type IncomeHistoryItem } from '../../../lib/api/incomeHistory'
import { getPackages, type Package } from '../../../lib/api/packages'
import { exportToCsv } from '../../../lib/export'
import { ToastContainer, useToast } from '../../../components/ui/Toast'

type TeamIncomeRow = {
  user_id: string // Display ID (Receiver)
  user_name: string | null // Receiver user name
  through_level: number | null // Level through which income came
  members: string // Source user with display ID
  members_name: string | null // Source user name
  income_amount: number
  created_at: string
}

export default function TeamIncomePage() {
  const [userIdFilter, setUserIdFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
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

  // Fetch team income from API
  const fetchTeamIncome = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const userId = extractUserId(userIdFilter)
      const params: any = {
        page: levelFilter ? 1 : page, // When level filter active, start from page 1
        limit: levelFilter ? Math.min(1000, pageSize) : pageSize, // Use pageSize (up to 1000) when level filter is active, otherwise use pageSize directly
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
      
      const response = await getTeamIncome(params)
      setIncomeData(response.items || [])
      setTotal(response.total || 0)
      setTotalPages(response.total_pages || 0)
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to fetch team income'
      setError(errorMessage)
      showToast(errorMessage, 'error')
      setIncomeData([])
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, userIdFilter, levelFilter, startDate, endDate, showToast])

  useEffect(() => {
    fetchTeamIncome()
  }, [fetchTeamIncome])

  // When level filter changes, refetch all data for client-side filtering
  useEffect(() => {
    if (levelFilter) {
      setPage(1) // Reset to first page when level filter changes
      // fetchTeamIncome will be called automatically via the dependency on levelFilter
    }
  }, [levelFilter])

  // Create package options for dropdown
  const packageOptions = useMemo(() => {
    const options = Array.from(packagesMap.entries()).map(([id, name]) => ({
      value: id.toString(),
      label: name
    }))
    return options.sort((a, b) => a.label.localeCompare(b.label))
  }, [packagesMap])

  // Create level options for dropdown
  const levelOptions = useMemo(() => {
    return [
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

  // Map API response to table rows (filter by level if selected)
  const allRows: TeamIncomeRow[] = useMemo(() => {
    return incomeData
      .filter(item => {
        // Filter by level if provided
        if (levelFilter) {
          const filterLevel = parseInt(levelFilter, 10)
          const itemLevel = item.level ?? null
          return itemLevel === filterLevel
        }
        return true
      })
      .map(item => {
        // Receiver display ID
        const receiverDisplayId = item.user_display_id || (() => {
          const userId = item.user_id || item.receiver_user_id || '-'
          if (!userId || userId === '-') return '-'
          const numericId = userId.toString()
          return numericId && numericId !== '-'
            ? `SIA${numericId.padStart(5, '0')}`
            : '-'
        })()
        
        // Source user display ID only (not name)
        let sourceDisplayId = '-'
        if (item.source_user_id) {
          sourceDisplayId = item.source_user_display_id || (() => {
            const numericId = item.source_user_id.toString()
            return numericId && numericId !== '-'
              ? `SIA${numericId.padStart(5, '0')}`
              : '-'
          })()
        }
        
        return {
          user_id: receiverDisplayId, // Receiver display ID
          user_name: item.user_name || null, // Receiver user name
          through_level: item.level ?? null, // Level through which income came
          members: sourceDisplayId, // Source user display ID
          members_name: item.source_user_name || null, // Source user name
          income_amount: item.amount || 0,
          created_at: formatDate(item.credited_at),
        }
      })
  }, [incomeData, levelFilter])

  // Apply client-side pagination when level filter is active
  const rows: TeamIncomeRow[] = useMemo(() => {
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

  const columns: Array<DataTableColumn<TeamIncomeRow>> = useMemo(() => [
    { 
      key: 'user_id', 
      title: 'user_id (Receiver)',
      render: (r: TeamIncomeRow) => {
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
      key: 'through_level', 
      title: 'Through Level',
      render: (r: TeamIncomeRow) => (
        <div className="flex items-center gap-2">
          {r.through_level != null ? (
            <>
              <span className="font-semibold text-gray-600">←</span>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getLevelBadgeColor(r.through_level)}`}>
                {getLevelDisplay(r.through_level)}
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
      key: 'members', 
      title: 'members (Source)',
      render: (r: TeamIncomeRow) => {
        const membersUserName = r.members_name || ''
        return (
          <div className="flex flex-col">
            <span className="font-semibold text-blue-600">{r.members}</span>
            {membersUserName && (
              <span className="text-xs text-gray-600 mt-0.5">{membersUserName}</span>
            )}
          </div>
        )
      }
    },
    { 
      key: 'income_amount', 
      title: 'income_amount',
      render: (r: TeamIncomeRow) => (
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
      showToast('Preparing team income export (all records)...', 'info')

      const exportPageSize = 1000
      const userId = extractUserId(userIdFilter)
      const baseParams: any = {
        page: 1,
        limit: exportPageSize,
      }
      if (userId) {
        baseParams.user_id = userId
      }
      if (startDate) {
        baseParams.start_date = startDate
      }
      if (endDate) {
        baseParams.end_date = endDate
      }

      const firstResponse = await getTeamIncome(baseParams)
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
        const response = await getTeamIncome(params)
        if (response.items?.length) {
          allItems.push(...response.items)
        }
        if (!response.items || response.items.length === 0) {
          break
        }
      }

      if (!allItems.length) {
        alert('No team income records available to export.')
        return
      }

      let exportRows: TeamIncomeRow[] = allItems
        .filter(item => {
          if (levelFilter) {
            const filterLevel = parseInt(levelFilter, 10)
            const itemLevel = item.level ?? null
            return itemLevel === filterLevel
          }
          return true
        })
        .map(item => {
          const receiverDisplayId = item.user_display_id || (() => {
            const userId = item.user_id || item.receiver_user_id || '-'
            if (!userId || userId === '-') return '-'
            const numericId = userId.toString()
            return numericId && numericId !== '-'
              ? `SIA${numericId.padStart(5, '0')}`
              : '-'
          })()

          let sourceDisplayId = '-'
          if (item.source_user_id) {
            sourceDisplayId =
              item.source_user_display_id ||
              (() => {
                const numericId = item.source_user_id!.toString()
                return numericId && numericId !== '-'
                  ? `SIA${numericId.padStart(5, '0')}`
                  : '-'
              })()
          }

          return {
            user_id: receiverDisplayId,
            user_name: item.user_name || null,
            through_level: item.level ?? null,
            members: sourceDisplayId,
            members_name: item.source_user_name || null,
            income_amount: item.amount || 0,
            created_at: formatDate(item.credited_at),
          }
        })

      if (!exportRows.length) {
        alert(
          'No team income records available to export for the selected filters.',
        )
        return
      }

      const headers = ['user_id', 'through_level', 'members', 'income_amount', 'created_at']
      const data = exportRows.map(row => [
        row.user_id,
        row.through_level != null ? getLevelDisplay(row.through_level) : 'N/A',
        row.members,
        row.income_amount.toFixed(2),
        row.created_at,
      ])

      exportToCsv('team-income-transactions.csv', headers, data)
      showToast(
        `Exported ${exportRows.length} team income records successfully.`,
        'success',
      )
    } catch (err: any) {
      console.error('❌ Error exporting team income:', err)
      const message = err?.message || 'Failed to export team income records.'
      showToast(message, 'error')
      alert(message)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSearch = () => {
    setPage(1) // Reset to first page when searching
    // Filter will be applied via API call in fetchTeamIncome
  }

  const handleClearFilters = () => {
    setUserIdFilter('')
    setLevelFilter('')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  return (
    <Card
      title="Team Income Transaction Report"
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
            <p className="text-sm text-gray-600">Loading team income data...</p>
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
          <p className="text-sm text-yellow-600">No team income records found.</p>
        </div>
      )}

      <DataTable<TeamIncomeRow>
        columns={columns}
        rows={rows}
        minWidthPx={750}
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
          id="level-filter"
          label="Filter by Level:"
          value={levelFilter}
          onChange={setLevelFilter}
          options={levelOptions}
          placeholder="All Levels"
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
        total={paginationTotal}
        onPageChange={setPage}
        onPageSizeChange={(newPageSize) => {
          setPageSize(newPageSize)
          setPage(1) // Reset to first page when changing page size
        }}
        pageSizeOptions={[10, 25, 50, 100, 250, 500, 1000]}
      />

      <ToastContainer toasts={toasts} onClose={closeToast} />
    </Card>
  )
}
