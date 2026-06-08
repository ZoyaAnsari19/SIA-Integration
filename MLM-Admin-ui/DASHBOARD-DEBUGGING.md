# Dashboard 0 Values - Debugging Guide

## 🔍 Problem
Dashboard par sabhi values 0 dikh rahi hain.

## ✅ Possible Causes & Solutions

### 1. Database Empty Hai (Sabse Common)
**Check:** Database mein data hai ya nahi?

**Solution:**
```bash
# Database check karein
# PostgreSQL mein connect karein aur check karein:

# Users count
SELECT COUNT(*) FROM users;

# Purchases count  
SELECT COUNT(*) FROM purchases WHERE status = 'completed';

# User balances
SELECT SUM(balance) FROM user_balances;

# Commissions
SELECT COUNT(*) FROM ledger_entries;
```

**Agar database empty hai:**
- Test users create karein
- Test purchases create karein
- Tabhi dashboard mein data dikhega

---

### 2. API Call Fail Ho Raha Hai
**Check:** Browser Console mein errors check karein

**Steps:**
1. Browser Console open karein (F12)
2. Network tab check karein
3. Dashboard API call check karein:
   - URL: `http://localhost:3006/api/v1/admin/dashboard`
   - Status: 200 (success) ya error?
   - Response: Kya data aa raha hai?

**Console mein ye logs dikhne chahiye:**
```
📊 Fetching dashboard data...
🔗 Dashboard API URL: http://localhost:3006/api/v1/admin/dashboard
🔑 Auth Token present: true
📡 Dashboard API Response Status: 200 OK
📊 Dashboard API Data: { total_users: 0, ... }
```

---

### 3. API URL Wrong Hai
**Check:** API base URL correct hai ya nahi?

**File:** `MLM-Admin-ui/src/lib/api/dashboard.ts`

**Default URL:** `http://localhost:3006/api/v1`

**Environment Variable Check:**
```bash
# .env.local file mein check karein:
NEXT_PUBLIC_API_URL=http://localhost:3006/api/v1
```

**Agar API different port par hai:**
- `.env.local` file mein correct URL set karein
- Frontend restart karein

---

### 4. Authentication Token Missing/Invalid
**Check:** Auth token sahi hai ya nahi?

**Steps:**
1. Browser Console mein:
```javascript
sessionStorage.getItem('auth_token')
```

2. Agar token null hai:
   - Login page par jao
   - Phir se login karo
   - Token automatically save hoga

3. Agar token invalid hai:
   - Logout karo
   - Phir se login karo

---

### 5. Backend API Server Not Running
**Check:** MLM-API server chal raha hai ya nahi?

**Steps:**
```bash
# MLM-API directory mein jao
cd MLM-API

# Server check karein
# Agar server chal raha hai, ye URL open karein:
# http://localhost:3006/api/v1/admin/dashboard

# Ya terminal mein:
curl -X GET "http://localhost:3006/api/v1/admin/dashboard" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Agar server nahi chal raha:**
```bash
cd MLM-API
npm run dev
# ya
npm start
```

---

### 6. CORS Error
**Check:** Browser Console mein CORS error dikh raha hai?

**Solution:**
- Backend mein CORS properly configured hona chahiye
- `MLM-API` mein CORS settings check karein

---

## 🧪 Quick Test Steps

### Step 1: Browser Console Check
```javascript
// Console mein ye commands run karein:

// 1. Check API URL
console.log('API URL:', process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3006/api/v1');

// 2. Check Auth Token
console.log('Auth Token:', sessionStorage.getItem('auth_token'));

// 3. Manual API Call Test
fetch('http://localhost:3006/api/v1/admin/dashboard', {
  headers: {
    'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
  }
})
.then(r => r.json())
.then(data => console.log('API Response:', data))
.catch(err => console.error('API Error:', err));
```

### Step 2: Network Tab Check
1. Browser DevTools open karein (F12)
2. Network tab select karein
3. Dashboard page refresh karein
4. `dashboard` API call find karein
5. Click karein aur check karein:
   - **Status:** 200 (success) ya error?
   - **Response:** Kya data aa raha hai?
   - **Headers:** Authorization header present hai?

### Step 3: Backend Logs Check
MLM-API server terminal mein check karein:
- Koi errors dikh rahi hain?
- Dashboard API call receive ho rahi hai?
- Database queries successful hain?

---

## 🔧 Quick Fixes

### Fix 1: Environment Variable Set Karein
```bash
# MLM-Admin-ui directory mein
echo "NEXT_PUBLIC_API_URL=http://localhost:3006/api/v1" > .env.local

# Frontend restart karein
npm run dev
```

### Fix 2: Login Phir Se Karein
1. Logout karo
2. Login page par jao
3. Phir se login karo
4. Dashboard check karo

### Fix 3: Database Seed Karein (Agar Empty Hai)
```bash
# Test data create karein
# MLM-API mein test scripts use karein
```

---

## 📊 Expected API Response

**Agar sab kuch sahi hai, API response aisa hona chahiye:**
```json
{
  "total_system_amount": 1500000.00,
  "sms_wallet_balance": 500.50,
  "sms_left": 2500,
  "activation_pending_count": 25,
  "total_users": 150,
  "package_activated": 120,
  "total_deposit": 500000.00,
  "self_income": 100000.00,
  "direct_team_income": 50000.00,
  "team_income": 75000.00,
  "pyramid_income": 30000.00,
  "team_wallet_balance": 25000.00,
  "pyramid_wallet_balance": 30000.00
}
```

**Agar database empty hai, sab values 0 aayengi:**
```json
{
  "total_system_amount": 0,
  "sms_wallet_balance": 0,
  "sms_left": 0,
  "activation_pending_count": 0,
  "total_users": 0,
  "package_activated": 0,
  "total_deposit": 0,
  "self_income": 0,
  "direct_team_income": 0,
  "team_income": 0,
  "pyramid_income": 0,
  "team_wallet_balance": 0,
  "pyramid_wallet_balance": 0
}
```

---

## 🎯 Most Likely Issue

**90% chance:** Database empty hai ya API call fail ho rahi hai.

**Quick Check:**
1. Browser Console open karein (F12)
2. Network tab check karein
3. Dashboard API call ka response dekhein
4. Agar response mein sab 0 hai = Database empty
5. Agar API call fail ho rahi hai = URL/Auth issue

---

## 📞 Next Steps

1. Browser Console check karein
2. Network tab check karein  
3. Backend logs check karein
4. Database check karein
5. Agar koi specific error dikhe, mujhe batao!

