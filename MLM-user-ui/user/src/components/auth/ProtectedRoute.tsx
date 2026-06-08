"use client";

/**
 * Demo mode: auth/JWT disabled — all routes render without login gate.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
