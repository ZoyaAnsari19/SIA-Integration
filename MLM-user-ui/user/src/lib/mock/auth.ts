import type { LoginRequest, LoginResponse } from "@/lib/api/types";
import { DEMO_USER, saveDemoSession } from "@/lib/mock/demoSession";

const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));

function buildMockUser(credentials: LoginRequest) {
  const userId = credentials.userId.trim();
  const isEmail = userId.includes("@");

  return {
    ...DEMO_USER,
    display_id: isEmail ? DEMO_USER.display_id : userId || DEMO_USER.display_id,
    email: isEmail ? userId : DEMO_USER.email,
    has_transaction_password: true,
  };
}

export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  await delay(150);

  if (!credentials.userId?.trim() || !credentials.password) {
    throw new Error("User ID and password are required");
  }

  const user = buildMockUser(credentials);
  saveDemoSession(user);

  return { token: "", user };
}

export async function setTransactionPassword(
  pin: string,
  confirmPin: string,
): Promise<void> {
  await delay(500);

  if (!pin || !confirmPin) {
    throw new Error("PIN and confirm PIN are required");
  }
  if (pin.length < 4 || pin.length > 6) {
    throw new Error("PIN must be 4-6 digits");
  }
  if (pin !== confirmPin) {
    throw new Error("PIN and confirm PIN do not match");
  }

}
