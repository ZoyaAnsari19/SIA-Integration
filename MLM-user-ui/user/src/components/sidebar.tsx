"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  User,
  Trophy,
  BookOpen,
  CreditCard,
  History,
  Users,
  LineChart,
  Wallet,
  UserPlus,
  Globe,
  Bolt,
  List,
  Receipt,
  Key,
  Bell,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  LogOut,
  FileText,
  TrendingUp,
  ArrowRightLeft,
  Send,
  MessageCircle,
  Bot,
} from "lucide-react";
import { useSidebar } from "@/contexts/sidebar-context";
import { getWalletBalance } from "@/lib/api/dashboard";
import { useAppSelector, useAppDispatch } from "@/redux/hooks";
import { logout as logoutAction } from "@/redux/features/auth/authSlice";
import { logout as logoutApi } from "@/lib/api/auth";

type DropdownKey = "income" | "withdraw" | "payments" | "transfer" | "setting" | null;

export default function Sidebar() {
  const { isOpen, setIsOpen, toggle } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [openDropdown, setOpenDropdown] = useState<DropdownKey>(null);
  const [activeKey, setActiveKey] = useState<string>("Dashboard");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);

  // Fetch wallet balance
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const wallet = await getWalletBalance();
        const teamRoyalty = wallet.team_royalty_balance ?? 0;
        const calculatedBalance =
          (wallet.spot_balance || 0) + (wallet.other_balance || 0) + teamRoyalty;
        setWalletBalance(calculatedBalance);
      } catch (err) {
        console.error('Failed to fetch wallet balance:', err);
        setWalletBalance(0);
      } finally {
        setIsLoadingBalance(false);
      }
    };

    if (isOpen) {
      fetchBalance();
    }
  }, [isOpen]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const incomeHeaderKey = "Income History";
  const incomeSubKeys = [
    "Self Income",
    "Direct Monthly Recurring",
    "Team Income (monthly royalty)",
    "Global Help Income",
    "Spot Income",
  ];
  const withdrawHeaderKey = "Withdraw";
  const withdrawSubKeys = [
    "Withdraw History",
  ];
  const paymentsHeaderKey = "Payments";
  const paymentsSubKeys = [
    "Payment History",
    "Receipt",
    "Wallet History / Admin Operations",
  ];
  const transferHeaderKey = "Transfer Money";
  const transferSubKeys = [
    "P2P Transfer",
    "Transfer History",
  ];
  const settingHeaderKey = "Setting";
  const settingSubKeys = ["Password Change"];
  const isIncomeHeaderActive = activeKey === incomeHeaderKey;
  const isWithdrawHeaderActive = activeKey === withdrawHeaderKey;
  const isPaymentsHeaderActive = activeKey === paymentsHeaderKey;
  const isTransferHeaderActive = activeKey === transferHeaderKey;
  const isSettingHeaderActive = activeKey === settingHeaderKey;
  const isIncomeGroupActive = incomeSubKeys.includes(activeKey);
  const isWithdrawGroupActive = withdrawSubKeys.includes(activeKey);
  const isPaymentsGroupActive = paymentsSubKeys.includes(activeKey);
  const isTransferGroupActive = transferSubKeys.includes(activeKey);
  const isSettingGroupActive = settingSubKeys.includes(activeKey);

  // Map pathname to activeKey
  useEffect(() => {
    if (!pathname) return;

    // Route to label mapping
    const routeToLabel: Record<string, string> = {
      "/": "Dashboard",
      "/dashboard": "Dashboard",
      "/ai-assistant": "SIA AI",
      "/profile": "Profile",
      "/leaderboard": "Leaderboard",
      "/my-course": "My Packages",
      "/add-balance": "Pay",
      "/pay-now": "Pay",
      "/path-rank": "Path Rank",
      "/team": "All Team",
      "/new-join": "New Join",
      "/notifications": "Notice",
      "/support": "Support",
      "/plan-rules": "User Terms",
      "/income-history/self-income": "Self Income",
      "/income-history/direct-income": "Direct Monthly Recurring",
      "/income-history/team-income": "Team Income (monthly royalty)",
      "/income-history/global-help-income": "Global Help Income",
      "/income-history/spot-income": "Spot Income",
      "/withdraw/spot-withdraw-request": "Withdraw History",
      "/withdraw/payment-history": "Payment History",
      "/withdraw/bill": "Receipt",
      "/wallet-history": "Wallet History / Admin Operations",
      "/transfer-money/p2p-transfer": "P2P Transfer",
      "/transfer-money/history": "Transfer History",
      "/password": "Password Change",
    };

    // Check exact match first
    if (routeToLabel[pathname]) {
      setActiveKey(routeToLabel[pathname]);
      return;
    }

    // Check for partial matches (for nested routes)
    for (const [route, label] of Object.entries(routeToLabel)) {
      if (pathname.startsWith(route) && route !== "/") {
        setActiveKey(label);
        return;
      }
    }
    // Support ticket detail: still show Support as active
    if (pathname.startsWith("/support/")) {
      setActiveKey("Support");
      return;
    }

    // Default to Dashboard if no match
    if (pathname === "/" || pathname === "/dashboard") {
      setActiveKey("Dashboard");
    }
  }, [pathname]);

  // Keep dropdown open in sync with the selected item
  useEffect(() => {
    // Only auto-open when a SUB item is active, not when header itself is active
    if (isIncomeGroupActive) {
      setOpenDropdown("income");
      return;
    }
    if (isWithdrawGroupActive) {
      setOpenDropdown("withdraw");
      return;
    }
    if (isPaymentsGroupActive) {
      setOpenDropdown("payments");
      return;
    }
    if (isTransferGroupActive) {
      setOpenDropdown("transfer");
      return;
    }
    if (isSettingGroupActive) {
      setOpenDropdown("setting");
      return;
    }
    // If only headers are active, do not force open (allows manual close)
  }, [isIncomeGroupActive, isWithdrawGroupActive, isPaymentsGroupActive, isSettingGroupActive]);

  const sidebarClassName = useMemo(
    () =>
      [
        // surfaces & base layout
        "bg-[var(--sidebar-bg)] border-(--border) shadow-sm will-change-transform transition-colors duration-200",
        // desktop (lg and above): sticky, snap width (no width animation to avoid layout jank)
        "lg:sticky lg:top-0 lg:h-screen lg:flex lg:flex-col lg:border-r",
        isOpen ? "lg:w-[260px]" : "lg:w-20",
        // tablet and mobile: overlay slide with transform (GPU friendly)
        "fixed top-0 left-0 h-screen flex flex-col border-r z-50 transition-transform duration-200",
        // Always visible on desktop (no translate), slide on tablet/mobile only
        isOpen
          ? "translate-x-0 lg:translate-x-0"
          : "-translate-x-full lg:translate-x-0",
      ].join(" "),
    [isOpen],
  );

  const labelClassName = useMemo(
    () =>
      [
        "transition-all duration-200 whitespace-nowrap overflow-hidden",
        isOpen ? "max-w-[180px] opacity-100 ml-0" : "max-w-0 opacity-0 ml-0",
      ].join(" "),
    [isOpen],
  );

  const handleDropdownToggle = (key: Exclude<DropdownKey, null>) => {
    setOpenDropdown((prev) => (prev === key ? null : key));
  };

  return (
    <>
      <nav className={sidebarClassName} aria-label="Primary">
        <div
          className={[
            "box-border border-b border-(--border) relative",
            isOpen ? "px-4 py-4" : "px-5 py-4",
          ].join(" ")}
        >
          {isOpen ? (
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center flex-shrink-0 mt-0.5 p-2">
                <img
                  src="/SIA-png-logo.png"
                  alt="Secure Infinite Association"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-(--brand-blue) leading-snug break-words">
                  Secure Infinite Association
                </h2>
              </div>
              <button
                className={[
                  "text-(--text-muted) hover:text-(--text-strong)",
                  "transition-colors duration-200 flex-shrink-0 mt-0.5",
                ].join(" ")}
                id="sidebar-toggle"
                aria-label="Collapse sidebar"
                onClick={toggle}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 p-2">
                <img
                  src="/SIA-png-logo.png"
                  alt="Secure Infinite Association"
                  className="w-full h-full object-contain"
                />
              </div>
              <button
                className={[
                  "text-(--text-muted) hover:text-(--text-strong)",
                  "transition-colors duration-200 flex-shrink-0 rotate-180",
                ].join(" ")}
                id="sidebar-toggle"
                aria-label="Expand sidebar"
                onClick={toggle}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Wallet */}
        <div
          className={[
            "mx-4 mb-4 rounded-xl text-center border px-5 py-4 bg-(--sidebar-hover) border-(--border) transition-colors duration-200",
            isOpen ? "block" : "hidden",
          ].join(" ")}
          role="region"
          aria-label="Wallet"
        >
          <span className="block text-[13px] font-medium text-(--text-muted)">
            My Wallet Balance
          </span>
          <span className="block text-[22px] font-bold text-green-600">
            {isLoadingBalance ? "Loading..." : walletBalance !== null ? formatCurrency(walletBalance) : "₹0.00"}
          </span>
          <Link
            href="/add-balance"
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand-blue)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            <span>Buy More</span>
          </Link>
        </div>

        {/* Links */}
        <ul className="flex-1 overflow-y-auto overflow-x-hidden">
          <li
            className={["px-5 pt-2 pb-1", isOpen ? "block" : "hidden"].join(
              " ",
            )}
          >
            <span className="text-[11px] font-semibold uppercase text-(--text-muted)">
              Overview
            </span>
          </li>
          <li className="group relative">
            <Link
              href="/dashboard"
              onClick={() => {
                setActiveKey("Dashboard");
              }}
              aria-current={activeKey === "Dashboard" ? "page" : undefined}
              className={[
                "mx-2 my-1 flex items-center rounded-lg px-4 py-2 text-sm font-medium",
                "transition-colors duration-200",
                activeKey === "Dashboard"
                  ? "bg-(--sidebar-active-bg) text-(--sidebar-active-text) ring-1 ring-[var(--ring-color)]"
                  : "text-(--text-body) hover:bg-(--sidebar-hover)",
              ].join(" ")}
              aria-label="Dashboard"
              title="Dashboard"
            >
              <Home
                className={[
                  "h-5 w-5 mr-2",
                  activeKey === "Dashboard"
                    ? "text-(--sidebar-active-text)"
                    : "text-(--text-muted)",
                ].join(" ")}
              />
              <span className={labelClassName}>Dashboard</span>
            </Link>
            {!isOpen && (
              <span
                role="tooltip"
                className="pointer-events-none absolute left-[78px] top-1/2 z-20 hidden -translate-y-1/2 rounded bg-(--tooltip-bg) px-2 py-1 text-xs font-medium text-(--tooltip-text) shadow group-hover:block transition-colors duration-200"
              >
                Dashboard
              </span>
            )}
          </li>
          {[
            { icon: Bell, label: "Notice", href: "/notifications" },
            { icon: User, label: "Profile", href: "/profile" },
            { icon: Trophy, label: "Leaderboard", href: "/leaderboard" },
            { icon: BookOpen, label: "My Packages", href: "/my-course" },
            { icon: CreditCard, label: "Buy More (Pay)", href: "/add-balance" },
            { icon: TrendingUp, label: "Path Rank", href: "/path-rank" },
            { icon: Users, label: "All Team", href: "/team" },
            { icon: UserPlus, label: "New Join", href: "/new-join" },
          ].map((item) => (
            <li key={item.label} className="group relative">
              {item.href ? (
                <Link
                  href={item.href}
                  onClick={() => {
                    setActiveKey(item.label);
                  }}
                  aria-current={activeKey === item.label ? "page" : undefined}
                  className={[
                    "mx-2 my-1 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200",
                    activeKey === item.label
                      ? "bg-(--sidebar-active-bg) text-(--sidebar-active-text) ring-1 ring-[var(--ring-color)]"
                      : "text-(--text-body) hover:bg-(--sidebar-hover)",
                  ].join(" ")}
                  aria-label={item.label}
                  title={item.label}
                >
                  <item.icon
                    className={[
                      "h-5 w-5",
                      activeKey === item.label
                        ? "text-(--sidebar-active-text)"
                        : "text-(--text-muted)",
                    ].join(" ")}
                  />
                  <span className={labelClassName}>{item.label}</span>
                </Link>
              ) : (
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveKey(item.label);
                  }}
                  aria-current={activeKey === item.label ? "page" : undefined}
                  className={[
                    "mx-2 my-1 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200",
                    activeKey === item.label
                      ? "bg-(--sidebar-active-bg) text-(--sidebar-active-text) ring-1 ring-[var(--ring-color)]"
                      : "text-(--text-body) hover:bg-(--sidebar-hover)",
                  ].join(" ")}
                  aria-label={item.label}
                  title={item.label}
                >
                  <item.icon
                    className={[
                      "h-5 w-5",
                      activeKey === item.label
                        ? "text-(--sidebar-active-text)"
                        : "text-(--text-muted)",
                    ].join(" ")}
                  />
                  <span className={labelClassName}>{item.label}</span>
                </a>
              )}
              {!isOpen && (
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-[78px] top-1/2 z-20 hidden -translate-y-1/2 rounded bg-(--tooltip-bg) px-2 py-1 text-xs font-medium text-(--tooltip-text) shadow group-hover:block transition-colors duration-200"
                >
                  {item.label}
                </span>
              )}
            </li>
          ))}

          <li
            className={["px-5 pt-3 pb-1", isOpen ? "block" : "hidden"].join(
              " ",
            )}
          >
            <span className="text-[11px] font-semibold uppercase text-(--text-muted)">
              Finance
            </span>
          </li>

          {/* Income dropdown */}
          <li className="relative group">
            <button
              type="button"
              onClick={() => {
                setActiveKey(incomeHeaderKey);
                setOpenDropdown((p) => (p === "income" ? null : "income"));
              }}
              className={[
                "mx-2 my-1 flex w-[calc(100%-1rem)] items-center justify-between rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                isIncomeHeaderActive || isIncomeGroupActive
                  ? "bg-(--sidebar-active-bg) text-(--sidebar-active-text) ring-1 ring-[var(--ring-color)]"
                  : "text-(--text-body) hover:bg-(--sidebar-hover)",
              ].join(" ")}
              aria-expanded={openDropdown === "income"}
              aria-controls="submenu-income"
              aria-label="Income History"
              title="Income History"
            >
              <span className="flex items-center gap-3">
                <LineChart
                  className={[
                    "h-5 w-5",
                    isIncomeHeaderActive || isIncomeGroupActive
                      ? "text-(--sidebar-active-text)"
                      : "text-(--text-muted)",
                  ].join(" ")}
                />
                <span className={isOpen ? "block" : "hidden"}>
                  Income History
                </span>
              </span>
              <ChevronRight
                className={[
                  "h-4 w-4 transition-transform",
                  openDropdown === "income" ? "rotate-90" : "",
                  isOpen ? "block" : "hidden",
                ].join(" ")}
              />
            </button>
            {!isOpen && (
              <span
                role="tooltip"
                className="pointer-events-none absolute left-[78px] top-4 z-20 hidden rounded bg-(--tooltip-bg) px-2 py-1 text-xs font-medium text-(--tooltip-text) shadow group-hover:block transition-colors duration-200"
              >
                Income History
              </span>
            )}
            {/* Submenu */}
            <ul
              id="submenu-income"
              role="menu"
              className={[
                "bg-(--sidebar-hover)",
                isOpen
                  ? openDropdown === "income"
                    ? "block"
                    : "hidden"
                  : "hidden",
                "mx-2 rounded-lg",
              ].join(" ")}
            >
              {[
                {
                  icon: User,
                  label: "Self Income",
                  href: "/income-history/self-income",
                },
                {
                  icon: UserPlus,
                  label: "Direct Monthly Recurring",
                  href: "/income-history/direct-income",
                },
                {
                  icon: Users,
                  label: "Team Income (monthly royalty)",
                  href: "/income-history/team-income",
                },
                {
                  icon: Globe,
                  label: "Global Help Income",
                  href: "/income-history/global-help-income",
                },
                {
                  icon: Bolt,
                  label: "Spot Income",
                  href: "/income-history/spot-income",
                },
              ].map((sub) => (
                <li key={sub.label}>
                  <Link
                    href={sub.href}
                    role="menuitem"
                    onClick={() => {
                      setActiveKey(sub.label);
                      setOpenDropdown("income");
                    }}
                    aria-current={activeKey === sub.label ? "page" : undefined}
                    className={[
                      "flex items-center gap-2 px-4 py-2 text-[13px] rounded-md transition-colors",
                      activeKey === sub.label
                        ? "bg-(--sidebar-active-bg) text-(--sidebar-active-text)"
                        : "text-(--text-body) hover:text-[var(--hover-text)]",
                    ].join(" ")}
                  >
                    <sub.icon
                      className={[
                        "h-4 w-4",
                        activeKey === sub.label
                          ? "text-(--sidebar-active-text)"
                          : "text-(--text-muted)",
                      ].join(" ")}
                    />
                    <span>{sub.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {/* Popout for collapsed */}
            {!isOpen && openDropdown === "income" && (
              <ul className="absolute left-[78px] top-0 z-20 w-[220px] rounded-lg border border-(--border) bg-[var(--card-bg)] p-1 shadow-sm">
                {[
                  {
                    icon: User,
                    label: "Self Income",
                    href: "/income-history/self-income",
                  },
                  {
                    icon: UserPlus,
                    label: "Direct Monthly Recurring",
                    href: "/income-history/direct-income",
                  },
                  {
                    icon: Users,
                    label: "Team Income",
                    href: "/income-history/team-income",
                  },
                  {
                    icon: Globe,
                    label: "Global Help Income",
                    href: "/income-history/global-help-income",
                  },
                  {
                    icon: Bolt,
                    label: "Spot Income",
                    href: "/income-history/spot-income",
                  },
                ].map((sub) => (
                  <li key={sub.label}>
                    <Link
                      href={sub.href}
                      onClick={() => {
                        setActiveKey(sub.label);
                      }}
                      className={[
                        "flex items-center gap-2 px-4 py-2 text-[13px] rounded-md",
                        activeKey === sub.label
                          ? "bg-(--sidebar-active-bg) text-(--sidebar-active-text)"
                          : "text-(--text-body) hover:text-[var(--hover-text)]",
                      ].join(" ")}
                    >
                      <sub.icon
                        className={[
                          "h-4 w-4",
                          activeKey === sub.label
                            ? "text-(--sidebar-active-text)"
                            : "text-(--text-muted)",
                        ].join(" ")}
                      />
                      <span>{sub.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>

          {/* Withdraw dropdown */}
          <li className="relative group">
            <button
              type="button"
              onClick={() => {
                setActiveKey(withdrawHeaderKey);
                setOpenDropdown((p) => (p === "withdraw" ? null : "withdraw"));
              }}
              className={[
                "mx-2 my-1 flex w-[calc(100%-1rem)] items-center justify-between rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                isWithdrawHeaderActive || isWithdrawGroupActive
                  ? "bg-(--sidebar-active-bg) text-(--sidebar-active-text) ring-1 ring-[var(--ring-color)]"
                  : "text-(--text-body) hover:bg-(--sidebar-hover)",
              ].join(" ")}
              aria-expanded={openDropdown === "withdraw"}
              aria-controls="submenu-withdraw"
              aria-label="Withdraw"
              title="Withdraw"
            >
              <span className="flex items-center gap-3">
                <Wallet
                  className={[
                    "h-5 w-5",
                    isWithdrawHeaderActive || isWithdrawGroupActive
                      ? "text-(--sidebar-active-text)"
                      : "text-(--text-muted)",
                  ].join(" ")}
                />
                <span className={isOpen ? "block" : "hidden"}>Withdraw</span>
              </span>
              <ChevronRight
                className={[
                  "h-4 w-4 transition-transform",
                  openDropdown === "withdraw" ? "rotate-90" : "",
                  isOpen ? "block" : "hidden",
                ].join(" ")}
              />
            </button>
            {!isOpen && (
              <span
                role="tooltip"
                className="pointer-events-none absolute left-[78px] top-4 z-20 hidden rounded bg-(--tooltip-bg) px-2 py-1 text-xs font-medium text-(--tooltip-text) shadow group-hover:block transition-colors duration-200"
              >
                Withdraw
              </span>
            )}
            <ul
              id="submenu-withdraw"
              role="menu"
              className={[
                "bg-(--sidebar-hover)",
                isOpen
                  ? openDropdown === "withdraw"
                    ? "block"
                    : "hidden"
                  : "hidden",
                "mx-2 rounded-lg",
              ].join(" ")}
            >
              {[
                {
                  icon: List,
                  label: "Withdraw History",
                  href: "/withdraw/spot-withdraw-request",
                },
              ].map((sub) => (
                <li key={sub.label}>
                  <Link
                    href={sub.href}
                    role="menuitem"
                    onClick={() => {
                      setActiveKey(sub.label);
                      setOpenDropdown("withdraw");
                    }}
                    aria-current={activeKey === sub.label ? "page" : undefined}
                    className={[
                      "flex items-center gap-2 px-4 py-2 text-[13px] rounded-md transition-colors",
                      activeKey === sub.label
                        ? "bg-(--sidebar-active-bg) text-(--sidebar-active-text)"
                        : "text-(--text-body) hover:text-[var(--hover-text)]",
                    ].join(" ")}
                  >
                    <sub.icon
                      className={[
                        "h-4 w-4",
                        activeKey === sub.label
                          ? "text-(--sidebar-active-text)"
                          : "text-(--text-muted)",
                      ].join(" ")}
                    />
                    <span>{sub.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {!isOpen && openDropdown === "withdraw" && (
              <ul className="absolute left-[78px] top-0 z-20 w-[220px] rounded-lg border border-(--border) bg-[var(--card-bg)] p-1 shadow-sm">
                {[
                  {
                    icon: List,
                    label: "Withdraw History",
                    href: "/withdraw/spot-withdraw-request",
                  },
                ].map((sub) => (
                  <li key={sub.label}>
                    <Link
                      href={sub.href}
                      onClick={() => {
                        setActiveKey(sub.label);
                      }}
                      className={[
                        "flex items-center gap-2 px-4 py-2 text-[13px] rounded-md",
                        activeKey === sub.label
                          ? "bg-(--sidebar-active-bg) text-(--sidebar-active-text)"
                          : "text-(--text-body) hover:text-[var(--hover-text)]",
                      ].join(" ")}
                    >
                      <sub.icon
                        className={[
                          "h-4 w-4",
                          activeKey === sub.label
                            ? "text-(--sidebar-active-text)"
                            : "text-(--text-muted)",
                        ].join(" ")}
                      />
                      <span>{sub.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>

          {/* Payments dropdown */}
          <li className="relative group">
            <button
              type="button"
              onClick={() => {
                setActiveKey(paymentsHeaderKey);
                setOpenDropdown((p) => (p === "payments" ? null : "payments"));
              }}
              className={[
                "mx-2 my-1 flex w-[calc(100%-1rem)] items-center justify-between rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                isPaymentsHeaderActive || isPaymentsGroupActive
                  ? "bg-(--sidebar-active-bg) text-(--sidebar-active-text) ring-1 ring-[var(--ring-color)]"
                  : "text-(--text-body) hover:bg-(--sidebar-hover)",
              ].join(" ")}
              aria-expanded={openDropdown === "payments"}
              aria-controls="submenu-payments"
              aria-label="Payments"
              title="Payments"
            >
              <span className="flex items-center gap-3">
                <Receipt
                  className={[
                    "h-5 w-5",
                    isPaymentsHeaderActive || isPaymentsGroupActive
                      ? "text-(--sidebar-active-text)"
                      : "text-(--text-muted)",
                  ].join(" ")}
                />
                <span className={isOpen ? "block" : "hidden"}>Payments</span>
              </span>
              <ChevronRight
                className={[
                  "h-4 w-4 transition-transform",
                  openDropdown === "payments" ? "rotate-90" : "",
                  isOpen ? "block" : "hidden",
                ].join(" ")}
              />
            </button>
            {!isOpen && (
              <span
                role="tooltip"
                className="pointer-events-none absolute left-[78px] top-4 z-20 hidden rounded bg-(--tooltip-bg) px-2 py-1 text-xs font-medium text-(--tooltip-text) shadow group-hover:block transition-colors duration-200"
              >
                Payments
              </span>
            )}
            <ul
              id="submenu-payments"
              role="menu"
              className={[
                "bg-(--sidebar-hover)",
                isOpen
                  ? openDropdown === "payments"
                    ? "block"
                    : "hidden"
                  : "hidden",
                "mx-2 rounded-lg",
              ].join(" ")}
            >
              {[
                {
                  icon: Receipt,
                  label: "Payment History",
                  href: "/withdraw/payment-history",
                },
                {
                  icon: FileText,
                  label: "Receipt",
                  href: "/withdraw/bill",
                },
                {
                  icon: Wallet,
                  label: "Wallet History / Admin Operations",
                  href: "/wallet-history",
                },
              ].map((sub) => (
                <li key={sub.label}>
                  <Link
                    href={sub.href}
                    role="menuitem"
                    onClick={() => {
                      setActiveKey(sub.label);
                      setOpenDropdown("payments");
                    }}
                    aria-current={activeKey === sub.label ? "page" : undefined}
                    className={[
                      "flex items-center gap-2 px-4 py-2 text-[13px] rounded-md transition-colors",
                      activeKey === sub.label
                        ? "bg-(--sidebar-active-bg) text-(--sidebar-active-text)"
                        : "text-(--text-body) hover:text-[var(--hover-text)]",
                    ].join(" ")}
                  >
                    <sub.icon
                      className={[
                        "h-4 w-4",
                        activeKey === sub.label
                          ? "text-(--sidebar-active-text)"
                          : "text-(--text-muted)",
                      ].join(" ")}
                    />
                    <span>{sub.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {!isOpen && openDropdown === "payments" && (
              <ul className="absolute left-[78px] top-0 z-20 w-[220px] rounded-lg border border-(--border) bg-[var(--card-bg)] p-1 shadow-sm">
                {[
                  {
                    icon: Receipt,
                    label: "Payment History",
                    href: "/withdraw/payment-history",
                  },
                  {
                    icon: FileText,
                    label: "Bill",
                    href: "/withdraw/bill",
                  },
                ].map((sub) => (
                  <li key={sub.label}>
                    <Link
                      href={sub.href}
                      onClick={() => {
                        setActiveKey(sub.label);
                      }}
                      className={[
                        "flex items-center gap-2 px-4 py-2 text-[13px] rounded-md",
                        activeKey === sub.label
                          ? "bg-(--sidebar-active-bg) text-(--sidebar-active-text)"
                          : "text-[var(--text-body)] hover:text-[var(--hover-text)]",
                      ].join(" ")}
                    >
                      <sub.icon
                        className={[
                          "h-4 w-4",
                          activeKey === sub.label
                            ? "text-(--sidebar-active-text)"
                            : "text-(--text-muted)",
                        ].join(" ")}
                      />
                      <span>{sub.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>

          {/* Transfer Money dropdown */}
          <li className="relative group">
            <button
              type="button"
              onClick={() => {
                setActiveKey(transferHeaderKey);
                setOpenDropdown((p) => (p === "transfer" ? null : "transfer"));
              }}
              className={[
                "mx-2 my-1 flex w-[calc(100%-1rem)] items-center justify-between rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                isTransferHeaderActive || isTransferGroupActive
                  ? "bg-(--sidebar-active-bg) text-(--sidebar-active-text) ring-1 ring-[var(--ring-color)]"
                  : "text-(--text-body) hover:bg-(--sidebar-hover)",
              ].join(" ")}
              aria-expanded={openDropdown === "transfer"}
              aria-controls="submenu-transfer"
              aria-label="Transfer Money"
              title="Transfer Money"
            >
              <span className="flex items-center gap-3">
                <ArrowRightLeft
                  className={[
                    "h-5 w-5",
                    isTransferHeaderActive || isTransferGroupActive
                      ? "text-(--sidebar-active-text)"
                      : "text-(--text-muted)",
                  ].join(" ")}
                />
                <span className={isOpen ? "block" : "hidden"}>
                  Transfer Money
                </span>
              </span>
              <ChevronRight
                className={[
                  "h-4 w-4 transition-transform",
                  openDropdown === "transfer" ? "rotate-90" : "",
                  isOpen ? "block" : "hidden",
                ].join(" ")}
              />
            </button>
            {!isOpen && (
              <span
                role="tooltip"
                className="pointer-events-none absolute left-[78px] top-4 z-20 hidden rounded bg-(--tooltip-bg) px-2 py-1 text-xs font-medium text-(--tooltip-text) shadow group-hover:block transition-colors duration-200"
              >
                Transfer Money
              </span>
            )}
            <ul
              id="submenu-transfer"
              role="menu"
              className={[
                "bg-(--sidebar-hover)",
                isOpen
                  ? openDropdown === "transfer"
                    ? "block"
                    : "hidden"
                  : "hidden",
                "mx-2 rounded-lg",
              ].join(" ")}
            >
              {[
                {
                  icon: Send,
                  label: "P2P Transfer",
                  href: "/transfer-money/p2p-transfer",
                },
                {
                  icon: History,
                  label: "Transfer History",
                  href: "/transfer-money/history",
                },
              ].map((sub) => (
                <li key={sub.label}>
                  <Link
                    href={sub.href}
                    role="menuitem"
                    onClick={() => {
                      setActiveKey(sub.label);
                      setOpenDropdown("transfer");
                    }}
                    aria-current={activeKey === sub.label ? "page" : undefined}
                    className={[
                      "flex items-center gap-2 px-4 py-2 text-[13px] rounded-md transition-colors",
                      activeKey === sub.label
                        ? "bg-(--sidebar-active-bg) text-(--sidebar-active-text)"
                        : "text-(--text-body) hover:text-[var(--hover-text)]",
                    ].join(" ")}
                  >
                    <sub.icon
                      className={[
                        "h-4 w-4",
                        activeKey === sub.label
                          ? "text-(--sidebar-active-text)"
                          : "text-(--text-muted)",
                      ].join(" ")}
                    />
                    <span>{sub.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {!isOpen && openDropdown === "transfer" && (
              <ul className="absolute left-[78px] top-0 z-20 w-[220px] rounded-lg border border-(--border) bg-[var(--card-bg)] p-1 shadow-sm">
                {[
                  {
                    icon: Send,
                    label: "P2P Transfer",
                    href: "/transfer-money/p2p-transfer",
                  },
                ].map((sub) => (
                  <li key={sub.label}>
                    <Link
                      href={sub.href}
                      onClick={() => {
                        setActiveKey(sub.label);
                      }}
                      className={[
                        "flex items-center gap-2 px-4 py-2 text-[13px] rounded-md",
                        activeKey === sub.label
                          ? "bg-(--sidebar-active-bg) text-(--sidebar-active-text)"
                          : "text-(--text-body) hover:text-[var(--hover-text)]",
                      ].join(" ")}
                    >
                      <sub.icon
                        className={[
                          "h-4 w-4",
                          activeKey === sub.label
                            ? "text-(--sidebar-active-text)"
                            : "text-(--text-muted)",
                        ].join(" ")}
                      />
                      <span>{sub.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>

          <li
            className={["px-5 pt-3 pb-1", isOpen ? "block" : "hidden"].join(
              " ",
            )}
          >
            <span className="text-[11px] font-semibold uppercase text-(--text-muted)">
              Other
            </span>
          </li>

          {/* Setting dropdown */}
          <li className="relative group">
            <button
              type="button"
              onClick={() => {
                setActiveKey(settingHeaderKey);
                setOpenDropdown((p) => (p === "setting" ? null : "setting"));
              }}
              className={[
                "mx-2 my-1 flex w-[calc(100%-1rem)] items-center justify-between rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                isSettingHeaderActive || isSettingGroupActive
                  ? "bg-(--sidebar-active-bg) text-(--sidebar-active-text) ring-1 ring-[var(--ring-color)]"
                  : "text-(--text-body) hover:bg-(--sidebar-hover)",
              ].join(" ")}
              aria-expanded={openDropdown === "setting"}
              aria-controls="submenu-setting"
              aria-label="Setting"
              title="Setting"
            >
              <span className="flex items-center gap-3">
                <Settings
                  className={[
                    "h-5 w-5",
                    isSettingHeaderActive || isSettingGroupActive
                      ? "text-(--sidebar-active-text)"
                      : "text-(--text-muted)",
                  ].join(" ")}
                />
                <span className={isOpen ? "block" : "hidden"}>Setting</span>
              </span>
              <ChevronRight
                className={[
                  "h-4 w-4 transition-transform",
                  openDropdown === "setting" ? "rotate-90" : "",
                  isOpen ? "block" : "hidden",
                ].join(" ")}
              />
            </button>
            {!isOpen && (
              <span
                role="tooltip"
                className="pointer-events-none absolute left-[78px] top-4 z-20 hidden rounded bg-(--tooltip-bg) px-2 py-1 text-xs font-medium text-(--tooltip-text) shadow group-hover:block transition-colors duration-200"
              >
                Setting
              </span>
            )}
            {/* Submenu */}
            <ul
              id="submenu-setting"
              role="menu"
              className={[
                "bg-(--sidebar-hover)",
                isOpen
                  ? openDropdown === "setting"
                    ? "block"
                    : "hidden"
                  : "hidden",
                "mx-2 rounded-lg",
              ].join(" ")}
            >
              {[{ icon: Key, label: "Password Change", href: "/password" }].map(
                (sub) => (
                  <li key={sub.label}>
                    <Link
                      href={sub.href}
                      role="menuitem"
                      onClick={() => {
                        setActiveKey(sub.label);
                        setOpenDropdown("setting");
                      }}
                      aria-current={
                        activeKey === sub.label ? "page" : undefined
                      }
                      className={[
                        "flex items-center gap-2 px-4 py-2 text-[13px] rounded-md transition-colors",
                        activeKey === sub.label
                          ? "bg-(--sidebar-active-bg) text-(--sidebar-active-text)"
                          : "text-(--text-body) hover:text-[var(--hover-text)]",
                      ].join(" ")}
                    >
                      <sub.icon
                        className={[
                          "h-4 w-4",
                          activeKey === sub.label
                            ? "text-(--sidebar-active-text)"
                            : "text-(--text-muted)",
                        ].join(" ")}
                      />
                      <span>{sub.label}</span>
                    </Link>
                  </li>
                ),
              )}
            </ul>
            {/* Popout for collapsed */}
            {!isOpen && openDropdown === "setting" && (
              <ul className="absolute left-[78px] top-0 z-20 w-[220px] rounded-lg border border-(--border) bg-[var(--card-bg)] p-1 shadow-sm">
                {[
                  { icon: Key, label: "Password Change", href: "/password" },
                ].map((sub) => (
                  <li key={sub.label}>
                    <Link
                      href={sub.href}
                      onClick={() => {
                        setActiveKey(sub.label);
                      }}
                      className={[
                        "flex items-center gap-2 px-4 py-2 text-[13px] rounded-md",
                        activeKey === sub.label
                          ? "bg-(--sidebar-active-bg) text-(--sidebar-active-text)"
                          : "text-(--text-body) hover:text-[var(--hover-text)]",
                      ].join(" ")}
                    >
                      <sub.icon
                        className={[
                          "h-4 w-4",
                          activeKey === sub.label
                            ? "text-(--sidebar-active-text)"
                            : "text-(--text-muted)",
                        ].join(" ")}
                      />
                      <span>{sub.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>

          {/* Support */}
          <li className="group relative">
            <Link
              href="/support"
              onClick={() => {
                setActiveKey("Support");
              }}
              aria-current={activeKey === "Support" ? "page" : undefined}
              className={[
                "mx-2 my-1 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                activeKey === "Support"
                  ? "bg-(--sidebar-active-bg) text-(--sidebar-active-text) ring-1 ring-[var(--ring-color)]"
                  : "text-(--text-body) hover:bg-(--sidebar-hover)",
              ].join(" ")}
              aria-label="Support"
              title="Support"
            >
              <MessageCircle
                className={[
                  "h-5 w-5",
                  activeKey === "Support"
                    ? "text-(--sidebar-active-text)"
                    : "text-(--text-muted)",
                ].join(" ")}
              />
              <span className={labelClassName}>Support</span>
            </Link>
            {!isOpen && (
              <span
                role="tooltip"
                className="pointer-events-none absolute left-[78px] top-1/2 z-20 hidden -translate-y-1/2 rounded bg-(--tooltip-bg) px-2 py-1 text-xs font-medium text-(--tooltip-text) shadow group-hover:block transition-colors duration-200"
              >
                Support
              </span>
            )}
          </li>

          {/* SIA AI Assistant */}
          <li className="group relative">
            <Link
              href="/ai-assistant"
              onClick={() => {
                setActiveKey("SIA AI");
              }}
              aria-current={activeKey === "SIA AI" ? "page" : undefined}
              className={[
                "mx-2 my-1 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                activeKey === "SIA AI"
                  ? "bg-(--sidebar-active-bg) text-(--sidebar-active-text) ring-1 ring-[var(--ring-color)]"
                  : "text-(--text-body) hover:bg-(--sidebar-hover)",
              ].join(" ")}
              aria-label="SIA AI"
              title="SIA AI"
            >
              <Bot
                className={[
                  "h-5 w-5",
                  activeKey === "SIA AI"
                    ? "text-(--sidebar-active-text)"
                    : "text-(--text-muted)",
                ].join(" ")}
              />
              <span className={labelClassName}>SIA AI</span>
            </Link>
            {!isOpen && (
              <span
                role="tooltip"
                className="pointer-events-none absolute left-[78px] top-1/2 z-20 hidden -translate-y-1/2 rounded bg-(--tooltip-bg) px-2 py-1 text-xs font-medium text-(--tooltip-text) shadow group-hover:block transition-colors duration-200"
              >
                SIA AI
              </span>
            )}
          </li>
          {/* User Terms (education) */}
          <li className="group relative">
            <Link
              href="/plan-rules"
              onClick={() => {
                setActiveKey("User Terms");
              }}
              aria-current={activeKey === "User Terms" ? "page" : undefined}
              className={[
                "mx-2 my-1 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                activeKey === "User Terms"
                  ? "bg-(--sidebar-active-bg) text-(--sidebar-active-text) ring-1 ring-[var(--ring-color)]"
                  : "text-(--text-body) hover:bg-(--sidebar-hover)",
              ].join(" ")}
              aria-label="User Terms"
              title="User Terms"
            >
              <FileText
                className={[
                  "h-5 w-5",
                  activeKey === "User Terms"
                    ? "text-(--sidebar-active-text)"
                    : "text-(--text-muted)",
                ].join(" ")}
              />
              <span className={labelClassName}>User Terms</span>
            </Link>
            {!isOpen && (
              <span
                role="tooltip"
                className="pointer-events-none absolute left-[78px] top-1/2 z-20 hidden -translate-y-1/2 rounded bg-(--tooltip-bg) px-2 py-1 text-xs font-medium text-(--tooltip-text) shadow group-hover:block transition-colors duration-200"
              >
                User Terms
              </span>
            )}
          </li>
        </ul>

        {/* Footer (logout only) */}

        <div className="border-t px-3 pb-4 pt-3 border-(--border)">
          <button
            className={[
              "inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border text-sm font-bold",
              "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
              !isOpen ? "h-12 w-12 p-0 rounded-[12px]" : "",
            ].join(" ")}
            onClick={() => {
              // Clear user-specific profile photo from localStorage
              if (typeof window !== "undefined" && user?.id) {
                localStorage.removeItem(`profilePhoto_${user.id}`);
              }
              logoutApi();
              dispatch(logoutAction());
              router.push("/login");
            }}
          >
            <LogOut className="h-4 w-4" />
            <span className={isOpen ? "inline" : "hidden"}>Logout</span>
          </button>
        </div>
      </nav>
      {/* Overlay for tablet and mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
