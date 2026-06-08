"use client"

import React, { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './sidebar'
import TopBar from './topbar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [adminName, setAdminName] = useState<string>('admin')
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined)
  const pathname = usePathname()

  // Close sidebar when route changes on mobile
  useEffect(() => {
    setIsMobileSidebarOpen(false)
  }, [pathname])

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileSidebarOpen) {
        setIsMobileSidebarOpen(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isMobileSidebarOpen])

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobileSidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileSidebarOpen])

  const toggleSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen)
  }

  const closeSidebar = () => {
    setIsMobileSidebarOpen(false)
  }

  // Load admin name and generate avatar URL once on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check localStorage first (for cross-tab persistence), then sessionStorage
    const storedName =
      localStorage.getItem('user_name') ||
      localStorage.getItem('admin_email') ||
      sessionStorage.getItem('user_name') ||
      sessionStorage.getItem('admin_email') ||
      'admin'

    setAdminName(storedName)

    const baseName = storedName || 'Admin'
    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      baseName,
    )}&background=0D8ABC&color=fff&size=64`

    setAvatarUrl(avatar)
  }, [])

  return (
    <div className="dashboard-container">
      {/* Backdrop overlay for mobile */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}
      
      <Sidebar
        activePath={pathname}
        isMobileOpen={isMobileSidebarOpen}
        onLinkClick={closeSidebar}
      />
      <TopBar onOpenSidebar={toggleSidebar} username={adminName} avatarUrl={avatarUrl} />
      <main className="content-area">{children}</main>
    </div>
  )
}

