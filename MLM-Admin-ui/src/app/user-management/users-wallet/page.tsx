"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, TextInput, DateRangeInput } from '../../../components/ui/FiltersBar'
import Pagination from '../../../components/ui/Pagination'
import Button from '../../../components/ui/Button'
import { EditButton } from '../../../components/ui/ActionButtons'
import Modal from '../../../components/ui/Modal'
import { getUsers, type User, type UsersListResponse, manualCreditWallet, manualDebitWallet, manageWallet } from '../../../lib/api/users'
import { exportToCsv } from '../../../lib/export'
import { getMyPermissions } from '../../../lib/api/sub-admins'
import { usePinVerification } from '../../../hooks/usePinVerification'

type WalletRow = {
  fullname: string
  user_id: string
  balance_main: string
  balance_spot: string
  balance_team_royalty: string
  status: 'Active' | 'Blocked'
  created_on: string
}

// Helper function to format currency
const formatCurrency = (amount: number): string => {
  return `₹ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Helper function to format date
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  } catch {
    return dateString
  }
}

export default function UsersWalletPage() {
  const [nameFilter, setNameFilter] = useState('')
  const [displayIdFilter, setDisplayIdFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Edit wallet modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [operationType, setOperationType] = useState<'credit' | 'debit'>('credit')
  const [amount, setAmount] = useState('')
  const [commissionType, setCommissionType] = useState<'SELF' | 'GLOBAL_HELPING' | 'SPOT' | 'MONTHLY'>('SELF')
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Manage wallet modal state
  const [isManageWalletModalOpen, setIsManageWalletModalOpen] = useState(false)
  const [selectedUserForManage, setSelectedUserForManage] = useState<User | null>(null)
  const [mainWalletAmount, setMainWalletAmount] = useState('')
  const [spotWalletAmount, setSpotWalletAmount] = useState('')
  const [teamWalletAmount, setTeamWalletAmount] = useState('')
  const [manageReason, setManageReason] = useState('')
  const [isManaging, setIsManaging] = useState(false)

  // Permission state
  const [adminPermissions, setAdminPermissions] = useState<string[]>([])
  const [adminRole, setAdminRole] = useState<string>('SUPER_ADMIN')
  const [permissionsLoaded, setPermissionsLoaded] = useState(false)

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
        setAdminRole('SUPER_ADMIN')
        setAdminPermissions([])
      } finally {
        setPermissionsLoaded(true)
      }
    }
    fetchPermissions()
  }, [])

  // Fetch users from API
  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const params: any = {
        page,
        limit: pageSize,
      }
      
      // Apply name filter if provided
      if (nameFilter.trim()) {
        params.name = nameFilter.trim()
      }
      
      // Apply display_id filter if provided (case-insensitive)
      if (displayIdFilter.trim()) {
        params.display_id = displayIdFilter.trim() // No case conversion - API handles case-insensitive matching
      }
      
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
      
      // Apply date range filters (API expects 'date' format: YYYY-MM-DD)
      if (startDate) {
        params.start_date = formatDateForAPI(startDate)
        console.log('📅 Date filter - startDate:', startDate, '-> formatted:', params.start_date)
      }
      if (endDate) {
        params.end_date = formatDateForAPI(endDate)
        console.log('📅 Date filter - endDate:', endDate, '-> formatted:', params.end_date)
      }
      
      const response: UsersListResponse = await getUsers(params)
      setUsers(response.items)
      setTotal(response.total)
    } catch (err: any) {
      console.error('Error fetching users:', err)
      setError(err.message || 'Failed to fetch users wallet data')
      setUsers([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, nameFilter, displayIdFilter, startDate, endDate])

  // Only fetch when user has WALLET_MANAGE permission (after permissions loaded)
  const canViewWallet = permissionsLoaded && hasPermission('WALLET_MANAGE')

  // Fetch users when page/pageSize changes, or when filters change (with manual search button)
  useEffect(() => {
    if (!canViewWallet) return
    // Reset to page 1 when date filters change
    if (startDate || endDate) {
      if (page !== 1) {
        setPage(1)
        return // Will trigger another fetch when page changes
      }
    }
    fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewWallet, page, pageSize, startDate, endDate]) // Include date filters to trigger refetch

  // Map API users to wallet rows
  const rows: WalletRow[] = useMemo(() => {
    return users.map((user) => ({
      fullname: user.name || 'N/A',
      user_id: user.display_id || user.id, // Show display_id if available, else numeric id
      balance_main: formatCurrency(user.other_balance ?? 0), // Main Wallet (other_balance) from API
      balance_spot: formatCurrency(user.spot_balance ?? 0), // Spot Wallet from API
      balance_team_royalty: formatCurrency(user.team_royalty_balance ?? 0), // Team Royalty Wallet from API
      status: user.status === 'active' ? 'Active' : 'Blocked', // Status from API
      created_on: formatDate(user.created_at),
    }))
  }, [users])

  // Handle edit wallet click
  const handleEditClick = useCallback((user_id: string) => {
    const user = users.find(u => u.id === user_id)
    if (user) {
      setSelectedUser(user)
      setOperationType('credit')
      setAmount('')
      setCommissionType('SELF')
      setReason('')
      setIsEditModalOpen(true)
    }
  }, [users])

  // Handle manage wallet click
  const handleManageWalletClick = useCallback((user_id: string) => {
    const user = users.find(u => u.id === user_id || u.display_id === user_id)
    if (user) {
      setSelectedUserForManage(user)
      setMainWalletAmount('')
      setSpotWalletAmount('')
      setTeamWalletAmount('')
      setManageReason('')
      setIsManageWalletModalOpen(true)
    }
  }, [users])

  // Handle wallet operation submit
  const handleWalletOperation = useCallback(async () => {
    if (!selectedUser) return

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid amount greater than 0')
      return
    }

    try {
      setIsSubmitting(true)
      
      if (operationType === 'credit') {
        await manualCreditWallet({
          user_id: selectedUser.id,
          amount: amountNum,
          commission_type: commissionType,
          reason: reason.trim() || null,
        })
        alert(`Successfully credited ₹${amountNum.toFixed(2)} to ${selectedUser.name || selectedUser.id}`)
      } else {
        await manualDebitWallet({
          user_id: selectedUser.id,
          amount: amountNum,
          reason: reason.trim() || null,
        })
        alert(`Successfully debited ₹${amountNum.toFixed(2)} from ${selectedUser.name || selectedUser.id}`)
      }

      // Refresh users list
      await fetchUsers()
      setIsEditModalOpen(false)
      setSelectedUser(null)
      setAmount('')
      setReason('')
    } catch (err: any) {
      console.error('Error performing wallet operation:', err)
      alert(`Error: ${err.message || 'Failed to perform wallet operation'}`)
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedUser, operationType, amount, commissionType, reason, fetchUsers])

  // Handle manage wallet submit (with PIN verification)
  const handleManageWallet = useCallback(async () => {
    if (!selectedUserForManage) return

    const mainAmount = parseFloat(mainWalletAmount) || 0
    const spotAmount = parseFloat(spotWalletAmount) || 0
    const teamRoyaltyAmount = parseFloat(teamWalletAmount) || 0

    if (mainAmount === 0 && spotAmount === 0 && teamRoyaltyAmount === 0) {
      alert('Please enter at least one amount (main wallet, spot wallet, or team royalty wallet)')
      return
    }

    // Verify PIN before proceeding
    const pinVerified = await verifyPinForAction('Wallet Management')
    if (!pinVerified) {
      return // User cancelled or PIN verification failed
    }

    try {
      setIsManaging(true)
      
      const result = await manageWallet({
        user_id: selectedUserForManage.id,
        main_wallet_amount: mainAmount,
        spot_wallet_amount: spotAmount,
        team_royalty_wallet_amount: teamRoyaltyAmount,
        reason: manageReason.trim() || null,
      })

      const teamRoyaltyMsg = result.new_team_royalty_balance !== undefined
        ? `\nTeam Royalty Wallet: ₹${result.new_team_royalty_balance.toFixed(2)}`
        : ''
      alert(`Successfully updated wallet for ${selectedUserForManage.name || selectedUserForManage.id}\nMain Wallet: ₹${result.new_main_balance.toFixed(2)}\nSpot Wallet: ₹${result.new_spot_balance.toFixed(2)}${teamRoyaltyMsg}`)

      // Refresh users list
      await fetchUsers()
      setIsManageWalletModalOpen(false)
      setSelectedUserForManage(null)
      setMainWalletAmount('')
      setSpotWalletAmount('')
      setTeamWalletAmount('')
      setManageReason('')
    } catch (err: any) {
      console.error('Error managing wallet:', err)
      alert(`Error: ${err.message || 'Failed to manage wallet'}`)
    } finally {
      setIsManaging(false)
    }
  }, [selectedUserForManage, mainWalletAmount, spotWalletAmount, teamWalletAmount, manageReason, fetchUsers, verifyPinForAction])

  const columns: Array<DataTableColumn<WalletRow>> = useMemo(() => [
    { key: 'fullname', title: 'Fullname', render: (r: WalletRow) => (<span className="font-semibold">{r.fullname}</span>) },
    { key: 'user_id', title: 'User Id', render: (r: WalletRow) => (<span className="font-semibold font-mono text-blue-600">{r.user_id}</span>) },
    { key: 'balance_main', title: 'Main Wallet', render: (r: WalletRow) => (<span className="font-bold text-[#007bff]">{r.balance_main}</span>) },
    { key: 'balance_spot', title: 'Spot Wallet', render: (r: WalletRow) => (<span className="font-semibold text-[#17a2b8]">{r.balance_spot}</span>) },
    { key: 'balance_team_royalty', title: 'Team Royalty', render: (r: WalletRow) => (<span className="font-semibold text-[#6f42c1]">{r.balance_team_royalty}</span>) },
    { key: 'status', title: 'Status', render: (r: WalletRow) => (<span className={r.status === 'Active' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{r.status}</span>) },
    { key: 'created_on', title: 'Created On' },
    { 
      key: 'actions', 
      title: 'Actions', 
      render: (r: WalletRow) => (
        <div className="flex gap-2">
          {hasPermission('WALLET_MANAGE') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleManageWalletClick(r.user_id)}
              className="text-xs"
            >
              Manage Wallet
            </Button>
          )}
        </div>
      )
    },
  ], [handleManageWalletClick, hasPermission])

  const handleExport = () => {
    if (!rows.length) {
      alert('No wallet records available to export.')
      return
    }

    // Extract numeric values from formatted currency strings
    const extractAmount = (formatted: string): number => {
      // Remove ₹, spaces, and commas, then parse
      const cleaned = formatted.replace(/₹|\s|,/g, '')
      return parseFloat(cleaned) || 0
    }

    const headers = ['Fullname', 'User ID', 'Main Wallet', 'Spot Wallet', 'Team Royalty', 'Status', 'Created On']
    const data = rows.map(row => [
      row.fullname,
      row.user_id,
      extractAmount(row.balance_main).toFixed(2),
      extractAmount(row.balance_spot).toFixed(2),
      extractAmount(row.balance_team_royalty).toFixed(2),
      row.status,
      row.created_on,
    ])

    exportToCsv(`users-wallet-balances-${new Date().toISOString().split('T')[0]}.csv`, headers, data)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSearch = () => {
    setPage(1)
    fetchUsers()
  }

  const handleClearFilters = () => {
    setNameFilter('')
    setDisplayIdFilter('')
    setStartDate('')
    setEndDate('')
    setPage(1)
    // Fetch with cleared filters after state updates
    setTimeout(() => {
      fetchUsers()
    }, 0)
  }

  if (permissionsLoaded && !hasPermission('WALLET_MANAGE')) {
    return (
      <Card title="Users Wallet Balances Overview 💰">
        <div className="py-12 text-center text-gray-600">
          <p className="font-medium">You don&apos;t have permission to view this page.</p>
          <p className="text-sm mt-1">Manage User Wallets permission is required.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card
      title="Users Wallet Balances Overview 💰"
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
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="text-gray-600">Loading wallet data...</div>
        </div>
      ) : (
        <>
      <DataTable<WalletRow>
        columns={columns}
            rows={rows}
        minWidthPx={1400}
      />

      <FiltersBar>
        <TextInput 
          id="displayid-filter" 
          label="Search by User ID (Display ID):" 
          value={displayIdFilter} 
          onChange={setDisplayIdFilter} 
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
        <DateRangeInput
          id="date-range"
          label="Date Range:"
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />
            <PrimaryButton type="button" onClick={handleSearch} disabled={isLoading}>
              Search
            </PrimaryButton>
            <SecondaryButton type="button" onClick={handleClearFilters} disabled={isLoading}>
              Clear filtering
            </SecondaryButton>
      </FiltersBar>

      <Pagination
        page={page}
        pageSize={pageSize}
            total={total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[10, 25, 50]}
      />
        </>
      )}

      {/* Edit Wallet Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          if (!isSubmitting) {
            setIsEditModalOpen(false)
            setSelectedUser(null)
            setAmount('')
            setReason('')
          }
        }}
        title={`Edit Wallet - ${selectedUser?.name || selectedUser?.id || 'User'}`}
        size="md"
        footer={
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                if (!isSubmitting) {
                  setIsEditModalOpen(false)
                  setSelectedUser(null)
                  setAmount('')
                  setReason('')
                }
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleWalletOperation}
              disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
            >
              {isSubmitting ? 'Processing...' : operationType === 'credit' ? 'Credit Wallet' : 'Debit Wallet'}
            </Button>
          </div>
        }
      >
        {selectedUser && (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-600">
                <strong>User ID:</strong> {selectedUser.id}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Name:</strong> {selectedUser.name || 'N/A'}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Current Balance:</strong> {formatCurrency(selectedUser.wallet_balance || 0)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Operation Type
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="operationType"
                    value="credit"
                    checked={operationType === 'credit'}
                    onChange={(e) => setOperationType(e.target.value as 'credit' | 'debit')}
                    disabled={isSubmitting}
                    className="mr-2"
                  />
                  <span className="text-green-600 font-semibold">Credit (Add Money)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="operationType"
                    value="debit"
                    checked={operationType === 'debit'}
                    onChange={(e) => setOperationType(e.target.value as 'credit' | 'debit')}
                    disabled={isSubmitting}
                    className="mr-2"
                  />
                  <span className="text-red-600 font-semibold">Debit (Deduct Money)</span>
                </label>
              </div>
            </div>

            {operationType === 'credit' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Commission Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={commissionType}
                  onChange={(e) => setCommissionType(e.target.value as typeof commissionType)}
                  disabled={isSubmitting}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="SELF">SELF</option>
                  <option value="GLOBAL_HELPING">GLOBAL_HELPING</option>
                  <option value="SPOT">SPOT</option>
                  <option value="MONTHLY">MONTHLY</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isSubmitting}
                placeholder="Enter amount"
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason (Optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isSubmitting}
                placeholder="Enter reason for this operation..."
                rows={3}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {operationType === 'debit' && selectedUser.wallet_balance !== undefined && parseFloat(amount) > selectedUser.wallet_balance && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">
                  ⚠️ Warning: Debit amount (₹{parseFloat(amount).toFixed(2)}) exceeds current balance (₹{selectedUser.wallet_balance.toFixed(2)})
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Manage Wallet Modal */}
      <Modal
        isOpen={isManageWalletModalOpen}
        onClose={() => {
          if (!isManaging) {
            setIsManageWalletModalOpen(false)
            setSelectedUserForManage(null)
            setMainWalletAmount('')
            setSpotWalletAmount('')
            setTeamWalletAmount('')
            setManageReason('')
          }
        }}
        title={`Manage Wallet - ${selectedUserForManage?.name || selectedUserForManage?.id || 'User'}`}
        size="md"
        footer={
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                if (!isManaging) {
                  setIsManageWalletModalOpen(false)
                  setSelectedUserForManage(null)
            setMainWalletAmount('')
            setSpotWalletAmount('')
            setTeamWalletAmount('')
            setManageReason('')
          }
        }}
        disabled={isManaging}
      >
        Cancel
            </Button>
            <Button
              onClick={handleManageWallet}
              disabled={isManaging || (parseFloat(mainWalletAmount) === 0 && parseFloat(spotWalletAmount) === 0 && parseFloat(teamWalletAmount) === 0)}
            >
              {isManaging ? 'Processing...' : 'Update Wallet'}
            </Button>
          </div>
        }
      >
        {selectedUserForManage && (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-600">
                <strong>User ID:</strong> {selectedUserForManage.id}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Name:</strong> {selectedUserForManage.name || 'N/A'}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Current Main Wallet:</strong> {formatCurrency(selectedUserForManage.other_balance ?? 0)}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Current Spot Wallet:</strong> {formatCurrency(selectedUserForManage.spot_balance ?? 0)}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Current Team Royalty:</strong> {formatCurrency(selectedUserForManage.team_royalty_balance ?? 0)}
              </p>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Enter positive amounts to add money, negative amounts to subtract money.
                <br />
                Example: +100 to add ₹100, -50 to subtract ₹50
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Main Wallet Amount <span className="text-red-500">*</span>
                <span className="text-xs text-gray-500 ml-2">(Enter 0 to skip)</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={mainWalletAmount}
                onChange={(e) => setMainWalletAmount(e.target.value)}
                disabled={isManaging}
                placeholder="Enter amount (e.g., 100 or -50)"
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {mainWalletAmount && parseFloat(mainWalletAmount) < 0 && selectedUserForManage.other_balance !== undefined && Math.abs(parseFloat(mainWalletAmount)) > selectedUserForManage.other_balance && (
                <p className="text-xs text-red-600 mt-1">
                  ⚠️ Warning: Debit amount exceeds current main wallet balance (₹{selectedUserForManage.other_balance.toFixed(2)})
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Spot Wallet Amount <span className="text-red-500">*</span>
                <span className="text-xs text-gray-500 ml-2">(Enter 0 to skip)</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={spotWalletAmount}
                onChange={(e) => setSpotWalletAmount(e.target.value)}
                disabled={isManaging}
                placeholder="Enter amount (e.g., 50 or -25)"
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {spotWalletAmount && parseFloat(spotWalletAmount) < 0 && selectedUserForManage.spot_balance !== undefined && Math.abs(parseFloat(spotWalletAmount)) > selectedUserForManage.spot_balance && (
                <p className="text-xs text-red-600 mt-1">
                  ⚠️ Warning: Debit amount exceeds current spot wallet balance (₹{selectedUserForManage.spot_balance.toFixed(2)})
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Team Royalty Wallet Amount <span className="text-red-500">*</span>
                <span className="text-xs text-gray-500 ml-2">(Enter 0 to skip)</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={teamWalletAmount}
                onChange={(e) => setTeamWalletAmount(e.target.value)}
                disabled={isManaging}
                placeholder="Enter amount (e.g., 50 or -25)"
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {teamWalletAmount && parseFloat(teamWalletAmount) < 0 && selectedUserForManage.team_royalty_balance !== undefined && Math.abs(parseFloat(teamWalletAmount)) > selectedUserForManage.team_royalty_balance && (
                <p className="text-xs text-red-600 mt-1">
                  ⚠️ Warning: Debit amount exceeds current team royalty wallet balance (₹{selectedUserForManage.team_royalty_balance.toFixed(2)})
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason (Optional)
              </label>
              <textarea
                value={manageReason}
                onChange={(e) => setManageReason(e.target.value)}
                disabled={isManaging}
                placeholder="Enter reason for this wallet adjustment..."
                rows={3}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </Modal>
    </Card>
  )
}
