'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getMyPermissions } from '@/lib/api/sub-admins'

type SidebarItem = {
  label: string
  href?: string
  icon?: React.ReactNode
  requiredPermission?: string // Permission key required to see this item
  children?: Array<{ label: string; href: string; icon?: React.ReactNode; requiredPermission?: string }>
}

export interface SidebarProps {
  activePath?: string
  isMobileOpen?: boolean
  onLinkClick?: () => void
}

// Icon components
const Icon = ({ children, className = "w-5 h-5" }: { children: React.ReactNode; className?: string }) => (
  <span className={`inline-flex items-center justify-center ${className}`}>{children}</span>
)

const DashboardIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  </Icon>
)

const ActivationIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  </Icon>
)

const CourseIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  </Icon>
)

const SettingsIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  </Icon>
)

const WebsiteIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  </Icon>
)

const IncomeIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  </Icon>
)

const P2PIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  </Icon>
)

const LedgerIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  </Icon>
)

const AiIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l1.2 3.6L17 8l-3.8 1.4L12 13l-1.2-3.6L7 8l3.8-1.4L12 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11l.8 2.4L22 14l-2.2.6L19 17l-.8-2.4L16 14l2.2-.6L19 11z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 11l.8 2.4L8 14l-2.2.6L5 17l-.8-2.4L2 14l2.2-.6L5 11z" />
    </svg>
  </Icon>
)

const UsersIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  </Icon>
)

const WithdrawIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  </Icon>
)

const LogoutIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  </Icon>
)

const NewRequestIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  </Icon>
)

const HistoryIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  </Icon>
)

const ModuleIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  </Icon>
)

const VideoIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  </Icon>
)

const PackageIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  </Icon>
)

const BankIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  </Icon>
)

const NoticeIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
    </svg>
  </Icon>
)

const TransactionIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  </Icon>
)

const FeeIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  </Icon>
)

const LevelIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  </Icon>
)

const ActivityLogsIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  </Icon>
)

const AdminManagementIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  </Icon>
)

const SliderIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  </Icon>
)

const SelfIncomeIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  </Icon>
)

const DirectIncomeIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  </Icon>
)

const TeamIncomeIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  </Icon>
)

const SpotIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  </Icon>
)

const GlobalHelpIncomeIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  </Icon>
)

const UserDetailsIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  </Icon>
)

const SummaryIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  </Icon>
)

const WalletIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  </Icon>
)

const KYCIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  </Icon>
)

const PendingIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  </Icon>
)

const SupportIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 0a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  </Icon>
)

const TicketsIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
    </svg>
  </Icon>
)

const PreQuestionsIcon = () => (
  <Icon>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  </Icon>
)

const menuItems: SidebarItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <DashboardIcon /> },
  { label: 'SIA AI', href: '/ai-assistant', icon: <AiIcon /> },
  { label: 'AI Settings', href: '/ai-settings', icon: <SettingsIcon /> },
  {
    label: 'Old System Data',
    icon: <HistoryIcon />,
    requiredPermission: 'INCOME_REPORT_VIEW',
    children: [
      { label: 'Legacy Activation History', href: '/legacy/activation-history', icon: <HistoryIcon />, requiredPermission: 'INCOME_REPORT_VIEW' },
      { label: 'Legacy Spot History', href: '/legacy/spot-history', icon: <HistoryIcon />, requiredPermission: 'INCOME_REPORT_VIEW' },
    ],
  },
  {
    label: 'Activation Request',
    icon: <ActivationIcon />,
    requiredPermission: 'ACTIVATION_REQUEST_VIEW',
    children: [
      { label: 'New Request', href: '/renewal-request/new-request', icon: <NewRequestIcon />, requiredPermission: 'ACTIVATION_REQUEST_VIEW' },
      { label: 'Request History', href: '/renewal-request/request-history', icon: <HistoryIcon />, requiredPermission: 'ACTIVATION_REQUEST_VIEW' },
      { label: 'Gateway History', href: '/gateway-purchases', icon: <HistoryIcon />, requiredPermission: 'ACTIVATION_REQUEST_VIEW' },
    ],
  },
  {
    label: 'Course Master',
    icon: <CourseIcon />,
    requiredPermission: 'COURSE_VIEW',
    children: [
      { label: 'Course Name', href: '/course-master/course-module', icon: <ModuleIcon />, requiredPermission: 'COURSE_VIEW' },
      { label: 'Course Videos', href: '/course-master/course-vedios', icon: <VideoIcon />, requiredPermission: 'COURSE_VIEW' },
    ],
  },
  {
    label: 'Master',
    icon: <SettingsIcon />,
    children: [
      { label: 'Package Setting', href: '/master/package-setting', icon: <PackageIcon />, requiredPermission: 'PACKAGE_MANAGE' },
      { label: 'Company Bank', href: '/master/company-bank', icon: <BankIcon />, requiredPermission: 'COMPANY_BANK_MANAGE' },
      { label: 'Transaction Rules', href: '/master/amount-setup', icon: <TransactionIcon />, requiredPermission: 'TRANSACTION_RULES_MANAGE' },
      { label: 'Fee Rules', href: '/master/fee-rules', icon: <FeeIcon />, requiredPermission: 'FEE_RULES_MANAGE' },
      { label: 'Levels', href: '/master/levels', icon: <LevelIcon />, requiredPermission: 'LEVELS_VIEW' },
      { label: 'Admin Management', href: '/master/admin-management', icon: <AdminManagementIcon />, requiredPermission: 'ADMIN_MANAGE' },
      { label: 'Sub-Admin Activity', href: '/master/sub-admin-activity', icon: <ActivityLogsIcon /> },
      { label: 'Flush History', href: '/master/flush-history', icon: <ActivityLogsIcon /> },
      { label: 'Admin Assigned Packages', href: '/master/admin-assigned-packages', icon: <ActivityLogsIcon /> },
    ],
  },
  {
    label: 'Website Setting',
    icon: <WebsiteIcon />,
    requiredPermission: 'WEBSITE_SETTINGS_MANAGE',
    children: [
      { label: 'Landing Slider', href: '/website-setting/landing-slider', icon: <SliderIcon />, requiredPermission: 'WEBSITE_SETTINGS_MANAGE' },
      { label: 'Notice Board', href: '/master/notice-board', icon: <NoticeIcon />, requiredPermission: 'NOTICE_MANAGE' },
    ],
  },
  {
    label: 'Income History',
    icon: <IncomeIcon />,
    requiredPermission: 'INCOME_REPORT_VIEW',
    children: [
      { label: 'Self Income', href: '/income-history/self-income', icon: <SelfIncomeIcon />, requiredPermission: 'INCOME_REPORT_VIEW' },
      { label: 'Direct Income', href: '/income-history/direct-income', icon: <DirectIncomeIcon />, requiredPermission: 'INCOME_REPORT_VIEW' },
      { label: 'Team Income', href: '/income-history/team-income', icon: <TeamIncomeIcon />, requiredPermission: 'INCOME_REPORT_VIEW' },
      { label: 'Spot Commission', href: '/income-history/spot-commision', icon: <SpotIcon />, requiredPermission: 'INCOME_REPORT_VIEW' },
      { label: 'Global Help Income', href: '/income-history/global-help-income', icon: <GlobalHelpIncomeIcon />, requiredPermission: 'INCOME_REPORT_VIEW' },
    ],
  },
  { label: 'P2P History', href: '/p2p-history', icon: <P2PIcon />, requiredPermission: 'P2P_VIEW' },
  { label: 'Ledger Logs', href: '/ledger-logs', icon: <LedgerIcon />, requiredPermission: 'LEDGER_VIEW' },
  {
    label: 'User Management',
    icon: <UsersIcon />,
    requiredPermission: 'USERS_VIEW',
    children: [
      { label: 'User Details', href: '/user-management/users-details', icon: <UserDetailsIcon />, requiredPermission: 'USERS_VIEW' },
      { label: 'Users Wallet', href: '/user-management/users-wallet', icon: <WalletIcon />, requiredPermission: 'WALLET_MANAGE' },
      { label: 'Users KYC', href: '/user-management/users-kyc', icon: <KYCIcon />, requiredPermission: 'KYC_VIEW' },
    ],
  },
  {
    label: 'Withdraw',
    icon: <WithdrawIcon />,
    requiredPermission: 'WITHDRAW_VIEW',
    children: [
      { label: 'Pending Withdraw', href: '/withdraw/pending-withdraw', icon: <PendingIcon />, requiredPermission: 'WITHDRAW_VIEW' },
      { label: 'Withdraw History', href: '/withdraw/withdraw-history', icon: <HistoryIcon />, requiredPermission: 'WITHDRAW_VIEW' },
    ],
  },
  {
    label: 'Support',
    icon: <SupportIcon />,
    requiredPermission: 'TICKET_VIEW',
    children: [
      { label: 'Tickets', href: '/support/tickets', icon: <TicketsIcon />, requiredPermission: 'TICKET_VIEW' },
      { label: 'Pre-questions', href: '/support/pre-questions', icon: <PreQuestionsIcon /> },
    ],
  },
  { label: 'Setting', href: '/settings1', icon: <SettingsIcon /> },
  { label: 'Logout', href: '/logout', icon: <LogoutIcon /> },
]

export default function Sidebar({ activePath, isMobileOpen, onLinkClick }: SidebarProps) {
  const [openSection, setOpenSection] = useState<string | null>(null)
  const [adminPermissions, setAdminPermissions] = useState<string[]>([])
  const [adminRole, setAdminRole] = useState<string>('')
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true)

  const activePathNormalized = useMemo(() => (activePath || '').toLowerCase(), [activePath])

  // Fetch admin permissions on mount and when window gains focus (to refresh after permission updates)
  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        setIsLoadingPermissions(true)
        const { permissions, role } = await getMyPermissions()
        setAdminPermissions(permissions)
        setAdminRole(role)
      } catch (error) {
        console.error('Error fetching admin permissions:', error)
        // If error, assume SUPER_ADMIN (show all)
        setAdminPermissions([])
        setAdminRole('SUPER_ADMIN')
      } finally {
        setIsLoadingPermissions(false)
      }
    }
    fetchPermissions()

    // Refresh permissions when window gains focus (user switches back to tab)
    const handleFocus = () => {
      fetchPermissions()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  // Check if user has permission (SUPER_ADMIN has all permissions)
  const hasPermission = useCallback((permission?: string) => {
    if (!permission) return true // No permission required
    if (adminRole === 'SUPER_ADMIN') return true // SUPER_ADMIN has all permissions
    return adminPermissions.includes(permission)
  }, [adminPermissions, adminRole])

  // Filter menu items based on permissions and role
  const filteredMenuItems = useMemo(() => {
    return menuItems
      .filter(item => {
        // Hide "Setting" for SUB_ADMIN (they can't change password)
        if (item.label === 'Setting' && adminRole === 'SUB_ADMIN') {
          return false
        }
        return true
      })
      .map(item => {
      // Filter children based on permissions first
      if (item.children) {
        const filteredChildren = item.children.filter(child => {
          // Sub-Admin Activity is SUPER_ADMIN only
          if (child.label === 'Sub-Admin Activity') {
            return adminRole === 'SUPER_ADMIN'
          }
          // Flush History is SUPER_ADMIN only
          if (child.label === 'Flush History') {
            return adminRole === 'SUPER_ADMIN'
          }
          // Pre-questions (Support topics) is SUPER_ADMIN only
          if (child.label === 'Pre-questions') {
            return adminRole === 'SUPER_ADMIN'
          }
          return hasPermission(child.requiredPermission)
        })
        
        // If no children are visible, hide parent
        if (filteredChildren.length === 0) return null
        
        // If parent has requiredPermission, check it
        // BUT: If children have their own permissions and are visible, show parent anyway
        // This allows "User Management" to show if "Users KYC" is visible, even without USERS_VIEW
        if (item.requiredPermission && !hasPermission(item.requiredPermission)) {
          // If any child is visible (has permission), show parent even without parent permission
          // This is intentional - allows access to specific child pages without full parent access
          const hasVisibleChild = filteredChildren.length > 0
          if (!hasVisibleChild) {
            return null
          }
        }
        
        return { ...item, children: filteredChildren }
      }
      
      // For items without children, check permission with fallback logic
      if (item.requiredPermission) {
        // P2P_MANAGE can access P2P_VIEW pages
        if (item.requiredPermission === 'P2P_VIEW') {
          if (!hasPermission('P2P_VIEW') && !hasPermission('P2P_MANAGE')) {
            return null
          }
        } else if (!hasPermission(item.requiredPermission)) {
          return null
        }
      }
      
      return item
    }).filter(Boolean) as SidebarItem[]
  }, [hasPermission])

  const handleToggle = useCallback(
    (label: string) => () => {
      setOpenSection(prev => (prev === label ? null : label))
    },
    []
  )

  return (
    <aside
      id="sidebar"
      className={`sidebar fixed left-0 top-0 h-full w-[250px] z-50 lg:static lg:z-auto transform ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 bg-[#2c3e50] text-[#ecf0f1] py-5 overflow-y-auto transition-transform duration-300 ease-in-out shadow-lg lg:shadow-none`}
    >
      <div className="px-6 pb-5 text-xl font-semibold text-white border-b border-[#34495e] mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 whitespace-nowrap">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="truncate">Admin Control</span>
        </div>
        <button
          onClick={onLinkClick}
          className="lg:hidden text-white hover:text-gray-300 transition-colors p-1 -mr-2"
          aria-label="Close menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <ul className="list-none m-0 p-0">
        {filteredMenuItems.map(item => {
          if (!item.children) {
            const isActive = !!item.href && activePathNormalized === item.href.toLowerCase()
            const anySectionOpen = openSection !== null
            return (
              <li key={item.label}>
                <Link
                  href={item.href!}
                  onClick={onLinkClick}
                  className={`flex items-center gap-3 px-6 py-4 text-[16px] no-underline select-none transition-colors ${
                    isActive && !anySectionOpen ? 'bg-primary text-white font-medium' : 'hover:bg-[#34495e]'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              </li>
            )
          }

          const isOpen = openSection === item.label
          return (
            <li key={item.label}>
              <div
                role="button"
                tabIndex={0}
                onClick={handleToggle(item.label)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setOpenSection(prev => (prev === item.label ? null : item.label))
                  }
                }}
                className={`flex items-center justify-between px-6 py-4 text-[16px] cursor-pointer select-none transition-colors ${
                  isOpen ? 'bg-primary text-white font-medium' : 'hover:bg-[#34495e]'
                }`}
              >
                <div className="flex items-center gap-3">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                <span className={`text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
              </div>
              <ul className={`${isOpen ? 'block' : 'hidden'} bg-[#233140]`}>
                {item.children.map(child => {
                  const isActive = activePathNormalized === child.href.toLowerCase()
                  return (
                    <li key={child.href}>
                      <Link
                        href={child.href}
                        onClick={onLinkClick}
                        className={`flex items-center gap-3 px-6 py-3 pl-12 text-[15px] no-underline transition-colors ${
                          isActive
                            ? 'text-primary'
                            : 'text-[#bdc3c7] hover:text-white'
                        }`}
                      >
                        {child.icon}
                        <span>{child.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}


