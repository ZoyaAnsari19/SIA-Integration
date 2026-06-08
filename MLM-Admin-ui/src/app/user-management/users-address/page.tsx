"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, TextInput } from '../../../components/ui/FiltersBar'
import Pagination from '../../../components/ui/Pagination'
import Button from '../../../components/ui/Button'
import { EditButton } from '../../../components/ui/ActionButtons'
import { getAllProfiles, type ProfileItem } from '../../../lib/api/kyc'
import { ToastContainer, useToast } from '../../../components/ui/Toast'

type AddressRow = {
  user_id: string
  village_locality: string
  post_office: string
  police_station: string
  district: string
  city: string
  pin_code: string
  status: 'Verified' | 'Pending' | 'Unverified'
  updated_at: string
}

export default function UsersAddressPage() {
  const router = useRouter()
  const [userIdFilter, setUserIdFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [profiles, setProfiles] = useState<ProfileItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  
  const { toasts, showToast, closeToast } = useToast()

  // Handle edit button click - navigate to user details page
  const handleEditClick = useCallback((userId: string) => {
    router.push(`/user-management/users-details?userId=${userId}`)
  }, [router])

  // Map KYC status to address verification status
  const getAddressStatus = (kycStatus: string): 'Verified' | 'Pending' | 'Unverified' => {
    if (kycStatus === 'approved') return 'Verified'
    if (kycStatus === 'submitted') return 'Pending'
    return 'Unverified'
  }

  // Format date
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' })
    } catch {
      return dateString
    }
  }

  // Fetch profiles from API
  const fetchProfiles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: any = {
        page,
        limit: pageSize,
      }
      
      // Add user_id filter if provided
      if (userIdFilter.trim()) {
        params.user_id = userIdFilter.trim()
      }
      
      const response = await getAllProfiles(params)
      setProfiles(response.items || [])
      setTotal(response.total || 0)
      setTotalPages(response.total_pages || 0)
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to fetch user addresses'
      setError(errorMessage)
      showToast(errorMessage, 'error')
      setProfiles([])
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, userIdFilter, showToast])

  useEffect(() => {
    fetchProfiles()
  }, [fetchProfiles])

  // Map API profiles to address rows
  const rows: AddressRow[] = useMemo(() => {
    return profiles.map(profile => {
      const profileData = profile.profile
      return {
        user_id: profile.user_id || '-',
        village_locality: profileData?.address || '-',
        post_office: '-', // Not available in API
        police_station: '-', // Not available in API
        district: profileData?.state || '-',
        city: profileData?.city || '-',
        pin_code: profileData?.pincode || '-',
        status: getAddressStatus(profile.kyc_status),
        updated_at: formatDate(profile.kyc_verified_at || profile.created_at),
      }
    })
  }, [profiles])

  const columns: Array<DataTableColumn<AddressRow>> = useMemo(() => [
    {
      key: 'action',
      title: 'action',
      render: (row: AddressRow) => (
        <div className="flex items-center gap-2">
          <EditButton
            onClick={() => handleEditClick(row.user_id)}
          />
        </div>
      )
    },
    {
      key: 'user_id',
      title: 'user id',
      render: (r: AddressRow) => (
        <span className="font-semibold">{r.user_id}</span>
      )
    },
    { key: 'village_locality', title: 'village/locality' },
    { key: 'post_office', title: 'post office' },
    { key: 'police_station', title: 'police station' },
    { key: 'district', title: 'district' },
    { key: 'city', title: 'city' },
    { key: 'pin_code', title: 'pin code' },
    {
      key: 'status',
      title: 'status',
      render: (r: AddressRow) => {
        const cls = r.status === 'Verified'
          ? 'text-green-600 font-semibold'
          : r.status === 'Pending'
          ? 'text-yellow-500 font-semibold'
          : 'text-red-600 font-semibold'
        return <span className={cls}>{r.status}</span>
      }
    },
    { key: 'updated_at', title: 'Date (Last Updated)' },
  ], [])


  const handleExport = () => {
    alert('Exporting users address data...')
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSearch = () => {
    setPage(1) // Reset to first page when searching
    // fetchProfiles will be called automatically via useEffect
  }

  const handleClearFilters = () => {
    setUserIdFilter('')
    setPage(1)
  }

  return (
    <Card
      title="User Address Details Verification"
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
            <p className="text-sm text-gray-600">Loading user addresses...</p>
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
          <p className="text-sm text-yellow-600">No user addresses found. Users need to submit KYC to have address data.</p>
        </div>
      )}

      <DataTable<AddressRow>
        columns={columns}
        rows={rows}
        minWidthPx={1200}
      />

      <FiltersBar>
        <TextInput
          id="user-id-filter"
          label="Filter by User ID:"
          value={userIdFilter}
          onChange={setUserIdFilter}
          placeholder="Enter User ID (e.g., U1001)"
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


