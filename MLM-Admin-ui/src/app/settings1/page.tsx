"use client"

import React, { useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import { changePassword, sendPasswordChangeOtp, isAuthenticated } from '../../lib/api/auth'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpExpiry, setOtpExpiry] = useState(0)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (otpExpiry <= 0) return
    const timer = setInterval(() => {
      setOtpExpiry((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [otpExpiry])

  // Simple client-side guard: if no auth token/admin flag, send to login
  useEffect(() => {
    if (typeof window === 'undefined') return
    // Use centralized authentication check (supports both localStorage and sessionStorage)
    if (!isAuthenticated()) {
      router.replace('/login')
    }
  }, [router])

  const handleSendOtp = async () => {
    setError(null)
    setIsSendingOtp(true)
    try {
      const result = await sendPasswordChangeOtp()
      setOtpSent(true)
      setOtpExpiry(600)
      setOtp('')
      if (result.email_masked) {
        setSuccess(`OTP sent to ${result.email_masked}`)
        setTimeout(() => setSuccess(null), 4000)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to send OTP. Please try again.')
    } finally {
      setIsSendingOtp(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setError(null)
    setSuccess(null)

    if (!otpSent || !otp || otp.length !== 6) {
      setError('Please request and enter the 6-digit email OTP.')
      return
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all fields.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.')
      return
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.')
      return
    }

    setIsSubmitting(true)
    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        otp,
      })
      setSuccess('Password updated successfully.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setOtp('')
      setOtpSent(false)
      setOtpExpiry(0)
    } catch (err: any) {
      setError(err?.message || 'Failed to update password. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f7fa] p-4 md:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Custom Card Container */}
        <div className="bg-white border border-[#e0e0e0] rounded-lg shadow-sm overflow-hidden">
          {/* Blue Header Section */}
          <div className="bg-primary text-white font-bold text-lg sm:text-xl px-4 py-3 sm:px-6 sm:py-4">
            Update Password
          </div>

          {/* Form Section */}
          <form onSubmit={handleSubmit} className="space-y-5 px-4 py-5 sm:px-6 sm:py-6 md:px-8 md:py-7">
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {success}
              </div>
            )}
            {/* Current Password Field */}
            <div className="flex flex-col gap-2">
              <label htmlFor="current-password" className="font-medium text-[#333] text-sm sm:text-base">
                Current Password
              </label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter Current Password"
                className="w-full px-3 py-2.5 sm:py-3 border border-[#ccc] rounded-md text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                required
              />
            </div>

            {/* New Password Field */}
            <div className="flex flex-col gap-2">
              <label htmlFor="new-password" className="font-medium text-[#333] text-sm sm:text-base">
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter New Password"
                className="w-full px-3 py-2.5 sm:py-3 border border-[#ccc] rounded-md text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                required
              />
            </div>

            {/* Confirm Password Field */}
            <div className="flex flex-col gap-2">
              <label htmlFor="confirm-password" className="font-medium text-[#333] text-sm sm:text-base">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Enter Confirm Password"
                className="w-full px-3 py-2.5 sm:py-3 border border-[#ccc] rounded-md text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                required
              />
            </div>

            <div className="flex flex-col gap-2 rounded-md border border-[#e0e0e0] bg-[#f9fafb] p-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label htmlFor="email-otp" className="font-medium text-[#333] text-sm sm:text-base">
                  Email OTP
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleSendOtp}
                  disabled={isSendingOtp || (otpSent && otpExpiry > 0)}
                >
                  {isSendingOtp ? 'Sending...' : otpSent && otpExpiry > 0 ? 'OTP Sent' : 'Send OTP'}
                </Button>
              </div>
              <input
                id="email-otp"
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit OTP from your email"
                maxLength={6}
                className="w-full px-3 py-2.5 sm:py-3 border border-[#ccc] rounded-md text-sm sm:text-base text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                required
              />
              {otpExpiry > 0 && (
                <p className="text-xs text-[#666]">
                  OTP valid for {Math.floor(otpExpiry / 60)}:{(otpExpiry % 60).toString().padStart(2, '0')}
                </p>
              )}
              {otpSent && otpExpiry === 0 && (
                <button type="button" onClick={handleSendOtp} className="text-sm text-primary hover:underline text-left">
                  Resend OTP
                </button>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="secondary"
                size="lg"
                className="w-full font-semibold text-base sm:text-lg py-3 sm:py-3.5"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

