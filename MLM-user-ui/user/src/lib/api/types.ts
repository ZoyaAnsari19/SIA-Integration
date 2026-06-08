/**
 * API Response Types
 * TypeScript interfaces for all API responses
 */

// Base API Response
export interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Auth Types
export interface LoginRequest {
  userId: string; // User ID (numeric) or email
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    display_id?: string | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    role: string;
    kyc_status?: string;
    has_transaction_password?: boolean;
  };
}

export interface User {
  id: string;
  display_id?: string | null;
  name?: string | null;
  display_title?: string | null;
  display_title_icon_url?: string | null;
  email?: string | null;
  phone?: string | null;
  role: string;
  kyc_status?: string;
  has_transaction_password?: boolean;
}

// Wallet Types
export interface WalletBalance {
  user_id: string;
  balance: number; // Total balance
  spot_balance: number; // SPOT commissions wallet
  other_balance: number; // Main wallet (SELF, GLOBAL_HELPING) - package renewal
  team_royalty_balance?: number; // Team Royalty wallet (Direct + Team Monthly Royalties)
  /** 10× package value limit for Spot + Team Royalty withdrawals (Phase 2) */
  spot_team_withdraw_limit?: number;
  spot_team_withdraw_used?: number;
  spot_team_withdraw_remaining?: number;
  /** Admin-configured multiplier (e.g. 5, 10) for Spot/Team Royalty limit */
  spot_team_withdraw_multiplier?: number;
  /** When 10× (N×) limit was first fully used (for flush countdown) */
  spot_team_limit_reached_at?: string | null;
  /** If true, flush mode is active (Spot/Team incomes are being flushed) */
  spot_team_flush_active?: boolean;
  /** SPOT amount under 14-day hold (not withdrawable yet) */
  spot_locked_hold?: number;
  /** SPOT amount available to withdraw (spot_balance - spot_locked_hold) */
  available_spot_balance?: number;
  /** Main wallet (SELF + GLOBAL) amount under reinvestment 90→60→30 day lock (not withdrawable yet) */
  main_locked_hold?: number;
  /** Main wallet amount available to withdraw (other_balance - main_locked_hold) */
  available_main_balance?: number;
}

// Dashboard Types
export interface DashboardStats {
  total_income?: number;
  total_commissions?: number;
  team_business?: number;
  active_packages?: number;
}

export interface CommissionSummary {
  self?: number;
  spot?: number;
  global_helping?: number;
  monthly?: number;
  total?: number;
}

// KYC Types
export interface KYCProfile {
  personal?: {
    mobile?: string;
    email?: string;
  };
  address?: {
    address?: string;
    city?: string;
    district?: string;
    state?: string;
    zipCode?: string;
  };
  bank?: {
    accountHolderName?: string;
    accountNumber?: string;
    bankName?: string;
    branch?: string;
    ifscCode?: string;
    upiId?: string;
    nomineeContact?: string;
    nomineeName?: string;
    nomineeRelation?: string;
  };
  kyc_status?: 'pending' | 'submitted' | 'approved' | 'rejected';
}

export interface KYCDocumentUploadResponse {
  image_url: string;
  url?: string; // Alias for image_url for backward compatibility
  document_type: string;
  side: 'front' | 'back';
  uploaded_at?: string;
}

export interface KYCSubmitRequest {
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  pan_number: string;
  aadhar_number: string;
  documents: Array<{
    document_type: string;
    document_number: string;
    front_image_url: string;
    back_image_url: string;
  }>;
}

// Ledger/Income History Types
export interface LedgerEntry {
  id: string;
  commission_type: 'SELF' | 'SPOT' | 'GLOBAL_HELPING' | 'MONTHLY';
  amount: number;
  source_user_id?: string;
  source_user_name?: string | null;
  source_user_display_id?: string | null;
  purchase_id?: string | null;
  investment?: number | null;
  package_name?: string | null;
  package_price?: number | null;
  level?: number | null;
  credited_at: string;
  settled?: boolean;
  /** SPOT 14-day hold: date (YYYY-MM-DD) after which this amount is withdrawable */
  hold_until?: string | null;
  /** SPOT 14-day hold: true if amount is still under hold (not withdrawable yet) */
  is_locked?: boolean;
  used_ids?: number | null; // Global IDs used for GLOBAL_HELPING commissions (active at credit time)
  /** raw − active global contributors at credit time; null for older ledger rows */
  inactive_global_contributors?: number | null;
  metadata?: {
    wallet_type?: 'spot_balance' | 'other_balance';
    from_wallet?: 'spot' | 'other';
    spot_deducted?: number;
    other_deducted?: number;
    used_ids?: number | null;
    inactive_global_contributors?: number | null;
    global_contributors_raw?: number;
    global_contributors_active?: number;
    [key: string]: any;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

// Package Types
export interface Package {
  id: number;
  name: string;
  price: number;
  min_amount?: number | null;
  max_amount?: number | null;
  self_monthly?: number | null;
  self_roi_percent?: number | null;
  global_ids?: number | null;
  global_monthly_per_id?: number | null;
  recurring_rate_percent?: number | null;
  validity_months: number;
  validity_days?: number | null;
  status?: 'active' | 'inactive';
  course_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface PackagePurchase {
  id: string;
  package_id: number;
  package_name?: string | null;
  amount: number;
  income: number; // Income earned from this purchase (for 2x progress)
  purchased_at: string;
  // active_until removed - expiry is ONLY based on 2x income
  status: 'completed' | 'active' | 'expired';
  is_active: boolean;
  is_renewal?: boolean; // Whether this is a renewal purchase
  previous_package_id?: number | null; // Previous package ID if renewal
  previous_purchase_id?: string | null; // Previous purchase ID (exact expired purchase) if renewal/upgrade
  renewed_at?: string | null; // Renewal date if this is a renewal
  global_ids_info?: {
    package_cap: number;
    used_ids: number;
    remaining_ids: number;
    is_cap_reached: boolean;
    new_ids_after_cap: number | null;
    cap_exceed_loss: number | null;
    total_global_users: number;
    contributors_raw_in_window?: number;
    contributors_active_in_window?: number;
    inactive_global_contributors?: number;
  };
  expiry_loss?: {
    total_loss: number;
    days_since_expiry: number;
    daily_breakdown: Array<{
      day: number;
      date: string;
      self_income: number;
      monthly_royalty: number;
      spot_income: number;
      total: number;
    }>;
  };
  renewal_countdown?: {
    last_income_date: string | null;
    renewal_deadline: string; // FIXED deadline - frontend calculates real-time countdown from this
    countdown: {
      days: number;
      hours: number;
      minutes: number;
      seconds: number;
      total_seconds: number;
    };
    can_renew: boolean;
  };
}

export interface PurchaseRequest {
  package_id: number;
  request_type: 'activation' | 'reinvestment' | 'renew';
  amount: number;
  txn_id?: string;
  payment_proof_url?: string;
  payment_type?: string;
  remarks?: string;
}

// Wallet Transfer Types
export interface P2PTransferRequest {
  receiver_id: string;
  amount: number;
  from_wallet: 'other'; // REQUIRED: P2P transfers only allowed from Main wallet (other)
  remarks?: string;
  transaction_password: string; // Required for P2P transfer
  otp: string; // Required: email OTP sent to registered email
}

export interface WalletTransferRequest {
  to_user_id: string;
  amount: number;
  from_wallet: 'spot' | 'other'; // REQUIRED: Which wallet to transfer from
  remarks?: string;
}

// Withdrawal Types
export interface WithdrawalRequest {
  amount: number;
  payment_method: 'bank' | 'upi';
  account_details: string; // JSON stringified
  withdraw_type?: 'wallet' | 'spot' | 'team_royalty';
  remarks?: string;
  transaction_password: string; // Required for withdrawal
}

export interface WithdrawalRequestResponse {
  id: string;
  user_id: string;
  withdraw_type: string;
  amount: number;
  payment_method: string;
  account_details: any;
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'cancelled';
  available_balances: {
    spot: number;
    other: number; // Backend API uses "other" field name, but UI displays as "Main"
    total: number;
  };
  allowed_wallets: Array<'spot' | 'other'>; // Based on current date - Backend API uses "other" value, but UI displays as "Main Wallet"
  created_at: string;
}

export interface WithdrawRules {
  min_withdraw: number;
  max_withdraw: number | null;
  spot_min_withdraw: number;
  admin_charges: number;
  withdrawal_enabled: boolean;
}

// Error Types
// Company Bank Account Types
export interface CompanyBankAccount {
  id: number;
  bank_name: string;
  bank_ac_holder: string;
  bank_ac_no: string;
  bank_ifsc: string;
  bank_branch: string | null;
  bank_upi: string | null;
  qr_image: string | null;
}

export interface ApiError {
  error: string;
  message?: string;
  details?: any;
}

