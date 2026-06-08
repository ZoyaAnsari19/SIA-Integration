# Dashboard & User Details API Integration - Complete Guide

## 📋 Overview

This document outlines the complete integration of Dashboard and User Details APIs from MLM-API to MLM-Admin-ui.

## ✅ Integration Status

### 1. Dashboard API Integration ✅

**Backend Endpoint:** `GET /api/v1/admin/dashboard`  
**Backend File:** `MLM-API/src/routes/admin-dashboard.ts`  
**Frontend API Client:** `MLM-Admin-ui/src/lib/api/dashboard.ts`  
**Frontend Component:** `MLM-Admin-ui/src/app/dashboard/page.tsx`

#### API Response Fields:
```typescript
{
  total_system_amount: number;          // Total wallet balance across all users
  sms_wallet_balance: number;           // SMS wallet balance from Fast2SMS
  sms_left: number;                     // Remaining SMS count
  activation_pending_count: number;      // Pending activation requests
  total_users: number;                  // Total number of users
  package_activated: number;            // Users with active packages
  total_deposit: number;                // Total deposit from all purchases
  self_income: number;                  // Total SELF commission income
  direct_team_income: number;           // Total GLOBAL_HELPING commission
  team_income: number;                  // Total MONTHLY commission
  pyramid_income: number;               // Total SPOT commission
  team_wallet_balance: number;          // Team wallet balance
  pyramid_wallet_balance: number;       // Pyramid wallet balance
}
```

#### Integration Details:
- ✅ Backend route registered at `/api/v1/admin/dashboard`
- ✅ Frontend API client function: `getDashboard()`
- ✅ Frontend component fetches data on mount
- ✅ Error handling and loading states implemented
- ✅ Data formatted and displayed in dashboard cards

---

### 2. User Details API Integration ✅

#### 2.1 List Users Endpoint ✅

**Backend Endpoint:** `GET /api/v1/admin/users`  
**Backend File:** `MLM-API/src/routes/admin-users.ts` (line 145)  
**Frontend API Client:** `MLM-Admin-ui/src/lib/api/users.ts`  
**Frontend Component:** `MLM-Admin-ui/src/app/user-management/users-details/page.tsx`

##### Query Parameters:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `id` / `user_id` - Filter by user ID
- `name` - Filter by name (partial search, case-insensitive)
- `start_date` - Filter users created >= date
- `end_date` - Filter users created <= date
- `kyc_status` - Filter by KYC status (pending/submitted/approved/rejected)
- `status` - Filter by user status (active/inactive)
- `sort` - Sort field (created_at/name/email/updated_at)
- `order` - Sort order (asc/desc)

##### API Response:
```typescript
{
  count: number;              // Items in current page
  page: number;                // Current page number
  limit: number;               // Items per page
  total_pages: number;         // Total number of pages
  total: number;               // Total number of users
  items: User[];               // Array of user objects
}

interface User {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;                    // ✅ Included
  latest_package_name: string | null;        // ✅ Included
  kyc_status: string;
  status: string;
  referrer_user_id: string | null;
  wallet_balance: number;
  direct_referrals: number;
  total_team_size: number;
  total_purchases: number;
  created_at: string;
  updated_at: string;
}
```

#### 2.2 Single User Details Endpoint ✅

**Backend Endpoint:** `GET /api/v1/admin/users/:id`  
**Backend File:** `MLM-API/src/routes/admin-users.ts` (line 417)  
**Frontend API Client:** `MLM-Admin-ui/src/lib/api/users.ts` - `getUserById()`  
**Frontend Usage:** Edit modal in users-details page

##### API Response:
```typescript
interface UserDetails {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;                    // ✅ Now included
  latest_package_name: string | null;      // ✅ Now included
  kyc_status: string;
  status: string;
  referrer_user_id: string | null;
  referrer_name: string | null;
  wallet_balance: number;
  total_commissions: number;
  direct_referrals: number;
  total_team_size: number;
  total_purchases: number;
  total_business_volume: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

#### 2.3 Update User Endpoint ✅

**Backend Endpoint:** `PUT /api/v1/admin/users/:id`  
**Frontend API Client:** `MLM-Admin-ui/src/lib/api/users.ts` - `updateUser()`

##### Request Body:
```typescript
{
  name?: string;
  email?: string;
  referrer_user_id?: string | null;
  kyc_status?: 'pending' | 'submitted' | 'approved' | 'rejected';
}
```

#### 2.4 Delete/Deactivate User Endpoint ✅

**Backend Endpoint:** `DELETE /api/v1/admin/users/:id`  
**Frontend API Client:** `MLM-Admin-ui/src/lib/api/users.ts` - `deleteUser()`

#### 2.5 Activate User Endpoint ✅

**Backend Endpoint:** `POST /api/v1/admin/users/:id/activate`  
**Frontend API Client:** `MLM-Admin-ui/src/lib/api/users.ts` - `activateUser()`

#### 2.6 Deactivate User Endpoint ✅

**Backend Endpoint:** `POST /api/v1/admin/users/:id/deactivate`  
**Frontend API Client:** `MLM-Admin-ui/src/lib/api/users.ts` - `deactivateUser()`

---

## 🔧 Configuration

### Base URL Configuration

**Frontend:** `MLM-Admin-ui/src/lib/api/dashboard.ts` & `users.ts`
```typescript
const getBaseUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3006/api/v1';
  if (envUrl.endsWith('/admin')) {
    return envUrl;
  }
  if (envUrl.endsWith('/api/v1')) {
    return `${envUrl}/admin`;
  }
  return `${envUrl}/admin`;
};
```

**Backend:** Routes registered under `/api/v1/admin` prefix  
**File:** `MLM-API/src/routes/index.ts`

---

## 🔐 Authentication

All endpoints require:
- **Header:** `Authorization: Bearer <admin_token>`
- **Token Source:** `sessionStorage.getItem('auth_token')`
- **Middleware:** `adminAuth` (backend)

---

## 📊 Data Flow

### Dashboard Flow:
1. User opens dashboard page
2. `useEffect` triggers `fetchDashboard()`
3. `getDashboard()` API call to `/api/v1/admin/dashboard`
4. Response data mapped to dashboard stats
5. Stats displayed in cards with formatted values

### User Details Flow:
1. User opens users-details page
2. `useEffect` triggers `fetchUsers()` with pagination
3. `getUsers()` API call to `/api/v1/admin/users?page=1&limit=10`
4. Response items mapped to table rows
5. Table displays user data with action buttons
6. Edit button → `getUserById()` → Opens edit modal
7. Save button → `updateUser()` → Refreshes list

---

## 🎯 Recent Updates

### ✅ Completed:
1. **Dashboard API Integration** - Fully connected and working
2. **User List API Integration** - Includes phone and latest_package_name
3. **Single User Details API** - Now includes phone and latest_package_name
4. **Frontend Type Definitions** - Updated to match API responses
5. **Error Handling** - Comprehensive error handling in place
6. **Loading States** - Loading indicators for all API calls

### 📝 Changes Made:
- Added `phone` field to single user details endpoint response
- Added `latest_package_name` field to single user details endpoint response
- Updated `UserDetails` interface in frontend to include phone and latest_package_name
- Updated backend schema definitions

---

## 🧪 Testing

### Test Dashboard API:
```bash
curl -X GET "http://localhost:3006/api/v1/admin/dashboard" \
  -H "Authorization: Bearer <admin_token>"
```

### Test User List API:
```bash
curl -X GET "http://localhost:3006/api/v1/admin/users?page=1&limit=10" \
  -H "Authorization: Bearer <admin_token>"
```

### Test Single User Details:
```bash
curl -X GET "http://localhost:3006/api/v1/admin/users/7" \
  -H "Authorization: Bearer <admin_token>"
```

---

## 📝 Notes

1. **Phone Number**: Retrieved from `user_profiles` table via relation
2. **Latest Package**: Retrieved from most recent completed purchase
3. **Pagination**: Default page size is 20, max is 100
4. **Search**: Name filter uses case-insensitive partial matching
5. **Date Filtering**: Supports date range filtering for user creation dates

---

## 🚀 Next Steps (Optional Enhancements)

1. Add phone number to edit form
2. Add package selection in edit form
3. Add export functionality for user data
4. Add bulk operations (activate/deactivate multiple users)
5. Add advanced filtering UI
6. Add real-time updates using WebSockets

---

## 📞 Support

For issues or questions:
- Check API logs in `MLM-API` console
- Check browser console for frontend errors
- Verify authentication token is valid
- Ensure API server is running on correct port

---

**Last Updated:** 2025-01-XX  
**Integration Status:** ✅ Complete

