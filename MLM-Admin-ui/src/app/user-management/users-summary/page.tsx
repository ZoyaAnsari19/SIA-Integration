"use client"

import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Card from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, TextInput, DateRangeInput, SelectInput } from '../../../components/ui/FiltersBar'
import Pagination from '../../../components/ui/Pagination'
import Button from '../../../components/ui/Button'
import { getUsers, type User, type UsersListResponse } from '../../../lib/api/users'
import { getPackages, type Package } from '../../../lib/api/packages'
import { exportToCsv } from '../../../lib/export'

type UserSummaryRow = {
  user_id: string
  fullname: string
  email: string
  package_name: string
  sponsor_id: string
  wallet_balance: string
  direct_referrals: number
  total_team_size: number
  total_purchases: number
  kyc_status: string
  status: string
  created_on: string
}

export default function UsersSummaryPage() {
  const [memberId, setMemberId] = useState('')
  const [memberName, setMemberName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [hasSearched, setHasSearched] = useState(false)
  const [packageFilterId, setPackageFilterId] = useState('')
  const [hasActivePackageFilter, setHasActivePackageFilter] = useState<'' | 'true' | 'false'>('')
  const [packages, setPackages] = useState<Package[]>([])

  // Fetch users from API
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const params: any = {
        page,
        limit: pageSize,
        sort: 'created_at',
        order: 'desc',
      }
      
      // Add filters (case-insensitive search)
      if (memberId.trim()) {
        params.id = memberId.trim() // No case conversion - API handles case-insensitive matching
      }
      if (memberName.trim()) {
        params.name = memberName.trim() // No case conversion - API handles case-insensitive matching
      }
      if (startDate) {
        params.start_date = startDate
      }
      if (endDate) {
        params.end_date = endDate
      }
      if (packageFilterId) {
        const pkgId = parseInt(packageFilterId, 10)
        if (!isNaN(pkgId)) params.package_id = pkgId
      }
      if (hasActivePackageFilter) {
        params.has_active_package = hasActivePackageFilter
      }

      console.log('🔍 Fetching users summary with params:', params)
      const response = await getUsers(params)
      
      console.log('✅ API Response:', {
        count: response.count,
        total: response.total,
        total_pages: response.total_pages,
        items_count: response.items.length,
      })
      
      setUsers(response.items)
      setTotal(response.total)
      setTotalPages(response.total_pages)
      setHasSearched(true)
    } catch (err: any) {
      console.error('❌ Error fetching users:', err)
      setError(err.message || 'Failed to fetch users')
      setUsers([])
      setTotal(0)
      setTotalPages(0)
    } finally {
      setLoading(false)
    }
  }, [memberId, memberName, startDate, endDate, packageFilterId, hasActivePackageFilter, page, pageSize])

  // Handle form submit
  const handleSubmit = useCallback((e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setPage(1) // Reset to first page on new search
    fetchUsers()
  }, [fetchUsers])

  // Handle clear filters
  const handleClearFilters = useCallback(() => {
    setMemberId('')
    setMemberName('')
    setPackageFilterId('')
    setHasActivePackageFilter('')
    setStartDate('')
    setEndDate('')
    setPage(1)
    setHasSearched(false)
    setUsers([])
    setTotal(0)
    setTotalPages(0)
    setError(null)
  }, [])

  // Load packages for filter dropdown
  useEffect(() => {
    getPackages({ status: 'active', limit: 100 })
      .then((res) => setPackages(res.items))
      .catch((err) => console.error('Failed to load packages:', err))
  }, [])

  // Map users to table rows
  const rows: UserSummaryRow[] = useMemo(() => {
    return users.map(user => {
      const formatValue = (value: any, fallback: string = 'N/A'): string => {
        if (value === null || value === undefined || value === '') {
          return fallback;
        }
        return String(value).trim();
      };

      return {
        user_id: user.id || 'N/A',
        fullname: formatValue(user.name),
        email: formatValue(user.email),
        package_name: formatValue(user.latest_package_name),
        sponsor_id: formatValue(user.referrer_user_id),
        wallet_balance: `₹${user.wallet_balance.toFixed(2)}`,
        direct_referrals: user.direct_referrals,
        total_team_size: user.total_team_size,
        total_purchases: user.total_purchases,
        kyc_status: user.kyc_status,
        status: user.status,
        created_on: user.created_at 
          ? new Date(user.created_at).toLocaleString('en-IN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })
          : 'N/A',
      };
    });
  }, [users])

  // Define table columns
  const columns: Array<DataTableColumn<UserSummaryRow>> = useMemo(() => [
    { 
      key: 'user_id', 
      title: 'user id', 
      render: (r: UserSummaryRow) => (
        <span className="font-semibold">{r.user_id}</span>
      )
    },
    { 
      key: 'fullname', 
      title: 'Fullname', 
      render: (r: UserSummaryRow) => (
        <span className="font-semibold">{r.fullname}</span>
      )
    },
    { key: 'email', title: 'email address' },
    { key: 'package_name', title: 'package' },
    { key: 'sponsor_id', title: 'sponsor id' },
    { 
      key: 'wallet_balance', 
      title: 'wallet balance',
      render: (r: UserSummaryRow) => (
        <span className="font-semibold text-blue-600">{r.wallet_balance}</span>
      )
    },
    { 
      key: 'direct_referrals', 
      title: 'direct referrals',
      render: (r: UserSummaryRow) => (
        <span className="font-medium">{r.direct_referrals}</span>
      )
    },
    { 
      key: 'total_team_size', 
      title: 'total team size',
      render: (r: UserSummaryRow) => (
        <span className="font-medium">{r.total_team_size}</span>
      )
    },
    { 
      key: 'total_purchases', 
      title: 'total purchases',
      render: (r: UserSummaryRow) => (
        <span className="font-medium">{r.total_purchases}</span>
      )
    },
    { 
      key: 'kyc_status', 
      title: 'kyc status',
      render: (r: UserSummaryRow) => {
        const statusColors: Record<string, string> = {
          approved: 'text-green-600',
          pending: 'text-yellow-600',
          submitted: 'text-blue-600',
          rejected: 'text-red-600',
        }
        return (
          <span className={`font-semibold ${statusColors[r.kyc_status.toLowerCase()] || 'text-gray-600'}`}>
            {r.kyc_status}
          </span>
        )
      }
    },
    { 
      key: 'status', 
      title: 'status',
      render: (r: UserSummaryRow) => (
        <span className={r.status === 'active' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
          {r.status}
        </span>
      )
    },
    { key: 'created_on', title: 'created on' },
  ], [])

  // Handle export
  const handleExport = () => {
    if (!rows.length) {
      alert('No user records available to export.')
      return
    }

    const headers = ['User ID', 'Fullname', 'Email', 'Package', 'Sponsor ID', 'Wallet Balance', 'Direct Referrals', 'Total Team Size', 'Total Purchases', 'KYC Status', 'Status', 'Created On']
    const data = rows.map(row => [
      row.user_id,
      row.fullname,
      row.email,
      row.package_name,
      row.sponsor_id,
      row.wallet_balance,
      row.direct_referrals,
      row.total_team_size,
      row.total_purchases,
      row.kyc_status,
      row.status,
      row.created_on,
    ])

    exportToCsv(`users-summary-${new Date().toISOString().split('T')[0]}.csv`, headers, data)
  }

  // Handle print
  const handlePrint = () => {
    window.print()
  }

  return (
    <Card
      title="Member Summary"
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
      {/* Filters Form */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextInput 
              id="filter-member-id"
              label="Member ID" 
              value={memberId}
              onChange={setMemberId} 
              placeholder="Enter Member ID"
            />
            <TextInput 
              id="filter-member-name"
              label="Member Name" 
              value={memberName}
              onChange={setMemberName} 
              placeholder="Enter Member Name"
            />
          </div>
          <DateRangeInput
            id="date-range"
            label="Date Range:"
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />
          <SelectInput
            id="filter-package"
            label="Filter by Package:"
            value={packageFilterId}
            onChange={setPackageFilterId}
            placeholder="All packages"
            options={packages.map((p) => ({
              value: p.id.toString(),
              label: `${p.name} — ₹${Number(p.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
            }))}
          />
          <SelectInput
            id="filter-active-package"
            label="Package status (active / expired):"
            value={hasActivePackageFilter}
            onChange={(v) => {
              setHasActivePackageFilter((v === 'true' || v === 'false' ? v : '') as '' | 'true' | 'false')
              setPage(1)
            }}
            options={[
              { value: '', label: 'All users' },
              { value: 'true', label: 'Has active package' },
              { value: 'false', label: 'No active package (expired only)' },
            ]}
          />
          <div className="flex gap-2">
            <PrimaryButton type="submit" disabled={loading}>
              {loading ? 'Loading...' : 'Filter Now'}
            </PrimaryButton>
            <SecondaryButton type="button" onClick={handleClearFilters}>
              Clear Filters
            </SecondaryButton>
          </div>
        </form>
      </div>

      {/* Loading State */}
      {loading && !hasSearched && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-4"></div>
            <p className="text-gray-600">Loading users...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button variant="outline" onClick={fetchUsers}>
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Results Table */}
      {!loading && hasSearched && (
        <>
          {rows.length > 0 ? (
            <>
              <div className="mb-4 text-sm text-gray-600">
                Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total} results
              </div>
              <DataTable<UserSummaryRow>
                columns={columns}
                rows={rows}
                minWidthPx={1800}
              />
              {totalPages > 1 && (
                <Pagination
                  page={page}
                  total={total}
                  onPageChange={setPage}
                  pageSize={pageSize}
                  onPageSizeChange={setPageSize}
                />
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600">No users found matching your filters.</p>
              <Button variant="outline" onClick={handleClearFilters} className="mt-4">
                Clear Filters
              </Button>
            </div>
          )}
        </>
      )}

      {/* Initial State - No Search Yet */}
      {!loading && !hasSearched && !error && (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">Enter filters and click "Filter Now" to search for users.</p>
        </div>
      )}
    </Card>
  )
}
