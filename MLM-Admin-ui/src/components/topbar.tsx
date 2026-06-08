'use client'

import React, { useEffect, useRef, useState } from 'react'

export interface TopBarProps {
  onOpenSidebar?: () => void
  username?: string
  avatarUrl?: string
}

export default function TopBar({ onOpenSidebar, username = 'admin', avatarUrl = 'https://i.pravatar.cc/64' }: TopBarProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onWindowClick(event: MouseEvent) {
      const target = event.target as Node
      if (!toggleRef.current || !dropdownRef.current) return
      const clickedInsideToggle = toggleRef.current.contains(target)
      const clickedInsideDropdown = dropdownRef.current.contains(target)
      if (!clickedInsideToggle && !clickedInsideDropdown) {
        setIsProfileOpen(false)
      }
    }
    window.addEventListener('click', onWindowClick)
    return () => window.removeEventListener('click', onWindowClick)
  }, [])

  return (
    <header className="top-bar flex items-center justify-between px-4 sm:px-5 md:px-6 bg-white border-b border-gray-200">
      <button
        className="menu-toggle block lg:hidden text-2xl leading-none p-2 -ml-2 text-gray-700 hover:text-gray-900 transition-colors"
        aria-label="Open menu"
        onClick={onOpenSidebar}
      >
        &#9776;
      </button>

      <div className="flex-1" />

      <div className="relative">
        <button
          className="flex items-center gap-2 text-gray-800 hover:opacity-90"
          aria-haspopup="true"
          ref={toggleRef}
          onClick={e => {
            e.stopPropagation()
            setIsProfileOpen(v => !v)
          }}
        >
          <img className="w-8 h-8 rounded-full object-cover" src={avatarUrl} alt="Profile" />
          <span className="font-medium">{username}</span>
          <svg className={`transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L5 5L9 1" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div
          className={`${isProfileOpen ? 'block' : 'hidden'} absolute right-0 top-[130%] min-w-44 rounded-md border border-gray-200 bg-white shadow-md overflow-hidden`}
          role="menu"
          ref={dropdownRef}
        >
          <a className="block px-4 py-3 text-gray-800 hover:bg-gray-50 whitespace-nowrap" href="/settings1" role="menuitem">
            Setting
          </a>
          <a className="block px-4 py-3 text-gray-800 hover:bg-gray-50 whitespace-nowrap" href="/logout" role="menuitem">
            Logout
          </a>
        </div>
      </div>
    </header>
  )
}


