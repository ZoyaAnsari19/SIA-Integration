"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react'
import Modal from './Modal'
import Button from './Button'
import { verifyPin, getPinStatus } from '../../lib/api/admin-pin'

interface PinVerificationModalProps {
  isOpen: boolean
  onClose: () => void
  onVerified: () => void
  actionName?: string
}

export default function PinVerificationModal({
  isOpen,
  onClose,
  onVerified,
  actionName = 'this action'
}: PinVerificationModalProps) {
  const [pin, setPin] = useState<string[]>(['', '', '', ''])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null)
  const [lockedUntil, setLockedUntil] = useState<string | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [requiresPin, setRequiresPin] = useState(true)
  const [hasPin, setHasPin] = useState(true)
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Check PIN status when modal opens
  useEffect(() => {
    if (isOpen) {
      checkPinStatus()
      // Reset state
      setPin(['', '', '', ''])
      setError(null)
      setRemainingAttempts(null)
      // Focus first input after a short delay
      setTimeout(() => {
        inputRefs.current[0]?.focus()
      }, 100)
    }
  }, [isOpen])

  const checkPinStatus = async () => {
    setCheckingStatus(true)
    try {
      const status = await getPinStatus()
      setRequiresPin(status.requires_pin)
      setHasPin(status.has_pin)
      
      if (status.is_locked && status.locked_until) {
        setLockedUntil(status.locked_until)
        setError('PIN is locked due to too many failed attempts')
      }
      
      // If super admin or doesn't require PIN, auto-verify
      if (!status.requires_pin) {
        onVerified()
        onClose()
      }
    } catch (err) {
      console.error('Error checking PIN status:', err)
    } finally {
      setCheckingStatus(false)
    }
  }

  const handleInputChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return

    const newPin = [...pin]
    newPin[index] = value
    setPin(newPin)
    setError(null)

    // Auto-focus next input
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all digits entered
    if (value && index === 3 && newPin.every(d => d !== '')) {
      handleVerify(newPin.join(''))
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!pin[index] && index > 0) {
        // Move to previous input if current is empty
        inputRefs.current[index - 1]?.focus()
        const newPin = [...pin]
        newPin[index - 1] = ''
        setPin(newPin)
      } else {
        // Clear current input
        const newPin = [...pin]
        newPin[index] = ''
        setPin(newPin)
      }
      e.preventDefault()
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < 3) {
      inputRefs.current[index + 1]?.focus()
    } else if (e.key === 'Enter') {
      const fullPin = pin.join('')
      if (fullPin.length === 4) {
        handleVerify(fullPin)
      }
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (pastedData.length > 0) {
      const newPin = [...pin]
      for (let i = 0; i < pastedData.length; i++) {
        newPin[i] = pastedData[i]
      }
      setPin(newPin)
      
      // Focus appropriate input
      if (pastedData.length === 4) {
        inputRefs.current[3]?.focus()
        handleVerify(pastedData)
      } else {
        inputRefs.current[pastedData.length]?.focus()
      }
    }
  }

  const handleVerify = async (pinValue: string) => {
    if (pinValue.length !== 4) {
      setError('Please enter 4-digit PIN')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await verifyPin(pinValue)
      
      if (response.verified) {
        onVerified()
        onClose()
      } else {
        setError(response.message)
        setRemainingAttempts(response.remaining_attempts || null)
        if (response.locked_until) {
          setLockedUntil(response.locked_until)
        }
        // Clear PIN on error
        setPin(['', '', '', ''])
        inputRefs.current[0]?.focus()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify PIN')
      setPin(['', '', '', ''])
      inputRefs.current[0]?.focus()
    } finally {
      setIsLoading(false)
    }
  }

  const formatLockedTime = (lockedUntilStr: string) => {
    const lockedDate = new Date(lockedUntilStr)
    const now = new Date()
    const diffMs = lockedDate.getTime() - now.getTime()
    
    if (diffMs <= 0) return null
    
    const diffMins = Math.ceil(diffMs / 60000)
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''}`
  }

  if (checkingStatus) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Verifying...">
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Modal>
    )
  }

  // If user doesn't have PIN set
  if (!hasPin && requiresPin) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="PIN Required">
        <div className="text-center py-6">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-4">
            <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Action PIN Not Set</h3>
          <p className="text-sm text-gray-500 mb-6">
            Your action PIN has not been set yet. Please contact the Super Admin to set your PIN before performing critical actions.
          </p>
          <Button onClick={onClose} variant="secondary">
            Close
          </Button>
        </div>
      </Modal>
    )
  }

  // Check if locked
  const lockedTimeRemaining = lockedUntil ? formatLockedTime(lockedUntil) : null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enter Action PIN">
      <div className="py-4">
        {/* Icon */}
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
          <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        {/* Description */}
        <p className="text-center text-sm text-gray-600 mb-6">
          Enter your 4-digit PIN to perform <span className="font-semibold text-gray-800">{actionName}</span>
        </p>

        {/* PIN Locked Message */}
        {lockedTimeRemaining && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-center">
            <p className="text-sm text-red-700">
              <span className="font-semibold">PIN Locked!</span><br />
              Try again in {lockedTimeRemaining}
            </p>
          </div>
        )}

        {/* PIN Input */}
        {!lockedTimeRemaining && (
          <>
            <div className="flex justify-center gap-3 mb-4" onPaste={handlePaste}>
              {[0, 1, 2, 3].map((index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el }}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={pin[index]}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  disabled={isLoading}
                  className={`w-14 h-14 text-center text-2xl font-bold border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${
                    error ? 'border-red-400 bg-red-50' : 'border-gray-300'
                  } ${isLoading ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                />
              ))}
            </div>

            {/* Error Message */}
            {error && (
              <div className="text-center mb-4">
                <p className="text-sm text-red-600">{error}</p>
                {remainingAttempts !== null && remainingAttempts > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining
                  </p>
                )}
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="flex justify-center mb-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            )}
          </>
        )}

        {/* Buttons */}
        <div className="flex gap-3 mt-6">
          <Button 
            onClick={onClose} 
            variant="secondary" 
            className="flex-1"
            disabled={isLoading}
          >
            Cancel
          </Button>
          {!lockedTimeRemaining && (
            <Button
              onClick={() => handleVerify(pin.join(''))}
              disabled={isLoading || pin.some(d => d === '')}
              className="flex-1"
            >
              {isLoading ? 'Verifying...' : 'Verify'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
