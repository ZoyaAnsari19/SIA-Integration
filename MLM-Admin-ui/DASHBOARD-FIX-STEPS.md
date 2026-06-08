# Dashboard 0 Values Fix - Step by Step

## ✅ Database Status
Database mein data hai:
- 14 users
- 6 completed purchases  
- 6 commissions
- ₹46,000+ total balance

**Problem:** Dashboard 0 dikha raha hai = API call issue hai!

## 🔧 Fix Steps

### Step 1: Check API Server
```bash
# API server chal raha hai?
curl http://localhost:3006/health

# Ya browser mein:
http://localhost:3006/api/v1/admin/dashboard
```

### Step 2: Check Frontend API URL
**File:** `MLM-Admin-ui/src/lib/api/dashboard.ts`

**Current:** `http://localhost:3006/api/v1/admin/dashboard`

**Verify:**
1. `.env.local` file check karein
2. `NEXT_PUBLIC_API_URL` set hai ya nahi?

### Step 3: Check Authentication Token
Browser Console (F12) mein:
```javascript
sessionStorage.getItem('auth_token')
```

Agar null hai:
1. Logout karo
2. Phir se login karo
3. Token automatically save hoga

### Step 4: Test API Directly
Browser Console mein:
```javascript
fetch('http://localhost:3006/api/v1/admin/dashboard', {
  headers: {
    'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
  }
})
.then(r => r.json())
.then(data => console.log('API Response:', data))
.catch(err => console.error('Error:', err));
```

### Step 5: Check Network Tab
1. F12 → Network tab
2. Dashboard page refresh karo
3. `dashboard` API call find karo
4. Click karke check karo:
   - **Status:** 200 (success) ya error?
   - **Response:** Kya data aa raha hai?
   - **Request URL:** Sahi hai ya nahi?

## 🎯 Most Likely Issues

### Issue 1: API URL Wrong
**Fix:** `.env.local` file mein:
```
NEXT_PUBLIC_API_URL=http://localhost:3006/api/v1
```

### Issue 2: Auth Token Missing
**Fix:** Login phir se karo

### Issue 3: CORS Error
**Fix:** Backend CORS settings check karo

### Issue 4: API Server Not Running
**Fix:** 
```bash
cd MLM-API
docker-compose up
```

## 📊 Expected API Response

Agar sab kuch sahi hai:
```json
{
  "total_system_amount": 46000.50,
  "total_users": 14,
  "package_activated": 6,
  "total_deposit": 30000,
  "self_income": 500,
  "direct_team_income": 300,
  "team_income": 200,
  "pyramid_income": 100,
  "activation_pending_count": 0,
  "team_wallet_balance": 0,
  "pyramid_wallet_balance": 0
}
```

## 🚀 Quick Test

Browser Console mein ye command run karo:
```javascript
// Get token
const token = sessionStorage.getItem('auth_token');
console.log('Token:', token ? '✅ Present' : '❌ Missing');

// Test API
fetch('http://localhost:3006/api/v1/admin/dashboard', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => {
  console.log('Status:', r.status);
  return r.json();
})
.then(data => {
  console.log('✅ API Response:', data);
  console.log('Total Users:', data.total_users);
  console.log('Total Deposit:', data.total_deposit);
})
.catch(err => console.error('❌ Error:', err));
```

---

**Next:** Agar API response sahi aa raha hai but dashboard 0 dikha raha hai, to frontend code mein issue hai.

