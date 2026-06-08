import type { User } from "@/lib/api/types";

/** Default demo user — no JWT, session stored as auth_user only */
export const DEMO_USER: User = {
  id: "1001",
  display_id: "SIA00057",
  name: "Rahul Sharma",
  email: "rahul.sharma@example.com",
  phone: "9876543210",
  role: "user",
  kyc_status: "approved",
  has_transaction_password: true,
};

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("auth_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function saveDemoSession(user: User = DEMO_USER): User {
  if (typeof window !== "undefined") {
    localStorage.removeItem("auth_token");
    localStorage.setItem("auth_user", JSON.stringify(user));
  }
  return user;
}

export function clearDemoSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_user");
  localStorage.removeItem("demo_has_transaction_password");
}

export function isDemoSessionActive(): boolean {
  return !!getStoredUser();
}
