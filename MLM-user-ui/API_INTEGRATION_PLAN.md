# MLM User UI - API Integration Plan

## 📋 Overview

This plan outlines the step-by-step integration of MLM-API backend with MLM-user-ui frontend. The integration will be done in priority order, starting with authentication and core features.

**Status:** Phase 1 (Seeding) ✅ Complete - Starting from Phase 2 (API Integration)

---

## 🔍 Current State Analysis

### ✅ What's Already Implemented

1. **UI Structure:**
   - ✅ All pages/components created
   - ✅ Redux store setup (`authSlice` with login/logout actions)
   - ✅ Theme system (dark/light mode)
   - ✅ UI components library (Button, Card, Input, Table, etc.)
   - ✅ Form validation and error handling

2. **Pages Ready for Integration:**
   - ✅ Login page (`/login`)
   - ✅ Dashboard (`/dashboard`)
   - ✅ Profile (`/profile`)
   - ✅ KYC pages (in profile)
   - ✅ Income History (`/income-history/*`)
   - ✅ Package Purchase (`/add-balance`, `/pay-now`, `/renew`)
   - ✅ Wallet Transfers (`/transfer-money/*`)
   - ✅ Withdrawal (`/withdraw/*`)
   - ✅ Leaderboard (`/leaderboard`)
   - ✅ My Course (`/my-course`)

3. **What's Missing:**
   - ❌ API client/service layer
   - ❌ API types/interfaces
   - ❌ Token management
   - ❌ API error handling
   - ❌ Loading states for API calls
   - ❌ Actual API integration in pages

---

## 🎯 Integration Priority Order

### Phase 1: Foundation (CRITICAL - Must Do First)
1. **API Client Setup** - Axios client, interceptors, error handling
2. **Auth Integration** - Login, token storage, protected routes
3. **Types Definition** - TypeScript interfaces for all API responses

### Phase 2: Core Features (HIGH PRIORITY)
4. **Dashboard** - Wallet balance, stats, commission summary
5. **KYC** - Profile fetch, document upload, KYC submission
6. **Ledger/Income History** - All income history endpoints
7. **Package Purchase** - List packages, create purchase, renew
8. **Wallet** - Balance display, P2P transfer, wallet transfer
9. **Withdrawal** - Create request, list requests, status

### Phase 3: Additional Features (MEDIUM PRIORITY)
10. **My Course** - Course list, global IDs info, expiry loss
11. **Leaderboard** - Top members, user rank
12. **Team** - Team hierarchy, team business
13. **Profile Updates** - Update personal, address, bank details

### Phase 4: Nice to Have (LOW PRIORITY)
14. **Notifications** - Notices, alerts
15. **Support** - Support tickets
16. **Path Rank** - Rank journey visualization

---

## 📝 Detailed Integration Plan

### **STEP 1: API Client Setup** 🚀

**Files to Create:**
- `user/src/lib/api/client.ts` - Axios client with interceptors
- `user/src/lib/api/types.ts` - TypeScript types/interfaces
- `user/src/lib/api/errors.ts` - Error handling utilities

**Dependencies to Install:**
```bash
cd user
npm install axios
```

**Implementation:**
- Create Axios instance with base URL from `NEXT_PUBLIC_API_URL`
- Request interceptor: Add JWT token from localStorage/Redux
- Response interceptor: Handle 401 (logout), 500 (show error)
- Error handling: Parse API errors and show user-friendly messages

**Environment Variable:**
```env
NEXT_PUBLIC_API_URL=https://api.secureinfiniteassociation.com/api/v1
```

---

### **STEP 2: Auth Integration** 🔐

**Files to Create:**
- `user/src/lib/api/auth.ts` - Auth API service

**Files to Modify:**
- `user/src/app/login/page.tsx` - Integrate login API
- `user/src/redux/features/auth/authSlice.ts` - Add token storage
- `user/src/app/layout.tsx` or middleware - Protected route logic

**API Endpoints:**
- `POST /api/v1/auth/login` - Login with userId/password
- `GET /api/v1/auth/me` - Get current user info

**Changes:**
1. Update login form to call `authApi.login()`
2. Store token in localStorage and Redux
3. Update authSlice to store token
4. Add protected route wrapper (redirect to login if not authenticated)
5. Add token refresh logic (if needed)

**Login Request:**
```typescript
{
  userId: string,  // User ID (display_id or numeric ID)
  password: string
}
```

**Login Response:**
```typescript
{
  token: string,
  user: {
    id: string,
    display_id: string,
    name: string,
    email: string,
    role: string
  }
}
```

---

### **STEP 3: Dashboard Integration** 📊

**Files to Create:**
- `user/src/lib/api/dashboard.ts` - Dashboard API service

**Files to Modify:**
- `user/src/app/dashboard/page.tsx` - Replace mock data with API calls

**API Endpoints:**
- `GET /api/v1/dashboard/wallet` - Get wallet balance (spot_balance, other_balance, total)
- `GET /api/v1/dashboard` - Get dashboard stats
- `GET /api/v1/dashboard/commissions-summary` - Commission summary
- `GET /api/v1/dashboard/team-business` - Team business income
- `GET /api/v1/dashboard/commission-trend` - Commission trend chart data

**Key Changes:**
1. Display `spot_balance` and `other_balance` separately
2. Show total balance
3. Load commission summary, team business, trends
4. Add loading states
5. Handle errors gracefully

**Wallet Response:**
```typescript
{
  user_id: string,
  balance: number,        // Total balance
  spot_balance: number,  // SPOT commissions wallet
  other_balance: number  // Other commissions wallet (SELF, GLOBAL_HELPING, MONTHLY)
}
```

---

### **STEP 4: KYC Integration** 📄

**Files to Create:**
- `user/src/lib/api/kyc.ts` - KYC API service

**Files to Modify:**
- `user/src/app/profile/page.tsx` - Integrate KYC APIs
- KYC submission components (if separate)

**API Endpoints:**
- `GET /api/v1/users/:id/profile` - Get user profile (includes KYC status)
- `POST /api/v1/user/kyc/document` - Upload KYC document (multipart/form-data)
- `POST /api/v1/users/:id/kyc/submit` - Submit KYC request

**Key Features:**
1. **Date Validation:** Check if current date is **not** in blocked list (1, 9, 10, 19, 20, 29, 30, 31)
2. **Document Upload:** Upload front/back images to Bunny CDN
3. **KYC Submission:** Submit KYC with all required fields
4. **Status Display:** Show KYC approval status

**KYC Document Upload:**
```typescript
FormData:
- document_type: 'aadhar' | 'pan' | 'passport' | 'driving_license' | 'bank_statement' | 'others'
- side: 'front' | 'back'
- file: File
```

**KYC Submit Request:**
```typescript
{
  phone: string,
  address: string,
  city: string,
  state: string,
  pincode: string,
  pan_number: string,
  aadhar_number: string,
  documents: Array<{
    document_type: string,
    document_number: string,
    front_image_url: string,
    back_image_url: string
  }>
}
```

**Date Restriction Check:**
```typescript
// Show error if date is 1, 14, 15, 16, 29, 30, 31
const today = new Date().getDate();
const blockedDates = [1, 9, 10, 19, 20, 29, 30, 31];
if (blockedDates.includes(today)) {
  // Show error: "KYC submission is not allowed on dates 1, 9, 10, 19, 20, 29, 30 and 31 of each month"
}
```

---

### **STEP 5: Ledger/Income History Integration** 💰

**Files to Create:**
- `user/src/lib/api/ledger.ts` - Ledger/Income API service

**Files to Modify:**
- `user/src/app/income-history/bill/page.tsx` - Main income history
- `user/src/app/income-history/self-income/page.tsx` - SELF commissions
- `user/src/app/income-history/spot-income/page.tsx` - SPOT commissions
- `user/src/app/income-history/global-help-income/page.tsx` - GLOBAL_HELPING
- `user/src/app/income-history/team-income/page.tsx` - Team income
- `user/src/app/income-history/direct-income/page.tsx` - Direct income

**API Endpoints:**
- `GET /api/v1/income-history/self-income` - SELF commissions (paginated)
- `GET /api/v1/income-history/global-help-income` - GLOBAL_HELPING commissions
- `GET /api/v1/income-history/spot-income` - SPOT commissions
- `GET /api/v1/income-history/team-income` - Team income (SPOT + MONTHLY)
- `GET /api/v1/income-history/direct-income` - Direct income

**Query Parameters (all endpoints):**
- `page`: number (default: 1)
- `limit`: number (default: 20)
- `start_date`: string (ISO date)
- `end_date`: string (ISO date)

**Response Format:**
```typescript
{
  items: Array<{
    id: string,
    commission_type: 'SELF' | 'SPOT' | 'GLOBAL_HELPING' | 'MONTHLY',
    amount: number,
    source_user_id: string,
    source_user_name: string,
    credited_at: string,
    metadata: {
      wallet_type?: 'spot_balance' | 'other_balance',
      // ... other metadata
    }
  }>,
  pagination: {
    page: number,
    limit: number,
    total: number,
    total_pages: number
  }
}
```

**Key Changes:**
1. Replace mock data with API calls
2. Implement pagination
3. Add date range filters
4. Display wallet_type in metadata (if available)
5. Show commission type badges

---

### **STEP 6: Package Purchase Integration** 📦

**Files to Create:**
- `user/src/lib/api/packages.ts` - Package purchase API service

**Files to Modify:**
- `user/src/app/add-balance/page.tsx` - Manual deposit
- `user/src/app/pay-now/page.tsx` - Gateway payment
- `user/src/app/renew/page.tsx` - Package renewal
- `user/src/app/my-course/page.tsx` - My packages list

**API Endpoints:**
- `GET /api/v1/packages` - List all packages
- `GET /api/v1/my-packages` - Get user's package purchases
- `GET /api/v1/my-packages/:id` - Get package purchase details
- `POST /api/v1/purchases` - Create purchase request (activation/reinvestment)
- `POST /api/v1/purchases/renew` - Renew package

**Package List Response:**
```typescript
Array<{
  id: number,
  name: string,
  price: number,
  global_ids: number,
  self_roi_percent: number,
  validity_months: number
}>
```

**My Packages Response:**
```typescript
{
  count: number,
  items: Array<{
    id: string,
    package_id: number,
    package_name: string,
    amount: number,
    purchased_at: string,
    active_until: string,
    status: 'completed' | 'active' | 'expired',
    is_active: boolean,
    global_ids_info?: {
      package_cap: number,
      used_ids: number,
      remaining_ids: number,
      is_cap_reached: boolean,
      new_ids_after_cap: number | null
    },
    expiry_loss?: {
      total_loss: number,
      days_since_expiry: number,
      daily_breakdown: Array<{
        day: number,
        date: string,
        self_income: number,
        monthly_royalty: number,
        spot_income: number,
        total: number
      }>
    }
  }>
}
```

**Purchase Request:**
```typescript
{
  package_id: number,
  request_type: 'activation' | 'reinvestment' | 'renew',
  amount: number,
  txn_id?: string,
  payment_proof_url?: string,
  payment_type?: string,
  remarks?: string
}
```

**Key Changes:**
1. Fetch packages list for dropdowns
2. Create purchase requests (manual deposit)
3. Display global_ids_info for active packages
4. Display expiry_loss for expired packages
5. Handle gateway payment flow (Razorpay integration - if needed in UI)

---

### **STEP 7: Wallet Transfer Integration** 💸

**Files to Create:**
- `user/src/lib/api/wallet.ts` - Wallet transfer API service

**Files to Modify:**
- `user/src/app/transfer-money/p2p-transfer/page.tsx` - P2P transfer
- `user/src/app/transfer-money/self-transfer/page.tsx` - Self transfer
- `user/src/app/transfer-money/fund-transfer-data/page.tsx` - Transfer history

**API Endpoints:**
- `GET /api/v1/users/:id/wallet` - Get user wallet balance
- `POST /api/v1/transfer/p2p` - P2P transfer
- `POST /api/v1/wallet/transfer` - Wallet transfer

**P2P Transfer Request:**
```typescript
{
  receiver_id: string,
  amount: number,
  from_wallet: 'spot' | 'other',  // REQUIRED: Which wallet to transfer from
  remarks?: string
}
```

**Wallet Transfer Request:**
```typescript
{
  to_user_id: string,
  amount: number,
  from_wallet: 'spot' | 'other',  // REQUIRED: Which wallet to transfer from
  remarks?: string
}
```

**Key Changes:**
1. Add `from_wallet` selector (spot | other) in transfer forms
2. Show sender's spot_balance and other_balance
3. Validate balance in selected wallet
4. Note: Receiver always gets credit in `other_balance`
5. Display transfer history

**Important:** 
- Sender must specify which wallet (`spot` or `other`) to transfer from
- Receiver always receives in `other_balance` wallet
- KYC approval required for transfers

---

### **STEP 8: Withdrawal Integration** 🏦

**Files to Create:**
- `user/src/lib/api/withdrawal.ts` - Withdrawal API service

**Files to Modify:**
- `user/src/app/withdraw/overall-withdraw/page.tsx` - Create withdrawal request
- `user/src/app/withdraw/list-withdraw-request/page.tsx` - List requests
- `user/src/app/withdraw/bill/page.tsx` - Withdrawal history
- `user/src/app/withdraw/spot-withdraw-request/page.tsx` - Spot withdrawal

**API Endpoints:**
- `GET /api/v1/withdraw/requests` - Get user's withdrawal requests
- `GET /api/v1/withdraw/requests/:id` - Get withdrawal request details
- `POST /api/v1/withdraw/requests` - Create withdrawal request

**Create Withdrawal Request:**
```typescript
{
  amount: number,
  payment_method: 'bank' | 'upi',
  account_details: string,  // JSON stringified
  withdraw_type?: 'wallet' | 'spot',  // Optional, defaults to 'wallet'
  remarks?: string
}
```

**Response:**
```typescript
{
  id: string,
  user_id: string,
  withdraw_type: string,
  amount: number,
  payment_method: string,
  account_details: object,
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'cancelled',
  available_balances: {
    spot: number,
    other: number,
    total: number
  },
  allowed_wallets: Array<'spot' | 'other'>,  // Based on current date
  created_at: string
}
```

**Date Restrictions:**
- **15th of month:** Only SPOT wallet allowed (`allowed_wallets: ['spot']`)
- **30th of month (28th in February):** Both wallets allowed (`allowed_wallets: ['spot', 'other']`)
- **Other dates:** Withdrawal not allowed (API returns error)

**Key Changes:**
1. Check date restrictions before showing form
2. Show `available_balances` (spot, other, total)
3. Show `allowed_wallets` based on current date
4. Validate amount against available balance in allowed wallets
5. Display withdrawal request status
6. Show appropriate error messages for date restrictions

**Date Validation Logic:**
```typescript
const today = new Date();
const day = today.getDate();
const month = today.getMonth() + 1;
const isFebruary = month === 2;

if (day === 15) {
  // Only SPOT wallet allowed
  allowedWallets = ['spot'];
} else if ((isFebruary && day === 28) || (!isFebruary && day === 30)) {
  // Both wallets allowed
  allowedWallets = ['spot', 'other'];
} else {
  // Withdrawal not allowed
  showError('Withdrawal is only allowed on 15th and 30th (28th in February) of each month');
}
```

---

### **STEP 9: My Course Integration** 🎓

**Files to Modify:**
- `user/src/app/my-course/page.tsx` - Course/package list

**API Endpoints:**
- `GET /api/v1/my-course` - Get user's course/package purchases
- `GET /api/v1/my-course/:id` - Get course/package purchase details

**Response:** Same as `my-packages` endpoint (includes `global_ids_info` and `expiry_loss`)

**Key Changes:**
1. Display global IDs info for active packages
2. Display expiry loss for expired packages
3. Show course details if linked

---

### **STEP 10: Leaderboard Integration** 🏆

**Files to Create:**
- `user/src/lib/api/leaderboard.ts` - Leaderboard API service

**Files to Modify:**
- `user/src/app/leaderboard/page.tsx` - Leaderboard display

**API Endpoints:**
- `GET /api/v1/leaderboard/top` - Get top members
- `GET /api/v1/leaderboard/rank` - Get user's rank

**Key Changes:**
1. Fetch top members with pagination
2. Show user's current rank
3. Display rankings with filters

---

### **STEP 11: Team Integration** 👥

**Files to Create:**
- `user/src/lib/api/team.ts` - Team API service

**Files to Modify:**
- `user/src/app/team/page.tsx` - Team hierarchy

**API Endpoints:**
- `GET /api/v1/users/:id/referrals` - Get user's direct referrals
- `GET /api/v1/users/:id/downline` - Get downline tree (if exists)

**Key Changes:**
1. Display team hierarchy
2. Show team business stats
3. Tree visualization

---

### **STEP 12: Profile Updates** ✏️

**Files to Modify:**
- `user/src/app/profile/page.tsx` - Profile update

**API Endpoints:**
- `PUT /api/v1/users/:id/profile` - Update profile (if exists)
- Or use KYC submit endpoint for profile updates

**Key Changes:**
1. Update personal info
2. Update address
3. Update bank details

---

## 🔧 Implementation Checklist

### Phase 1: Foundation
- [ ] Install axios
- [ ] Create API client with interceptors
- [ ] Create TypeScript types
- [ ] Setup error handling
- [ ] Integrate login API
- [ ] Setup token storage (localStorage + Redux)
- [ ] Add protected route logic

### Phase 2: Core Features
- [ ] Dashboard wallet balance
- [ ] Dashboard stats
- [ ] KYC profile fetch
- [ ] KYC document upload
- [ ] KYC submission (with date validation)
- [ ] Income history (all types)
- [ ] Package list
- [ ] Package purchase (manual)
- [ ] Package purchase (gateway - if needed)
- [ ] Package renewal
- [ ] My packages with global_ids_info
- [ ] My packages with expiry_loss
- [ ] Wallet balance display
- [ ] P2P transfer (with from_wallet)
- [ ] Wallet transfer (with from_wallet)
- [ ] Withdrawal request creation (with date validation)
- [ ] Withdrawal request list
- [ ] Withdrawal status display

### Phase 3: Additional Features
- [ ] Leaderboard top members
- [ ] Leaderboard user rank
- [ ] Team hierarchy
- [ ] Profile updates

---

## 📦 File Structure

```
user/src/
├── lib/
│   └── api/
│       ├── client.ts          # Axios client
│       ├── types.ts           # TypeScript types
│       ├── errors.ts          # Error handling
│       ├── auth.ts            # Auth endpoints
│       ├── dashboard.ts       # Dashboard endpoints
│       ├── kyc.ts             # KYC endpoints
│       ├── ledger.ts          # Income history endpoints
│       ├── packages.ts        # Package purchase endpoints
│       ├── wallet.ts          # Wallet transfer endpoints
│       ├── withdrawal.ts      # Withdrawal endpoints
│       ├── leaderboard.ts     # Leaderboard endpoints
│       └── team.ts            # Team endpoints
├── app/
│   ├── login/page.tsx         # ✅ Integrate login
│   ├── dashboard/page.tsx     # ✅ Integrate dashboard
│   ├── profile/page.tsx       # ✅ Integrate KYC
│   ├── income-history/       # ✅ Integrate ledger
│   ├── add-balance/page.tsx   # ✅ Integrate purchase
│   ├── pay-now/page.tsx       # ✅ Integrate purchase
│   ├── renew/page.tsx         # ✅ Integrate renewal
│   ├── transfer-money/        # ✅ Integrate wallet
│   ├── withdraw/              # ✅ Integrate withdrawal
│   ├── my-course/page.tsx     # ✅ Integrate my packages
│   ├── leaderboard/page.tsx   # ✅ Integrate leaderboard
│   └── team/page.tsx          # ✅ Integrate team
└── redux/
    └── features/
        └── auth/
            └── authSlice.ts   # ✅ Add token storage
```

---

## 🚨 Important Notes

### 2-Wallet System
- Always display `spot_balance` and `other_balance` separately
- Total balance = `spot_balance + other_balance`
- Transfers require `from_wallet` selection
- Withdrawals have date-based wallet restrictions

### Date Restrictions
- **KYC Submission:** Blocked on 1, 9, 10, 19, 20, 29, 30, 31; allowed on all other dates
- **Withdrawal:** Only 15th (SPOT only) and 30th/28th (both wallets)
- Show appropriate error messages and disable forms on restricted dates

### Global IDs & Expiry Loss
- Backend already calculates and returns this data
- Just display the data from API response
- No calculation needed in frontend

### Error Handling
- Handle 401 (unauthorized) → logout and redirect to login
- Handle 400 (bad request) → show validation errors
- Handle 500 (server error) → show generic error message
- Handle network errors → show connection error

### Loading States
- Show loading spinners during API calls
- Disable forms during submission
- Show success/error toasts

---

## 🧪 Testing Checklist

After each step, test:
- [ ] API calls work correctly
- [ ] Error handling works
- [ ] Loading states display
- [ ] Success/error messages show
- [ ] Token is stored and sent with requests
- [ ] Protected routes redirect to login
- [ ] Date restrictions work
- [ ] Wallet balances display correctly
- [ ] Forms validate correctly

---

## 📝 Next Steps

1. **Review this plan** and get approval
2. **Start with Step 1** (API Client Setup)
3. **Test each step** before moving to next
4. **Update checklist** as you complete each item
5. **Document any issues** or changes needed

---

## 🔗 API Base URL

**Local Development (Default):**
```
http://localhost:3000/api/v1
```

**Production:**
```
https://api.secureinfiniteassociation.com/api/v1
```

Set in `.env.local` (in `user/` directory):
```env
# For local development (default)
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1

# For production (uncomment when deploying)
# NEXT_PUBLIC_API_URL=https://api.secureinfiniteassociation.com/api/v1
```

**Note:** Default is set to local API. No `.env.local` file needed for local development.

---

**Ready to start?** Begin with Step 1: API Client Setup! 🚀

