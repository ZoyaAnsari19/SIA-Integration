# User Details Page - Endpoints Documentation

## 📍 Frontend API Client

**File:** `MLM-Admin-ui/src/lib/api/users.ts`

### 1. Get All Users (List)
```typescript
GET /api/v1/admin/users
```
- **Function:** `getUsers(params?: GetUsersParams)`
- **Used in:** `src/app/user-management/users-details/page.tsx` (line 12, 69)
- **Query Parameters:**
  - `page` - Page number (default: 1)
  - `limit` - Items per page (default: 20)
  - `id` / `user_id` - Filter by user ID
  - `name` - Filter by name (partial search)
  - `start_date` - Filter users created >= date
  - `end_date` - Filter users created <= date
  - `kyc_status` - Filter by KYC status (pending/submitted/approved/rejected)
  - `status` - Filter by user status (active/inactive)
  - `sort` - Sort field (created_at/name/email/updated_at)
  - `order` - Sort order (asc/desc)

### 2. Get Single User by ID
```typescript
GET /api/v1/admin/users/:id
```
- **Function:** `getUserById(userId: string)`
- **Used in:** `src/app/user-management/users-details/page.tsx` (line 12, 203)
- **Purpose:** Fetch user details for edit modal

### 3. Update User
```typescript
PUT /api/v1/admin/users/:id
```
- **Function:** `updateUser(userId: string, data: UpdateUserRequest)`
- **Used in:** `src/app/user-management/users-details/page.tsx` (line 12, 231)
- **Request Body:**
  ```typescript
  {
    name?: string;
    email?: string;
    referrer_user_id?: string | null;
    kyc_status?: 'pending' | 'submitted' | 'approved' | 'rejected';
  }
  ```

---

## 🔧 Backend API Routes

**File:** `MLM-API/src/routes/admin-users.ts`

### 1. GET /api/v1/admin/users
- **Line:** 145
- **Handler:** List all users with pagination and filters
- **Response:** 
  ```json
  {
    "count": 20,
    "page": 1,
    "limit": 20,
    "total_pages": 5,
    "total": 100,
    "items": [
      {
        "id": "123",
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+919876543210",
        "latest_package_name": "Premium",
        "kyc_status": "approved",
        "status": "active",
        "referrer_user_id": "100",
        "wallet_balance": 5000.00,
        "direct_referrals": 10,
        "total_team_size": 50,
        "total_purchases": 3,
        "created_at": "2025-01-15T10:30:00Z",
        "updated_at": "2025-01-20T15:45:00Z"
      }
    ]
  }
  ```

### 2. GET /api/v1/admin/users/:id
- **Line:** 417
- **Handler:** Get single user details with comprehensive info
- **Response:** Extended user details including commissions, purchases, etc.

### 3. PUT /api/v1/admin/users/:id
- **Line:** 607
- **Handler:** Update user details
- **Request Body:**
  ```json
  {
    "name": "Updated Name",
    "email": "updated@example.com",
    "referrer_user_id": "100",
    "kyc_status": "approved"
  }
  ```
- **Response:**
  ```json
  {
    "id": "123",
    "name": "Updated Name",
    "email": "updated@example.com",
    "kyc_status": "approved",
    "status": "active",
    "referrer_user_id": "100",
    "created_at": "2025-01-15T10:30:00Z",
    "updated_at": "2025-01-20T15:45:00Z"
  }
  ```

### 4. DELETE /api/v1/admin/users/:id
- **Line:** 753
- **Handler:** Soft delete user (sets status to inactive)

### 5. POST /api/v1/admin/users/:id/activate
- **Line:** 862
- **Handler:** Activate user

### 6. POST /api/v1/admin/users/:id/deactivate
- **Line:** 971
- **Handler:** Deactivate user

---

## 🔗 Base URL Configuration

**Frontend:** `MLM-Admin-ui/src/lib/api/users.ts` (line 3-18)
- Default: `http://localhost:3006/api/v1/admin`
- Environment Variable: `NEXT_PUBLIC_API_URL`
- Auto-appends `/admin` if not present

**Backend:** `MLM-API/src/routes/admin-users.ts`
- Registered under `/api/v1/admin` prefix
- Authentication: Admin JWT token required

---

## 📝 Usage in Frontend

**File:** `MLM-Admin-ui/src/app/user-management/users-details/page.tsx`

1. **Initial Load:** `fetchUsers()` called on mount (line 108)
2. **Pagination:** `fetchUsers()` called when page/pageSize changes (line 110)
3. **Search:** `fetchUsers()` called with name filter (line 114-124)
4. **Edit:** `getUserById()` called when edit button clicked (line 203)
5. **Update:** `updateUser()` called when form submitted (line 231)

---

## 🔐 Authentication

All endpoints require:
- **Header:** `Authorization: Bearer <admin_token>`
- **Token Source:** `sessionStorage.getItem('auth_token')`
- **Middleware:** `adminAuth` (backend)

---

## 📊 API Response Fields Mapping

| Frontend Field | API Field | Notes |
|---------------|-----------|-------|
| `fullname` | `name` | User's full name |
| `user_id` | `id` | User ID |
| `role_id` | - | Hardcoded as "2 (Member)" |
| `package_name` | `latest_package_name` | Latest purchased package |
| `sponsor_id` | `referrer_user_id` | Referrer/Sponsor user ID |
| `email` | `email` | Email address |
| `mobile` | `phone` | Phone number from user_profiles |
| `password_enc` | - | Masked as "******" (not in API) |
| `trans_pass_enc` | - | Masked as "***" (not in API) |
| `block_status` | `status` | "Active" or "Blocked" |
| `created_on` | `created_at` | Formatted date |



