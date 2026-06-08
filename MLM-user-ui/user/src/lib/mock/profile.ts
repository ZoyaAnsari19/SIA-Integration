import type { UserProfileResponse, KYCStatusResponse } from "@/lib/api/kyc";

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

let mockProfile: UserProfileResponse = {
  id: "1001",
  user_id: "1001",
  name: "Rahul Sharma",
  display_title: "Level 2 Member",
  email: "rahul.sharma@example.com",
  phone: "9876543210",
  kyc_status: "approved",
  kyc_verified_at: "2025-11-15T10:00:00.000Z",
  kyc_fee_amount: 0,
  referrer_name: "Amit Kumar",
  referrer_display_id: "SIA00012",
  profile: {
    phone: "9876543210",
    profile_photo_url:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&h=200&fit=crop&crop=faces",
    date_of_birth: "1990-05-20",
    address: "123 MG Road, Andheri East",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400069",
    bank_account_no: "123456789012",
    bank_ifsc: "SBIN0001234",
    bank_name: "State Bank of India",
    bank_branch: "Andheri",
    bank_ac_holder: "Rahul Sharma",
    bank_upi: "rahul@upi",
    pan_number: "ABCDE1234F",
    aadhar_number: "123456789012",
  },
};

let mockKycStatus: KYCStatusResponse = {
  user_id: "1001",
  kyc_status: "approved",
  kyc_verified_at: "2025-11-15T10:00:00.000Z",
  documents: [
    {
      id: "doc-1",
      document_type: "aadhar",
      document_number: "123456789012",
      status: "approved",
      submitted_at: "2025-11-10T08:00:00.000Z",
      verified_at: "2025-11-15T10:00:00.000Z",
    },
    {
      id: "doc-2",
      document_type: "pan",
      document_number: "ABCDE1234F",
      status: "approved",
      submitted_at: "2025-11-10T08:00:00.000Z",
      verified_at: "2025-11-15T10:00:00.000Z",
    },
  ],
};

export type { UserProfileResponse, KYCStatusResponse };

export async function getUserProfile(): Promise<UserProfileResponse> {
  await delay();
  return structuredClone(mockProfile);
}

export async function getKYCStatus(_userId?: string): Promise<KYCStatusResponse> {
  await delay();
  return structuredClone(mockKycStatus);
}

export async function getProfileUpdateFee(): Promise<number> {
  await delay(100);
  return 50;
}

export async function getNameChangeFee(): Promise<number> {
  await delay(100);
  return 100;
}

export function isKYCSubmissionAllowed(): { allowed: boolean; message?: string } {
  return { allowed: true };
}

export async function sendNameChangeOTP(_mobile: string) {
  await delay(500);
  return { success: true, message: "OTP sent successfully (demo)" };
}

export async function verifyNameChangeOTP(_mobile: string, otp: string) {
  await delay(500);
  if (otp.length !== 6) {
    throw new Error("Invalid OTP");
  }
  return {
    success: true,
    message: "OTP verified (demo)",
    verificationToken: "mock-verification-token",
  };
}

export async function checkAccountNumberExists(accountNumber: string) {
  await delay(300);
  const exists = accountNumber === "999999999999";
  return {
    exists,
    message: exists ? "This account number is already registered." : "",
  };
}

export async function updateProfile(data: Record<string, unknown>) {
  await delay(400);
  if (data.name) mockProfile.name = String(data.name);
  if (data.email) mockProfile.email = String(data.email);
  if (data.phone) {
    mockProfile.phone = String(data.phone);
    if (mockProfile.profile) mockProfile.profile.phone = String(data.phone);
  }
  if (data.address && mockProfile.profile) mockProfile.profile.address = String(data.address);
  if (data.city && mockProfile.profile) mockProfile.profile.city = String(data.city);
  if (data.state && mockProfile.profile) mockProfile.profile.state = String(data.state);
  if ((data.pincode || data.zipCode) && mockProfile.profile) {
    mockProfile.profile.pincode = String(data.pincode || data.zipCode);
  }
  if (mockProfile.profile) {
    if (data.accountHolderName || data.bank_ac_holder) {
      mockProfile.profile.bank_ac_holder = String(data.accountHolderName || data.bank_ac_holder);
    }
    if (data.accountNumber || data.bank_account_no) {
      mockProfile.profile.bank_account_no = String(data.accountNumber || data.bank_account_no);
    }
    if (data.bankName || data.bank_name) {
      mockProfile.profile.bank_name = String(data.bankName || data.bank_name);
    }
    if (data.branch || data.bank_branch) {
      mockProfile.profile.bank_branch = String(data.branch || data.bank_branch);
    }
    if (data.ifscCode || data.bank_ifsc) {
      mockProfile.profile.bank_ifsc = String(data.ifscCode || data.bank_ifsc);
    }
    if (data.upiId || data.bank_upi) {
      mockProfile.profile.bank_upi = String(data.upiId || data.bank_upi);
    }
  }
  return structuredClone(mockProfile);
}

export async function uploadProfilePhoto(file: File) {
  await delay(600);
  const url = URL.createObjectURL(file);
  if (mockProfile.profile) mockProfile.profile.profile_photo_url = url;
  return { profile_photo_url: url };
}

export async function uploadKYCDocument(
  file: File,
  documentType: string,
  side: "front" | "back",
) {
  await delay(500);
  const image_url = URL.createObjectURL(file);
  return {
    image_url,
    url: image_url,
    document_type: documentType,
    side,
    uploaded_at: new Date().toISOString(),
  };
}

export async function submitKYC(_userId: string, data: Record<string, unknown>) {
  await delay(800);
  mockProfile.kyc_status = "submitted";
  mockKycStatus.kyc_status = "submitted";
  if (data.pan_number) {
    if (mockProfile.profile) mockProfile.profile.pan_number = String(data.pan_number);
  }
  if (data.aadhar_number) {
    if (mockProfile.profile) mockProfile.profile.aadhar_number = String(data.aadhar_number);
  }
  return { success: true, message: "KYC submitted successfully (demo)" };
}
