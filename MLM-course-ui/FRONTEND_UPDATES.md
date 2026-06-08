# Frontend Updates for Unified MLM-API

## ✅ Changes Completed (November 30, 2025)

### 1. API Base URL Update
**File:** `lib/apiClient.js`
- **Old:** `http://localhost:4010/api`
- **New:** `http://localhost:3000/api/v1`
- ✅ Updated with environment variable support

### 2. Authentication Updates

#### Login (AuthContext.jsx)
**Before:**
```javascript
authAPI.login({ email, password })
```

**After:**
```javascript
authAPI.login({ userId: email, password }) // userId parameter for unified API
```

#### Registration (AuthContext.jsx + register/page.jsx)
**Added Fields:**
- `mobile` - 10 digit phone number (required)
- `referrer_user_id` - Referrer user ID (defaults to '2')

**New Request Format:**
```javascript
{
  name: "John Doe",
  email: "john@example.com",
  password: "password123",
  mobile: "9876543210",      // NEW - Required
  referrer_user_id: "2"      // NEW - Required
}
```

**New Response Includes:**
```javascript
{
  id: "68",
  display_id: "SIA02028",    // NEW - Auto-generated
  name: "John Doe",
  email: "john@example.com",
  phone: "9876543210",
  role: "STUDENT"            // NEW
}
```

### 3. Registration Form Updates
**File:** `app/register/page.jsx`

**Changes:**
1. ✅ Changed `phone` field to `mobile` with 10-digit validation
2. ✅ Added `referrerId` field (defaults to '2')
3. ✅ Added mobile number validation (10 digits required)
4. ✅ Success toast now shows assigned display_id
5. ✅ Added helper text for referrer ID

**Form Fields:**
```
- First Name (required)
- Last Name (required)
- Email (required)
- Password (required, min 6 chars)
- Mobile (required, 10 digits) ← UPDATED
- Referrer ID (optional, default: 2) ← NEW
```

### 4. Environment Variables
**Files Created:**
- `.env.example` - Template for environment variables
- `.env.local` - Local development config (not committed to git)

**Variables:**
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_your_key_id
NEXT_PUBLIC_APP_NAME=Secure Infinite Association
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

### 5. API Endpoints (All Now Use `/api/v1`)
**Updated in:** `lib/api.js`

All endpoints automatically use the new base URL:
- ✅ `/api/v1/auth/register`
- ✅ `/api/v1/auth/login`
- ✅ `/api/v1/auth/me`
- ✅ `/api/v1/courses`
- ✅ `/api/v1/courses/:slug`
- ✅ `/api/v1/courses/my-courses/list`
- ✅ `/api/v1/cart`
- ✅ `/api/v1/cart/items`
- ✅ `/api/v1/payments/*`
- ✅ `/api/v1/videos/:id`
- ✅ `/api/v1/ratings`

### 6. User Object Updates
**Components affected:**
- `contexts/AuthContext.jsx`
- `components/Navbar.jsx` (if it displays user info)
- `app/my-courses/page.jsx` (if it shows user details)

**New fields available:**
```javascript
user.display_id  // "SIA02028" - Display ID
user.role        // "STUDENT" or "ADMIN"
user.phone       // User's mobile number
```

## 🧪 Testing Checklist

### Registration Flow
- [ ] Fill out registration form with all fields
- [ ] Submit with valid 10-digit mobile number
- [ ] Verify display_id is shown in success message
- [ ] Verify redirect to login page
- [ ] Check that user is created in database with SIA ID

### Login Flow
- [ ] Login with registered email and password
- [ ] Verify JWT token is stored in localStorage
- [ ] Verify user object includes display_id and role
- [ ] Check that protected routes work after login

### Courses
- [ ] Browse courses (public, no auth)
- [ ] View course details (includes enrollment check if logged in)
- [ ] Add course to cart (requires auth)
- [ ] View my enrolled courses (requires auth)
- [ ] Access course videos (requires enrollment)

### Cart & Checkout
- [ ] Add multiple courses to cart
- [ ] Remove items from cart
- [ ] Proceed to checkout
- [ ] Complete payment (test mode)

## 🔄 Migration Steps for Developers

### 1. Pull Latest Frontend Changes
```bash
cd MLM-course-ui
git pull
```

### 2. Install Dependencies (if needed)
```bash
npm install
```

### 3. Create Environment File
```bash
cp .env.example .env.local
# Edit .env.local with your local settings
```

### 4. Ensure Backend is Running
```bash
cd ../MLM-API
docker-compose up -d
npm run dev
```

### 5. Start Frontend
```bash
cd ../MLM-course-ui
npm run dev
```

### 6. Test Registration
1. Go to http://localhost:3001/register
2. Fill form:
   - First Name: Test
   - Last Name: User
   - Email: test@example.com
   - Password: password123
   - Mobile: 9876543210
   - Referrer ID: 2 (default)
3. Submit and verify success message shows SIA ID

### 7. Test Login
1. Go to http://localhost:3001/login
2. Login with registered credentials
3. Verify redirect to homepage
4. Check navbar shows user name

## 🐛 Known Issues & Solutions

### Issue 1: "Cannot connect to API"
**Solution:** Ensure MLM-API backend is running on port 3000
```bash
cd MLM-API && npm run dev
```

### Issue 2: "Invalid referrer_user_id"
**Solution:** 
- Default referrer_user_id is '2' (root user)
- Make sure root user exists in database
- Run: `bash scripts/seed-db.sh` to create root user

### Issue 3: "Mobile number validation failed"
**Solution:**
- Mobile must be exactly 10 digits
- No spaces, hyphens, or country code
- Example: 9876543210

### Issue 4: CORS errors
**Solution:**
- Check MLM-API CORS configuration
- Ensure `http://localhost:3001` is allowed in CORS origins

## 📝 Files Modified

### Updated Files:
1. ✅ `lib/apiClient.js` - API base URL
2. ✅ `contexts/AuthContext.jsx` - Login/register logic
3. ✅ `app/register/page.jsx` - Registration form
4. ✅ `.env.example` - Environment template
5. ✅ `.env.local` - Local environment (created)

### New Files:
1. ✅ `MIGRATION_TO_UNIFIED_API.md` - Migration guide
2. ✅ `FRONTEND_UPDATES.md` - This file

### Files NOT Modified (work as-is):
- `lib/api.js` - API endpoints (paths auto-adjusted by base URL)
- `components/LoginForm.jsx` - Uses AuthContext (no changes needed)
- `app/courses/page.jsx` - Course listing (no changes needed)
- `app/my-courses/page.jsx` - My courses (no changes needed)
- All other components and pages

## 🚀 Deployment Notes

### Development
```bash
# Backend (MLM-API)
cd MLM-API
docker-compose up -d
npm run dev  # Port 3000

# Frontend (MLM-course-ui)
cd MLM-course-ui
npm run dev  # Port 3001
```

### Production
```bash
# Build frontend
cd MLM-course-ui
npm run build

# Start production server
npm run start
```

**Environment:**
```env
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com/api/v1
```

## 🔐 Security Notes

1. ✅ JWT tokens stored in localStorage with 'sia_token' key
2. ✅ Auto-logout on 401 Unauthorized
3. ✅ All protected routes check authentication
4. ✅ Referrer validation on backend
5. ✅ Mobile number validation on frontend & backend

## 📊 User Flow Comparison

### OLD Flow (MLM-course-API):
```
Register → Login → Browse Courses → Enroll → Watch Videos
```

### NEW Flow (Unified MLM-API):
```
Register (with referrer) 
  → Get SIA ID (e.g., SIA02028)
  → Login 
  → Browse Courses 
  → Enroll 
  → Watch Videos
  → Package activated if course mapped to MLM package
  → Commissions triggered
```

## 🎯 Next Steps

1. **Testing:** Complete all items in testing checklist
2. **UI Enhancements:** 
   - Display user's SIA ID in navbar/profile
   - Show referral tree (if needed)
   - Add package activation notifications
3. **Documentation:** Update user-facing docs
4. **Deployment:** Deploy to staging for QA testing

---

**Last Updated:** November 30, 2025  
**Status:** ✅ Migration Complete  
**Tested:** Pending QA



