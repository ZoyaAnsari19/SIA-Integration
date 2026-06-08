'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import {
  getAdminPreQuestions,
  createPreQuestion,
  updatePreQuestion,
  deletePreQuestion,
  type PreQuestion,
} from '@/lib/api/support'
import { getMyPermissions } from '@/lib/api/sub-admins'

export default function SupportPreQuestionsPage() {
  const [items, setItems] = useState<PreQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adminRole, setAdminRole] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formQuestion, setFormQuestion] = useState('')
  const [formCategory, setFormCategory] = useState('general')
  const [formSortOrder, setFormSortOrder] = useState(0)
  const [formActive, setFormActive] = useState(true)
  const [formFeeRuleCode, setFormFeeRuleCode] = useState<string>('')
  const [submitLoading, setSubmitLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const fetchList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getAdminPreQuestions()
      const list = Array.isArray(res.items) ? res.items : Array.isArray((res as { data?: { items?: PreQuestion[] } }).data?.items) ? (res as unknown as { data: { items: PreQuestion[] } }).data.items : []
      setItems(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pre-questions')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  useEffect(() => {
    getMyPermissions()
      .then(({ role }) => setAdminRole(role))
      .catch(() => setAdminRole(''))
  }, [])

  const FEE_RULE_OPTIONS: { value: string; label: string }[] = [
    { value: '', label: 'No topic fee (2nd+ ticket uses general support fee)' },
    { value: 'GENERAL_PROBLEM', label: 'General Problem (₹30)' },
    { value: 'COMMISSION_ISSUE', label: 'Commission Issue (₹30)' },
    { value: 'COMMISSION_ANALYSIS', label: 'Commission Analysis & Issue (₹100)' },
    { value: 'NAME_CORRECTION_MINOR', label: 'Name Correction – Spelling (₹30)' },
    { value: 'EMAIL_CORRECTION', label: 'Email Correction (₹30)' },
    { value: 'MOBILE_CORRECTION_MINOR', label: 'Mobile Correction – Digit (₹30)' },
    { value: 'FULL_NAME_CHANGE', label: 'Full Name Change (₹100)' },
    { value: 'FULL_MOBILE_CHANGE', label: 'Full Mobile Number Change (₹100)' },
    { value: 'INFORMATION_PROBLEM', label: 'Information Problem (₹21)' },
    { value: 'CHEQUE_RETURN_ISSUE', label: 'Cheque Return Issue (₹21)' },
    { value: 'NAME_CHANGE', label: 'Name change (legacy)' },
    { value: 'NUMBER_CHANGE', label: 'Number change (legacy)' },
    { value: 'EMAIL_CHANGE', label: 'Email change (legacy)' },
  ]

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormQuestion('')
    setFormCategory('general')
    setFormSortOrder(items.length)
    setFormActive(true)
    setFormFeeRuleCode('')
    setFormError(null)
  }

  const handleEdit = (q: PreQuestion) => {
    setEditingId(q.id)
    setFormQuestion(q.question)
    setFormCategory(q.category ?? 'general')
    setFormSortOrder(q.sort_order ?? 0)
    setFormActive(q.is_active ?? true)
    setFormFeeRuleCode(q.fee_rule_code ?? '')
    setShowForm(true)
    setFormError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const question = formQuestion.trim()
    if (!question) {
      setFormError('Question is required')
      return
    }
    setSubmitLoading(true)
    try {
      const feeRuleCode = formFeeRuleCode.trim() || null
      if (editingId != null) {
        await updatePreQuestion(editingId, {
          question,
          category: formCategory || 'general',
          sort_order: formSortOrder,
          is_active: formActive,
          fee_rule_code: feeRuleCode,
        })
      } else {
        await createPreQuestion({
          question,
          category: formCategory || 'general',
          sort_order: formSortOrder,
          fee_rule_code: feeRuleCode,
        })
      }
      resetForm()
      setSuccessMessage(editingId != null ? 'Pre-question updated.' : 'Pre-question added.')
      setTimeout(() => setSuccessMessage(null), 3000)
      await fetchList()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this pre-question? It will no longer appear in the user ticket form.')) return
    try {
      await deletePreQuestion(id)
      await fetchList()
      if (editingId === id) resetForm()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  if (adminRole !== '' && adminRole !== 'SUPER_ADMIN') {
    return (
      <div className="space-y-4">
        <Card title="Pre-questions">
          <p className="text-slate-600">Only Super Admin can manage pre-questions.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card title="Support Pre-questions">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 mb-4 text-sm text-slate-700 space-y-2">
          <p className="font-medium text-slate-800">Yahan kya karna hai?</p>
          <p>
            <strong>Pre-questions</strong> wo topics hain jo <strong>user</strong> ko “New support ticket” banate waqt <strong>Topic</strong> dropdown mein dikhte hain. User inmein se koi ek choose karke apna issue batata hai.
          </p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li><strong>Add:</strong> “+ Add pre-question” dabayein, phir <strong>Question / Topic text</strong> mein woh topic likhein jo users ko dikhana hai (jaise “Payment issue”, “Account locked”).</li>
            <li><strong>Category:</strong> Optional — topic ko group karne ke liye (e.g. <code className="bg-white px-1 rounded">general</code>, <code className="bg-white px-1 rounded">billing</code>).</li>
            <li><strong>Sort order:</strong> Number chhota = list mein upar. Jis order mein chahiye waise number dein (0, 1, 2…).</li>
          </ul>
          <p className="text-slate-600 pt-1">Sirf Super Admin pre-questions add/edit/delete kar sakta hai.</p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm mb-4">{error}</div>
        )}

        {successMessage && (
          <div className="rounded-lg bg-green-50 text-green-700 px-4 py-3 text-sm mb-4">{successMessage}</div>
        )}
        {formError && (
          <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm mb-4">{formError}</div>
        )}

        {!showForm ? (
          <button
            type="button"
            onClick={() => {
              setShowForm(true)
              setEditingId(null)
              setFormQuestion('')
              setFormCategory('general')
              setFormSortOrder(items.length)
              setFormActive(true)
              setFormFeeRuleCode('')
            }}
            className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            + Add pre-question
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="mb-6 p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-3 max-w-xl">
            <h3 className="font-medium text-slate-800">{editingId != null ? 'Edit' : 'New'} pre-question</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Question / Topic text *</label>
              <input
                type="text"
                value={formQuestion}
                onChange={(e) => setFormQuestion(e.target.value)}
                placeholder="e.g. Payment issue"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <input
                type="text"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                placeholder="general"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sort order</label>
              <input
                type="number"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Topic fee (wallet deduction)</label>
              <select
                value={formFeeRuleCode}
                onChange={(e) => setFormFeeRuleCode(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
              >
                {FEE_RULE_OPTIONS.map((opt) => (
                  <option key={opt.value || 'none'} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">If set, user is charged this topic fee when creating a ticket. Set amounts in Master → Fee rules.</p>
            </div>
            {editingId != null && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="formActive"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <label htmlFor="formActive" className="text-sm text-slate-700">Active (show in user form)</label>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitLoading}
                className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {submitLoading ? 'Saving...' : editingId != null ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="py-8 text-center text-slate-500">Loading...</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-slate-500">No pre-questions yet. Add one above.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="pb-2 pr-4 text-sm font-semibold text-slate-600">Order</th>
                  <th className="pb-2 pr-4 text-sm font-semibold text-slate-600">Question</th>
                  <th className="pb-2 pr-4 text-sm font-semibold text-slate-600">Category</th>
                  <th className="pb-2 pr-4 text-sm font-semibold text-slate-600">Topic fee</th>
                  <th className="pb-2 pr-4 text-sm font-semibold text-slate-600">Active</th>
                  <th className="pb-2 text-sm font-semibold text-slate-600" />
                </tr>
              </thead>
              <tbody>
                {items.map((q) => (
                  <tr key={q.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 pr-4 text-sm text-slate-600">{q.sort_order}</td>
                    <td className="py-3 pr-4 text-sm font-medium text-slate-900">{q.question}</td>
                    <td className="py-3 pr-4 text-sm text-slate-600">{q.category ?? '—'}</td>
                    <td className="py-3 pr-4 text-sm text-slate-600">{q.fee_rule_code ?? '—'}</td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${q.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                        {q.is_active ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => handleEdit(q)}
                        className="text-blue-600 font-medium hover:underline mr-3"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(q.id)}
                        className="text-red-600 font-medium hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
