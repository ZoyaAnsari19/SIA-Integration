# 🚀 Quick Reference - MLM Course UI

## ⚡ Quick Start (3 Steps)

```bash
# 1. Backend
cd ../MLM-API && npm run dev

# 2. Frontend
cd ../MLM-course-ui && cp env.example .env.local && npm run dev

# 3. Browser
http://localhost:3001
```

---

## 📝 API Changes Cheat Sheet

### Registration
```javascript
// OLD
{ name, email, password, phone? }

// NEW
{ 
  name, 
  email, 
  password, 
  mobile: "9876543210",      // Required (10 digits)
  referrer_user_id: "2"      // Required (default: 2)
}
```

### Login
```javascript
// OLD
{ email, password }

// NEW
{ userId: email, password }  // Changed: userId parameter
```

### User Object
```javascript
// OLD
{ id, name, email }

// NEW
{ 
  id, 
  display_id: "SIA02028",    // NEW
  name, 
  email, 
  phone: "9876543210",       // NEW
  role: "STUDENT"            // NEW
}
```

---

## 🌐 Environment Variables

```env
# .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_your_key
```

---

## 🧪 Test User Registration

1. Open: `http://localhost:3001/register`
2. Fill:
   ```
   First Name: Test
   Last Name: User
   Email: test@example.com
   Password: password123
   Mobile: 9876543210
   Referrer ID: 2
   ```
3. Expected: "Registration successful! Your ID: SIA02XXX"

---

## 🔍 Common Errors & Fixes

| Error | Fix |
|-------|-----|
| "Cannot connect to API" | Start backend: `cd ../MLM-API && npm run dev` |
| "Mobile validation failed" | Use exactly 10 digits (e.g., 9876543210) |
| "Invalid referrer_user_id" | Use default '2' or existing user ID |
| CORS errors | Check MLM-API allows localhost:3001 |

---

## 📂 Files Changed

```
✅ lib/apiClient.js           (API URL)
✅ contexts/AuthContext.jsx   (Login/register)
✅ app/register/page.jsx      (Form fields)
✅ env.example                (New file)
```

---

## 📚 Documentation

| File | Purpose |
|------|---------|
| `SETUP.md` | Quick setup guide |
| `FRONTEND_UPDATES.md` | Complete changelog |
| `API_MIGRATION_COMPLETE.md` | Test results & status |
| `BEFORE_AFTER_COMPARISON.md` | Visual comparison |
| `MIGRATION_TO_UNIFIED_API.md` | Migration guide |

---

## 🎯 API Endpoints

```
POST /api/v1/auth/register     - Register
POST /api/v1/auth/login        - Login
GET  /api/v1/auth/me           - Current user
GET  /api/v1/courses           - List courses
GET  /api/v1/courses/:slug     - Course details
POST /api/v1/cart/items        - Add to cart
GET  /api/v1/cart              - Get cart
POST /api/v1/payments/*        - Payments
```

---

## ✅ Status

- ✅ Backend: Complete & Tested
- ✅ Frontend: Complete (QA Pending)
- ✅ Documentation: Complete
- 🎉 Ready for Testing!

---

**Last Updated:** November 30, 2025  
**Version:** 2.0.0 (Unified API)



