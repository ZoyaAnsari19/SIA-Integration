"use client"

import React, { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Card from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, TextInput, SelectInput } from '../../../components/ui/FiltersBar'
import Pagination from '../../../components/ui/Pagination'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import { getUsers, getUserById, updateUser, uploadDisplayTitleIcon, activateUser, deactivateUser, getUserActiveCourses, getUserEligibility, getBusinessVolumeWithLegs, type User, type UserDetails, type UpdateUserRequest, type UserPurchase, type LevelEligibility, type BusinessVolumeResponse } from '../../../lib/api/users'
import { getPackages, assignPackageToUser, type Package } from '../../../lib/api/packages'
import UserSummaryModal from '../../../components/UserSummaryModal'
import { exportToCsv } from '../../../lib/export'
import { getMyPermissions } from '../../../lib/api/sub-admins'
import { usePinVerification } from '../../../hooks/usePinVerification'

type UserDetailsRow = {
  fullname: string
  user_id: string // Keep for action buttons, but don't display in table
  user_display_id: string // User ID column - display_id like SIA02047
  investments: string
  sponsor_id: string
  email: string
  password: string | null // Plain text password for admin view
  kyc_status: 'Submitted' | 'Approved' | 'Rejected' | 'Pending' | null
  status: 'Active' | 'Blocked'
  created_on: string
}

export default function UsersDetailsPage() {
  const router = useRouter()
  const [nameFilter, setNameFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  
  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserDetails | null>(null)
  const [editLoading, setEditLoading] = useState(false)

  // Set display title only modal (quick edit)
  const [isSetTitleModalOpen, setIsSetTitleModalOpen] = useState(false)
  const [setTitleUserId, setSetTitleUserId] = useState<string | null>(null)
  const [setTitleUserName, setSetTitleUserName] = useState<string>('')
  const [setTitleValue, setSetTitleValue] = useState<string>('')
  const [setTitleIconUrl, setSetTitleIconUrl] = useState<string | null>(null)
  const [setTitleLoading, setSetTitleLoading] = useState(false)
  const [setTitleIconUploading, setSetTitleIconUploading] = useState(false)
  const [isActiveCoursesModalOpen, setIsActiveCoursesModalOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [activeCourses, setActiveCourses] = useState<UserPurchase[]>([])
  const [loadingCourses, setLoadingCourses] = useState(false)
  
  // User Summary Modal state
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false)
  const [summaryUserId, setSummaryUserId] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState<UpdateUserRequest>({
    name: '',
    display_title: null,
    display_title_icon_url: null,
    email: '',
    phone: '',
    referrer_user_id: null,
    kyc_status: 'pending',
    withdrawal_blocked: false,
  })
  const [editIconUploading, setEditIconUploading] = useState(false)

  // Action loading state
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Advanced filter state
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false)
  const [sortBy, setSortBy] = useState<'created_at' | 'direct_referrals' | 'total_business_volume'>('created_at')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')
  const [packageFilterId, setPackageFilterId] = useState('')
  const [hasActivePackageFilter, setHasActivePackageFilter] = useState<'' | 'true' | 'false'>('')
  const [minDirectReferrals, setMinDirectReferrals] = useState('')
  const [minTeamBusiness, setMinTeamBusiness] = useState('')
  const [filterResults, setFilterResults] = useState<User[]>([])
  const [filterLoading, setFilterLoading] = useState(false)
  const [filtersApplied, setFiltersApplied] = useState(false)
  const [userLevels, setUserLevels] = useState<Map<string, { title: string; level: number }>>(new Map())
  const [loadingLevels, setLoadingLevels] = useState(false)

  // User-specific business report state
  const [businessReportUserId, setBusinessReportUserId] = useState('')
  const [businessReportStartDate, setBusinessReportStartDate] = useState('')
  const [businessReportEndDate, setBusinessReportEndDate] = useState('')
  const [businessReportData, setBusinessReportData] = useState<BusinessVolumeResponse | null>(null)
  const [businessReportLoading, setBusinessReportLoading] = useState(false)
  const [businessReportError, setBusinessReportError] = useState<string | null>(null)
  const [businessReportUserInfo, setBusinessReportUserInfo] = useState<{ name: string | null; display_id: string | null } | null>(null)

  // Comparison & Analytics state
  const [comparisonMode, setComparisonMode] = useState<'users' | 'period' | 'none'>('none')
  const [comparisonUserIds, setComparisonUserIds] = useState<string[]>(['', ''])
  const [comparisonData, setComparisonData] = useState<Array<{ user: { name: string | null; display_id: string | null }, data: BusinessVolumeResponse | null }>>([])
  const [comparisonLoading, setComparisonLoading] = useState(false)
  const [periodComparisonData, setPeriodComparisonData] = useState<{ current: BusinessVolumeResponse | null, previous: BusinessVolumeResponse | null }>({ current: null, previous: null })
  const [periodComparisonLoading, setPeriodComparisonLoading] = useState(false)
  const [showTopPerformers, setShowTopPerformers] = useState(false)
  const [topPerformersData, setTopPerformersData] = useState<Array<{ user: User, business: number }>>([])

  // Package Assign Modal state
  const [isPackageAssignModalOpen, setIsPackageAssignModalOpen] = useState(false)
  const [selectedUserForPackage, setSelectedUserForPackage] = useState<User | null>(null)
  const [packages, setPackages] = useState<Package[]>([])
  const [loadingPackages, setLoadingPackages] = useState(false)
  const [assignPackageData, setAssignPackageData] = useState({
    package_id: '',
    used_ids: 0,
    income: 0,
  })
  const [assigningPackage, setAssigningPackage] = useState(false)

  // Permission state
  const [adminPermissions, setAdminPermissions] = useState<string[]>([])
  const [adminRole, setAdminRole] = useState<string>('SUPER_ADMIN')

  // PIN verification hook
  const { verifyPinForAction } = usePinVerification()

  // Check if user has permission (SUPER_ADMIN has all permissions)
  const hasPermission = (permission: string) => {
    if (adminRole === 'SUPER_ADMIN') return true
    return adminPermissions.includes(permission)
  }

  // Fetch admin permissions on mount
  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const { permissions, role } = await getMyPermissions()
        setAdminPermissions(permissions)
        setAdminRole(role)
      } catch (error) {
        console.error('Error fetching admin permissions:', error)
        // Default to SUPER_ADMIN if error
        setAdminRole('SUPER_ADMIN')
        setAdminPermissions([])
      }
    }
    fetchPermissions()
  }, [])

  // Fetch users from API
  const fetchUsers = async (overridePage?: number) => {
    try {
      setLoading(true)
      setError(null)
      
      const currentPage = overridePage !== undefined ? overridePage : page
      
      const params: any = {
        page: currentPage,
        limit: pageSize,
        sort: sortBy,
        order: 'desc',
      }
      
      // Add name filter if provided
      if (nameFilter.trim()) {
        params.name = nameFilter.trim()
      }
      
      // Add search query (search by user's own display_id - case-insensitive)
      if (searchQuery.trim()) {
        params.display_id = searchQuery.trim() // Search by user's own display_id (no case conversion)
      }
      
      // Add date filters
      if (filterStartDate) {
        params.start_date = filterStartDate
      }
      if (filterEndDate) {
        params.end_date = filterEndDate
      }
      if (packageFilterId) {
        const pkgId = parseInt(packageFilterId, 10)
        if (!isNaN(pkgId)) params.package_id = pkgId
      }
      if (hasActivePackageFilter) {
        params.has_active_package = hasActivePackageFilter
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Fetching users with params:', params)
      }
      const response = await getUsers(params)
      
      // Detailed logging for field verification (development only)
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ API Response Summary:', {
          count: response.count,
          total: response.total,
          total_pages: response.total_pages,
          items_count: response.items.length,
        })
        
        // Log all users with their field values
        console.log('📋 All Users Data (Field Check):', response.items.map(user => ({
          id: user.id,
          name: user.name,
          phone: user.phone || '❌ NULL',
          password: user.password || '❌ NULL',
          latest_package_name: user.latest_package_name || '❌ NULL',
          referrer_user_id: user.referrer_user_id || '❌ NULL',
          email: user.email,
          status: user.status,
        })))
        
        // Log raw API response for first user to see all fields
        if (response.items.length > 0) {
          console.log('🔍 Raw API Response (First User - All Keys):', {
            allKeys: Object.keys(response.items[0]),
            fullObject: response.items[0],
          })
        }
        
        // Log first user in detail
        if (response.items.length > 0) {
          const firstUser = response.items[0]
          console.log('🔬 First User Detailed Analysis:', {
            password: firstUser.password,
            'Raw API Response': firstUser,
            'Field Status': {
              phone: firstUser.phone ? `✅ "${firstUser.phone}"` : '❌ NULL/UNDEFINED',
              latest_package_name: firstUser.latest_package_name ? `✅ "${firstUser.latest_package_name}"` : '❌ NULL/UNDEFINED',
              referrer_user_id: firstUser.referrer_user_id ? `✅ "${firstUser.referrer_user_id}"` : '❌ NULL/UNDEFINED',
            }
          })
        }
      }
      
      setUsers(response.items)
      setTotal(response.total)
      setTotalPages(response.total_pages)
    } catch (err: any) {
      console.error('❌ Error fetching users:', err)
      console.error('Error details:', {
        message: err.message,
        stack: err.stack,
      })
      setError(err.message || 'Failed to fetch users')
      
      // Handle 401 - redirect to login
      if (err.message?.includes('Unauthorized') || err.message?.includes('401')) {
        router.push('/login')
        return
      }
    } finally {
      setLoading(false)
    }
  }

  // Fetch users on mount and when filters change
  useEffect(() => {
    fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize])

  // Fetch users when name filter changes (debounced search)
  // Note: This is disabled - search only happens on button click
  // useEffect(() => {
  //   const timer = setTimeout(() => {
  //     if (page === 1) {
  //       fetchUsers()
  //     } else {
  //       setPage(1) // Reset to page 1 when filter changes
  //     }
  //   }, 500) // Debounce search by 500ms

  //   return () => clearTimeout(timer)
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [nameFilter, searchQuery])

  // Map API User to UI UserDetailsRow
  const rows: UserDetailsRow[] = useMemo(() => {
    return users.map((user) => {
      // Helper to format null/undefined values
      const formatValue = (value: string | null | undefined, fallback: string = 'N/A'): string => {
        if (value === null || value === undefined || value === '') {
          return fallback;
        }
        return String(value).trim();
      };

      const mappedRow = {
        fullname: formatValue(user.name),
        user_id: user.id || 'N/A', // Keep for action buttons, but don't display
        user_display_id: user.display_id ? formatValue(user.display_id) : formatValue(user.id), // User ID column - always show display_id if available
        investments: `${(user.active_investment ?? user.total_investment).toLocaleString('en-IN', { maximumFractionDigits: 2 })} / ${user.total_active_packages} active`,
        sponsor_id: user.referrer_display_id || formatValue(user.referrer_user_id), // Show display_id if available, else user_id
        email: formatValue(user.email),
        password: user.password || null, // Plain text password for admin view
        kyc_status: (() => {
          const kycStatus = user.kyc_status?.toLowerCase()
          if (kycStatus === 'submitted') return 'Submitted'
          if (kycStatus === 'approved') return 'Approved'
          if (kycStatus === 'rejected') return 'Rejected'
          return null // For pending or any other status, return null (don't show)
        })() as 'Submitted' | 'Approved' | 'Rejected' | null,
        status: (user.status === 'active' ? 'Active' : 'Blocked') as 'Active' | 'Blocked',
        created_on: user.created_at 
          ? new Date(user.created_at).toLocaleString('en-IN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          : 'N/A',
      };

      // Debug log for all users to see data mapping
      console.log(`📊 User ${user.id} - Field Mapping:`, {
        'API kyc_status': user.kyc_status,
        '→ UI kyc_status': mappedRow.kyc_status,
        'API referrer_user_id': user.referrer_user_id,
        '→ UI sponsor_id': mappedRow.sponsor_id,
      });

      return mappedRow;
    });
  }, [users])

  const columns: Array<DataTableColumn<UserDetailsRow>> = useMemo(() => [
    {
      key: 'action',
      title: 'Action',
      render: (row: UserDetailsRow) => {
        const user = users.find(u => u.id === row.user_id)
        const isActive = user?.status === 'active'
        const isLoading = actionLoading === row.user_id
        
        return (
        <div className="flex items-center gap-2">
            {isActive ? (
              <button
                className="px-3 py-1 rounded-lg border bg-white text-[#ffc107] border-[#d1d5db] inline-flex items-center justify-center hover:bg-[#ffc107] hover:text-white hover:border-[#ffc107] transition-colors text-sm font-medium"
                title="Block"
                type="button"
                onClick={() => !isLoading && handleDeactivateClick(row.user_id)}
                aria-label="Block"
                disabled={isLoading}
              >
                Block
              </button>
            ) : (
              <button
                className="px-3 py-1 rounded-lg border bg-white text-[#28a745] border-[#d1d5db] inline-flex items-center justify-center hover:bg-[#28a745] hover:text-white hover:border-[#28a745] transition-colors text-sm font-medium"
                title="Unblock"
                type="button"
                onClick={() => !isLoading && handleActivateClick(row.user_id)}
                aria-label="Unblock"
                disabled={isLoading}
              >
                Unblock
              </button>
            )}
            <button
              className="px-2 py-1 rounded-lg border bg-white text-blue-600 border-blue-300 inline-flex items-center justify-center hover:bg-blue-50 hover:border-blue-400 transition-colors text-sm font-medium"
              title="View Summary"
              type="button"
              onClick={() => {
                setSummaryUserId(row.user_id)
                setIsSummaryModalOpen(true)
              }}
              aria-label="View Summary"
              disabled={isLoading}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
            {hasPermission('USERS_EDIT') && (
            <button
              className="px-2 py-1 rounded-lg border bg-white text-gray-700 border-gray-300 inline-flex items-center justify-center hover:bg-gray-50 hover:border-gray-400 transition-colors text-sm font-medium"
              title="Edit user (name, email, display title, etc.)"
              type="button"
              onClick={() => !isLoading && handleEditClick(row.user_id)}
              aria-label="Edit"
              disabled={isLoading}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            )}
            {hasPermission('DISPLAY_TITLE_MANAGE') && (
            <button
              className="px-2 py-1 rounded-lg border bg-white text-amber-600 border-amber-300 inline-flex items-center justify-center hover:bg-amber-50 hover:border-amber-400 transition-colors text-sm font-medium"
              title="Set display title only"
              type="button"
              onClick={() => !isLoading && handleSetTitleClick(row.user_id, user?.display_title ?? null, user?.name || user?.display_id || row.user_display_id || row.user_id, user?.display_title_icon_url ?? null)}
              aria-label="Set title"
              disabled={isLoading}
            >
              Title
            </button>
            )}
            {hasPermission('PACKAGE_ASSIGN') && (
              <button
                className="px-3 py-1 rounded-lg border bg-white text-purple-600 border-purple-300 inline-flex items-center justify-center hover:bg-purple-50 hover:border-purple-400 transition-colors text-sm font-medium"
                title="Assign Package"
                type="button"
                onClick={() => {
                  const user = users.find(u => u.id === row.user_id)
                  if (user) {
                    handlePackageAssignClick(user)
                  }
                }}
                aria-label="Assign Package"
                disabled={isLoading || actionLoading === row.user_id}
              >
                Package Assign
              </button>
            )}
            {isLoading && (
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
            )}
        </div>
      )
      }
    },
    { key: 'fullname', title: 'Fullname', render: (r: UserDetailsRow) => (<span className="font-semibold">{r.fullname}</span>) },
    { key: 'user_display_id', title: 'User ID', render: (r: UserDetailsRow) => (<span className="font-mono font-semibold text-blue-600">{r.user_display_id}</span>) },
    { 
      key: 'investments', 
      title: 'Investments',
      render: (r: UserDetailsRow) => {
        const [amount, active] = r.investments.split(' / ');
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{amount}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleViewActiveCourses(r.user_id)}
                className="h-6 px-2 text-xs"
              >
                View
              </Button>
            </div>
            <span className="text-sm text-gray-600">{active}</span>
          </div>
        );
      }
    },
    { key: 'sponsor_id', title: 'Sponsor id' },
    { key: 'email', title: 'Email address' },
    { 
      key: 'password', 
      title: 'Password', 
      render: (r: UserDetailsRow) => (
        <span className="font-mono text-sm">
          {r.password || '-'}
        </span>
      )
    },
    { 
      key: 'kyc_status', 
      title: 'KYC Status', 
      render: (r: UserDetailsRow) => {
        // Only show Submitted, Approved, or Rejected - not pending/not-submitted
        if (!r.kyc_status) return <span className="text-gray-400">-</span>
        
        const statusColors: Record<string, string> = {
          'Approved': 'text-green-700',
          'Submitted': 'text-yellow-700',
          'Rejected': 'text-red-700',
          'Pending': 'text-gray-700'
        }
        const bgColors: Record<string, string> = {
          'Approved': 'bg-green-100',
          'Submitted': 'bg-yellow-100',
          'Rejected': 'bg-red-100',
          'Pending': 'bg-gray-100'
        }
        return (
          <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColors[r.kyc_status] || 'text-gray-700'} ${bgColors[r.kyc_status] || 'bg-gray-100'}`}>
            {r.kyc_status}
          </span>
        )
      }
    },
    { 
      key: 'status', 
      title: 'Status',
      render: (r: UserDetailsRow) => (
        <span className={r.status === 'Active' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
          {r.status}
        </span>
      )
    },
    { key: 'created_on', title: 'Created on' },
  ], [users, actionLoading])

  const handleExport = async () => {
    try {
      const exportPageSize = 1000
      const baseParams: any = {
        page: 1,
        limit: exportPageSize,
        sort: sortBy,
        order: 'desc',
      }

      if (nameFilter.trim()) {
        baseParams.name = nameFilter.trim()
      }
      if (searchQuery.trim()) {
        baseParams.display_id = searchQuery.trim()
      }
      if (filterStartDate) {
        baseParams.start_date = filterStartDate
      }
      if (filterEndDate) {
        baseParams.end_date = filterEndDate
      }
      if (packageFilterId) {
        const pkgId = parseInt(packageFilterId, 10)
        if (!isNaN(pkgId)) baseParams.package_id = pkgId
      }

      const allUsers: User[] = []

      const firstResponse = await getUsers(baseParams)
      if (firstResponse.items?.length) {
        allUsers.push(...firstResponse.items)
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
        const response = await getUsers(params)
        if (response.items?.length) {
          allUsers.push(...response.items)
        }
        if (!response.items || response.items.length === 0) {
          break
        }
      }

      if (!allUsers.length) {
        alert('No user records available to export.')
        return
      }

      const exportRows: UserDetailsRow[] = allUsers.map(user => {
        const formatValue = (
          value: string | null | undefined,
          fallback: string = 'N/A',
        ): string => {
          if (value === null || value === undefined || value === '') {
            return fallback
          }
          return String(value).trim()
        }

        return {
          fullname: formatValue(user.name),
          user_id: user.id || 'N/A',
          user_display_id: user.display_id
            ? formatValue(user.display_id)
            : formatValue(user.id),
          investments: `${(user.active_investment ?? user.total_investment).toLocaleString('en-IN', { maximumFractionDigits: 2 })} / ${user.total_active_packages} active`,
          sponsor_id:
            user.referrer_display_id || formatValue(user.referrer_user_id),
          email: formatValue(user.email),
          password: user.password || null,
          kyc_status: (() => {
            const kycStatus = user.kyc_status?.toLowerCase()
            if (kycStatus === 'submitted') return 'Submitted'
            if (kycStatus === 'approved') return 'Approved'
            if (kycStatus === 'rejected') return 'Rejected'
            return null
          })() as 'Submitted' | 'Approved' | 'Rejected' | null,
          status:
            (user.status === 'active' ? 'Active' : 'Blocked') as
              | 'Active'
              | 'Blocked',
          created_on: user.created_at
            ? new Date(user.created_at).toLocaleString('en-IN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })
            : 'N/A',
        }
      })

      const headers = [
        'Fullname',
        'User ID',
        'Investments',
        'Sponsor ID',
        'Email',
        'Password',
        'KYC Status',
        'Status',
        'Created On',
      ]
      const data = exportRows.map(row => [
        row.fullname,
        row.user_display_id,
        row.investments,
        row.sponsor_id,
        row.email,
        row.password || 'N/A',
        row.kyc_status || 'N/A',
        row.status,
        row.created_on,
      ])

      exportToCsv(
        `users-details-${new Date().toISOString().split('T')[0]}.csv`,
        headers,
        data,
      )
    } catch (err: any) {
      console.error('❌ Error exporting users:', err)
      alert(err?.message || 'Failed to export user records.')
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSearch = () => {
    setPage(1)
    fetchUsers(1) // Pass page 1 directly to ensure it's used
  }

  const handleClearFilters = () => {
    setNameFilter('')
    setSearchQuery('')
    setPackageFilterId('')
    setHasActivePackageFilter('')
    setSortBy('created_at')
    setFilterStartDate('')
    setFilterEndDate('')
    setPage(1)
  }

  // Fetch levels for users in filter results
  useEffect(() => {
    const fetchUserLevels = async () => {
      if (!filtersApplied || filterResults.length === 0) {
        setUserLevels(new Map())
        return
      }

      try {
        setLoadingLevels(true)
        const levelMap = new Map<string, { title: string; level: number }>()
        
        // Fetch eligibility for all users in parallel
        const eligibilityPromises = filterResults.map(async (user) => {
          try {
            const eligibility = await getUserEligibility(user.id)
            // Find the highest eligible level
            const eligibleLevels = eligibility.eligibility
              .filter(level => level.eligible)
              .sort((a, b) => b.level - a.level) // Sort descending to get highest level first
            
            if (eligibleLevels.length > 0) {
              const highestLevel = eligibleLevels[0]
              levelMap.set(user.id, {
                title: highestLevel.title || `Level ${highestLevel.level}`,
                level: highestLevel.level
              })
            } else {
              // No eligible level found, but Level 0 should always be eligible
              // Try to get Level 0 from the eligibility array
              const level0 = eligibility.eligibility.find(level => level.level === 0)
              if (level0) {
                levelMap.set(user.id, {
                  title: level0.title || 'Level 0',
                  level: 0
                })
              } else {
                // Fallback: show first available level or default
                const firstLevel = eligibility.eligibility[0]
                if (firstLevel) {
                  levelMap.set(user.id, {
                    title: firstLevel.title || `Level ${firstLevel.level}`,
                    level: firstLevel.level
                  })
                } else {
                  // Last resort: show N/A
                  levelMap.set(user.id, {
                    title: 'N/A',
                    level: -1
                  })
                }
              }
            }
          } catch (err) {
            console.error(`Error fetching eligibility for user ${user.id}:`, err)
            // On error, show N/A
            levelMap.set(user.id, {
              title: 'N/A',
              level: -1
            })
          }
        })
        
        await Promise.all(eligibilityPromises)
        setUserLevels(levelMap)
      } catch (err) {
        console.error('Error fetching user levels:', err)
      } finally {
        setLoadingLevels(false)
      }
    }

    fetchUserLevels()
  }, [filterResults, filtersApplied])

  const handleApplyAdvancedFilters = async () => {
    try {
      setFilterLoading(true)
      setFiltersApplied(true)
      
      const params: any = {
        page: 1,
        limit: 100, // Get top 100 results
        sort: sortBy,
        order: 'desc',
      }
      
      if (filterStartDate) {
        params.start_date = filterStartDate
      }
      if (filterEndDate) {
        params.end_date = filterEndDate
      }
      
      const response = await getUsers(params)
      
      // Apply minimum filters on frontend
      let filtered = response.items
      
      if (minDirectReferrals && !isNaN(Number(minDirectReferrals))) {
        const min = Number(minDirectReferrals)
        filtered = filtered.filter(user => (user.direct_referrals || 0) >= min)
      }
      
      if (minTeamBusiness && !isNaN(Number(minTeamBusiness))) {
        const min = Number(minTeamBusiness)
        filtered = filtered.filter(user => (user.total_business_volume || 0) >= min)
      }
      
      setFilterResults(filtered)
    } catch (err: any) {
      console.error('Error fetching filter results:', err)
      alert(`Error: ${err.message || 'Failed to fetch filtered results'}`)
    } finally {
      setFilterLoading(false)
    }
  }

  const handleClearAdvancedFilters = () => {
    setSortBy('created_at')
    setFilterStartDate('')
    setFilterEndDate('')
    setMinDirectReferrals('')
    setMinTeamBusiness('')
    setFilterResults([])
    setFiltersApplied(false)
    setUserLevels(new Map())
  }

  const handleApplyToTable = () => {
    setPage(1)
    setIsAdvancedFilterOpen(false)
    fetchUsers(1)
  }

  const handleExportFilterResults = () => {
    if (!filterResults.length) {
      alert('No filtered results available to export.')
      return
    }

    const headers = ['Level', 'User ID', 'Fullname', 'Email', 
      ...(sortBy === 'direct_referrals' ? ['Direct Referrals'] : []),
      ...(sortBy === 'total_business_volume' ? ['Team Business (₹)'] : []),
      'Status', 'Created On']
    
    const data = filterResults.map((user, index) => {
      const userLevel = userLevels.get(user.id)
      const levelDisplay = userLevel 
        ? userLevel.level >= 0 
          ? `${userLevel.title} (Level ${userLevel.level})`
          : 'N/A'
        : 'N/A'
      
      const row: any[] = [
        levelDisplay,
        user.display_id || user.id,
        user.name || 'N/A',
        user.email || 'N/A',
      ]
      
      if (sortBy === 'direct_referrals') {
        row.push(user.direct_referrals || 0)
      }
      
      if (sortBy === 'total_business_volume') {
        row.push((user.total_business_volume || 0).toFixed(2))
      }
      
      row.push(
        user.status === 'active' ? 'Active' : 'Blocked',
        user.created_at 
          ? new Date(user.created_at).toLocaleDateString('en-IN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            })
          : 'N/A'
      )
      
      return row
    })

    const filterName = sortBy === 'direct_referrals' 
      ? 'direct-referrals' 
      : sortBy === 'total_business_volume'
      ? 'team-business'
      : 'filtered'
    
    exportToCsv(`users-advanced-filter-${filterName}-${new Date().toISOString().split('T')[0]}.csv`, headers, data)
  }

  // Handle edit button click
  const handleEditClick = async (userId: string) => {
    try {
      setEditLoading(true)
      console.log('🔍 Fetching user details for edit:', userId)
      const userDetails = await getUserById(userId)
      console.log('✅ User details fetched:', userDetails)
      console.log('📋 Address fields:', {
        address: userDetails.address,
        city: userDetails.city,
        state: userDetails.state,
        pincode: userDetails.pincode,
      })
      console.log('🏦 Bank fields:', {
        bank_account_no: userDetails.bank_account_no,
        bank_ifsc: userDetails.bank_ifsc,
        bank_name: userDetails.bank_name,
        bank_branch: userDetails.bank_branch,
      })
      
      setEditingUser(userDetails)
      setEditFormData({
        name: userDetails.name || '',
        display_title: userDetails.display_title ?? null,
        display_title_icon_url: userDetails.display_title_icon_url ?? null,
        email: userDetails.email || '',
        phone: userDetails.phone ?? '',
        referrer_user_id: userDetails.referrer_user_id || null,
        kyc_status: userDetails.kyc_status as 'pending' | 'submitted' | 'approved' | 'rejected',
        withdrawal_blocked: userDetails.withdrawal_blocked ?? false,
      })
      setIsEditModalOpen(true)
    } catch (err: any) {
      console.error('❌ Error fetching user details:', err)
      alert(`Error loading user details: ${err.message}`)
    } finally {
      setEditLoading(false)
    }
  }

  // Handle edit form submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    try {
      setEditLoading(true)
      console.log('💾 Updating user:', editingUser.id, editFormData)

      // Only send editable fields from this modal (name, email, referrer, KYC, withdrawal flag)
      const { name, email, phone, referrer_user_id, kyc_status, withdrawal_blocked } = editFormData
      const payload: UpdateUserRequest = {
        name,
        email,
        phone: phone?.trim() ? phone.trim() : null,
        referrer_user_id,
        kyc_status,
        withdrawal_blocked,
      }

      const updatedUser = await updateUser(editingUser.id, payload)
      console.log('✅ User updated successfully:', updatedUser)
      
      // Refresh users list
      await fetchUsers()
      
      // Close modal
      setIsEditModalOpen(false)
      setEditingUser(null)
      
      alert('User updated successfully!')
    } catch (err: any) {
      console.error('❌ Error updating user:', err)
      alert(`Error updating user: ${err.message}`)
    } finally {
      setEditLoading(false)
    }
  }

  // Handle modal close
  const handleCloseModal = () => {
    setIsEditModalOpen(false)
    setEditingUser(null)
      setEditFormData({
        name: '',
        display_title: null,
        display_title_icon_url: null,
        email: '',
        phone: '',
        referrer_user_id: null,
        kyc_status: 'pending',
        withdrawal_blocked: false,
      })
  }

  const handleEditIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editingUser) return
    try {
      setEditIconUploading(true)
      const { display_title_icon_url } = await uploadDisplayTitleIcon(editingUser.id, file)
      setEditFormData((prev) => ({ ...prev, display_title_icon_url }))
    } catch (err: any) {
      alert(err?.message || 'Icon upload failed.')
    } finally {
      setEditIconUploading(false)
      e.target.value = ''
    }
  }

  // Open Set title only modal
  const handleSetTitleClick = (userId: string, currentTitle: string | null, userName: string, currentIconUrl: string | null) => {
    setSetTitleUserId(userId)
    setSetTitleValue(currentTitle ?? '')
    setSetTitleUserName(userName)
    setSetTitleIconUrl(currentIconUrl ?? null)
    setIsSetTitleModalOpen(true)
  }

  // Upload display title icon (called when file selected)
  const handleSetTitleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !setTitleUserId) return
    try {
      setSetTitleIconUploading(true)
      const { display_title_icon_url } = await uploadDisplayTitleIcon(setTitleUserId, file)
      setSetTitleIconUrl(display_title_icon_url)
    } catch (err: any) {
      alert(err?.message || 'Icon upload failed.')
    } finally {
      setSetTitleIconUploading(false)
      e.target.value = ''
    }
  }

  // Save display title (and optional icon URL)
  const handleSetTitleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!setTitleUserId) return
    try {
      setSetTitleLoading(true)
      await updateUser(setTitleUserId, {
        display_title: setTitleValue.trim() || null,
        display_title_icon_url: setTitleIconUrl,
      })
      await fetchUsers()
      setIsSetTitleModalOpen(false)
      setSetTitleUserId(null)
      setSetTitleValue('')
      setSetTitleUserName('')
      setSetTitleIconUrl(null)
      alert('Display title updated.')
    } catch (err: any) {
      alert(err?.message || 'Failed to update title.')
    } finally {
      setSetTitleLoading(false)
    }
  }

  // Handle activate user
  const handleActivateClick = async (userId: string) => {
    const user = users.find(u => u.id === userId)
    const userName = user?.name || userId
    
    if (!confirm(`Are you sure you want to activate user "${userName}" (ID: ${userId})?`)) {
      return
    }

    try {
      setActionLoading(userId)
      console.log('✅ Activating user:', userId)
      await activateUser(userId)
      console.log('✅ User activated successfully')
      
      // Refresh users list
      await fetchUsers()
      
      alert('User activated successfully!')
    } catch (err: any) {
      console.error('❌ Error activating user:', err)
      alert(`Error activating user: ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  // Handle view active courses
  const handleViewActiveCourses = async (userId: string) => {
    try {
      setSelectedUserId(userId)
      setLoadingCourses(true)
      setIsActiveCoursesModalOpen(true)
      
      const response = await getUserActiveCourses(userId)
      console.log('📋 handleViewActiveCourses - Response:', {
        count: response.count,
        items_count: response.items.length,
        items: response.items.map(i => ({ 
          id: i.id, 
          package_name: i.package_name, 
          is_active: i.is_active,
          status: i.status,
          has_global_ids: !!i.global_ids_info
        })),
      })
      console.log('📋 Setting activeCourses state with', response.items.length, 'items')
      setActiveCourses(response.items)
    } catch (err: any) {
      console.error('❌ Error fetching active courses:', err)
      alert(`Error loading active courses: ${err.message}`)
      setIsActiveCoursesModalOpen(false)
    } finally {
      setLoadingCourses(false)
    }
  }

  // Handle deactivate user
  const handleDeactivateClick = async (userId: string) => {
    const user = users.find(u => u.id === userId)
    const userName = user?.name || userId
    
    if (!confirm(`Are you sure you want to deactivate user "${userName}" (ID: ${userId})?`)) {
      return
    }

    try {
      setActionLoading(userId)
      console.log('❌ Deactivating user:', userId)
      await deactivateUser(userId)
      console.log('✅ User deactivated successfully')
      
      // Refresh users list
      await fetchUsers()
      
      alert('User deactivated successfully!')
    } catch (err: any) {
      console.error('❌ Error deactivating user:', err)
      alert(`Error deactivating user: ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  // Fetch packages for package assign modal and filter dropdown
  const fetchPackages = async () => {
    try {
      setLoadingPackages(true)
      const response = await getPackages({ status: 'active', limit: 100 })
      setPackages(response.items)
    } catch (err: any) {
      console.error('Error fetching packages:', err)
      alert(`Error: ${err.message || 'Failed to fetch packages'}`)
    } finally {
      setLoadingPackages(false)
    }
  }

  // Load packages on mount for filter dropdown
  useEffect(() => {
    fetchPackages()
  }, [])

  // Handle package assign button click
  const handlePackageAssignClick = async (user: User) => {
    setSelectedUserForPackage(user)
    setIsPackageAssignModalOpen(true)
    await fetchPackages()
    // Reset form
    setAssignPackageData({
      package_id: '',
      used_ids: 0,
      income: 0,
    })
  }

  // Handle package assignment (with PIN verification)
  const handleAssignPackage = async () => {
    if (!selectedUserForPackage || !assignPackageData.package_id) {
      alert('Please select a package')
      return
    }

    // Verify PIN before proceeding
    const pinVerified = await verifyPinForAction('Package Assignment')
    if (!pinVerified) return

    // Validate income doesn't exceed (2x package amount - 1 rupee)
    const selectedPkg = packages.find(p => p.id.toString() === assignPackageData.package_id)
    if (selectedPkg) {
      const maxIncome = (selectedPkg.price * 2) - 1 // 1 rupee less than 2x to keep package active
      const enteredIncome = assignPackageData.income || 0
      if (enteredIncome > maxIncome) {
        alert(`Initial Income cannot exceed ₹${maxIncome.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (1 rupee less than 2x package amount). Package expires when income reaches 2x.`)
        return
      }
    }

    try {
      setAssigningPackage(true)
      await assignPackageToUser(selectedUserForPackage.id, {
        package_id: parseInt(assignPackageData.package_id),
        used_ids: assignPackageData.used_ids || 0,
        income: assignPackageData.income || 0,
      })
      
      alert('Package assigned successfully!')
      setIsPackageAssignModalOpen(false)
      setSelectedUserForPackage(null)
      // Refresh users list
      fetchUsers()
    } catch (err: any) {
      console.error('Error assigning package:', err)
      alert(`Error: ${err.message || 'Failed to assign package'}`)
    } finally {
      setAssigningPackage(false)
    }
  }

  if (loading && users.length === 0) {
    return (
      <Card title="User Accounts & Details">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-4"></div>
            <p className="text-gray-600">Loading users...</p>
          </div>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card title="User Accounts & Details">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button variant="outline" onClick={() => fetchUsers()}>
              Retry
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card
      title="User Accounts & Details"
      toolbarRight={
        <>
          <Button
            variant="outline"
            size="md"
            aria-label="Advanced Filter"
            onClick={() => setIsAdvancedFilterOpen(true)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            <span>Advanced Filter</span>
          </Button>
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
      
      <DataTable<UserDetailsRow>
        columns={columns}
        rows={rows}
        minWidthPx={1600}
      />

      <FiltersBar>
        <TextInput 
          id="search-bar" 
          label="Search by User ID (Display ID):" 
          value={searchQuery} 
          onChange={setSearchQuery} 
          placeholder="Enter Display ID (e.g., SIA02047)"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSearch()
            }
          }}
        />
        <TextInput 
          id="fullname-filter" 
          label="Filter by Full Name:" 
          value={nameFilter} 
          onChange={setNameFilter} 
          placeholder="Enter Full Name (e.g., Ramesh Kumar)"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSearch()
            }
          }}
        />
        <SelectInput
          id="package-filter"
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
          id="active-package-filter"
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
        total={total}
        onPageChange={setPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize)
          setPage(1)
        }}
        pageSizeOptions={[10, 25, 50, 100, 250, 500, 1000]}
      />

      {/* Edit User Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={handleCloseModal}
        title="Edit User"
        size="md"
        closeOnBackdropClick={false}
        footer={
          <>
            <Button
              variant="outline"
              onClick={handleCloseModal}
              disabled={editLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditSubmit}
              disabled={editLoading}
            >
              {editLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </>
        }
      >
        {editLoading && !editingUser ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mb-2"></div>
              <p className="text-sm text-gray-600">Loading user details...</p>
            </div>
          </div>
        ) : editingUser ? (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User ID
              </label>
              <input
                type="text"
                value={editingUser.id}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter email address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={editFormData.phone || editingUser.phone || ''}
                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter phone number"
              />
              <p className="text-xs text-gray-500 mt-1">
                Phone change will affect app login/OTP (if the app uses mobile).
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sponsor ID (Referrer)
              </label>
              <input
                type="text"
                value={editFormData.referrer_user_id || ''}
                disabled
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                placeholder="Not editable"
              />
              <p className="text-xs text-gray-500 mt-1">Referrer cannot be changed from this form</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                KYC Status <span className="text-red-500">*</span>
              </label>
              <select
                value={editFormData.kyc_status}
                onChange={(e) => setEditFormData({ 
                  ...editFormData, 
                  kyc_status: e.target.value as 'pending' | 'submitted' | 'approved' | 'rejected'
                })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="pending">Pending</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div className="flex items-center gap-3 pt-2 pb-1">
              <input
                type="checkbox"
                id="edit-withdrawal-blocked"
                checked={editFormData.withdrawal_blocked ?? false}
                onChange={(e) => setEditFormData({ ...editFormData, withdrawal_blocked: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="edit-withdrawal-blocked" className="text-sm font-medium text-gray-700 cursor-pointer">
                {editFormData.withdrawal_blocked ? 'Unblock withdrawal for this user' : 'Block withdrawal for this user'}
              </label>
            </div>
            <p className="text-xs text-gray-500 -mt-1 ml-7">When checked, this user cannot create withdrawal requests. Uncheck to allow withdrawals again.</p>

            {/* Address Section */}
            {editingUser && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Address Details</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address
                    </label>
                    <input
                      type="text"
                      value={editingUser.address || ''}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                      placeholder="Not provided"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={editingUser.city || ''}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                      placeholder="Not provided"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      value={editingUser.state || ''}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                      placeholder="Not provided"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pin Code
                    </label>
                    <input
                      type="text"
                      value={editingUser.pincode || ''}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                      placeholder="Not provided"
                    />
                  </div>
                </div>

                {/* Bank Details Section */}
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Bank Details</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Bank Account Number
                      </label>
                      <input
                        type="text"
                        value={editingUser.bank_account_no || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                        placeholder="Not provided"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        IFSC Code
                      </label>
                      <input
                        type="text"
                        value={editingUser.bank_ifsc || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                        placeholder="Not provided"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Bank Name
                      </label>
                      <input
                        type="text"
                        value={editingUser.bank_name || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                        placeholder="Not provided"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Bank Branch
                      </label>
                      <input
                        type="text"
                        value={editingUser.bank_branch || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                        placeholder="Not provided"
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Details */}
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Additional Details</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="text"
                        value={editingUser.phone || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                        placeholder="Not provided"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date of Birth
                      </label>
                      <input
                        type="text"
                        value={editingUser.date_of_birth ? new Date(editingUser.date_of_birth).toLocaleDateString() : ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                        placeholder="Not provided"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        PAN Number
                      </label>
                      <input
                        type="text"
                        value={editingUser.pan_number || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                        placeholder="Not provided"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Aadhar Number
                      </label>
                      <input
                        type="text"
                        value={editingUser.aadhar_number || ''}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                        placeholder="Not provided"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {editingUser && (
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  <strong>Current Status:</strong> {editingUser.status === 'active' ? 'Active' : 'Inactive'}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  <strong>Password:</strong> {editingUser.password || 'Not set'}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  <strong>Wallet Balance:</strong> ₹{editingUser.wallet_balance?.toFixed(2) || '0.00'}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  <strong>Created:</strong> {new Date(editingUser.created_at).toLocaleString()}
                </p>
              </div>
            )}
          </form>
        ) : null}
      </Modal>

      {/* Set display title only modal */}
      <Modal
        isOpen={isSetTitleModalOpen}
        onClose={() => {
          if (!setTitleLoading) {
            setIsSetTitleModalOpen(false)
            setSetTitleUserId(null)
            setSetTitleValue('')
            setSetTitleUserName('')
            setSetTitleIconUrl(null)
          }
        }}
        title="Set display title"
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsSetTitleModalOpen(false)}
              disabled={setTitleLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleSetTitleSubmit} disabled={setTitleLoading}>
              {setTitleLoading ? 'Saving...' : 'Save title'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSetTitleSubmit} className="space-y-4">
          {setTitleUserName && (
            <p className="text-sm text-gray-600">
              User: <span className="font-medium text-gray-800">{setTitleUserName}</span>
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display title
            </label>
            <input
              type="text"
              value={setTitleValue}
              onChange={(e) => setSetTitleValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Manager, Team Lead"
              maxLength={100}
            />
            <p className="text-xs text-gray-500 mt-1">Display-only; no role or permission change. Leave empty to clear.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Icon (optional, PNG)
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {setTitleIconUrl && (
                <span className="flex items-center gap-1.5">
                  <img src={setTitleIconUrl} alt="Title icon" className="h-8 w-8 object-contain rounded border border-gray-200" />
                  <button
                    type="button"
                    onClick={() => setSetTitleIconUrl(null)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </span>
              )}
              <label className="cursor-pointer">
                <span className="inline-flex items-center px-3 py-1.5 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50">
                  {setTitleIconUploading ? 'Uploading...' : setTitleIconUrl ? 'Change icon' : 'Upload icon'}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                  className="hidden"
                  disabled={setTitleIconUploading || !setTitleUserId}
                  onChange={handleSetTitleIconUpload}
                />
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-1">Shows next to title on user dashboard. Max 2MB.</p>
          </div>
        </form>
      </Modal>

      {/* Active Courses Modal */}
      <Modal
        isOpen={isActiveCoursesModalOpen}
        onClose={() => {
          setIsActiveCoursesModalOpen(false)
          setSelectedUserId(null)
          setActiveCourses([])
        }}
        title={`Active Courses - ${users.find(u => u.id === selectedUserId)?.name || selectedUserId || 'User'}`}
        size="xl"
      >
        {loadingCourses ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mb-2"></div>
              <p className="text-sm text-gray-600">Loading active courses...</p>
            </div>
          </div>
        ) : activeCourses.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600">No active courses found for this user.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-xs text-gray-500 mb-2">
              Debug: Rendering {activeCourses.length} courses
            </div>
            <div className={`grid gap-4 ${activeCourses.length === 1 ? 'grid-cols-1 justify-items-center' : 'grid-cols-1 md:grid-cols-2'}`}>
              {activeCourses.map((course, index) => {
                console.log(`🎨 Rendering course ${index + 1}/${activeCourses.length}:`, course.id, course.package_name);
                const target2x = course.amount * 2;
                const progressPercent = Math.min((course.income / target2x) * 100, 100);
                const globalIds = course.global_ids_info;
                
                return (
                  <div key={course.id} className={`border border-gray-200 rounded-lg p-4 bg-white shadow-sm ${activeCourses.length === 1 ? 'max-w-md w-full' : 'w-full'}`}>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-bold text-gray-900">
                        {course.package_name || `Package #${course.package_id}`}
                      </h3>
                      <span className="px-3 py-1 bg-green-500 text-white text-xs font-semibold rounded">
                        Active
                      </span>
                    </div>
                    
                    {/* Price */}
                    <div className="mb-4">
                      <p className="text-2xl font-semibold text-gray-900">
                        ₹{course.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    
                    {/* Purchase/Renewal Date */}
                    <div className="flex justify-between text-sm text-gray-600 mb-4">
                      <span>
                        {course.is_renewal ? 'Renewed on:' : 'Purchased:'}
                      </span>
                      <span>
                        {new Date(course.purchased_at).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    
                    {/* Income Progress (2x Target) */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Income Progress (2x Target)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all"
                          style={{ width: `${progressPercent}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700">
                          ₹{course.income.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-gray-600">
                          / ₹{target2x.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                    
                    {/* Global IDs Info */}
                    {globalIds && (
                      <div className="border border-green-500 rounded-lg p-3 bg-green-50">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm font-semibold text-green-800">Global IDs Info</span>
                        </div>
                        <div className="space-y-1 text-sm text-green-700">
                          <div className="flex justify-between">
                            <span>Used:</span>
                            <span className="font-semibold">{globalIds.used_ids} / {globalIds.package_cap}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Remaining:</span>
                            <span className="font-semibold">{globalIds.remaining_ids}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="text-sm text-gray-600 text-center pt-2">
              Total Active Courses: {activeCourses.length}
            </div>
          </div>
        )}
      </Modal>

      {/* User Summary Modal */}
      <UserSummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => {
          setIsSummaryModalOpen(false)
          setSummaryUserId(null)
        }}
        userId={summaryUserId}
      />

      {/* Package Assign Modal */}
      <Modal
        isOpen={isPackageAssignModalOpen}
        onClose={() => {
          setIsPackageAssignModalOpen(false)
          setSelectedUserForPackage(null)
        }}
        title={`Assign Package to ${selectedUserForPackage?.name || selectedUserForPackage?.display_id || 'User'}`}
      >
        <div className="space-y-4">
          {/* Package Dropdown */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Select Package <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={assignPackageData.package_id}
              onChange={(e) => {
                const selectedPkg = packages.find(p => p.id.toString() === e.target.value)
                setAssignPackageData({
                  ...assignPackageData,
                  package_id: e.target.value,
                  used_ids: 0, // Reset used_ids when package changes
                })
              }}
              disabled={loadingPackages || assigningPackage}
            >
              <option value="">Select a package...</option>
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name} - ₹{pkg.price.toLocaleString('en-IN')} 
                  {pkg.global_ids ? ` (${pkg.global_ids} IDs)` : ''}
                </option>
              ))}
            </select>
            {loadingPackages && (
              <p className="text-xs text-gray-500 mt-1">Loading packages...</p>
            )}
          </div>

          {/* Used IDs Input */}
          {assignPackageData.package_id && (
            <>
              {(() => {
                const selectedPkg = packages.find(p => p.id.toString() === assignPackageData.package_id)
                const maxIds = selectedPkg?.global_ids || 0
                return (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Used IDs (out of {maxIds} total IDs)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={maxIds}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={assignPackageData.used_ids}
                      onChange={(e) => {
                        const value = Math.min(Math.max(0, parseInt(e.target.value) || 0), maxIds)
                        setAssignPackageData({
                          ...assignPackageData,
                          used_ids: value,
                        })
                      }}
                      disabled={assigningPackage}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Remaining IDs: {maxIds - (assignPackageData.used_ids || 0)}
                    </p>
                  </div>
                )
              })()}

              {/* Income Input */}
              {(() => {
                const selectedPkg = packages.find(p => p.id.toString() === assignPackageData.package_id)
                const packagePrice = selectedPkg?.price || 0
                const maxIncome = (packagePrice * 2) - 1 // 1 rupee less than 2x (to keep package active)
                const currentIncome = assignPackageData.income || 0
                const isIncomeExceeded = currentIncome > maxIncome
                
                return (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Initial Income (Self + Global Combined)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={maxIncome}
                      step="0.01"
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                        isIncomeExceeded 
                          ? 'border-red-500 focus:ring-red-500' 
                          : 'focus:ring-blue-500'
                      }`}
                      value={assignPackageData.income}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0
                        const cappedValue = Math.min(value, maxIncome)
                        setAssignPackageData({
                          ...assignPackageData,
                          income: cappedValue,
                        })
                      }}
                      disabled={assigningPackage}
                      placeholder="0.00"
                    />
                    <p className={`text-xs mt-1 ${isIncomeExceeded ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                      {isIncomeExceeded 
                        ? `⚠️ Maximum allowed: ₹${maxIncome.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (1 rupee less than 2x package amount). Package expires at 2x income.`
                        : `This will be the starting income for the 2x progress bar. Maximum: ₹${maxIncome.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (1 rupee less than 2x = ₹${(packagePrice * 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
                      }
                    </p>
                  </div>
                )
              })()}
            </>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setIsPackageAssignModalOpen(false)
                setSelectedUserForPackage(null)
              }}
              disabled={assigningPackage}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAssignPackage}
              disabled={!assignPackageData.package_id || assigningPackage}
            >
              {assigningPackage ? 'Assigning...' : 'Assign Package'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Advanced Filter Modal */}
      <Modal
        isOpen={isAdvancedFilterOpen}
        onClose={() => {
          setIsAdvancedFilterOpen(false)
          setFiltersApplied(false)
          setFilterResults([])
          setMinDirectReferrals('')
          setMinTeamBusiness('')
          setUserLevels(new Map())
        }}
        title="Advanced Filters"
        size="xl"
        footer={
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={handleClearAdvancedFilters}
            >
              Clear
            </Button>
            {filtersApplied && filterResults.length > 0 && (
              <Button
                variant="outline"
                onClick={handleExportFilterResults}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                <span>Export</span>
              </Button>
            )}
            <Button
              onClick={handleApplyAdvancedFilters}
              disabled={filterLoading}
            >
              {filterLoading ? 'Loading...' : 'Apply Filters'}
            </Button>
            {filtersApplied && (
              <Button
                onClick={handleApplyToTable}
              >
                Apply to Table
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          {/* Sort By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sort By <span className="text-red-500">*</span>
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'created_at' | 'direct_referrals' | 'total_business_volume')}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="created_at">Default (Created Date)</option>
              <option value="direct_referrals">Most Direct Referrals</option>
              <option value="total_business_volume">Most Team Business</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {sortBy === 'direct_referrals' && 'Sort by users with highest number of direct referrals'}
              {sortBy === 'total_business_volume' && 'Sort by users with highest team business volume'}
              {sortBy === 'created_at' && 'Sort by user creation date'}
            </p>
          </div>
          
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range (Optional)
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">End Date</label>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Filter users by account creation date range
            </p>
          </div>

          {/* Minimum Value Filters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Value Filters (Optional)
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Minimum Direct Referrals
                </label>
                <input
                  type="number"
                  min="0"
                  value={minDirectReferrals}
                  onChange={(e) => setMinDirectReferrals(e.target.value)}
                  placeholder="e.g., 10"
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Show users with at least this many direct referrals
                </p>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Minimum Team Business (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={minTeamBusiness}
                  onChange={(e) => setMinTeamBusiness(e.target.value)}
                  placeholder="e.g., 100000"
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Show users with at least this team business volume
                </p>
              </div>
            </div>
          </div>

          {/* Comparison & Analytics Section */}
          <div className="border-t border-gray-200 pt-6 mt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Comparison & Analytics</h3>
            
            {/* Mode Selection */}
            <div className="mb-4 flex gap-2 flex-wrap">
              <button
                onClick={() => {
                  setComparisonMode('none')
                  setShowTopPerformers(false)
                }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  comparisonMode === 'none' && !showTopPerformers
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Single User Report
              </button>
              <button
                onClick={() => {
                  setComparisonMode('users')
                  setShowTopPerformers(false)
                }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  comparisonMode === 'users'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Compare Users
              </button>
              <button
                onClick={() => {
                  setComparisonMode('period')
                  setShowTopPerformers(false)
                }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  comparisonMode === 'period'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Period Comparison
              </button>
              <button
                onClick={async () => {
                  setShowTopPerformers(true)
                  setComparisonMode('none')
                  try {
                    // Get top users by business volume
                    const response = await getUsers({ 
                      sort: 'total_business_volume', 
                      order: 'desc', 
                      limit: 50 // Get more to filter out admins
                    })
                    
                    // Filter out admin users
                    const filteredUsers = response.items.filter(user => {
                      const displayId = (user.display_id || '').toLowerCase()
                      const name = (user.name || '').toLowerCase()
                      const email = (user.email || '').toLowerCase()
                      
                      // Hide users with admin in display_id, name, or email
                      return !displayId.includes('admin') && 
                             !name.includes('admin') && 
                             !email.includes('@admin') &&
                             displayId !== 'admin' &&
                             name !== 'admin'
                    })
                    
                    const topUsers = filteredUsers.slice(0, 10)
                    const topPerformers = await Promise.all(
                      topUsers.map(async (user) => {
                        try {
                          const businessData = await getBusinessVolumeWithLegs(user.id, {
                            start_date: businessReportStartDate || undefined,
                            end_date: businessReportEndDate || undefined,
                          })
                          return { user, business: businessData.total_business_volume }
                        } catch {
                          return { user, business: user.total_business_volume || 0 }
                        }
                      })
                    )
                    setTopPerformersData(topPerformers.sort((a, b) => b.business - a.business))
                  } catch (error) {
                    console.error('Error fetching top performers:', error)
                  }
                }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  showTopPerformers
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Top Performers
              </button>
            </div>

            {/* Compare Users Mode */}
            {comparisonMode === 'users' && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-semibold text-blue-800 mb-3">Compare Multiple Users</h4>
                <div className="space-y-3">
                  {comparisonUserIds.map((userId, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={userId}
                        onChange={(e) => {
                          const newIds = [...comparisonUserIds]
                          newIds[index] = e.target.value.toUpperCase().trim()
                          setComparisonUserIds(newIds)
                        }}
                        placeholder={`User ${index + 1} ID (e.g., SIA00299)`}
                        className="flex-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {index > 1 && (
                        <button
                          onClick={() => {
                            const newIds = comparisonUserIds.filter((_, i) => i !== index)
                            setComparisonUserIds(newIds)
                          }}
                          className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (comparisonUserIds.length < 5) {
                          setComparisonUserIds([...comparisonUserIds, ''])
                        }
                      }}
                      className="px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 text-sm"
                      disabled={comparisonUserIds.length >= 5}
                    >
                      + Add User (Max 5)
                    </button>
                    <button
                      onClick={async () => {
                        if (!businessReportStartDate || !businessReportEndDate) {
                          alert('Please select date range first')
                          return
                        }
                        setComparisonLoading(true)
                        try {
                          const comparisonResults = await Promise.all(
                            comparisonUserIds
                              .filter(id => id.trim())
                              .map(async (userId) => {
                                try {
                                  const usersResponse = await getUsers({ display_id: userId.trim(), limit: 1 })
                                  if (!usersResponse.items || usersResponse.items.length === 0) {
                                    return { user: { name: null, display_id: userId }, data: null }
                                  }
                                  const foundUser = usersResponse.items[0]
                                  const businessData = await getBusinessVolumeWithLegs(foundUser.id, {
                                    start_date: businessReportStartDate,
                                    end_date: businessReportEndDate,
                                  })
                                  return {
                                    user: { name: foundUser.name, display_id: foundUser.display_id },
                                    data: businessData
                                  }
                                } catch (error) {
                                  return { user: { name: null, display_id: userId }, data: null }
                                }
                              })
                          )
                          setComparisonData(comparisonResults)
                        } catch (error) {
                          console.error('Error comparing users:', error)
                        } finally {
                          setComparisonLoading(false)
                        }
                      }}
                      disabled={comparisonLoading || !businessReportStartDate || !businessReportEndDate}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {comparisonLoading ? 'Comparing...' : 'Compare Users'}
                    </button>
                  </div>
                </div>

                {/* Comparison Results */}
                {comparisonData.length > 0 && (
                  <div className="mt-6">
                    <h5 className="text-sm font-semibold text-gray-800 mb-3">Comparison Results</h5>
                    <div className="overflow-x-auto">
                      <table className="min-w-full border border-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 border-b">User</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 border-b">Direct Business</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 border-b">Team Business</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 border-b">Total Business</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 border-b">Legs Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparisonData.map((item, index) => (
                            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-4 py-2 text-sm border-b">
                                <div className="font-mono text-blue-600">{item.user.display_id}</div>
                                <div className="text-xs text-gray-600">{item.user.name || 'N/A'}</div>
                              </td>
                              <td className="px-4 py-2 text-sm text-right border-b">
                                {item.data ? `₹${item.data.direct_business.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'N/A'}
                              </td>
                              <td className="px-4 py-2 text-sm text-right border-b">
                                {item.data ? `₹${item.data.team_business.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'N/A'}
                              </td>
                              <td className="px-4 py-2 text-sm font-bold text-right border-b">
                                {item.data ? `₹${item.data.total_business_volume.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'N/A'}
                              </td>
                              <td className="px-4 py-2 text-sm text-right border-b">
                                {item.data ? item.data.legs.length : 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Visual Comparison Bars */}
                    <div className="mt-4 space-y-3">
                      <h6 className="text-xs font-semibold text-gray-700">Visual Comparison</h6>
                      {comparisonData.map((item, index) => {
                        if (!item.data) return null
                        const maxBusiness = Math.max(...comparisonData.filter(d => d.data).map(d => d.data!.total_business_volume))
                        const percentage = (item.data.total_business_volume / maxBusiness) * 100
                        return (
                          <div key={index} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="font-medium">{item.user.display_id}</span>
                              <span className="text-gray-600">₹{item.data.total_business_volume.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-4">
                              <div
                                className="bg-blue-600 h-4 rounded-full transition-all"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Period Comparison Mode */}
            {comparisonMode === 'period' && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="text-sm font-semibold text-green-800 mb-3">Compare Periods</h4>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Current Period Start</label>
                    <input
                      type="date"
                      value={businessReportStartDate}
                      onChange={(e) => setBusinessReportStartDate(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Current Period End</label>
                    <input
                      type="date"
                      value={businessReportEndDate}
                      onChange={(e) => setBusinessReportEndDate(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (!businessReportUserId.trim() || !businessReportStartDate || !businessReportEndDate) {
                      alert('Please enter User ID and select date range')
                      return
                    }
                    setPeriodComparisonLoading(true)
                    try {
                      const usersResponse = await getUsers({ display_id: businessReportUserId.trim(), limit: 1 })
                      if (!usersResponse.items || usersResponse.items.length === 0) {
                        alert('User not found')
                        return
                      }
                      const foundUser = usersResponse.items[0]

                      // Calculate previous period (same duration, before current period)
                      const currentStart = new Date(businessReportStartDate)
                      const currentEnd = new Date(businessReportEndDate)
                      const duration = currentEnd.getTime() - currentStart.getTime()
                      const previousEnd = new Date(currentStart)
                      previousEnd.setDate(previousEnd.getDate() - 1)
                      const previousStart = new Date(previousEnd)
                      previousStart.setTime(previousStart.getTime() - duration)

                      const [currentData, previousData] = await Promise.all([
                        getBusinessVolumeWithLegs(foundUser.id, {
                          start_date: businessReportStartDate,
                          end_date: businessReportEndDate,
                        }),
                        getBusinessVolumeWithLegs(foundUser.id, {
                          start_date: previousStart.toISOString().split('T')[0],
                          end_date: previousEnd.toISOString().split('T')[0],
                        }),
                      ])

                      setPeriodComparisonData({ current: currentData, previous: previousData })
                    } catch (error) {
                      console.error('Error comparing periods:', error)
                    } finally {
                      setPeriodComparisonLoading(false)
                    }
                  }}
                  disabled={periodComparisonLoading || !businessReportUserId.trim() || !businessReportStartDate || !businessReportEndDate}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
                >
                  {periodComparisonLoading ? 'Comparing...' : 'Compare Periods'}
                </button>

                {/* Period Comparison Results */}
                {periodComparisonData.current && periodComparisonData.previous && (
                  <div className="mt-6">
                    <h5 className="text-sm font-semibold text-gray-800 mb-3">Period Comparison</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-4 border border-gray-200 rounded-lg">
                        <h6 className="text-xs font-semibold text-gray-600 mb-2">Previous Period</h6>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-gray-500">Direct Business</p>
                            <p className="text-lg font-bold">₹{periodComparisonData.previous.direct_business.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Team Business</p>
                            <p className="text-lg font-bold">₹{periodComparisonData.previous.team_business.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Total Business</p>
                            <p className="text-xl font-bold text-indigo-800">₹{periodComparisonData.previous.total_business_volume.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white p-4 border border-gray-200 rounded-lg">
                        <h6 className="text-xs font-semibold text-gray-600 mb-2">Current Period</h6>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-gray-500">Direct Business</p>
                            <p className="text-lg font-bold">₹{periodComparisonData.current.direct_business.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                            <p className={`text-xs ${periodComparisonData.current.direct_business >= periodComparisonData.previous.direct_business ? 'text-green-600' : 'text-red-600'}`}>
                              {periodComparisonData.current.direct_business >= periodComparisonData.previous.direct_business ? '↑' : '↓'} 
                              {Math.abs(((periodComparisonData.current.direct_business - periodComparisonData.previous.direct_business) / (periodComparisonData.previous.direct_business || 1)) * 100).toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Team Business</p>
                            <p className="text-lg font-bold">₹{periodComparisonData.current.team_business.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                            <p className={`text-xs ${periodComparisonData.current.team_business >= periodComparisonData.previous.team_business ? 'text-green-600' : 'text-red-600'}`}>
                              {periodComparisonData.current.team_business >= periodComparisonData.previous.team_business ? '↑' : '↓'} 
                              {Math.abs(((periodComparisonData.current.team_business - periodComparisonData.previous.team_business) / (periodComparisonData.previous.team_business || 1)) * 100).toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Total Business</p>
                            <p className="text-xl font-bold text-indigo-800">₹{periodComparisonData.current.total_business_volume.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                            <p className={`text-xs font-semibold ${periodComparisonData.current.total_business_volume >= periodComparisonData.previous.total_business_volume ? 'text-green-600' : 'text-red-600'}`}>
                              {periodComparisonData.current.total_business_volume >= periodComparisonData.previous.total_business_volume ? '↑' : '↓'} 
                              {Math.abs(((periodComparisonData.current.total_business_volume - periodComparisonData.previous.total_business_volume) / (periodComparisonData.previous.total_business_volume || 1)) * 100).toFixed(1)}% Growth
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Top Performers */}
            {showTopPerformers && (
              <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <h4 className="text-sm font-semibold text-purple-800 mb-3">🏆 Top 10 Performers</h4>
                {topPerformersData.length > 0 ? (
                  <div className="space-y-2">
                    {topPerformersData.map((item, index) => {
                      const maxBusiness = topPerformersData[0]?.business || 1
                      const percentage = (item.business / maxBusiness) * 100
                      return (
                        <div key={item.user.id} className="bg-white p-3 rounded-lg border border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                              <div>
                                <p className="font-mono text-sm font-bold text-blue-600">{item.user.display_id}</p>
                                <p className="text-xs text-gray-600">{item.user.name || 'N/A'}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-indigo-800">₹{item.business.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                              <p className="text-xs text-gray-500">{item.user.direct_referrals || 0} referrals</p>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-purple-500 to-indigo-600 h-2 rounded-full"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">Click "Top Performers" to load rankings</p>
                )}
              </div>
            )}
          </div>

          {/* User-Specific Business Report Section */}
          <div className="border-t border-gray-200 pt-6 mt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">User-Specific Business Report</h3>
            <p className="text-sm text-gray-600 mb-4">
              Enter a user ID and date range to see their business volume and legs breakdown for that period.
            </p>
            
            <div className="space-y-4">
              {/* User ID Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  User ID (Display ID) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={businessReportUserId}
                  onChange={(e) => setBusinessReportUserId(e.target.value.toUpperCase().trim())}
                  placeholder="e.g., SIA00299"
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter the user's display ID (e.g., SIA00299)
                </p>
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date Range <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={businessReportStartDate}
                      onChange={(e) => setBusinessReportStartDate(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">End Date</label>
                    <input
                      type="date"
                      value={businessReportEndDate}
                      onChange={(e) => setBusinessReportEndDate(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Fetch Button */}
              <Button
                onClick={async () => {
                  if (!businessReportUserId.trim()) {
                    alert('Please enter a User ID')
                    return
                  }
                  if (!businessReportStartDate || !businessReportEndDate) {
                    alert('Please select both start and end dates')
                    return
                  }

                  try {
                    setBusinessReportLoading(true)
                    setBusinessReportError(null)
                    setBusinessReportData(null)
                    setBusinessReportUserInfo(null)

                    // First, find user by display_id
                    const usersResponse = await getUsers({ display_id: businessReportUserId.trim(), limit: 1 })
                    if (!usersResponse.items || usersResponse.items.length === 0) {
                      setBusinessReportError(`User with ID "${businessReportUserId}" not found`)
                      setBusinessReportLoading(false)
                      return
                    }

                    const foundUser = usersResponse.items[0]
                    setBusinessReportUserInfo({
                      name: foundUser.name,
                      display_id: foundUser.display_id,
                    })

                    // Fetch business volume with legs
                    const businessData = await getBusinessVolumeWithLegs(foundUser.id, {
                      start_date: businessReportStartDate,
                      end_date: businessReportEndDate,
                    })

                    setBusinessReportData(businessData)
                  } catch (error: any) {
                    console.error('Error fetching business report:', error)
                    setBusinessReportError(error.message || 'Failed to fetch business report')
                  } finally {
                    setBusinessReportLoading(false)
                  }
                }}
                disabled={businessReportLoading || !businessReportUserId.trim() || !businessReportStartDate || !businessReportEndDate}
              >
                {businessReportLoading ? 'Loading...' : 'Get Business Report'}
              </Button>

              {/* Error Display */}
              {businessReportError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-800">{businessReportError}</p>
                </div>
              )}

              {/* Results Display */}
              {businessReportData && businessReportUserInfo && (
                <div className="mt-6 space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                    <h4 className="text-sm font-semibold text-green-800 mb-2">
                      Business Report for {businessReportUserInfo.display_id} ({businessReportUserInfo.name || 'N/A'})
                    </h4>
                    <p className="text-xs text-green-700">
                      Period: {new Date(businessReportStartDate).toLocaleDateString('en-IN')} to {new Date(businessReportEndDate).toLocaleDateString('en-IN')}
                    </p>
                  </div>

                  {/* Business Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <label className="text-xs font-semibold text-blue-600 uppercase">Direct Business</label>
                      <p className="text-2xl font-bold text-blue-800 mt-2">
                        ₹{businessReportData.direct_business.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">User's own purchases</p>
                    </div>

                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <label className="text-xs font-semibold text-purple-600 uppercase">Team Business</label>
                      <p className="text-2xl font-bold text-purple-800 mt-2">
                        ₹{businessReportData.team_business.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-purple-600 mt-1">Downline purchases</p>
                    </div>

                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                      <label className="text-xs font-semibold text-indigo-600 uppercase">Total Business Volume</label>
                      <p className="text-2xl font-bold text-indigo-800 mt-2">
                        ₹{businessReportData.total_business_volume.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-indigo-600 mt-1">Direct + Team Business</p>
                    </div>
                  </div>

                  {/* Top 3 Legs Highlight */}
                  {businessReportData.legs && businessReportData.legs.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-lg font-semibold text-gray-800 mb-4">🏆 Top 3 Legs Performance</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        {[...businessReportData.legs]
                          .sort((a, b) => b.leg_business_volume - a.leg_business_volume)
                          .slice(0, 3)
                          .map((leg, index) => {
                            const totalLegsBusiness = businessReportData.legs.reduce((sum, l) => sum + l.leg_business_volume, 0)
                            const percentage = totalLegsBusiness > 0 ? (leg.leg_business_volume / totalLegsBusiness * 100) : 0
                            
                            const medalColors = [
                              { bg: 'from-yellow-50 to-yellow-100', border: 'border-yellow-300', text: 'text-yellow-800', medal: '🥇' },
                              { bg: 'from-gray-50 to-gray-100', border: 'border-gray-300', text: 'text-gray-800', medal: '🥈' },
                              { bg: 'from-orange-50 to-orange-100', border: 'border-orange-300', text: 'text-orange-800', medal: '🥉' },
                            ]
                            const colors = medalColors[index]
                            
                            return (
                              <div 
                                key={leg.leg_user_id} 
                                className={`bg-gradient-to-br ${colors.bg} border-2 ${colors.border} rounded-lg p-4 shadow-md`}
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-2xl">{colors.medal}</span>
                                    <span className="text-sm font-bold text-gray-600">Leg #{index + 1}</span>
                                  </div>
                                  <span className={`text-xs font-semibold ${colors.text} bg-white px-2 py-1 rounded`}>
                                    {percentage.toFixed(1)}% of Total
                                  </span>
                                </div>
                                
                                <div className="mb-3">
                                  <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Leg User</p>
                                  <p className="text-sm font-mono text-blue-600 font-bold">{leg.leg_user_display_id || leg.leg_user_id}</p>
                                  <p className="text-sm font-medium text-gray-800">{leg.leg_user_name || 'N/A'}</p>
                                </div>
                                
                                <div className="space-y-2">
                                  <div className="bg-white/60 rounded p-2">
                                    <p className="text-xs text-gray-600 mb-1">Direct Business</p>
                                    <p className="text-lg font-bold text-gray-800">
                                      ₹{leg.direct_business.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-xs text-gray-500">Leg user's own purchases</p>
                                  </div>
                                  
                                  <div className="bg-white/60 rounded p-2">
                                    <p className="text-xs text-gray-600 mb-1">Team Business</p>
                                    <p className="text-lg font-bold text-gray-800">
                                      ₹{leg.team_business.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-xs text-gray-500">Leg's downline purchases</p>
                                  </div>
                                  
                                  <div className={`bg-gradient-to-r ${colors.bg} border ${colors.border} rounded p-2 mt-2`}>
                                    <p className="text-xs font-semibold text-gray-700 uppercase mb-1">Total Leg Business</p>
                                    <p className={`text-xl font-bold ${colors.text}`}>
                                      ₹{leg.leg_business_volume.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}

                  {/* Legs Breakdown */}
                  {businessReportData.legs && businessReportData.legs.length > 0 && (
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-gray-800">All Legs Breakdown</h4>
                        <div className="text-sm text-gray-600">
                          Total Legs: <span className="font-semibold text-gray-800">{businessReportData.legs.length}</span>
                        </div>
                      </div>
                      
                      {/* Summary Card */}
                      <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs font-semibold text-blue-600 uppercase mb-1">Total Legs Business</p>
                            <p className="text-xl font-bold text-blue-800">
                              ₹{businessReportData.legs.reduce((sum, leg) => sum + leg.leg_business_volume, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-purple-600 uppercase mb-1">Total Legs Direct</p>
                            <p className="text-xl font-bold text-purple-800">
                              ₹{businessReportData.legs.reduce((sum, leg) => sum + leg.direct_business, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-indigo-600 uppercase mb-1">Total Legs Team</p>
                            <p className="text-xl font-bold text-indigo-800">
                              ₹{businessReportData.legs.reduce((sum, leg) => sum + leg.team_business, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                          <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">
                                #
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">
                                Leg User ID
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">
                                Leg User Name
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">
                                Direct Business
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">
                                Team Business
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">
                                Total Leg Business
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">
                                % of Total
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {[...businessReportData.legs]
                              .sort((a, b) => b.leg_business_volume - a.leg_business_volume) // Sort by total business volume (highest first)
                              .map((leg, index) => {
                                const totalLegsBusiness = businessReportData.legs.reduce((sum, l) => sum + l.leg_business_volume, 0)
                                const percentage = totalLegsBusiness > 0 ? (leg.leg_business_volume / totalLegsBusiness * 100) : 0
                                
                                return (
                                  <tr 
                                    key={leg.leg_user_id} 
                                    className={index % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-gray-100'}
                                  >
                                    <td className="px-4 py-3 text-sm font-semibold text-gray-600 border-b">
                                      {index + 1}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-mono text-blue-600 font-semibold border-b">
                                      {leg.leg_user_display_id || leg.leg_user_id}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 border-b">
                                      {leg.leg_user_name || 'N/A'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 border-b text-right">
                                      ₹{leg.direct_business.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 border-b text-right">
                                      ₹{leg.team_business.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-bold text-indigo-800 border-b text-right">
                                      ₹{leg.leg_business_volume.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-semibold text-gray-700 border-b text-right">
                                      {percentage.toFixed(2)}%
                                    </td>
                                  </tr>
                                )
                              })}
                          </tbody>
                          <tfoot className="bg-gray-100">
                            <tr>
                              <td colSpan={3} className="px-4 py-3 text-sm font-bold text-gray-800 border-t-2 border-gray-300">
                                TOTAL
                              </td>
                              <td className="px-4 py-3 text-sm font-bold text-gray-800 border-t-2 border-gray-300 text-right">
                                ₹{businessReportData.legs.reduce((sum, leg) => sum + leg.direct_business, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-3 text-sm font-bold text-gray-800 border-t-2 border-gray-300 text-right">
                                ₹{businessReportData.legs.reduce((sum, leg) => sum + leg.team_business, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-3 text-sm font-bold text-indigo-800 border-t-2 border-gray-300 text-right">
                                ₹{businessReportData.legs.reduce((sum, leg) => sum + leg.leg_business_volume, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-3 text-sm font-bold text-gray-800 border-t-2 border-gray-300 text-right">
                                100.00%
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      
                      <p className="text-xs text-gray-500 mt-3">
                        <strong>Note:</strong> Legs are sorted by Total Leg Business (highest first). Each leg represents a direct referral and their entire downline team.
                      </p>
                    </div>
                  )}

                  {(!businessReportData.legs || businessReportData.legs.length === 0) && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-sm text-yellow-800">No legs (direct referrals) found for this user.</p>
                    </div>
                  )}

                  {/* Purchase Details for Debugging */}
                  {businessReportData.purchase_details && businessReportData.purchase_details.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-gray-800 mb-3">Recent Purchases (All Time - for reference)</h4>
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <p className="text-xs text-gray-600 mb-3">
                          Showing last 10 purchases to help verify purchase dates. These are ALL purchases (not filtered by date range).
                        </p>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b">
                                  Purchase Date
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b">
                                  Amount
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b">
                                  In Selected Range?
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {businessReportData.purchase_details.map((purchase) => {
                                const purchaseDate = new Date(purchase.purchased_at)
                                const startDate = new Date(businessReportStartDate)
                                startDate.setUTCHours(0, 0, 0, 0)
                                const endDate = new Date(businessReportEndDate)
                                endDate.setUTCHours(23, 59, 59, 999)
                                const isInRange = purchaseDate >= startDate && purchaseDate <= endDate
                                
                                return (
                                  <tr key={purchase.id} className={isInRange ? 'bg-green-50' : ''}>
                                    <td className="px-4 py-2 text-sm text-gray-900 border-b">
                                      {purchaseDate.toLocaleString('en-IN', { 
                                        year: 'numeric', 
                                        month: '2-digit', 
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </td>
                                    <td className="px-4 py-2 text-sm font-semibold text-gray-900 border-b">
                                      ₹{purchase.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-2 text-sm border-b">
                                      {isInRange ? (
                                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">Yes</span>
                                      ) : (
                                        <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold">No</span>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-xs text-gray-500 mt-3">
                          <strong>Note:</strong> If a purchase shows "No" in the selected range, it means the purchase was made outside the date range you selected (10/01/2026 to 23/01/2026).
                          To see that purchase in the business report, select a date range that includes the purchase date.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Active Filters Display */}
          {(sortBy !== 'created_at' || filterStartDate || filterEndDate || minDirectReferrals || minTeamBusiness) && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm font-semibold text-blue-800 mb-2">Active Filters:</p>
              <ul className="text-xs text-blue-700 space-y-1">
                {sortBy !== 'created_at' && (
                  <li>• Sort: {sortBy === 'direct_referrals' ? 'Most Direct Referrals' : 'Most Team Business'}</li>
                )}
                {filterStartDate && (
                  <li>• Start Date: {new Date(filterStartDate).toLocaleDateString('en-IN')}</li>
                )}
                {filterEndDate && (
                  <li>• End Date: {new Date(filterEndDate).toLocaleDateString('en-IN')}</li>
                )}
                {minDirectReferrals && (
                  <li>• Min Direct Referrals: {minDirectReferrals}</li>
                )}
                {minTeamBusiness && (
                  <li>• Min Team Business: ₹{Number(minTeamBusiness).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</li>
                )}
              </ul>
            </div>
          )}

          {/* Results Section */}
          {filterLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-2"></div>
                <p className="text-sm text-gray-600">Loading results...</p>
              </div>
            </div>
          )}

          {filtersApplied && !filterLoading && (
            <div className="mt-6 border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  {sortBy === 'direct_referrals' 
                    ? 'Top Users by Direct Referrals' 
                    : sortBy === 'total_business_volume'
                    ? 'Top Users by Team Business Volume'
                    : 'Filtered Results'}
                </h3>
                <span className="text-sm text-gray-600">
                  Showing {filterResults.length} results
                </span>
              </div>

              {filterResults.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No users found matching the selected filters.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b">
                          Level
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b">
                          User ID
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b">
                          Fullname
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b">
                          Email
                        </th>
                        {sortBy === 'direct_referrals' && (
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b">
                            Direct Referrals
                          </th>
                        )}
                        {sortBy === 'total_business_volume' && (
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b">
                            Team Business
                          </th>
                        )}
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b">
                          Created On
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filterResults.map((user, index) => {
                        const userLevel = userLevels.get(user.id)
                        const levelDisplay = userLevel 
                          ? userLevel.level >= 0 
                            ? `${userLevel.title} (Level ${userLevel.level})`
                            : 'N/A'
                          : loadingLevels 
                            ? 'Loading...' 
                            : 'N/A'
                        
                        return (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                            {levelDisplay}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-blue-600">
                            {user.display_id || user.id}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {user.name || 'N/A'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {user.email || 'N/A'}
                          </td>
                          {sortBy === 'direct_referrals' && (
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-green-600">
                              {user.direct_referrals || 0}
                            </td>
                          )}
                          {sortBy === 'total_business_volume' && (
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-green-600">
                              ₹{(user.total_business_volume || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </td>
                          )}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-semibold rounded ${
                              user.status === 'active' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {user.status === 'active' ? 'Active' : 'Blocked'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {user.created_at 
                              ? new Date(user.created_at).toLocaleDateString('en-IN', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                })
                              : 'N/A'}
                          </td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </Card>
  )
}
