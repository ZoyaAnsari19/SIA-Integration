'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import DashboardLayout from './DashboardLayout'
import { PinVerificationProvider } from '../hooks/usePinVerification'

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  
  // Sync localStorage across tabs using storage event
  useEffect(() => {
    if (typeof window === 'undefined') return

    // On page load, check if we have token in sessionStorage but not in localStorage
    // This handles the case where user logged in before the localStorage fix was deployed
    const sessionToken = sessionStorage.getItem('auth_token')
    const localToken = localStorage.getItem('auth_token')
    
    if (sessionToken && !localToken) {
      // Migrate sessionStorage token to localStorage for cross-tab persistence
      localStorage.setItem('auth_token', sessionToken)
      const adminEmail = sessionStorage.getItem('admin_email')
      const adminAuth = sessionStorage.getItem('admin_authenticated')
      const adminRole = sessionStorage.getItem('admin_role')
      
      if (adminEmail) localStorage.setItem('admin_email', adminEmail)
      if (adminAuth) localStorage.setItem('admin_authenticated', adminAuth)
      if (adminRole) localStorage.setItem('admin_role', adminRole)
    }

    // Listen for storage events from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_token' && e.newValue && !localStorage.getItem('auth_token')) {
        // Another tab set the token, sync it here
        localStorage.setItem('auth_token', e.newValue)
      }
      if (e.key === 'admin_authenticated' && e.newValue) {
        localStorage.setItem('admin_authenticated', e.newValue)
      }
      if (e.key === 'admin_email' && e.newValue) {
        localStorage.setItem('admin_email', e.newValue)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])
  
  // Don't wrap login page with DashboardLayout
  if (pathname === '/login') {
    return <>{children}</>
  }
  
  return (
    <PinVerificationProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </PinVerificationProvider>
  )
}




