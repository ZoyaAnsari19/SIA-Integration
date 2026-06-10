import type { PinInfo, PinStatus, VerifyPinResponse } from "../api/admin-pin";

export type { PinInfo, PinStatus, VerifyPinResponse };

const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));

const pinInfoStore: Record<string, PinInfo> = {
  "sub-admin-001": {
    success: true,
    sub_admin_id: "sub-admin-001",
    sub_admin_name: "Priya Operations",
    sub_admin_email: "priya.ops@example.com",
    has_pin: true,
    pin_value: "1234",
    is_locked: false,
    locked_until: null,
    failed_attempts: 0,
    pin_set_at: "2025-11-01T08:00:00.000Z",
    pin_set_by_name: "Super Admin",
  },
  "sub-admin-002": {
    success: true,
    sub_admin_id: "sub-admin-002",
    sub_admin_name: "Amit Support",
    sub_admin_email: "amit.support@example.com",
    has_pin: true,
    pin_value: "5678",
    is_locked: false,
    locked_until: null,
    failed_attempts: 0,
    pin_set_at: "2025-12-15T09:30:00.000Z",
    pin_set_by_name: "Super Admin",
  },
};

/** Demo: logged-in as super admin — PIN not required */
export async function getPinStatus(): Promise<PinStatus> {
  await delay(100);
  return {
    success: true,
    has_pin: false,
    requires_pin: false,
    is_locked: false,
    locked_until: null,
    pin_set_at: null,
  };
}

export async function verifyPin(_pin: string): Promise<VerifyPinResponse> {
  await delay(200);
  return {
    success: true,
    verified: true,
    message: "PIN verified (demo)",
  };
}

export async function setSubAdminPin(
  subAdminId: string,
  pin: string,
): Promise<{ success: boolean; message: string }> {
  await delay(300);
  pinInfoStore[subAdminId] = {
    success: true,
    sub_admin_id: subAdminId,
    sub_admin_name: pinInfoStore[subAdminId]?.sub_admin_name || "Sub Admin",
    sub_admin_email: pinInfoStore[subAdminId]?.sub_admin_email || null,
    has_pin: true,
    pin_value: pin,
    is_locked: false,
    locked_until: null,
    failed_attempts: 0,
    pin_set_at: new Date().toISOString(),
    pin_set_by_name: "Super Admin",
  };
  return { success: true, message: "PIN set successfully (demo)" };
}

export async function resetSubAdminPin(
  subAdminId: string,
  newPin: string,
): Promise<{ success: boolean; message: string }> {
  return setSubAdminPin(subAdminId, newPin);
}

export async function getSubAdminPinInfo(subAdminId: string): Promise<PinInfo> {
  await delay(150);
  return (
    pinInfoStore[subAdminId] || {
      success: true,
      sub_admin_id: subAdminId,
      sub_admin_name: "Sub Admin",
      sub_admin_email: null,
      has_pin: false,
      pin_value: null,
      is_locked: false,
      locked_until: null,
      failed_attempts: 0,
      pin_set_at: null,
      pin_set_by_name: null,
    }
  );
}

export async function unlockSubAdminPin(
  subAdminId: string,
): Promise<{ success: boolean; message: string }> {
  await delay(200);
  if (pinInfoStore[subAdminId]) {
    pinInfoStore[subAdminId] = {
      ...pinInfoStore[subAdminId],
      is_locked: false,
      locked_until: null,
      failed_attempts: 0,
    };
  }
  return { success: true, message: "PIN unlocked (demo)" };
}
