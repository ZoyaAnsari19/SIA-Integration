"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/sidebar";
import Topbar from "@/components/topbar";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Routes where sidebar and topbar should be hidden
  const authRoutes = ["/login", "/forgot-password"];
  const isAuthRoute = authRoutes.some((route) => pathname?.startsWith(route));

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <Sidebar />
        <div className="flex-1 flex flex-col min-h-screen min-w-0">
          <Topbar />
          <main className="flex-1 p-4 md:p-6 overflow-x-hidden bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
