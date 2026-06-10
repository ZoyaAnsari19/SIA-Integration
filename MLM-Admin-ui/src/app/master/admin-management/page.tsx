"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Card, { ToolbarButton } from '../../../components/ui/Card'
import DataTable, { DataTableColumn } from '../../../components/ui/DataTable'
import FiltersBar, { PrimaryButton, SecondaryButton, SearchInput } from '../../../components/ui/FiltersBar'
import { EditButton } from '../../../components/ui/ActionButtons'
import Pagination from '../../../components/ui/Pagination'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import StatusBadge from '../../../components/ui/StatusBadge'
import {
  getSubAdmins,
  getSubAdminById,
  createSubAdmin,
  updateSubAdmin,
  updateSubAdminStatus,
  getPermissions,
  type SubAdmin,
  type PermissionKey,
  type Permission,
  PERMISSION_GROUPS,
  type CreateSubAdminRequest,
  type UpdateSubAdminRequest,
} from '../../../lib/mock/sub-admins'
import {
  setSubAdminPin,
  resetSubAdminPin,
  getSubAdminPinInfo,
  unlockSubAdminPin,
  type PinInfo,
} from '../../../lib/mock/admin-pin'

type Row = {
  id: string
  name: string | null
  email: string | null
  role: string
  status: 'active' | 'inactive'
  password: string | null
  action_pin: string | null
  permissions_count: number
  permissions: PermissionKey[]
  created_at: string
}

export default function AdminManagementPage() {
  const [searchFilter, setSearchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [subAdmins, setSubAdmins] = useState<SubAdmin[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSubAdminId, setEditingSubAdminId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [permissionGroups, setPermissionGroups] = useState<Array<{ group: string; permissions: Permission[] }>>([])
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    action_pin: '',
    permissions: [] as PermissionKey[],
    status: 'active' as 'active' | 'inactive',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  
  // PIN Modal State
  const [isPinModalOpen, setIsPinModalOpen] = useState(false)
  const [pinModalSubAdmin, setPinModalSubAdmin] = useState<{ id: string; name: string | null; email: string | null } | null>(null)
  const [pinInfo, setPinInfo] = useState<PinInfo | null>(null)
  const [pinValue, setPinValue] = useState('')
  const [isPinLoading, setIsPinLoading] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)

  // Fetch sub-admins from API
  const fetchSubAdmins = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const params: any = {
        page,
        limit: pageSize,
      }

      if (searchFilter.trim()) {
        params.search = searchFilter.trim()
      }

      if (statusFilter !== 'all') {
        params.status = statusFilter
      }

      const response = await getSubAdmins(params)
      setSubAdmins(response.items)
      setTotal(response.total)
    } catch (err: any) {
      console.error('Error fetching sub-admins:', err)
      setError(err.message || 'Failed to fetch sub-admins')
      setSubAdmins([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, searchFilter, statusFilter])

  // Fetch permissions on mount
  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const perms = await getPermissions()
        console.log('📋 Fetched permissions from API:', perms)
        
        // Check if PACKAGE_ASSIGN and WALLET_MANAGE are in the response
        const hasPackageAssign = perms.some(p => p.key === 'PACKAGE_ASSIGN')
        const hasWalletManage = perms.some(p => p.key === 'WALLET_MANAGE')
        console.log('🔍 PACKAGE_ASSIGN found in API response:', hasPackageAssign)
        console.log('🔍 WALLET_MANAGE found in API response:', hasWalletManage)
        
        // Filter out permissions that are redundant (VIEW permissions are sufficient):
        // - P2P_MANAGE (P2P_VIEW is sufficient)
        // - PACKAGE_MANAGE (PACKAGE_VIEW is sufficient)
        // - LEVELS_MANAGE (LEVELS_VIEW is sufficient)
        // - WITHDRAW_RULES_MANAGE (WITHDRAW_VIEW is sufficient)
        const filteredPerms = perms.filter(p => 
          p.key !== 'P2P_MANAGE' && 
          p.key !== 'PACKAGE_MANAGE' && 
          p.key !== 'LEVELS_MANAGE' &&
          p.key !== 'WITHDRAW_RULES_MANAGE'
        )
        
        // If PACKAGE_ASSIGN is missing from API, add it from fallback
        if (!hasPackageAssign) {
          console.log('⚠️ PACKAGE_ASSIGN not found in API, adding from fallback')
          const packageAssignPerm = PERMISSION_GROUPS
            .find(g => g.group === 'Packages')
            ?.permissions.find(p => p.key === 'PACKAGE_ASSIGN')
          if (packageAssignPerm) {
            filteredPerms.push({
              key: packageAssignPerm.key,
              label: packageAssignPerm.label,
              group: 'Packages'
            })
          }
        }
        
        // If WALLET_MANAGE is missing from API, add it from fallback
        if (!hasWalletManage) {
          console.log('⚠️ WALLET_MANAGE not found in API, adding from fallback')
          const walletManagePerm = PERMISSION_GROUPS
            .find(g => g.group === 'Users & KYC')
            ?.permissions.find(p => p.key === 'WALLET_MANAGE')
          if (walletManagePerm) {
            filteredPerms.push({
              key: walletManagePerm.key,
              label: walletManagePerm.label,
              group: 'Users & KYC'
            })
          }
        }

        // If TICKET_VIEW / TICKET_MANAGE are missing from API (e.g. production DB not yet seeded), add from fallback
        const hasTicketView = filteredPerms.some(p => p.key === 'TICKET_VIEW')
        const hasTicketManage = filteredPerms.some(p => p.key === 'TICKET_MANAGE')
        if (!hasTicketView || !hasTicketManage) {
          const supportGroup = PERMISSION_GROUPS.find(g => g.group === 'Support')
          supportGroup?.permissions.forEach(p => {
            if (!filteredPerms.some(perm => perm.key === p.key)) {
              filteredPerms.push({ key: p.key, label: p.label, group: 'Support' })
            }
          })
        }

        // If ECOSYSTEM_VIEW missing from API, add from fallback (dashboard ecosystem cards)
        if (!filteredPerms.some(p => p.key === 'ECOSYSTEM_VIEW')) {
          const ecosystemPerm = PERMISSION_GROUPS.find(g => g.group === 'Dashboard')
            ?.permissions.find(p => p.key === 'ECOSYSTEM_VIEW')
          if (ecosystemPerm) {
            filteredPerms.push({
              key: ecosystemPerm.key,
              label: ecosystemPerm.label,
              group: 'Dashboard',
            })
          }
        }

        console.log('✅ Final permissions after filtering:', filteredPerms)
        setPermissions(filteredPerms)
        
        // Group permissions by group name
        const grouped = filteredPerms.reduce((acc, perm) => {
          const existingGroup = acc.find(g => g.group === perm.group)
          if (existingGroup) {
            existingGroup.permissions.push(perm)
          } else {
            acc.push({ group: perm.group, permissions: [perm] })
          }
          return acc
        }, [] as Array<{ group: string; permissions: Permission[] }>)
        
        setPermissionGroups(grouped)
      } catch (err: any) {
        console.error('Error fetching permissions:', err)
        // Fallback to hardcoded groups (also filter out redundant permissions)
        const fallbackGroups = PERMISSION_GROUPS.map(g => ({
          group: g.group,
          permissions: g.permissions
            .filter(p => 
              p.key !== 'P2P_MANAGE' && 
              p.key !== 'PACKAGE_MANAGE' && 
              p.key !== 'LEVELS_MANAGE' &&
              p.key !== 'WITHDRAW_RULES_MANAGE'
            )
            .map(p => ({ key: p.key, label: p.label, group: g.group }))
        })).filter(g => g.permissions.length > 0)
        console.log('📋 Using fallback permissions:', fallbackGroups)
        setPermissionGroups(fallbackGroups)
        // Also set permissions for the flat list
        const flatPerms = fallbackGroups.flatMap(g => g.permissions)
        setPermissions(flatPerms)
      }
    }
    fetchPermissions()
  }, [])

  // Fetch sub-admins on mount and when filters change
  useEffect(() => {
    fetchSubAdmins()
  }, [fetchSubAdmins])

  // Map API response to UI format
  const rows: Row[] = useMemo(() => {
    return subAdmins.map((admin) => ({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      status: admin.status,
      password: admin.password,
      action_pin: admin.action_pin,
      permissions_count: admin.permissions.length,
      permissions: admin.permissions,
      created_at: admin.created_at,
    }))
  }, [subAdmins])

  // Handle edit - load sub-admin data into form
  const handleEdit = useCallback(async (adminId: string) => {
    try {
      setIsLoading(true)
      const admin = await getSubAdminById(adminId)

      setFormData({
        name: admin.name || '',
        email: admin.email || '',
        phone: admin.phone || '',
        password: '', // Don't show password in edit mode
        action_pin: '', // PIN is managed separately via PIN modal
        permissions: admin.permissions,
        status: admin.status,
      })

      setEditingSubAdminId(adminId)
      setIsModalOpen(true)
      setFormErrors({})
    } catch (err: any) {
      console.error('Error loading sub-admin:', err)
      alert(`Error loading sub-admin: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Handle create
  const handleCreate = useCallback(() => {
    setEditingSubAdminId(null)
    setFormData({
      name: '',
      email: '',
      phone: '',
      password: '',
      action_pin: '',
      permissions: [],
      status: 'active',
    })
    setFormErrors({})
    setIsModalOpen(true)
  }, [])

  // Handle close modal
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
    setEditingSubAdminId(null)
    setFormData({
      name: '',
      email: '',
      phone: '',
      password: '',
      action_pin: '',
      permissions: [],
      status: 'active',
    })
    setFormErrors({})
  }, [])

  // Handle open PIN modal
  const handleOpenPinModal = useCallback(async (adminId: string, name: string | null, email: string | null) => {
    setPinModalSubAdmin({ id: adminId, name, email })
    setPinValue('')
    setPinError(null)
    setIsPinLoading(true)
    setIsPinModalOpen(true)

    try {
      const info = await getSubAdminPinInfo(adminId)
      setPinInfo(info)
    } catch (err: any) {
      console.error('Error fetching PIN info:', err)
      setPinError(err.message || 'Failed to fetch PIN info')
      setPinInfo(null)
    } finally {
      setIsPinLoading(false)
    }
  }, [])

  // Handle close PIN modal
  const handleClosePinModal = useCallback(() => {
    setIsPinModalOpen(false)
    setPinModalSubAdmin(null)
    setPinInfo(null)
    setPinValue('')
    setPinError(null)
  }, [])

  // Handle set/reset PIN
  const handleSetPin = useCallback(async () => {
    if (!pinModalSubAdmin) return

    // Validate PIN
    if (!pinValue || pinValue.length !== 4 || !/^\d{4}$/.test(pinValue)) {
      setPinError('Please enter a valid 4-digit PIN')
      return
    }

    setIsPinLoading(true)
    setPinError(null)

    try {
      if (pinInfo?.has_pin) {
        // Reset existing PIN
        await resetSubAdminPin(pinModalSubAdmin.id, pinValue)
        alert('PIN reset successfully!')
      } else {
        // Set new PIN
        await setSubAdminPin(pinModalSubAdmin.id, pinValue)
        alert('PIN set successfully!')
      }
      handleClosePinModal()
    } catch (err: any) {
      console.error('Error setting PIN:', err)
      setPinError(err.message || 'Failed to set PIN')
    } finally {
      setIsPinLoading(false)
    }
  }, [pinModalSubAdmin, pinValue, pinInfo, handleClosePinModal])

  // Handle unlock PIN
  const handleUnlockPin = useCallback(async () => {
    if (!pinModalSubAdmin) return

    if (!confirm('Are you sure you want to unlock this sub-admin\'s PIN?')) {
      return
    }

    setIsPinLoading(true)
    setPinError(null)

    try {
      await unlockSubAdminPin(pinModalSubAdmin.id)
      alert('PIN unlocked successfully!')
      // Refresh PIN info
      const info = await getSubAdminPinInfo(pinModalSubAdmin.id)
      setPinInfo(info)
    } catch (err: any) {
      console.error('Error unlocking PIN:', err)
      setPinError(err.message || 'Failed to unlock PIN')
    } finally {
      setIsPinLoading(false)
    }
  }, [pinModalSubAdmin])

  // Handle toggle permission
  const handleTogglePermission = useCallback((permissionKey: PermissionKey) => {
    setFormData((prev) => {
      const currentPermissions = prev.permissions
      const isSelected = currentPermissions.includes(permissionKey)

      if (isSelected) {
        return {
          ...prev,
          permissions: currentPermissions.filter((p) => p !== permissionKey),
        }
      } else {
        return {
          ...prev,
          permissions: [...currentPermissions, permissionKey],
        }
      }
    })
  }, [])

  // Handle select all permissions (Full Access)
  const handleSelectAllPermissions = useCallback(() => {
    setFormData((prev) => {
      const allPermissionKeys = permissions.map((p) => p.key as PermissionKey)
      const allSelected = allPermissionKeys.every((key) => prev.permissions.includes(key))

      if (allSelected) {
        // Deselect all
        return {
          ...prev,
          permissions: [],
        }
      } else {
        // Select all
        return {
          ...prev,
          permissions: allPermissionKeys,
        }
      }
    })
  }, [permissions])

  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.name.trim()) {
      errors.name = 'Name is required'
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required'
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email.trim())) {
        errors.email = 'Invalid email format'
      }
    }

    // Password required only for new sub-admin
    if (!editingSubAdminId && (!formData.password || !formData.password.trim())) {
      errors.password = 'Password is required'
    } else if (formData.password && formData.password.trim() && formData.password.trim().length < 6) {
      errors.password = 'Password must be at least 6 characters'
    }

    // Action PIN validation (only for new sub-admin, optional for existing)
    if (!editingSubAdminId && (!formData.action_pin || !formData.action_pin.trim())) {
      errors.action_pin = 'Action PIN is required for new sub-admin'
    } else if (formData.action_pin && formData.action_pin.trim() && !/^\d{4}$/.test(formData.action_pin.trim())) {
      errors.action_pin = 'Action PIN must be exactly 4 digits'
    }

    if (formData.permissions.length === 0) {
      errors.permissions = 'At least one permission must be selected'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Handle save (create or update)
  const handleSave = useCallback(async () => {
    if (!validateForm()) {
      return
    }

    try {
      setIsSubmitting(true)

      if (editingSubAdminId) {
        // Update existing sub-admin
        const updatePayload: UpdateSubAdminRequest = {
          name: formData.name.trim(),
          email: formData.email.trim(),
          permissions: formData.permissions,
          status: formData.status,
        }

        // Only include phone if provided
        if (formData.phone.trim()) {
          updatePayload.phone = formData.phone.trim()
        }

        // Only include password if it's provided
        if (formData.password.trim()) {
          updatePayload.password = formData.password.trim()
        }

        await updateSubAdmin(editingSubAdminId, updatePayload)
        alert('Sub-admin updated successfully!')
      } else {
        // Create new sub-admin
        const createPayload: CreateSubAdminRequest = {
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password.trim(),
          permissions: formData.permissions,
        }

        // Only include phone if provided
        if (formData.phone.trim()) {
          createPayload.phone = formData.phone.trim()
        }

        const newSubAdmin = await createSubAdmin(createPayload)
        
        // Set action PIN for the new sub-admin
        if (formData.action_pin.trim() && newSubAdmin?.id) {
          try {
            await setSubAdminPin(newSubAdmin.id, formData.action_pin.trim())
            alert('Sub-admin created with PIN successfully!')
          } catch (pinErr: any) {
            console.error('Error setting PIN:', pinErr)
            alert(`Sub-admin created but failed to set PIN: ${pinErr.message}. You can set it later.`)
          }
        } else {
          alert('Sub-admin created successfully!')
        }
      }

      handleCloseModal()
      await fetchSubAdmins()
    } catch (err: any) {
      console.error('Error saving sub-admin:', err)
      alert(`Error saving sub-admin: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, editingSubAdminId, fetchSubAdmins, handleCloseModal])

  // Handle status toggle
  const handleToggleStatus = useCallback(
    async (adminId: string, currentStatus: 'active' | 'inactive') => {
      if (
        !confirm(
          `Are you sure you want to ${currentStatus === 'active' ? 'deactivate' : 'activate'} this sub-admin?`
        )
      ) {
        return
      }

      try {
        setIsLoading(true)
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
        await updateSubAdminStatus(adminId, newStatus)
        await fetchSubAdmins()
        alert(`Sub-admin ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully!`)
      } catch (err: any) {
        console.error('Error updating status:', err)
        alert(`Error updating status: ${err.message}`)
      } finally {
        setIsLoading(false)
      }
    },
    [fetchSubAdmins]
  )

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateString
    }
  }

  // Table columns
  const columns: Array<DataTableColumn<Row>> = useMemo(
    () => [
      {
        key: 'id',
        title: 'ID',
        render: (r: Row) => (
          <span className="font-mono text-sm text-slate-600" title="Use this ID in Support ticket Reassign">
            {r.id}
          </span>
        ),
      },
      {
        key: 'name',
        title: 'Name',
        render: (r: Row) => <span className="font-medium">{r.name}</span>,
      },
      {
        key: 'email',
        title: 'Email',
        render: (r: Row) => <span className="text-gray-700">{r.email}</span>,
      },
      {
        key: 'role',
        title: 'Role',
        render: (r: Row) => (
          <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
            {r.role}
          </span>
        ),
      },
      {
        key: 'status',
        title: 'Status',
        render: (r: Row) => (
          <StatusBadge variant={r.status === 'active' ? 'active' : 'rejected'}>
            {r.status}
          </StatusBadge>
        ),
      },
      {
        key: 'password',
        title: 'Password',
        render: (r: Row) => (
          <span className="text-gray-800 font-mono text-sm">
            {r.password || <span className="text-gray-400 italic">Not set</span>}
          </span>
        ),
      },
      {
        key: 'action_pin',
        title: 'Action PIN',
        render: (r: Row) => (
          <span className={`font-mono text-lg font-bold tracking-widest ${r.action_pin ? 'text-green-700' : 'text-gray-400'}`}>
            {r.action_pin || <span className="text-xs italic font-normal">Not set</span>}
          </span>
        ),
      },
      {
        key: 'permissions_count',
        title: 'Permissions',
        cellClassName: 'whitespace-normal',
        render: (r: Row) => {
          if (r.permissions.length === 0) {
            return <span className="text-gray-400 italic">No permissions</span>
          }
          
          // Get permission labels from permissions list
          const permissionLabels = r.permissions.map(permKey => {
            const perm = permissions.find(p => p.key === permKey)
            return perm ? perm.label : permKey
          })
          
          // Show first 3 permissions, then "+X more" if there are more
          const displayCount = 3
          const visiblePerms = permissionLabels.slice(0, displayCount)
          const remainingCount = permissionLabels.length - displayCount
          
          return (
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap gap-1">
                {visiblePerms.map((label, idx) => (
                  <span
                    key={idx}
                    className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-blue-50 text-blue-700 border border-blue-200"
                    title={label}
                  >
                    {label}
                  </span>
                ))}
                {remainingCount > 0 && (
                  <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600">
                    +{remainingCount} more
                  </span>
                )}
              </div>
              {r.permissions_count > 0 && (
                <span className="text-xs text-gray-500 mt-0.5">
                  Total: {r.permissions_count} permission{r.permissions_count !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )
        },
      },
      {
        key: 'created_at',
        title: 'Created At',
        cellClassName: 'whitespace-nowrap',
        render: (r: Row) => formatDate(r.created_at),
      },
    ],
    [permissions]
  )

  return (
    <div className="p-4 sm:p-6">
      <Card
        title="Admin Management"
        toolbarRight={
          <ToolbarButton onClick={handleCreate} disabled={isLoading}>
            + Add Sub Admin
          </ToolbarButton>
        }
      >
        <FiltersBar>
          <SearchInput
            placeholder="Search by name or email..."
            value={searchFilter}
            onChange={(v) => {
              setSearchFilter(v)
              setPage(1) // Reset to first page on search
            }}
          />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')
              setPage(1)
            }}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <SecondaryButton onClick={() => fetchSubAdmins()} disabled={isLoading}>
            Refresh
          </SecondaryButton>
        </FiltersBar>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="mt-4">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="text-gray-600">Loading sub-admins...</div>
            </div>
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              actionsHeader="Actions"
              renderActions={(row: Row) => (
                <div className="flex gap-2 flex-wrap">
                  <EditButton onClick={() => handleEdit(row.id)} />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleOpenPinModal(row.id, row.name, row.email)}
                    disabled={isLoading}
                    title="Manage Action PIN"
                  >
                    🔐 PIN
                  </Button>
                  <Button
                    variant={row.status === 'active' ? 'danger' : 'primary'}
                    size="sm"
                    onClick={() => handleToggleStatus(row.id, row.status)}
                    disabled={isLoading}
                  >
                    {row.status === 'active' ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              )}
            />
          )}
        </div>

        {total > 0 && (
          <div className="mt-4">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingSubAdminId ? 'Edit Sub Admin' : 'Create Sub Admin'}
        size="xl"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleCloseModal} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : editingSubAdminId ? 'Update' : 'Create'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Basic Information</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                  formErrors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter sub-admin name"
              />
              {formErrors.name && (
                <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                  formErrors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter email address"
              />
              {formErrors.email && (
                <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter 10-digit phone number"
                maxLength={10}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password {!editingSubAdminId && <span className="text-red-500">*</span>}
                {editingSubAdminId && (
                  <span className="text-gray-500 text-xs ml-1">(Leave blank to keep current)</span>
                )}
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                  formErrors.password ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder={editingSubAdminId ? 'Enter new password (optional)' : 'Enter password'}
              />
              {formErrors.password && (
                <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>
              )}
            </div>

            {/* Action PIN - Only for new sub-admin creation */}
            {!editingSubAdminId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Action PIN <span className="text-red-500">*</span>
                  <span className="text-gray-500 text-xs ml-1">(4-digit PIN for critical actions)</span>
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={formData.action_pin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 4)
                    setFormData({ ...formData, action_pin: value })
                  }}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                    formErrors.action_pin ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter 4-digit PIN"
                  maxLength={4}
                />
                {formErrors.action_pin && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.action_pin}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  This PIN will be required for the sub-admin to perform critical actions like KYC approval, wallet management, etc.
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Permissions */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Permissions</h3>
              {formErrors.permissions && (
                <p className="text-sm text-red-600">{formErrors.permissions}</p>
              )}
            </div>

            {/* Full Access Checkbox */}
            <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={permissions.length > 0 && permissions.every((p) => 
                    formData.permissions.includes(p.key as PermissionKey)
                  )}
                  onChange={handleSelectAllPermissions}
                  className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <span className="text-base font-semibold text-gray-800">
                  Full Access (Select All Permissions)
                </span>
              </label>
            </div>

            {/* Individual Permissions List */}
            <div className="border rounded-lg p-4 bg-gray-50 max-h-[400px] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {permissions.map((permission) => {
                  const isChecked = formData.permissions.includes(permission.key as PermissionKey)
                  return (
                    <label
                      key={permission.key}
                      className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-2 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleTogglePermission(permission.key as PermissionKey)}
                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                      <span className="text-sm text-gray-700">{permission.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* PIN Management Modal */}
      <Modal
        isOpen={isPinModalOpen}
        onClose={handleClosePinModal}
        title="Manage Action PIN"
        size="sm"
      >
        <div className="space-y-4">
          {isPinLoading && !pinInfo ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Sub-admin info */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">Sub-Admin</p>
                <p className="font-medium text-gray-800">{pinModalSubAdmin?.name || pinModalSubAdmin?.email}</p>
              </div>

              {/* Current PIN Status */}
              {pinInfo && (
                <div className={`p-3 rounded-lg border ${pinInfo.has_pin ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg ${pinInfo.has_pin ? 'text-green-600' : 'text-yellow-600'}`}>
                      {pinInfo.has_pin ? '✓' : '⚠'}
                    </span>
                    <div className="flex-1">
                      <p className={`font-medium ${pinInfo.has_pin ? 'text-green-800' : 'text-yellow-800'}`}>
                        {pinInfo.has_pin ? 'PIN is set' : 'PIN not set'}
                      </p>
                      {pinInfo.pin_set_at && (
                        <p className="text-xs text-gray-600">
                          Set on: {new Date(pinInfo.pin_set_at).toLocaleString()}
                          {pinInfo.pin_set_by_name && ` by ${pinInfo.pin_set_by_name}`}
                        </p>
                      )}
                    </div>
                    {/* Show current PIN value */}
                    {pinInfo.has_pin && pinInfo.pin_value && (
                      <div className="bg-white px-4 py-2 rounded-lg border-2 border-green-300 shadow-sm">
                        <p className="text-xs text-gray-500 mb-0.5">Current PIN</p>
                        <p className="text-2xl font-bold text-green-700 tracking-widest font-mono">
                          {pinInfo.pin_value}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Locked Status */}
              {pinInfo?.is_locked && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-red-800">🔒 PIN Locked</p>
                      <p className="text-xs text-red-600">
                        Failed attempts: {pinInfo.failed_attempts}
                        {pinInfo.locked_until && (
                          <> · Locked until: {new Date(pinInfo.locked_until).toLocaleString()}</>
                        )}
                      </p>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={handleUnlockPin}
                      disabled={isPinLoading}
                    >
                      Unlock
                    </Button>
                  </div>
                </div>
              )}

              {/* PIN Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {pinInfo?.has_pin ? 'New PIN (4 digits)' : 'Set PIN (4 digits)'}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={pinValue}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 4)
                    setPinValue(value)
                    setPinError(null)
                  }}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-center text-xl tracking-widest ${
                    pinError ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="• • • •"
                  maxLength={4}
                />
                {pinError && (
                  <p className="mt-1 text-sm text-red-600">{pinError}</p>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={handleClosePinModal}
                  disabled={isPinLoading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSetPin}
                  disabled={isPinLoading || pinValue.length !== 4}
                  className="flex-1"
                >
                  {isPinLoading ? 'Saving...' : pinInfo?.has_pin ? 'Reset PIN' : 'Set PIN'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}

