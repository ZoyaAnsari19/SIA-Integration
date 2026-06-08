"use client"

import React, { useState, useCallback, createContext, useContext, ReactNode } from 'react'
import PinVerificationModal from '../components/ui/PinVerificationModal'
import { getPinStatus } from '../lib/api/admin-pin'

interface PinVerificationContextType {
  verifyPinForAction: (actionName: string) => Promise<boolean>
  requiresPin: boolean
  checkingPinStatus: boolean
}

const PinVerificationContext = createContext<PinVerificationContextType | null>(null)

export function PinVerificationProvider({ children }: { children: ReactNode }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [actionName, setActionName] = useState('')
  const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null)
  const [requiresPin, setRequiresPin] = useState(false)
  const [checkingPinStatus, setCheckingPinStatus] = useState(true)

  // Check PIN status on mount
  React.useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await getPinStatus()
        setRequiresPin(status.requires_pin && status.has_pin)
      } catch (err) {
        console.error('Error checking PIN status:', err)
        setRequiresPin(false)
      } finally {
        setCheckingPinStatus(false)
      }
    }
    checkStatus()
  }, [])

  const verifyPinForAction = useCallback((action: string): Promise<boolean> => {
    return new Promise(async (resolve) => {
      try {
        if (process.env.NODE_ENV === 'development') {
          console.log('[PIN] verifyPinForAction called for:', action)
        }
        
        // Always check PIN status fresh when action is triggered
        const status = await getPinStatus()
        
        // If requires_pin is false, user is SUPER_ADMIN - no PIN needed
        // If requires_pin is true, user is SUB_ADMIN - always show PIN modal (even if PIN not set, modal will show error)
        const shouldShowPinModal = status.requires_pin

        if (process.env.NODE_ENV === 'development') {
          console.log('[PIN] PIN status check:', {
            requires_pin: status.requires_pin,
            has_pin: status.has_pin,
            is_locked: status.is_locked,
            shouldShowPinModal,
            action
          })
        }

        // If user doesn't require PIN (super admin), auto-approve
        if (!shouldShowPinModal) {
          if (process.env.NODE_ENV === 'development') {
            console.log('[PIN] ✅ User is SUPER_ADMIN - PIN not required, auto-approving action')
          }
          resolve(true)
          return
        }

        // If requires_pin is true but PIN not set, modal will show appropriate message
        if (!status.has_pin && process.env.NODE_ENV === 'development') {
          console.warn('[PIN] ⚠️ SUB_ADMIN but PIN not set - will show error in modal')
        }

        // Show PIN modal
        if (process.env.NODE_ENV === 'development') {
          console.log('[PIN] ✅ Showing PIN modal for action:', action)
        }
        setActionName(action)
        setResolvePromise(() => resolve)
        setIsModalOpen(true)
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[PIN] ❌ Error checking PIN status:', err)
          console.log('[PIN] Showing PIN modal due to error (fail secure)')
        }
        // On error, show PIN modal anyway to be safe (fail secure)
        setActionName(action)
        setResolvePromise(() => resolve)
        setIsModalOpen(true)
      }
    })
  }, [])

  const handleVerified = useCallback(() => {
    if (resolvePromise) {
      resolvePromise(true)
      setResolvePromise(null)
    }
  }, [resolvePromise])

  const handleClose = useCallback(() => {
    setIsModalOpen(false)
    if (resolvePromise) {
      resolvePromise(false)
      setResolvePromise(null)
    }
  }, [resolvePromise])

  return (
    <PinVerificationContext.Provider value={{ verifyPinForAction, requiresPin, checkingPinStatus }}>
      {children}
      <PinVerificationModal
        isOpen={isModalOpen}
        onClose={handleClose}
        onVerified={handleVerified}
        actionName={actionName}
      />
    </PinVerificationContext.Provider>
  )
}

export function usePinVerification() {
  const context = useContext(PinVerificationContext)
  if (!context) {
    console.error('[PIN] ⚠️⚠️⚠️ CRITICAL: PinVerificationContext not found! PIN verification will be bypassed!')
    console.error('[PIN] Make sure PinVerificationProvider wraps your app in ConditionalLayout')
    // Return a default implementation that doesn't require PIN
    return {
      verifyPinForAction: async () => {
        console.warn('[PIN] ⚠️ Context not available - auto-approving (INSECURE!)')
        return true
      },
      requiresPin: false,
      checkingPinStatus: false,
    }
  }
  return context
}

/**
 * Higher-order function to wrap an action with PIN verification
 * Usage: const handleApprove = withPinVerification('KYC Approval', async () => { ... })
 */
export function createPinProtectedAction(
  verifyPinForAction: (action: string) => Promise<boolean>,
  actionName: string,
  action: () => Promise<void> | void
) {
  return async () => {
    const verified = await verifyPinForAction(actionName)
    if (verified) {
      await action()
    }
  }
}
