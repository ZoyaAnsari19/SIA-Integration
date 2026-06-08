"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, TextInput, DateRangeInput } from '../../../components/ui/FiltersBar'
import Pagination from '../../../components/ui/Pagination'
import Button from '../../../components/ui/Button'
import { getAdminAssignedPackages, type AdminAssignedPackage, type AdminAssignedPackagesQuery } from '../../../lib/api/packages'
import { exportToCsv } from '../../../lib/export'

type AdminAssignedPackageRow = {
  id: string
  user_display_id: string
  user_name: string
  package_name: string
  amount: string
  income: string
  effective_global_ids: string
  assigned_by: string
  assigned_date: string
  status: string
}

// Format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

// Format date
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString)
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateString
  }
}

export default function AdminAssignedPackagesPage() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [packages, setPackages] = useState<AdminAssignedPackage[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [userIdFilter, setUserIdFilter] = useState('')
  const [adminUserIdFilter, setAdminUserIdFilter] = useState('')
  const [packageIdFilter, setPackageIdFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Fetch admin-assigned packages
  const fetchPackages = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const query: AdminAssignedPackagesQuery = {
        page,
        limit: pageSize,
      }

      if (userIdFilter.trim()) {
        query.user_id = userIdFilter.trim()
      }
      if (adminUserIdFilter.trim()) {
        query.admin_user_id = adminUserIdFilter.trim()
      }
      if (packageIdFilter.trim()) {
        query.package_id = parseInt(packageIdFilter.trim(), 10)
      }
      if (startDate) {
        query.start_date = startDate
      }
      if (endDate) {
        query.end_date = endDate
      }

      const response = await getAdminAssignedPackages(query)
      setPackages(response.items)
      setTotal(response.total)
    } catch (err: any) {
      console.error('Error fetching admin-assigned packages:', err)
      setError(err.message || 'Failed to fetch admin-assigned packages')
      setPackages([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, userIdFilter, adminUserIdFilter, packageIdFilter, startDate, endDate])

  useEffect(() => {
    fetchPackages()
  }, [fetchPackages])

  // Convert to table rows
  const rows: AdminAssignedPackageRow[] = useMemo(() => {
    if (!packages || packages.length === 0) {
      return []
    }
    return packages.map((pkg) => ({
      id: pkg.id,
      user_display_id: pkg.user_display_id || pkg.user_id,
      user_name: pkg.user_name || 'N/A',
      package_name: pkg.package_name,
      amount: formatCurrency(pkg.amount),
      income: formatCurrency(pkg.income),
      effective_global_ids: pkg.effective_global_ids !== null ? pkg.effective_global_ids.toString() : '0',
      assigned_by: pkg.assigned_by
        ? `${pkg.assigned_by.display_id || pkg.assigned_by.id} (${pkg.assigned_by.name || 'N/A'})`
        : 'N/A',
      assigned_date: formatDate(pkg.purchased_at),
      status: pkg.status === 'completed' ? 'Active' : pkg.status,
    }))
  }, [packages])

  // Table columns
  const columns: DataTableColumn<AdminAssignedPackageRow>[] = useMemo(
    () => [
      {
        key: 'user_display_id',
        title: 'User ID',
      },
      {
        key: 'user_name',
        title: 'User Name',
      },
      {
        key: 'package_name',
        title: 'Package',
      },
      {
        key: 'amount',
        title: 'Amount',
      },
      {
        key: 'income',
        title: 'Current Income',
      },
      {
        key: 'effective_global_ids',
        title: 'Initial Global IDs',
      },
      {
        key: 'assigned_by',
        title: 'Assigned By',
      },
      {
        key: 'assigned_date',
        title: 'Assigned Date',
      },
      {
        key: 'status',
        title: 'Status',
      },
    ],
    []
  )

  // Export to CSV
  const handleExport = useCallback(() => {
    const headers = [
      'ID',
      'User ID',
      'User Name',
      'User Email',
      'Package Name',
      'Amount',
      'Current Income',
      'Initial Global IDs',
      'Assigned By (ID)',
      'Assigned By (Name)',
      'Assigned Date',
      'Status',
      'Transaction ID',
      'Is Renewal',
    ]

    const csvRows = packages.map((pkg) => [
      pkg.id,
      pkg.user_display_id || pkg.user_id,
      pkg.user_name || 'N/A',
      pkg.user_email || 'N/A',
      pkg.package_name,
      pkg.amount.toString(),
      pkg.income.toString(),
      pkg.effective_global_ids?.toString() || '0',
      pkg.assigned_by?.display_id || pkg.assigned_by?.id || 'N/A',
      pkg.assigned_by?.name || 'N/A',
      formatDate(pkg.purchased_at),
      pkg.status,
      pkg.txn_id || 'N/A',
      pkg.is_renewal ? 'Yes' : 'No',
    ])

    exportToCsv(`admin-assigned-packages-${new Date().toISOString().split('T')[0]}.csv`, headers, csvRows)
  }, [packages])

  // Clear filters
  const handleClearFilters = useCallback(() => {
    setUserIdFilter('')
    setAdminUserIdFilter('')
    setPackageIdFilter('')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }, [])

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Admin Assigned Packages</h1>
          <p className="text-sm text-gray-600 mt-1">
            View all packages assigned by admins to users
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={isLoading || packages.length === 0}>
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <FiltersBar>
          <TextInput
            id="user-id-filter"
            label="User ID"
            value={userIdFilter}
            onChange={(value) => {
              setUserIdFilter(value)
              setPage(1)
            }}
            placeholder="Filter by user ID"
          />
          <TextInput
            id="admin-id-filter"
            label="Admin ID"
            value={adminUserIdFilter}
            onChange={(value) => {
              setAdminUserIdFilter(value)
              setPage(1)
            }}
            placeholder="Filter by admin ID"
          />
          <TextInput
            id="package-id-filter"
            label="Package ID"
            value={packageIdFilter}
            onChange={(value) => {
              setPackageIdFilter(value)
              setPage(1)
            }}
            placeholder="Filter by package ID"
          />
          <DateRangeInput
            id="date-range-filter"
            label="Date Range"
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={(date) => {
              setStartDate(date)
              setPage(1)
            }}
            onEndDateChange={(date) => {
              setEndDate(date)
              setPage(1)
            }}
          />
          <SecondaryButton onClick={handleClearFilters}>Clear Filters</SecondaryButton>
        </FiltersBar>

        {error && (
          <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="p-8 text-center">
            <p className="text-gray-600">Loading admin-assigned packages...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-600">No admin-assigned packages found</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
          />
        )}

        {totalPages > 1 && (
          <div className="mt-4">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
            />
          </div>
        )}

        <div className="mt-4 text-sm text-gray-600">
          Showing {packages.length} of {total} admin-assigned packages
        </div>
      </Card>
    </div>
  )
}
