'use client';

import { usePathname, useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";

export function SupportFab() {
  const pathname = usePathname();
  const router = useRouter();

  // Hide on support pages themselves
  if (pathname?.startsWith("/support")) return null;

  return (
    <button
      type="button"
      onClick={() => router.push("/support")}
      className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-blue)] text-white shadow-[0_10px_25px_rgba(0,0,0,0.35)] hover:bg-[var(--brand-blue-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-blue)] focus:ring-offset-[var(--app-bg)] transition-colors"
      aria-label="Contact support"
    >
      <MessageCircle className="h-6 w-6" />
    </button>
  );
}

