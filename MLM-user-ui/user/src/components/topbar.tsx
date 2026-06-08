"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Menu, Trophy, Users, Wallet, ChevronDown, Plus } from "lucide-react";
import { useSidebar } from "@/contexts/sidebar-context";
import { useTheme } from "@/contexts/theme-context";
import {
  NotificationPopup,
  type Notification,
} from "@/components/ui/me/NotificationPopup";
import { useAppSelector, useAppDispatch } from "@/redux/hooks";
import { logout as logoutAction } from "@/redux/features/auth/authSlice";
import { clearDemoSession } from "@/lib/mock/demoSession";
import { getDashboardNotices } from "@/lib/api/dashboard";
import { getUserProfile } from "@/lib/api/kyc";

export default function Topbar() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { toggle } = useSidebar();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const user = useAppSelector((state) => state.auth.user);
  const [avatarSrc, setAvatarSrc] = useState(
    "https://ui-avatars.com/api/?name=User&background=0D8ABC&color=fff&size=80",
  );
  const { theme, toggleTheme } = useTheme();

  // Fetch and update avatar when user changes
  useEffect(() => {
    const fetchProfilePhoto = async () => {
      if (!user?.id) {
        // Clear avatar if no user
        setAvatarSrc(`https://ui-avatars.com/api/?name=User&background=0D8ABC&color=fff&size=80`);
        return;
      }

      // First check localStorage for this specific user
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(`profilePhoto_${user.id}`);
        if (stored) {
          setAvatarSrc(stored);
          return;
        }
      }

      // Fetch from API
      try {
        const profile = await getUserProfile();
        if (profile?.profile?.profile_photo_url) {
          const photoUrl = profile.profile.profile_photo_url;
          setAvatarSrc(photoUrl);
          if (typeof window !== "undefined") {
            localStorage.setItem(`profilePhoto_${user.id}`, photoUrl);
          }
        } else {
          // Use generated avatar if no photo
          setAvatarSrc(`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "User")}&background=0D8ABC&color=fff&size=80`);
        }
      } catch (err) {
        console.error("Error fetching profile photo:", err);
        // Fallback to generated avatar
        setAvatarSrc(`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "User")}&background=0D8ABC&color=fff&size=80`);
      }
    };

    fetchProfilePhoto();
  }, [user?.id, user?.name]);

  const handleLogout = () => {
    // Clear user-specific profile photo from localStorage
    if (typeof window !== "undefined" && user?.id) {
      localStorage.removeItem(`profilePhoto_${user.id}`);
    }
    clearDemoSession();
    dispatch(logoutAction());
    setProfileOpen(false);
    router.push("/login");
  };
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Fetch notifications from API
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const noticesData = await getDashboardNotices();
        // Convert notices to Notification format
        const convertedNotifications: Notification[] = noticesData.items.map((notice) => {
          // Determine notification type based on title/content
          let type: Notification["type"] = "info";
          const titleLower = notice.title.toLowerCase();
          const contentLower = notice.content.toLowerCase();
          
          if (titleLower.includes("welcome") || contentLower.includes("welcome")) {
            type = "success";
          } else if (titleLower.includes("warning") || contentLower.includes("warning") || titleLower.includes("renew")) {
            type = "warning";
          } else if (titleLower.includes("error") || contentLower.includes("error")) {
            type = "error";
          }

          // Calculate time ago
          const noticeDate = new Date(notice.created_at);
          const now = new Date();
          const diffMs = now.getTime() - noticeDate.getTime();
          const diffMins = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMs / 3600000);
          const diffDays = Math.floor(diffMs / 86400000);

          let timeAgo = "";
          if (diffMins < 1) {
            timeAgo = "Just now";
          } else if (diffMins < 60) {
            timeAgo = `${diffMins}m ago`;
          } else if (diffHours < 24) {
            timeAgo = `${diffHours}h ago`;
          } else if (diffDays === 1) {
            timeAgo = "Yesterday";
          } else if (diffDays < 7) {
            timeAgo = `${diffDays} days ago`;
          } else {
            timeAgo = noticeDate.toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
            });
          }

          // Use link field directly from API (not from markdown parsing)
          const linkUrl = notice.link || undefined;
          const linkText = linkUrl ? "Click here" : undefined;
          const message = notice.content || '';

          return {
            id: `notice-${notice.id}`,
            type,
            title: notice.title,
            message: message,
            time: timeAgo,
            linkText,
            linkUrl,
          };
        });
        setNotifications(convertedNotifications);
      } catch (err) {
        console.error("Error fetching notifications:", err);
        setNotifications([]);
      }
    };
    fetchNotifications();
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (profileRef.current && !profileRef.current.contains(target))
        setProfileOpen(false);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-[var(--topbar-bg)] border-[var(--border)] px-3 sm:px-4 md:px-6 transition-colors duration-200">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Menu icon for tablet and mobile */}
        <button
          onClick={toggle}
          className="lg:hidden inline-flex items-center justify-center h-10 w-10 rounded-lg text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-strong)] transition-colors shrink-0"
          aria-label="Toggle sidebar"
          title="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="ml-0 flex items-center gap-1.5 sm:gap-2 text-[var(--text-strong)] font-semibold min-w-0 flex-1 overflow-hidden">
          <span className="text-xs sm:text-sm shrink-0">Welcome,</span>
          <small className="text-xs sm:text-sm text-[var(--text-muted)] font-semibold truncate min-w-0" title={user?.name || "User"}>
            {user?.name || "User"}
          </small>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 shrink-0">
        <Link
          href="/add-balance"
          className="inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-md sm:rounded-lg border border-[var(--brand-blue)] bg-[var(--brand-blue)] px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-white hover:opacity-90 active:opacity-80 transition-opacity min-h-[40px] sm:min-h-[44px] shadow-sm hover:shadow-md"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Buy More</span>
        </Link>
        <Link
          href="/withdraw/spot-withdraw-request?new=1"
          className="inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-md sm:rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-[var(--text-strong)] hover:bg-[var(--hover-bg)] active:opacity-80 transition-colors min-h-[40px] sm:min-h-[44px] shadow-sm"
        >
          <Wallet className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Create Withdraw Request</span>
        </Link>

        <div className="hidden items-center gap-3 md:flex">
          <IconButton
            icon={<Trophy className="h-5 w-5" />}
            label="Leaderboard"
            href="/leaderboard"
          />
          <IconButton
            icon={<Users className="h-5 w-5" />}
            label="Team"
            href="/team"
          />
          <IconButton
            icon={<Wallet className="h-5 w-5" />}
            label="Withdraw"
            href="/withdraw/spot-withdraw-request"
          />
        </div>

        {/* Notifications */}
        <NotificationPopup notifications={notifications} />

        <div ref={profileRef} className="relative shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setProfileOpen((v) => !v);
            }}
            className="flex items-center gap-1.5 sm:gap-2 rounded-full border border-[var(--border)] bg-[var(--card-bg)] px-1.5 sm:px-2 py-1 hover:bg-[var(--hover-bg)] hover:border-[var(--hover-border)] transition-colors min-h-[40px] sm:min-h-[44px]"
            aria-haspopup="menu"
            aria-expanded={profileOpen}
          >
            <img
              src={avatarSrc}
              alt=""
              onError={() =>
                setAvatarSrc(
                  "https://ui-avatars.com/api/?name=A&background=0D8ABC&color=fff&size=80",
                )
              }
              className="h-8 w-8 sm:h-10 sm:w-10 rounded-full object-cover shrink-0"
            />
            <span className="hidden md:block text-sm text-[var(--text-strong)]">
              {user?.name || user?.display_id || "User"}
            </span>
            <ChevronDown className="hidden md:block h-4 w-4 text-[var(--text-muted)] shrink-0" />
          </button>

          {profileOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card-bg)] shadow-md transition-colors duration-200"
            >
              <Link
                href="/profile"
                onClick={(e) => {
                  e.stopPropagation();
                  setProfileOpen(false);
                }}
                className="block px-4 py-2 text-sm text-[var(--text-strong)] hover:bg-[var(--hover-bg)] transition-colors"
                role="menuitem"
              >
                Profile
              </Link>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleLogout();
                }}
                className="w-full text-left block px-4 py-2 text-sm text-[var(--text-strong)] hover:bg-[var(--hover-bg)] transition-colors"
                role="menuitem"
              >
                Logout
              </button>
              <div className="my-1 h-px bg-[var(--border)]" />
              <div className="flex items-center justify-between px-4 py-3 relative group">
                <span className="text-sm text-[var(--text-strong)]">
                  Dark Mode
                </span>
                <label 
                  className={`relative inline-flex h-6 w-11 items-center ${theme === "dark" ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                  title={theme === "dark" ? "Coming Soon" : ""}
                >
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={theme === "dark"}
                    onChange={theme === "dark" ? undefined : toggleTheme}
                    disabled={theme === "dark"}
                    aria-label="Dark Mode"
                  />
                  <span className="absolute inset-0 rounded-full bg-zinc-300 transition peer-checked:bg-[var(--brand-blue)]" />
                  <span className="absolute left-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
                </label>
                {theme === "dark" && (
                  <div className="absolute right-2 top-full mt-2 px-2 py-1 text-xs text-white bg-gray-800 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap">
                    Coming Soon
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function IconButton({
  icon,
  label,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
}) {
  const className =
    "relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--hover-bg)] hover:border-[var(--hover-border)] transition-colors group";

  if (href) {
    return (
      <Link href={href} className={className} aria-label={label} title={label}>
        <span className="text-[var(--text-body)] group-hover:text-[var(--hover-text)] transition-colors">
          {icon}
        </span>
      </Link>
    );
  }

  return (
    <button className={className} aria-label={label} title={label}>
      <span className="text-[var(--text-body)] group-hover:text-[var(--hover-text)] transition-colors">
        {icon}
      </span>
    </button>
  );
}
