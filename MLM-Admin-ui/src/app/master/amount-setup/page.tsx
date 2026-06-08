"use client"

import React, { useCallback, useEffect, useState } from 'react'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import { getWithdrawalTransferRules, updateWithdrawalTransferRules, type WithdrawalTransferRules, type UpdateWithdrawalTransferRulesRequest } from '../../../lib/api/withdrawalTransferRules'
import { exportToCsv } from '../../../lib/export'

export default function AmountSetupPage() {
  const [rules, setRules] = useState<WithdrawalTransferRules | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<UpdateWithdrawalTransferRulesRequest>({
    admin_charges: undefined,
    min_withdraw: undefined,
    max_withdraw: undefined,
    spot_min_withdraw: undefined,
    spot_team_withdraw_multiplier: undefined,
    min_transfer_amt: undefined,
    max_transfer_amt: undefined,
    transfer_amt_tax: undefined,
    withdrawal_enabled: undefined,
    is_active: undefined,
  })

  // Fetch rules from API
  const fetchRules = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      console.log('📊 Fetching withdrawal transfer rules...')
      
      const data = await getWithdrawalTransferRules()
      console.log('✅ Rules fetched:', data)
      setRules(data)
      
      // Initialize form data with current values
      setFormData({
        admin_charges: data.admin_charges,
        min_withdraw: data.min_withdraw,
        max_withdraw: data.max_withdraw,
        spot_min_withdraw: data.spot_min_withdraw,
        spot_team_withdraw_multiplier: data.spot_team_withdraw_multiplier,
        min_transfer_amt: data.min_transfer_amt,
        max_transfer_amt: data.max_transfer_amt,
        transfer_amt_tax: data.transfer_amt_tax,
        withdrawal_enabled: data.withdrawal_enabled,
        is_active: data.is_active,
      })
    } catch (err: any) {
      console.error('❌ Error fetching rules:', err)
      setError(err.message || 'Failed to load withdrawal transfer rules')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  const handleEdit = () => {
    if (rules) {
      setFormData({
        admin_charges: rules.admin_charges,
        min_withdraw: rules.min_withdraw,
        max_withdraw: rules.max_withdraw,
        spot_min_withdraw: rules.spot_min_withdraw,
        spot_team_withdraw_multiplier: rules.spot_team_withdraw_multiplier,
        min_transfer_amt: rules.min_transfer_amt,
        max_transfer_amt: rules.max_transfer_amt,
        transfer_amt_tax: rules.transfer_amt_tax,
        withdrawal_enabled: rules.withdrawal_enabled,
        is_active: rules.is_active,
      })
      setIsModalOpen(true)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setIsSubmitting(true)
      setError(null)
      
      // Filter out undefined values before sending
      const dataToSend: UpdateWithdrawalTransferRulesRequest = {};
      if (formData.admin_charges !== undefined) dataToSend.admin_charges = formData.admin_charges;
      if (formData.min_withdraw !== undefined) dataToSend.min_withdraw = formData.min_withdraw;
      if (formData.max_withdraw !== undefined) dataToSend.max_withdraw = formData.max_withdraw;
      if (formData.spot_min_withdraw !== undefined) dataToSend.spot_min_withdraw = formData.spot_min_withdraw;
      if (formData.spot_team_withdraw_multiplier !== undefined) dataToSend.spot_team_withdraw_multiplier = formData.spot_team_withdraw_multiplier;
      if (formData.min_transfer_amt !== undefined) dataToSend.min_transfer_amt = formData.min_transfer_amt;
      if (formData.max_transfer_amt !== undefined) dataToSend.max_transfer_amt = formData.max_transfer_amt;
      if (formData.transfer_amt_tax !== undefined) dataToSend.transfer_amt_tax = formData.transfer_amt_tax;
      if (formData.withdrawal_enabled !== undefined) dataToSend.withdrawal_enabled = formData.withdrawal_enabled;
      if (formData.is_active !== undefined) dataToSend.is_active = formData.is_active;
      
      console.log('💾 Updating withdrawal transfer rules:', dataToSend)
      
      const updatedRules = await updateWithdrawalTransferRules(dataToSend)
      console.log('✅ Rules updated:', updatedRules)
      
      // Refresh rules from API to ensure we have the latest values
      await fetchRules()
      
      setIsModalOpen(false)
      
      // Show success message
      alert('Withdrawal transfer rules updated successfully!')
    } catch (err: any) {
      console.error('❌ Error updating rules:', err)
      setError(err.message || 'Failed to update withdrawal transfer rules')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleExport = () => {
    if (!rules) {
      alert('No rules data available to export.')
      return
    }
    
    const headers = ['Field', 'Value']
    const data = [
      ['Admin Charges (₹)', rules.admin_charges?.toString() || 'N/A'],
      ['Minimum Withdraw (₹)', rules.min_withdraw?.toString() || 'N/A'],
      ['Maximum Withdraw (₹)', rules.max_withdraw?.toString() || 'N/A'],
      ['Spot Minimum Withdraw (₹)', rules.spot_min_withdraw?.toString() || 'N/A'],
      ['Spot/Team Royalty Withdraw Multiplier (×)', rules.spot_team_withdraw_multiplier?.toString() ?? '10'],
      ['Minimum Transfer Amount (₹)', rules.min_transfer_amt?.toString() || 'N/A'],
      ['Maximum Transfer Amount (₹)', rules.max_transfer_amt?.toString() || 'N/A'],
      ['Transfer Amount Tax (%)', rules.transfer_amt_tax?.toString() || 'N/A'],
      ['Withdrawal Enabled', rules.withdrawal_enabled ? 'Yes' : 'No'],
      ['Status', rules.is_active ? 'Active' : 'Inactive'],
      ['Created At', rules.created_at ? new Date(rules.created_at).toLocaleString('en-IN') : 'N/A'],
      ['Updated At', rules.updated_at ? new Date(rules.updated_at).toLocaleString('en-IN') : 'N/A'],
    ]

    exportToCsv(`withdrawal-transfer-rules-${new Date().toISOString().split('T')[0]}.csv`, headers, data)
  }

  const handlePrint = () => {
    window.print()
  }

  const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return 'No limit'
    return `₹${value.toFixed(2)}`
  }

  const formatPercentage = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return 'N/A'
    return `${value.toFixed(2)}%`
  }

  if (isLoading) {
    return (
      <Card title="Transaction Rules and Limits">
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading withdrawal transfer rules...</p>
          </div>
        </div>
      </Card>
    )
  }

  if (error && !rules) {
    return (
      <Card title="Transaction Rules and Limits">
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 font-semibold mb-2">Error</p>
          <p className="text-red-700">{error}</p>
          <button
            onClick={fetchRules}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Retry
          </button>
        </div>
      </Card>
    )
  }

  return (
    <>
    <Card
      title="Transaction Rules and Limits"
      toolbarRight={
        <>
          <Button variant="outline" size="md" aria-label="Export" onClick={handleExport}>
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

        {rules && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Admin Charge
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Min Withdraw
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Spot Min Withdraw
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Spot/Team × Limit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Min Transfer Amt
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transfer Amt Tax
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Max Transfer Amt
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Withdrawal Enabled
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={handleEdit}
                      className="text-blue-600 hover:text-blue-900 p-1"
                      title="Edit Rules"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {formatCurrency(rules.admin_charges)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {formatCurrency(rules.min_withdraw)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {formatCurrency(rules.spot_min_withdraw)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {(rules.spot_team_withdraw_multiplier ?? 10)}×
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {formatCurrency(rules.min_transfer_amt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {formatPercentage(rules.transfer_amt_tax)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {formatCurrency(rules.max_transfer_amt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      rules.withdrawal_enabled 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {rules.withdrawal_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {rules && (
          <div className="mt-4 text-sm text-gray-500">
            <p>Last updated: {new Date(rules.updated_at).toLocaleString()}</p>
          </div>
        )}
      </Card>

      {/* Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Edit Withdrawal Transfer Rules"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admin Charges (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.admin_charges ?? ''}
                onChange={(e) => setFormData({ ...formData, admin_charges: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Withdraw (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.min_withdraw ?? ''}
                onChange={(e) => setFormData({ ...formData, min_withdraw: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="100.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Withdraw (₹) <span className="text-gray-500 text-xs">(leave empty for no limit)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.max_withdraw ?? ''}
                onChange={(e) => setFormData({ ...formData, max_withdraw: e.target.value ? parseFloat(e.target.value) : null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="No limit"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Spot Minimum Withdraw (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.spot_min_withdraw ?? ''}
                onChange={(e) => setFormData({ ...formData, spot_min_withdraw: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="1000.00"
              />
              <p className="mt-1 text-xs text-gray-500">Minimum withdrawal amount for SPOT wallet</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Spot/Team Royalty Withdraw Multiplier (×)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                step="1"
                value={formData.spot_team_withdraw_multiplier ?? ''}
                onChange={(e) => setFormData({ ...formData, spot_team_withdraw_multiplier: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="10"
              />
              <p className="mt-1 text-xs text-gray-500">Limit = (active package value) × this. e.g. 5 = 5×, 10 = 10×. Range: 1–100.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Transfer Amount (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.min_transfer_amt ?? ''}
                onChange={(e) => setFormData({ ...formData, min_transfer_amt: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="10.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Transfer Amount (₹) <span className="text-gray-500 text-xs">(leave empty for no limit)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.max_transfer_amt ?? ''}
                onChange={(e) => setFormData({ ...formData, max_transfer_amt: e.target.value ? parseFloat(e.target.value) : null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="No limit"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transfer Amount Tax (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.transfer_amt_tax ?? ''}
                onChange={(e) => setFormData({ ...formData, transfer_amt_tax: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
              <p className="mt-1 text-xs text-gray-500">Range: 0-100%</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Withdrawal Mode
              </label>
              <select
                value={formData.withdrawal_enabled ? 'enabled' : 'date-based'}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({
                    ...formData,
                    // enabled  => withdrawals allowed any day
                    // date-based => withdrawals allowed only on scheduled dates (10th, 20th & 30th, 28th in Feb)
                    withdrawal_enabled: value === 'enabled',
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="enabled">Enabled (any date)</option>
                <option value="date-based">Date based (10th, 20th & 30th / 28th Feb)</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Enabled: withdrawals allowed any day. Date based: allowed only on 10th, 20th & 30th of each month (28th in February).
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.is_active !== undefined ? (formData.is_active ? 'true' : 'false') : ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({ 
                    ...formData, 
                    is_active: value === '' ? undefined : value === 'true' 
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Keep current</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Updating...' : 'Update Rules'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
