# Migration to Unified MLM-API

## Overview
This document tracks the migration from MLM-course-API to the unified MLM-API backend.

## Changes Required

### 1. API Base URL Update
**Old:** `http://localhost:4010/api`  
**New:** `http://localhost:3000/api/v1`

### 2. Authentication Changes
**Registration:**
- **Added Field:** `referrer_user_id` (mandatory) - must be set to user's referrer ID
- **Added Field:** `mobile` (10 digits, mandatory)
- **Response now includes:** `display_id`, `role`, `phone`

**Login:**
- **Old:** `{ email, password }`
- **New:** `{ userId: email, password }` - userId parameter instead of email

### 3. API Endpoint Updates
All endpoints now use `/api/v1` prefix:

| Old Endpoint | New Endpoint |
|--------------|--------------|
| `/auth/register` | `/api/v1/auth/register` |
| `/auth/login` | `/api/v1/auth/login` |
| `/auth/me` | `/api/v1/auth/me` |
| `/courses` | `/api/v1/courses` |
| `/courses/:slug` | `/api/v1/courses/:slug` |
| `/courses/my-courses/list` | `/api/v1/courses/my-courses/list` |
| `/cart` | `/api/v1/cart` |
| `/payments/*` | `/api/v1/payments/*` |
| `/videos/:id` | `/api/v1/videos/:id` |
| `/ratings` | `/api/v1/ratings` |

### 4. User Object Updates
**Old User Object:**
```json
{
  "id": "123",
  "name": "John Doe",
  "email": "john@example.com"
}
```

**New User Object:**
```json
{
  "id": "123",
  "display_id": "SIA02028",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "role": "STUDENT"
}
```

### 5. Registration Flow Update
**New Required Fields:**
1. `referrer_user_id` - Mandatory (default to root user ID: 2)
2. `mobile` - 10 digit phone number (mandatory)

**Updated Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "mobile": "9876543210",
  "password": "password123",
  "referrer_user_id": "2"
}
```

### 6. Environment Variables
Create `.env.local` file:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
```

## Implementation Checklist

- [x] Update API base URL in `lib/apiClient.js`
- [ ] Update authentication endpoints
- [ ] Add referrer_user_id to registration
- [ ] Update login payload structure
- [ ] Update user object handling
- [ ] Test all API endpoints
- [ ] Update documentation

## Testing Plan

1. **Registration:**
   - Test with referrer_user_id
   - Verify display_id is returned
   - Verify mobile validation

2. **Login:**
   - Test with userId parameter
   - Verify token is stored
   - Verify user object includes new fields

3. **Courses:**
   - List all courses
   - View course details
   - Enroll in course
   - Access videos

4. **Cart & Payments:**
   - Add to cart
   - Checkout flow
   - Payment verification

## Migration Date
**Started:** November 30, 2025  
**Status:** In Progress



