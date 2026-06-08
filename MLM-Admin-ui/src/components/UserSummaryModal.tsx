"use client"

import React, { useState, useEffect } from 'react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import { getUserById, getUserActiveCourses, getUserEligibility, getTeamBusinessVolume, getBusinessVolumeWithLegs, type UserDetails, type UserPurchase, type LevelEligibility, type TeamBusinessVolumeResponse, type BusinessVolumeLeg } from '../lib/api/users'
import { getSelfIncome, getDirectIncome, getTeamIncome, getSpotIncome, getGlobalIncome } from '../lib/api/incomeHistory'
import { getLedgerEntries, type LedgerEntryItem } from '../lib/api/ledger'
import { getWithdrawalHistory, getWalletTransfers, type WithdrawRequestItem, type WalletTransferItem } from '../lib/api/withdraw'

type TabType = 'overview' | 'business' | 'team' | 'income' | 'packages' | 'levels' | 'transactions'

interface UserSummaryModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string | null
}

const tabs: { id: TabType; label: string }[] = [
  { id: 'overview', label: 'Basic Information' },
  { id: 'business', label: 'Business Overview' },
  { id: 'team', label: 'Team & Network' },
  { id: 'income', label: 'Income & Commissions' },
  { id: 'packages', label: 'Package Details' },
  { id: 'levels', label: 'Levels & Eligibility' },
  { id: 'transactions', label: 'Transaction History' },
]

export default function UserSummaryModal({ isOpen, onClose, userId }: UserSummaryModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [loading, setLoading] = useState(false)
  const [userData, setUserData] = useState<UserDetails | null>(null)
  
  // Income tab state
  const [incomeLoading, setIncomeLoading] = useState(false)
  const [dateFilter, setDateFilter] = useState<'7d' | '30d' | '90d' | 'all' | 'custom'>('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [incomeData, setIncomeData] = useState<{
    self: number
    direct: number
    team: number
    spot: number
    global: number
    total: number
  } | null>(null)
  
  // Packages tab state
  const [packagesLoading, setPackagesLoading] = useState(false)
  const [packages, setPackages] = useState<UserPurchase[]>([])
  
  // Levels tab state
  const [levelsLoading, setLevelsLoading] = useState(false)
  const [levelsData, setLevelsData] = useState<LevelEligibility[]>([])
  const [legsData, setLegsData] = useState<BusinessVolumeLeg[]>([])
  const [legsLoading, setLegsLoading] = useState(false)
  
  // Transactions tab state
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [transactionsDateFilter, setTransactionsDateFilter] = useState<'7d' | '30d' | '90d' | 'all' | 'custom'>('30d')
  const [transactionsCustomStartDate, setTransactionsCustomStartDate] = useState('')
  const [transactionsCustomEndDate, setTransactionsCustomEndDate] = useState('')
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntryItem[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawRequestItem[]>([])
  const [walletTransfers, setWalletTransfers] = useState<WalletTransferItem[]>([])
  
  // Business tab state
  const [businessLoading, setBusinessLoading] = useState(false)
  const [businessDateFilter, setBusinessDateFilter] = useState<'7d' | '30d' | '90d' | 'all' | 'custom'>('all')
  const [businessCustomStartDate, setBusinessCustomStartDate] = useState('')
  const [businessCustomEndDate, setBusinessCustomEndDate] = useState('')
  const [businessData, setBusinessData] = useState<TeamBusinessVolumeResponse | null>(null)
  
  // Team tab state
  const [teamBusinessLoading, setTeamBusinessLoading] = useState(false)
  const [teamDateFilter, setTeamDateFilter] = useState<'7d' | '30d' | '90d' | 'all' | 'custom'>('all')
  const [teamCustomStartDate, setTeamCustomStartDate] = useState('')
  const [teamCustomEndDate, setTeamCustomEndDate] = useState('')
  const [teamBusinessData, setTeamBusinessData] = useState<TeamBusinessVolumeResponse | null>(null)

  useEffect(() => {
    if (isOpen && userId) {
      // Fetch user summary data
      fetchUserSummary()
    } else {
      // Reset data when modal closes
      setUserData(null)
      setActiveTab('overview')
      setIncomeData(null)
      setPackages([])
      setLevelsData([])
      setLegsData([])
      setLedgerEntries([])
      setWithdrawals([])
      setWalletTransfers([])
      setTeamBusinessData(null)
      setBusinessData(null)
    }
  }, [isOpen, userId])

  useEffect(() => {
    if (activeTab === 'income' && userId) {
      fetchIncomeData()
    } else if (activeTab === 'packages' && userId) {
      fetchPackages()
    } else if (activeTab === 'levels' && userId) {
      fetchLevels()
    } else if (activeTab === 'transactions' && userId) {
      fetchTransactions()
    } else if (activeTab === 'team' && userId) {
      fetchTeamBusiness()
    } else if (activeTab === 'business' && userId) {
      fetchBusinessData()
    }
  }, [activeTab, userId, dateFilter, customStartDate, customEndDate, transactionsDateFilter, transactionsCustomStartDate, transactionsCustomEndDate, teamDateFilter, teamCustomStartDate, teamCustomEndDate, businessDateFilter, businessCustomStartDate, businessCustomEndDate])

  const fetchUserSummary = async () => {
    if (!userId) return
    
    try {
      setLoading(true)
      const data = await getUserById(userId)
      setUserData(data)
    } catch (error) {
      console.error('Error fetching user summary:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDateRange = () => {
    const now = new Date()
    let startDate: Date
    
    switch (dateFilter) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case 'custom':
        if (customStartDate && customEndDate) {
          return {
            start_date: customStartDate,
            end_date: customEndDate
          }
        }
        return {}
      default:
        return {}
    }
    
    return {
      start_date: startDate.toISOString().split('T')[0],
      end_date: now.toISOString().split('T')[0]
    }
  }

  const fetchIncomeData = async () => {
    if (!userId) return
    
    try {
      setIncomeLoading(true)
      const dateRange = getDateRange()
      
      console.log('📊 Fetching income data for user:', userId, 'Date range:', dateRange)
      
      // Backend max limit is 100, so use 100 instead of 1000
      const [selfRes, directRes, teamRes, spotRes, globalRes] = await Promise.all([
        getSelfIncome({ ...dateRange, limit: 100, user_id: userId }).catch((err) => {
          console.error('❌ Error fetching Self Income:', err)
          return { items: [] }
        }),
        getDirectIncome({ ...dateRange, limit: 100, user_id: userId }).catch((err) => {
          console.error('❌ Error fetching Direct Income:', err)
          return { items: [] }
        }),
        getTeamIncome({ ...dateRange, limit: 100, user_id: userId }).catch((err) => {
          console.error('❌ Error fetching Team Income:', err)
          return { items: [] }
        }),
        getSpotIncome({ ...dateRange, limit: 100, user_id: userId }).catch((err) => {
          console.error('❌ Error fetching Spot Income:', err)
          return { items: [] }
        }),
        getGlobalIncome({ ...dateRange, limit: 100, user_id: userId }).catch((err) => {
          console.error('❌ Error fetching Global Income:', err)
          return { items: [] }
        })
      ])
      
      console.log('📊 Income data received:', {
        self: selfRes.items?.length || 0,
        direct: directRes.items?.length || 0,
        team: teamRes.items?.length || 0,
        spot: spotRes.items?.length || 0,
        global: globalRes.items?.length || 0,
        selfFirstItem: selfRes.items?.[0],
        directFirstItem: directRes.items?.[0],
        teamFirstItem: teamRes.items?.[0],
        spotFirstItem: spotRes.items?.[0],
        globalFirstItem: globalRes.items?.[0]
      })
      
      // Calculate totals with better logging
      const selfItems = selfRes.items || []
      const directItems = directRes.items || []
      const teamItems = teamRes.items || []
      const spotItems = spotRes.items || []
      const globalItems = globalRes.items || []
      
      console.log('💰 Processing income items:', {
        selfItemsCount: selfItems.length,
        directItemsCount: directItems.length,
        teamItemsCount: teamItems.length,
        spotItemsCount: spotItems.length,
        globalItemsCount: globalItems.length
      })
      
      const selfTotal = selfItems.reduce((sum: number, item: any) => {
        const amount = Number(item.amount) || 0
        if (isNaN(amount)) {
          console.warn('⚠️ Invalid amount in self income item:', item)
          return sum
        }
        return sum + amount
      }, 0)
      
      const directTotal = directItems.reduce((sum: number, item: any) => {
        const amount = Number(item.amount) || 0
        if (isNaN(amount)) {
          console.warn('⚠️ Invalid amount in direct income item:', item)
          return sum
        }
        return sum + amount
      }, 0)
      
      const teamTotal = teamItems.reduce((sum: number, item: any) => {
        const amount = Number(item.amount) || 0
        if (isNaN(amount)) {
          console.warn('⚠️ Invalid amount in team income item:', item)
          return sum
        }
        return sum + amount
      }, 0)
      
      const spotTotal = spotItems.reduce((sum: number, item: any) => {
        const amount = Number(item.amount) || 0
        if (isNaN(amount)) {
          console.warn('⚠️ Invalid amount in spot income item:', item)
          return sum
        }
        return sum + amount
      }, 0)
      
      const globalTotal = globalItems.reduce((sum: number, item: any) => {
        const amount = Number(item.amount) || 0
        if (isNaN(amount)) {
          console.warn('⚠️ Invalid amount in global income item:', item)
          return sum
        }
        return sum + amount
      }, 0)
      
      const totals = {
        self: selfTotal,
        direct: directTotal,
        team: teamTotal,
        spot: spotTotal,
        global: globalTotal,
        total: selfTotal + directTotal + teamTotal + spotTotal + globalTotal
      }
      
      console.log('💰 Calculated totals:', totals)
      
      setIncomeData(totals)
    } catch (error) {
      console.error('❌ Error fetching income data:', error)
      setIncomeData({
        self: 0,
        direct: 0,
        team: 0,
        spot: 0,
        global: 0,
        total: 0
      })
    } finally {
      setIncomeLoading(false)
    }
  }

  const fetchPackages = async () => {
    if (!userId) return
    
    try {
      setPackagesLoading(true)
      const response = await getUserActiveCourses(userId)
      setPackages(response.items)
    } catch (error) {
      console.error('Error fetching packages:', error)
    } finally {
      setPackagesLoading(false)
    }
  }

  const fetchLevels = async () => {
    if (!userId) return
    
    try {
      setLevelsLoading(true)
      setLegsLoading(true)
      const [response, businessRes] = await Promise.all([
        getUserEligibility(userId),
        getBusinessVolumeWithLegs(userId).catch(() => ({ legs: [] }))
      ])
      setLevelsData(response.eligibility)
      setLegsData(businessRes.legs || [])
    } catch (error) {
      console.error('Error fetching levels:', error)
    } finally {
      setLevelsLoading(false)
      setLegsLoading(false)
    }
  }

  const getBusinessDateRange = () => {
    const now = new Date()
    let startDate: Date
    
    switch (businessDateFilter) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case 'custom':
        if (businessCustomStartDate && businessCustomEndDate) {
          return {
            start_date: businessCustomStartDate,
            end_date: businessCustomEndDate
          }
        }
        return {}
      default:
        return {} // 'all' - no date filter
    }
    
    return {
      start_date: startDate.toISOString().split('T')[0],
      end_date: now.toISOString().split('T')[0]
    }
  }

  const fetchBusinessData = async () => {
    if (!userId) return
    
    try {
      setBusinessLoading(true)
      const dateRange = getBusinessDateRange()
      const response = await getTeamBusinessVolume(userId, dateRange)
      setBusinessData(response)
    } catch (error) {
      console.error('Error fetching business data:', error)
      setBusinessData(null)
    } finally {
      setBusinessLoading(false)
    }
  }

  const getTeamDateRange = () => {
    const now = new Date()
    let startDate: Date
    
    switch (teamDateFilter) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case 'custom':
        if (teamCustomStartDate && teamCustomEndDate) {
          return {
            start_date: teamCustomStartDate,
            end_date: teamCustomEndDate
          }
        }
        return {}
      default:
        return {} // 'all' - no date filter
    }
    
    return {
      start_date: startDate.toISOString().split('T')[0],
      end_date: now.toISOString().split('T')[0]
    }
  }

  const fetchTeamBusiness = async () => {
    if (!userId) return
    
    try {
      setTeamBusinessLoading(true)
      const dateRange = getTeamDateRange()
      const response = await getTeamBusinessVolume(userId, dateRange)
      setTeamBusinessData(response)
    } catch (error) {
      console.error('Error fetching team business data:', error)
      setTeamBusinessData(null)
    } finally {
      setTeamBusinessLoading(false)
    }
  }

  const getTransactionsDateRange = () => {
    const now = new Date()
    let startDate: Date
    
    switch (transactionsDateFilter) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case 'custom':
        if (transactionsCustomStartDate && transactionsCustomEndDate) {
          return {
            start_date: transactionsCustomStartDate,
            end_date: transactionsCustomEndDate
          }
        }
        return {}
      default:
        return {}
    }
    
    return {
      start_date: startDate.toISOString().split('T')[0],
      end_date: now.toISOString().split('T')[0]
    }
  }

  const fetchTransactions = async () => {
    if (!userId) return
    
    try {
      setTransactionsLoading(true)
      const dateRange = getTransactionsDateRange()
      
      // Fetch all transaction types in parallel
      const [ledgerRes, withdrawalsRes, transfersRes] = await Promise.all([
        getLedgerEntries({ ...dateRange, user_id: userId, limit: 100 }).catch(() => ({ items: [] })),
        getWithdrawalHistory({ ...dateRange, user_id: userId, limit: 100 }).catch(() => ({ items: [] })),
        getWalletTransfers({ 
          from_date: dateRange.start_date, 
          to_date: dateRange.end_date,
          from_user_id: userId,
          limit: 100 
        }).catch(() => ({ items: [] }))
      ])
      
      setLedgerEntries(ledgerRes.items || [])
      setWithdrawals(withdrawalsRes.items || [])
      setWalletTransfers(transfersRes.items || [])
    } catch (error) {
      console.error('Error fetching transactions:', error)
    } finally {
      setTransactionsLoading(false)
    }
  }

  // Helper function to escape CSV values
  const escapeCsvValue = (value: any): string => {
    if (value === null || value === undefined) return ''
    const str = String(value)
    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  // Helper function to format currency without comma in CSV (Excel will format it)
  const formatCurrency = (amount: number | undefined | null): string => {
    if (amount === null || amount === undefined) return '0.00'
    return amount.toFixed(2)
  }

  const handleExportToExcel = () => {
    if (!userData) {
      alert('No user data available to export')
      return
    }

    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `user-summary-${userData.display_id || userData.name || userId}-${timestamp}.csv`
    
    // Prepare all data for export
    const exportData: string[] = []
    
    // Header
    exportData.push('USER SUMMARY EXPORT')
    exportData.push(`Generated on: ${new Date().toLocaleString('en-IN')}`)
    exportData.push(`User: ${userData.display_id || userData.name || 'N/A'}`)
    exportData.push('')
    
    // 1. Basic Information
    exportData.push('=== BASIC INFORMATION ===')
    exportData.push('Field,Value')
    exportData.push(`User ID,${escapeCsvValue(userData.display_id || 'N/A')}`)
    exportData.push(`Name,${escapeCsvValue(userData.name || 'N/A')}`)
    exportData.push(`Email,${escapeCsvValue(userData.email || 'N/A')}`)
    exportData.push(`Phone,${escapeCsvValue(userData.phone || 'N/A')}`)
    exportData.push(`KYC Status,${escapeCsvValue(userData.kyc_status || 'N/A')}`)
    exportData.push(`Account Status,${escapeCsvValue(userData.status || 'N/A')}`)
    exportData.push(`Registration Date,${escapeCsvValue(userData.created_at ? new Date(userData.created_at).toLocaleString('en-IN') : 'N/A')}`)
    exportData.push(`Last Updated,${escapeCsvValue(userData.updated_at ? new Date(userData.updated_at).toLocaleString('en-IN') : 'N/A')}`)
    if (userData.referrer_display_id) {
      exportData.push(`Sponsor ID,${escapeCsvValue(userData.referrer_display_id)}`)
      exportData.push(`Sponsor Name,${escapeCsvValue(userData.referrer_name || 'N/A')}`)
    }
    if (userData.address) {
      const fullAddress = `${userData.address}${userData.city ? `, ${userData.city}` : ''}${userData.state ? `, ${userData.state}` : ''}${userData.pincode ? ` - ${userData.pincode}` : ''}`
      exportData.push(`Address,${escapeCsvValue(fullAddress)}`)
    }
    exportData.push('')
    
    // 2. Business Overview
    exportData.push('=== BUSINESS OVERVIEW ===')
    exportData.push('Field,Value')
    exportData.push(`Total Investment,${formatCurrency(userData.total_investment)}`)
    exportData.push(`Active Packages,${userData.total_active_packages || 0}`)
    if (businessData) {
      exportData.push(`Direct Business,${formatCurrency(businessData.direct_business)}`)
      exportData.push(`Team Business,${formatCurrency(businessData.team_business)}`)
      exportData.push(`Total Business Volume,${formatCurrency(businessData.total_business_volume)}`)
    }
    exportData.push('')
    
    // 3. Team & Network
    exportData.push('=== TEAM & NETWORK ===')
    exportData.push('Field,Value')
    if (teamBusinessData) {
      exportData.push(`Direct Business,${formatCurrency(teamBusinessData.direct_business)}`)
      exportData.push(`Team Business,${formatCurrency(teamBusinessData.team_business)}`)
      exportData.push(`Total Business Volume,${formatCurrency(teamBusinessData.total_business_volume)}`)
    }
    exportData.push('')
    
    // 4. Income & Commissions
    exportData.push('=== INCOME & COMMISSIONS ===')
    exportData.push('Type,Amount')
    if (incomeData) {
      exportData.push(`Self Income,${formatCurrency(incomeData.self)}`)
      exportData.push(`Direct Income,${formatCurrency(incomeData.direct)}`)
      exportData.push(`Team Income,${formatCurrency(incomeData.team)}`)
      exportData.push(`Spot Income,${formatCurrency(incomeData.spot)}`)
      exportData.push(`Global Income,${formatCurrency(incomeData.global)}`)
      exportData.push(`Total Income,${formatCurrency(incomeData.total)}`)
    }
    exportData.push('')
    
    // 5. Package Details
    if (packages.length > 0) {
      exportData.push('=== PACKAGE DETAILS ===')
      exportData.push('Package Name,Amount,Status,Purchase Date')
      packages.forEach((pkg) => {
        exportData.push(`${escapeCsvValue(pkg.package_name || 'N/A')},${formatCurrency(pkg.amount)},${escapeCsvValue(pkg.status || 'N/A')},${escapeCsvValue(pkg.purchased_at ? new Date(pkg.purchased_at).toLocaleString('en-IN') : 'N/A')}`)
      })
      exportData.push('')
    }
    
    // 6. Levels & Eligibility
    if (levelsData.length > 0) {
      exportData.push('=== LEVELS & ELIGIBILITY ===')
      exportData.push('Level,Title,Eligible,Spot Commission %,Monthly Royalty %,Reward,Business Requirement')
      levelsData.forEach((level) => {
        const businessReq = typeof level.business_requirement === 'object' ? JSON.stringify(level.business_requirement) : (level.business_requirement || 'N/A')
        exportData.push(`${level.level},${escapeCsvValue(level.title || 'N/A')},${level.eligible ? 'Yes' : 'No'},${escapeCsvValue(level.spot_commission_percent || 'N/A')},${escapeCsvValue(level.monthly_royalty_percent || 'N/A')},${escapeCsvValue(level.reward || 'N/A')},${escapeCsvValue(businessReq)}`)
      })
      exportData.push('')
    }
    
    // 7. Transaction History
    if (ledgerEntries.length > 0 || withdrawals.length > 0 || walletTransfers.length > 0) {
      exportData.push('=== TRANSACTION HISTORY ===')
      
      if (ledgerEntries.length > 0) {
        exportData.push('--- Ledger Entries ---')
        exportData.push('ID,Type,Amount,Source User,Receiver User,Credited At')
        ledgerEntries.forEach((entry) => {
          exportData.push(`${escapeCsvValue(entry.id)},${escapeCsvValue(entry.commission_type || 'N/A')},${formatCurrency(entry.amount)},${escapeCsvValue(entry.source_display_id || entry.source_user_id || 'N/A')},${escapeCsvValue(entry.receiver_display_id || entry.receiver_user_id || 'N/A')},${escapeCsvValue(entry.credited_at ? new Date(entry.credited_at).toLocaleString('en-IN') : 'N/A')}`)
        })
        exportData.push('')
      }
      
      if (withdrawals.length > 0) {
        exportData.push('--- Withdrawals ---')
        exportData.push('ID,Amount,Type,Status,Payment Method,Created At')
        withdrawals.forEach((withdrawal) => {
          exportData.push(`${escapeCsvValue(withdrawal.id)},${formatCurrency(withdrawal.amount)},${escapeCsvValue(withdrawal.withdraw_type || 'N/A')},${escapeCsvValue(withdrawal.status || 'N/A')},${escapeCsvValue(withdrawal.payment_method || 'N/A')},${escapeCsvValue(withdrawal.created_at ? new Date(withdrawal.created_at).toLocaleString('en-IN') : 'N/A')}`)
        })
        exportData.push('')
      }
      
      if (walletTransfers.length > 0) {
        exportData.push('--- Wallet Transfers ---')
        exportData.push('ID,Amount,From User,To User,Status,Created At')
        walletTransfers.forEach((transfer) => {
          exportData.push(`${escapeCsvValue(transfer.id)},${formatCurrency(transfer.amount)},${escapeCsvValue(transfer.from_user_display_id || transfer.from_user_id || 'N/A')},${escapeCsvValue(transfer.to_user_display_id || transfer.to_user_id || 'N/A')},${escapeCsvValue(transfer.status || 'N/A')},${escapeCsvValue(transfer.created_at ? new Date(transfer.created_at).toLocaleString('en-IN') : 'N/A')}`)
        })
      }
    }
    
    // Create CSV content with UTF-8 BOM for Excel compatibility
    const csvContent = '\uFEFF' + exportData.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (!isOpen || !userId) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`User Summary - ${userData?.display_id || userData?.name || userId || 'User'}`}
      size="full"
    >
      <div className="w-full">
        {/* Tabs and Export Button */}
        <div className="flex items-center justify-between mb-4">
          <div className="border-b border-gray-200 flex-1">
            <nav className="flex space-x-1 overflow-x-auto" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
                    ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
          
          {/* Export Button */}
          {userData && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportToExcel}
              className="ml-4 flex items-center gap-2 whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export to Excel
            </Button>
          )}
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading user summary...</span>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800">Basic Information</h3>
                  
                  {userData ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* User ID & Display Info */}
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <label className="text-xs font-semibold text-gray-500 uppercase">User ID</label>
                        <p className="text-sm font-mono text-blue-600 mt-1">{userData.display_id || 'N/A'}</p>
                      </div>
                      
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <label className="text-xs font-semibold text-gray-500 uppercase">Name</label>
                        <p className="text-sm font-semibold text-gray-800 mt-1">{userData.name || 'N/A'}</p>
                      </div>
                      
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <label className="text-xs font-semibold text-gray-500 uppercase">Email</label>
                        <p className="text-sm text-gray-800 mt-1">{userData.email || 'N/A'}</p>
                      </div>
                      
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <label className="text-xs font-semibold text-gray-500 uppercase">Phone</label>
                        <p className="text-sm text-gray-800 mt-1">{userData.phone || 'N/A'}</p>
                      </div>
                      
                      {/* KYC Status */}
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <label className="text-xs font-semibold text-gray-500 uppercase">KYC Status</label>
                        <div className="mt-1">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            userData.kyc_status === 'approved' ? 'bg-green-100 text-green-700' :
                            userData.kyc_status === 'submitted' ? 'bg-yellow-100 text-yellow-700' :
                            userData.kyc_status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {userData.kyc_status ? userData.kyc_status.charAt(0).toUpperCase() + userData.kyc_status.slice(1) : 'Pending'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Account Status */}
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <label className="text-xs font-semibold text-gray-500 uppercase">Account Status</label>
                        <div className="mt-1">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            userData.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {userData.status ? userData.status.charAt(0).toUpperCase() + userData.status.slice(1) : 'N/A'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Registration Date */}
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <label className="text-xs font-semibold text-gray-500 uppercase">Registration Date</label>
                        <p className="text-sm text-gray-800 mt-1">
                          {userData.created_at ? new Date(userData.created_at).toLocaleString('en-IN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : 'N/A'}
                        </p>
                      </div>
                      
                      {/* Last Updated */}
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <label className="text-xs font-semibold text-gray-500 uppercase">Last Updated</label>
                        <p className="text-sm text-gray-800 mt-1">
                          {userData.updated_at ? new Date(userData.updated_at).toLocaleString('en-IN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : 'N/A'}
                        </p>
                      </div>
                      
                      {/* Sponsor/Referrer Info */}
                      {userData.referrer_user_id && (
                        <>
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <label className="text-xs font-semibold text-gray-500 uppercase">Sponsor ID</label>
                            <p className="text-sm font-mono text-blue-600 mt-1">{userData.referrer_display_id || 'N/A'}</p>
                          </div>
                          
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <label className="text-xs font-semibold text-gray-500 uppercase">Sponsor Name</label>
                            <p className="text-sm text-gray-800 mt-1">{userData.referrer_name || 'N/A'}</p>
                          </div>
                        </>
                      )}
                      
                      {/* Additional Profile Info */}
                      {userData.address && (
                        <div className="bg-gray-50 p-4 rounded-lg md:col-span-2">
                          <label className="text-xs font-semibold text-gray-500 uppercase">Address</label>
                          <p className="text-sm text-gray-800 mt-1">
                            {userData.address}
                            {userData.city && `, ${userData.city}`}
                            {userData.state && `, ${userData.state}`}
                            {userData.pincode && ` - ${userData.pincode}`}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No user data available
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'business' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-800">Business Overview</h3>
                    
                    {/* Date Filter */}
                    <div className="flex items-center gap-2">
                      <select
                        value={businessDateFilter}
                        onChange={(e) => setBusinessDateFilter(e.target.value as any)}
                        className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Time</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                        <option value="90d">Last 90 Days</option>
                        <option value="custom">Custom Range</option>
                      </select>
                      
                      {businessDateFilter === 'custom' && (
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={businessCustomStartDate}
                            onChange={(e) => setBusinessCustomStartDate(e.target.value)}
                            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-gray-500 text-sm">to</span>
                          <input
                            type="date"
                            value={businessCustomEndDate}
                            onChange={(e) => setBusinessCustomEndDate(e.target.value)}
                            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {userData ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Total Investment */}
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                          <label className="text-xs font-semibold text-blue-600 uppercase">Total Investment</label>
                          <p className="text-2xl font-bold text-blue-800 mt-2">
                            ₹{userData.total_investment?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                          </p>
                        </div>
                        
                        {/* Active Packages */}
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                          <label className="text-xs font-semibold text-green-600 uppercase">Active Packages</label>
                          <p className="text-2xl font-bold text-green-800 mt-2">
                            {userData.total_active_packages || 0}
                          </p>
                        </div>
                        
                        {/* Business Volume */}
                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                          <label className="text-xs font-semibold text-purple-600 uppercase">
                            Business Volume
                            {businessDateFilter !== 'all' && (
                              <span className="text-xs text-purple-500 ml-1">(Filtered)</span>
                            )}
                          </label>
                          {businessLoading ? (
                            <div className="flex items-center gap-2 mt-2">
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
                              <span className="text-sm text-gray-600">Loading...</span>
                            </div>
                          ) : (
                            <p className="text-2xl font-bold text-purple-800 mt-2">
                              ₹{businessData?.direct_business?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || userData.total_business_volume?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || userData.total_investment?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                            </p>
                          )}
                        </div>
                      
                      {/* Main Wallet Balance */}
                      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                        <label className="text-xs font-semibold text-yellow-600 uppercase">Main Wallet</label>
                        <p className="text-2xl font-bold text-yellow-800 mt-2">
                          ₹{userData.wallet_balance?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                        </p>
                      </div>
                      
                      {/* Total Purchases */}
                      <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                        <label className="text-xs font-semibold text-indigo-600 uppercase">Total Purchases</label>
                        <p className="text-2xl font-bold text-indigo-800 mt-2">
                          {userData.total_purchases || 0}
                        </p>
                      </div>
                      
                      {/* Total Commissions */}
                      <div className="bg-pink-50 p-4 rounded-lg border border-pink-200">
                        <label className="text-xs font-semibold text-pink-600 uppercase">Total Commissions</label>
                        <p className="text-2xl font-bold text-pink-800 mt-2">
                          ₹{userData.total_commissions?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                        </p>
                      </div>
                      </div>
                      
                      {/* Business Breakdown with Date Filter */}
                      {businessData && businessDateFilter !== 'all' && (
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">
                            Business Breakdown ({businessDateFilter === 'custom' ? `${businessCustomStartDate} to ${businessCustomEndDate}` : businessDateFilter === '7d' ? 'Last 7 Days' : businessDateFilter === '30d' ? 'Last 30 Days' : 'Last 90 Days'})
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                              <label className="text-xs font-semibold text-orange-600 uppercase">Direct Business</label>
                              <p className="text-xl font-bold text-orange-800 mt-1">
                                ₹{businessData.direct_business?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                              </p>
                              <p className="text-xs text-orange-600 mt-1">User's own purchases</p>
                            </div>
                            
                            <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                              <label className="text-xs font-semibold text-indigo-600 uppercase">Total Business Volume</label>
                              <p className="text-xl font-bold text-indigo-800 mt-1">
                                ₹{businessData.total_business_volume?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                              </p>
                              <p className="text-xs text-indigo-600 mt-1">Direct + Team Business</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No business data available
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'team' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-800">Team & Network</h3>
                    
                    {/* Date Filter */}
                    <div className="flex items-center gap-2">
                      <select
                        value={teamDateFilter}
                        onChange={(e) => setTeamDateFilter(e.target.value as any)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Time</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                        <option value="90d">Last 90 Days</option>
                        <option value="custom">Custom Range</option>
                      </select>
                      
                      {teamDateFilter === 'custom' && (
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={teamCustomStartDate}
                            onChange={(e) => setTeamCustomStartDate(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-gray-500">to</span>
                          <input
                            type="date"
                            value={teamCustomEndDate}
                            onChange={(e) => setTeamCustomEndDate(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {userData ? (
                    <div className="space-y-6">
                      {/* Team Statistics */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                          <label className="text-xs font-semibold text-blue-600 uppercase">Direct Referrals</label>
                          <p className="text-2xl font-bold text-blue-800 mt-2">
                            {userData.direct_referrals || 0}
                          </p>
                        </div>
                        
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                          <label className="text-xs font-semibold text-green-600 uppercase">Total Team Size</label>
                          <p className="text-2xl font-bold text-green-800 mt-2">
                            {userData.total_team_size || 0}
                          </p>
                        </div>
                        
                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                          <label className="text-xs font-semibold text-purple-600 uppercase">
                            Team Business Volume
                            {teamDateFilter !== 'all' && (
                              <span className="text-xs text-purple-500 ml-1">(Filtered)</span>
                            )}
                          </label>
                          {teamBusinessLoading ? (
                            <div className="flex items-center gap-2 mt-2">
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
                              <span className="text-sm text-gray-600">Loading...</span>
                            </div>
                          ) : (
                            <p className="text-2xl font-bold text-purple-800 mt-2">
                              ₹{teamBusinessData?.total_business_volume?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || userData.total_business_volume?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Business Breakdown */}
                      {teamBusinessData && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                            <label className="text-xs font-semibold text-orange-600 uppercase">Direct Business</label>
                            <p className="text-xl font-bold text-orange-800 mt-2">
                              ₹{teamBusinessData.direct_business?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                            </p>
                            <p className="text-xs text-orange-600 mt-1">User's own purchases</p>
                          </div>
                          
                          <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                            <label className="text-xs font-semibold text-indigo-600 uppercase">Team Business</label>
                            <p className="text-xl font-bold text-indigo-800 mt-2">
                              ₹{teamBusinessData.team_business?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                            </p>
                            <p className="text-xs text-indigo-600 mt-1">Downline purchases</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Team Structure Info */}
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Team Structure</h4>
                        <div className="space-y-2 text-sm text-gray-600">
                          <p>• Direct Referrals: <span className="font-semibold text-gray-800">{userData.direct_referrals || 0}</span> users</p>
                          <p>• Total Team Members: <span className="font-semibold text-gray-800">{userData.total_team_size || 0}</span> users (including all levels)</p>
                          <p className="text-xs text-gray-500 mt-3">Note: Detailed team tree view will be available in future updates</p>
                        </div>
                      </div>
                      
                      {/* Sponsor Info */}
                      {userData.referrer_user_id && (
                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                          <h4 className="text-sm font-semibold text-yellow-700 mb-2">Sponsor Information</h4>
                          <div className="space-y-1 text-sm">
                            <p><span className="font-semibold">Sponsor ID:</span> <span className="font-mono text-blue-600">{userData.referrer_display_id || 'N/A'}</span></p>
                            {userData.referrer_name && (
                              <p><span className="font-semibold">Sponsor Name:</span> {userData.referrer_name}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No team data available
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'income' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-800">Income & Commissions</h3>
                    
                    {/* Date Filter */}
                    <div className="flex items-center gap-2">
                      <select
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value as any)}
                        className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                        <option value="90d">Last 90 days</option>
                        <option value="all">All Time</option>
                        <option value="custom">Custom Range</option>
                      </select>
                      
                      {dateFilter === 'custom' && (
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            className="px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                            placeholder="Start Date"
                          />
                          <span className="text-gray-500">to</span>
                          <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            className="px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                            placeholder="End Date"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {incomeLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="ml-3 text-gray-600">Loading income data...</span>
                    </div>
                  ) : incomeData ? (
                    <div className="space-y-4">
                      {/* Total Earnings */}
                      <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 rounded-lg text-white">
                        <label className="text-xs font-semibold uppercase opacity-90">Total Earnings</label>
                        <p className="text-3xl font-bold mt-2">
                          ₹{incomeData.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      
                      {/* Commission Breakdown */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                          <label className="text-xs font-semibold text-green-600 uppercase">SELF Income</label>
                          <p className="text-xl font-bold text-green-800 mt-2">
                            ₹{incomeData.self.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                          <label className="text-xs font-semibold text-blue-600 uppercase">Direct Income</label>
                          <p className="text-xl font-bold text-blue-800 mt-2">
                            ₹{incomeData.direct.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        
                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                          <label className="text-xs font-semibold text-purple-600 uppercase">Team Income</label>
                          <p className="text-xl font-bold text-purple-800 mt-2">
                            ₹{incomeData.team.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        
                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                          <label className="text-xs font-semibold text-yellow-600 uppercase">Spot Commission</label>
                          <p className="text-xl font-bold text-yellow-800 mt-2">
                            ₹{incomeData.spot.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        
                        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                          <label className="text-xs font-semibold text-orange-600 uppercase">Global Income</label>
                          <p className="text-xl font-bold text-orange-800 mt-2">
                            ₹{incomeData.global.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                      
                      {/* All Time Total (from userData) */}
                      {userData?.total_commissions && (
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <label className="text-xs font-semibold text-gray-600 uppercase">All Time Total Commissions</label>
                          <p className="text-xl font-bold text-gray-800 mt-2">
                            ₹{userData.total_commissions.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No income data available
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'packages' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800">Package Details</h3>
                  
                  {packagesLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="ml-3 text-gray-600">Loading packages...</span>
                    </div>
                  ) : packages.length > 0 ? (
                    <div className="space-y-4">
                      {/* Summary Stats */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                          <label className="text-xs font-semibold text-blue-600 uppercase">Total Packages</label>
                          <p className="text-2xl font-bold text-blue-800 mt-2">{packages.length}</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                          <label className="text-xs font-semibold text-green-600 uppercase">Active Packages</label>
                          <p className="text-2xl font-bold text-green-800 mt-2">
                            {packages.filter(p => p.is_active).length}
                          </p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                          <label className="text-xs font-semibold text-purple-600 uppercase">Total Investment</label>
                          <p className="text-2xl font-bold text-purple-800 mt-2">
                            ₹{packages.reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                      
                      {/* Package List */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-gray-700">Package History</h4>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {packages.map((pkg) => {
                            const target2x = pkg.amount * 2
                            const progressPercent = pkg.income ? Math.min((pkg.income / target2x) * 100, 100) : 0
                            const isActive = pkg.is_active
                            
                            return (
                              <div key={pkg.id} className={`border rounded-lg p-4 ${isActive ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <h5 className="font-semibold text-gray-800">{pkg.package_name || `Package #${pkg.package_id}`}</h5>
                                    <p className="text-xs text-gray-500">ID: {pkg.id}</p>
                                  </div>
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                  }`}>
                                    {isActive ? 'Active' : pkg.status || 'Inactive'}
                                  </span>
                                </div>
                                
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3 text-sm">
                                  <div>
                                    <label className="text-xs text-gray-500">Amount</label>
                                    <p className="font-semibold text-gray-800">₹{pkg.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-500">Income</label>
                                    <p className="font-semibold text-green-600">₹{pkg.income?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</p>
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-500">Purchased</label>
                                    <p className="font-semibold text-gray-800">
                                      {pkg.purchased_at ? new Date(pkg.purchased_at).toLocaleDateString('en-IN') : 'N/A'}
                                    </p>
                                  </div>
                                </div>
                                
                                {/* Global IDs Info Section - Always show */}
                                <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                  <label className="text-xs font-semibold text-blue-600 uppercase mb-2 block">Global IDs Info</label>
                                  {pkg.global_ids_info ? (
                                    <>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                        <div>
                                          <label className="text-xs text-gray-500">Package Cap</label>
                                          <p className="font-semibold text-gray-800">{pkg.global_ids_info.package_cap || 0}</p>
                                        </div>
                                        <div>
                                          <label className="text-xs text-gray-500">Used IDs</label>
                                          <p className="font-semibold text-orange-600">{pkg.global_ids_info.used_ids || 0}</p>
                                        </div>
                                        <div>
                                          <label className="text-xs text-gray-500">Remaining IDs</label>
                                          <p className="font-semibold text-green-600">{pkg.global_ids_info.remaining_ids !== undefined ? pkg.global_ids_info.remaining_ids : 'N/A'}</p>
                                        </div>
                                        <div>
                                          <label className="text-xs text-gray-500">Status</label>
                                          {pkg.global_ids_info.is_cap_reached ? (
                                            <p className="font-semibold text-red-600">Cap Reached</p>
                                          ) : (
                                            <p className="font-semibold text-green-600">Active</p>
                                          )}
                                        </div>
                                      </div>
                                      {pkg.global_ids_info.new_ids_after_cap !== null && pkg.global_ids_info.new_ids_after_cap !== undefined && (
                                        <div className="mt-2 pt-2 border-t border-blue-300">
                                          <p className="text-xs text-gray-600">
                                            <span className="font-semibold">New IDs After Cap:</span> {pkg.global_ids_info.new_ids_after_cap}
                                          </p>
                                        </div>
                                      )}
                                      {pkg.global_ids_info.total_global_users !== undefined && (
                                        <div className="mt-1">
                                          <p className="text-xs text-gray-600">
                                            <span className="font-semibold">Total Global Users:</span> {pkg.global_ids_info.total_global_users}
                                          </p>
                                        </div>
                                      )}
                                      <div className="mt-1">
                                        <p className="text-xs font-semibold text-red-600">
                                          Today inactive: {pkg.global_ids_info.inactive_global_contributors ?? 0}
                                        </p>
                                      </div>
                                    </>
                                  ) : (
                                    <p className="text-sm text-gray-500">No Global IDs information available</p>
                                  )}
                                </div>
                                
                                {/* Progress Bar */}
                                {isActive && (
                                  <div className="mt-3">
                                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                                      <span>2x Progress</span>
                                      <span>{progressPercent.toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                      <div
                                        className="bg-blue-600 h-2 rounded-full transition-all"
                                        style={{ width: `${progressPercent}%` }}
                                      ></div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                      ₹{pkg.income?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} / ₹{target2x.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No packages found for this user
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'levels' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold mb-1 text-gray-800">Levels & Eligibility</h3>
                  <p className="text-sm text-gray-500 mb-4">Level-wise eligibility, commissions and leg-wise business for this user.</p>
                  
                  {levelsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="ml-3 text-gray-600">Loading levels data...</span>
                    </div>
                  ) : levelsData.length > 0 ? (
                    <div className="space-y-6">
                      {/* At a glance - like Path Rank: user konse level par hai, kitne leg, total business */}
                      {(() => {
                        const eligibleLevels = levelsData.filter(l => l.eligible)
                        const highestLevel = eligibleLevels.length > 0 ? Math.max(...eligibleLevels.map(l => l.level)) : 0
                        const highestLevelData = levelsData.find(l => l.level === highestLevel)
                        const totalLegBusiness = legsData.reduce((sum, leg) => sum + (leg.leg_business_volume || 0), 0)
                        const level1Req = levelsData.find(l => l.level === 1)?.business_requirement as { required_leg_count?: number; required_leg_min_amount?: number; total_business?: number } | undefined
                        const minPerLeg = level1Req?.required_leg_min_amount ?? 7500
                        const requiredTotal = level1Req?.total_business ?? 215000
                        const requiredLegCount = level1Req?.required_leg_count ?? 4
                        const legsMeetingMin = legsData.filter(leg => (leg.leg_business_volume || 0) >= minPerLeg).length
                        return (
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-slate-700 mb-3">Summary (like Path Rank)</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-slate-500">User is at level:</span>
                                <p className="font-bold text-slate-800 mt-0.5">
                                  Level {highestLevel}
                                  {highestLevelData?.title ? ` – ${highestLevelData.title}` : ''}
                                </p>
                              </div>
                              <div>
                                <span className="text-slate-500">Total direct legs:</span>
                                <p className="font-bold text-slate-800 mt-0.5">{legsData.length}</p>
                                {legsData.length > 0 && (
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    {legsMeetingMin} leg(s) with ≥ ₹{minPerLeg.toLocaleString('en-IN')} (Level 1: need {requiredLegCount} legs, total ≥ ₹{requiredTotal.toLocaleString('en-IN')})
                                  </p>
                                )}
                              </div>
                              <div>
                                <span className="text-slate-500">Total business (all legs):</span>
                                <p className="font-bold text-slate-800 mt-0.5">
                                  ₹{totalLegBusiness.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      })()}
                      
                      {/* Summary - same clear style as in design */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                          <label className="text-xs font-semibold text-blue-600 uppercase tracking-wide">TOTAL LEVELS</label>
                          <p className="text-2xl font-bold text-blue-800 mt-2">{levelsData.length}</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                          <label className="text-xs font-semibold text-green-600 uppercase tracking-wide">ELIGIBLE LEVELS</label>
                          <p className="text-2xl font-bold text-green-800 mt-2">
                            {levelsData.filter(l => l.eligible).length}
                          </p>
                        </div>
                        <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                          <label className="text-xs font-semibold text-amber-700 uppercase tracking-wide">HIGHEST LEVEL</label>
                          <p className="text-2xl font-bold text-amber-800 mt-2">
                            {(() => {
                              const eligibleLevels = levelsData.filter(l => l.eligible).map(l => l.level)
                              return eligibleLevels.length > 0 ? Math.max(...eligibleLevels) : 0
                            })()}
                          </p>
                        </div>
                      </div>
                      
                      {/* Legs (Direct Referrals) Business - so admin sees which legs have how much business */}
                      {legsLoading ? (
                        <div className="flex items-center gap-2 py-4 text-gray-500 text-sm">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          Loading legs...
                        </div>
                      ) : legsData.length > 0 ? (
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-gray-700">Legs (Direct Referrals) Business</h4>
                          {(() => {
                            const level1Req = levelsData.find(l => l.level === 1)?.business_requirement as { required_leg_count?: number; required_leg_min_amount?: number; total_business?: number } | undefined
                            const minPerLeg = level1Req?.required_leg_min_amount ?? 7500
                            const requiredTotal = level1Req?.total_business ?? 215000
                            const requiredLegCount = level1Req?.required_leg_count ?? 4
                            return (
                              <p className="text-xs text-gray-500 mb-2">
                                {legsData.length} direct leg(s). Total business from legs: ₹{legsData.reduce((s, l) => s + (l.leg_business_volume || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}. Level 1 requires {requiredLegCount} legs (min ₹{minPerLeg.toLocaleString('en-IN')} each) and total business ≥ ₹{requiredTotal.toLocaleString('en-IN')}.
                              </p>
                            )
                          })()}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                            {legsData.map((leg, index) => {
                              const level1Req = levelsData.find(l => l.level === 1)?.business_requirement as { required_leg_min_amount?: number } | undefined
                              const minPerLeg = level1Req?.required_leg_min_amount ?? 7500
                              const vol = leg.leg_business_volume || 0
                              const meetsMinPerLeg = vol >= minPerLeg
                              return (
                                <div
                                  key={leg.leg_user_id}
                                  className={`border rounded-lg p-3 ${
                                    meetsMinPerLeg ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'
                                  }`}
                                >
                                  <div className="flex justify-between items-start gap-2">
                                    <div className="min-w-0">
                                      <p className="text-xs font-medium text-gray-500">Leg {index + 1}</p>
                                      <p className="font-semibold text-gray-800 truncate" title={leg.leg_user_name || undefined}>
                                        {leg.leg_user_name || leg.leg_user_display_id || `User ${leg.leg_user_id}`}
                                      </p>
                                      {leg.leg_user_display_id && (
                                        <p className="text-xs font-mono text-blue-600 mt-0.5">{leg.leg_user_display_id}</p>
                                      )}
                                    </div>
                                    <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-semibold ${meetsMinPerLeg ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                      {meetsMinPerLeg ? `≥ ₹${(minPerLeg / 1000).toFixed(1)}k` : `< ₹${(minPerLeg / 1000).toFixed(1)}k`}
                                    </span>
                                  </div>
                                  <p className="text-sm font-bold text-gray-800 mt-2">
                                    ₹{vol.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                  </p>
                                  <p className="text-xs text-gray-500">Total business in this leg</p>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No levels data available
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'transactions' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-800">Transaction History</h3>
                    
                    {/* Date Filter */}
                    <div className="flex items-center gap-2">
                      <select
                        value={transactionsDateFilter}
                        onChange={(e) => setTransactionsDateFilter(e.target.value as any)}
                        className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                        <option value="90d">Last 90 days</option>
                        <option value="all">All Time</option>
                        <option value="custom">Custom Range</option>
                      </select>
                      
                      {transactionsDateFilter === 'custom' && (
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={transactionsCustomStartDate}
                            onChange={(e) => setTransactionsCustomStartDate(e.target.value)}
                            className="px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                            placeholder="Start Date"
                          />
                          <span className="text-gray-500">to</span>
                          <input
                            type="date"
                            value={transactionsCustomEndDate}
                            onChange={(e) => setTransactionsCustomEndDate(e.target.value)}
                            className="px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                            placeholder="End Date"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {transactionsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="ml-3 text-gray-600">Loading transactions...</span>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Summary Stats */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                          <label className="text-xs font-semibold text-blue-600 uppercase">Ledger Entries</label>
                          <p className="text-2xl font-bold text-blue-800 mt-2">{ledgerEntries.length}</p>
                        </div>
                        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                          <label className="text-xs font-semibold text-red-600 uppercase">Withdrawals</label>
                          <p className="text-2xl font-bold text-red-800 mt-2">{withdrawals.length}</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                          <label className="text-xs font-semibold text-green-600 uppercase">P2P Transfers</label>
                          <p className="text-2xl font-bold text-green-800 mt-2">{walletTransfers.length}</p>
                        </div>
                      </div>
                      
                      {/* Ledger Entries */}
                      {ledgerEntries.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-gray-700">Wallet Transactions (Ledger)</h4>
                          <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                            {ledgerEntries.slice(0, 10).map((entry) => (
                              <div key={entry.id} className="bg-white p-3 rounded border border-gray-200 text-sm">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-semibold text-gray-800">
                                      {entry.commission_type}
                                      {entry.source_name && (
                                        <span className="text-gray-600 text-xs ml-2">from {entry.source_name}</span>
                                      )}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {new Date(entry.credited_at).toLocaleString('en-IN')}
                                    </p>
                                  </div>
                                  <span className={`font-bold ${
                                    entry.amount >= 0 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {entry.amount >= 0 ? '+' : ''}₹{entry.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </div>
                            ))}
                            {ledgerEntries.length > 10 && (
                              <p className="text-xs text-gray-500 text-center mt-2">
                                Showing 10 of {ledgerEntries.length} entries
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Withdrawals */}
                      {withdrawals.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-gray-700">Withdrawal History</h4>
                          <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                            {withdrawals.slice(0, 10).map((withdrawal) => (
                              <div key={withdrawal.id} className="bg-white p-3 rounded border border-gray-200 text-sm">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-semibold text-gray-800">
                                      {withdrawal.withdraw_type} Withdrawal
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {new Date(withdrawal.created_at).toLocaleString('en-IN')}
                                    </p>
                                    <p className="text-xs text-gray-600 mt-1">
                                      Status: <span className={`font-semibold ${
                                        withdrawal.status === 'approved' ? 'text-green-600' :
                                        withdrawal.status === 'rejected' ? 'text-red-600' :
                                        'text-yellow-600'
                                      }`}>{withdrawal.status}</span>
                                    </p>
                                  </div>
                                  <span className="font-bold text-red-600">
                                    -₹{withdrawal.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </div>
                            ))}
                            {withdrawals.length > 10 && (
                              <p className="text-xs text-gray-500 text-center mt-2">
                                Showing 10 of {withdrawals.length} withdrawals
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* P2P Transfers */}
                      {walletTransfers.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-gray-700">P2P Transfers</h4>
                          <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                            {walletTransfers.slice(0, 10).map((transfer) => (
                              <div key={transfer.id} className="bg-white p-3 rounded border border-gray-200 text-sm">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-semibold text-gray-800">
                                      {transfer.from_user_id === userId ? 'Sent to' : 'Received from'}{' '}
                                      {transfer.from_user_id === userId 
                                        ? transfer.to_user_name || transfer.to_user_display_id 
                                        : transfer.from_user_name || transfer.from_user_display_id}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {new Date(transfer.created_at).toLocaleString('en-IN')}
                                    </p>
                                  </div>
                                  <span className={`font-bold ${
                                    transfer.from_user_id === userId ? 'text-red-600' : 'text-green-600'
                                  }`}>
                                    {transfer.from_user_id === userId ? '-' : '+'}₹{transfer.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </div>
                            ))}
                            {walletTransfers.length > 10 && (
                              <p className="text-xs text-gray-500 text-center mt-2">
                                Showing 10 of {walletTransfers.length} transfers
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {ledgerEntries.length === 0 && withdrawals.length === 0 && walletTransfers.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          No transactions found for the selected period
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}

