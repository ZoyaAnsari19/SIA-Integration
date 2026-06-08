# How to Run End-to-End Tests 🧪

## Quick Start (2 Simple Steps)

### Step 1: Start the Server
```bash
cd /Users/siddhantgour/Documents/Projects/MLM/MLM-API
npm run dev
```

Wait until you see:
```
Server listening on http://0.0.0.0:3000
```

### Step 2: Run Tests (In New Terminal)
```bash
cd /Users/siddhantgour/Documents/Projects/MLM/MLM-API
./scripts/test-e2e-all-new-apis.sh
```

---

## What Gets Tested

### ✅ **All New Admin APIs:**
1. Dashboard API (with Fast2SMS integration)
2. Extended User Management (phone, latest_package_name, filters)
3. Extended KYC Management (bank_branch, pagination, update endpoint)
4. All Commissions API (with extended fields and filters)
5. Withdrawal Rules (spot_min_withdraw field)

### ✅ **All New User APIs:**
1. Team Business Dashboard
2. Team Tree Hierarchy
3. User Details by ID
4. Bills List & Invoices
5. P2P Wallet Transfer
6. Transfer History

### ✅ **Edge Cases Tested (32+):**
- Authentication validation
- Access control enforcement
- Invalid inputs
- Non-existent resources
- Filter and pagination
- Transfer validations
- KYC validations
- Error handling

---

## Test Results Example

```bash
==========================================
OVERALL RESULTS
==========================================

Total Tests Run:        85
Passed:                 85
Failed:                 0
Edge Cases Tested:      32

Pass Rate:              100%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ ALL TESTS PASSED!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎉 All APIs are working correctly!
🎉 All edge cases handled properly!
🎉 Ready for production!
```

---

## Manual Testing (File Uploads)

Some APIs require actual file uploads and need manual testing:

### 1. Profile Photo Upload

#### Using cURL:
```bash
# Replace YOUR_TOKEN with actual JWT token
curl -X POST http://localhost:3000/api/v1/user/profile/photo \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/your/image.jpg"
```

#### Using Postman:
1. Create POST request to `/api/v1/user/profile/photo`
2. Add Authorization header: `Bearer YOUR_TOKEN`
3. In Body tab, select "form-data"
4. Add key "file" (type: File)
5. Choose an image file (JPG/PNG/GIF/WebP, max 5MB)
6. Send request

**Expected Response:**
```json
{
  "profile_photo_url": "https://mlm-cdn.b-cdn.net/profile_photos/123_1732875123456.jpg",
  "uploaded_at": "2025-11-29T10:30:00Z"
}
```

**Test Cases:**
- ✅ Upload JPG (should work)
- ✅ Upload PNG (should work)
- ✅ Upload GIF (should work)
- ✅ Upload WebP (should work)
- ❌ Upload PDF (should fail - invalid type)
- ❌ Upload >5MB file (should fail - too large)

---

### 2. Manual Deposit (Payment Proof Upload)

#### Using cURL:
```bash
curl -X POST http://localhost:3000/api/v1/deposit/manual \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "package_id=1" \
  -F "amount=2500" \
  -F "request_type=activation" \
  -F "utr_number=UTR123456789" \
  -F "payment_type=bank_transfer" \
  -F "remarks=Test payment" \
  -F "file=@/path/to/payment_screenshot.jpg"
```

#### Using Postman:
1. Create POST request to `/api/v1/deposit/manual`
2. Add Authorization header: `Bearer YOUR_TOKEN`
3. In Body tab, select "form-data"
4. Add all fields:
   - `package_id`: 1
   - `amount`: 2500
   - `request_type`: activation
   - `utr_number`: UTR123456789
   - `payment_type`: bank_transfer
   - `remarks`: Test payment
   - `file`: (type: File) Choose payment screenshot
5. Send request

**Expected Response:**
```json
{
  "id": "789",
  "user_id": "456",
  "package_id": 1,
  "request_type": "activation",
  "amount": 2500.00,
  "status": "pending",
  "txn_id": "UTR123456789",
  "payment_proof_url": "https://mlm-cdn.b-cdn.net/payment_proofs/456_1732875123456.jpg",
  "created_at": "2025-11-29T10:30:00Z",
  "message": "Payment request submitted successfully. Admin will review and approve."
}
```

**Test Cases:**
- ✅ Activation request (should work)
- ✅ Renew request (should work)
- ✅ Reinvestment request (should work)
- ❌ Invalid package ID (should fail)
- ❌ Amount mismatch (should fail)
- ❌ Missing UTR number (should fail)
- ❌ No payment proof (should fail)
- ❌ Invalid file type (should fail)
- ❌ File >10MB (should fail)

---

## Troubleshooting

### Server Not Starting?

**Check Database:**
```bash
# Make sure PostgreSQL is running
psql -h localhost -p 5433 -U postgres -d mlm
```

**Check Environment:**
```bash
# Verify .env file exists and has required values
cat .env
```

**Check Dependencies:**
```bash
# Reinstall if needed
npm install
```

---

### Tests Failing?

**1. Check Server is Running:**
```bash
curl http://localhost:3000/
# Should return something (not connection refused)
```

**2. Check Database is Seeded:**
```bash
# Run seed if needed
npm run seed
```

**3. Check Admin User Exists:**
```bash
# Default admin credentials:
# Email: admin@mlm.com
# Password: Admin@1234
```

**4. Check Fast2SMS API Key:**
```bash
# In .env file:
FAST2SMS_API_KEY=pqCvWrXHwkOFMl0Cm4GKvre7nDU8GESLNkwvsgZqkxGame2tWtmXQNkZb1To
```

**5. Check Bunny CDN Config:**
```bash
# In .env file:
BUNNY_STORAGE_ZONE_NAME=mlm-cdn
BUNNY_API_KEY=b50c3ed0-dd8a-42dc-a394cb787b60-0c99-4966
BUNNY_STORAGE_ENDPOINT=https://storage.bunnycdn.com
BUNNY_CDN_HOSTNAME=mlm-cdn.b-cdn.net
```

---

### Test Specific API

Edit the test script to run only specific sections:

```bash
# Open the script
nano scripts/test-e2e-all-new-apis.sh

# Comment out sections you don't want to test
# Example: Add # before the section you want to skip
# print_header "SECTION 2: ADMIN APIs - Dashboard & Analytics"
```

---

## Test Files

1. **`scripts/test-e2e-all-new-apis.sh`**
   - Main comprehensive test suite
   - Tests all APIs with edge cases
   - 85+ automated tests

2. **`scripts/test-user-apis.sh`**
   - User-side APIs only
   - Simpler, faster tests
   - Good for quick verification

3. **`scripts/test-admin-new-apis.sh`**
   - Admin APIs only
   - Dashboard, users, KYC, commissions
   - Good for admin feature testing

4. **`scripts/test-bunny-cdn.ts`**
   - Bunny CDN storage tests
   - File upload, list, delete
   - Image upload verification

---

## Performance Benchmarks

**Expected Response Times:**
- Simple GET requests: < 100ms
- List endpoints with pagination: < 200ms
- Complex queries (joins): < 300ms
- File uploads (5MB): < 2000ms

**Concurrent Requests:**
- Should handle 10+ simultaneous requests
- No race conditions
- Atomic transactions

---

## CI/CD Integration

### GitHub Actions Example:

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run migrations
        run: npx prisma migrate deploy
      
      - name: Seed database
        run: npm run seed
      
      - name: Start server
        run: npm run dev &
        
      - name: Wait for server
        run: sleep 5
      
      - name: Run E2E tests
        run: ./scripts/test-e2e-all-new-apis.sh
```

---

## Next Steps After Testing

1. **Review Test Results:**
   - All tests should pass
   - No errors in console
   - No linter warnings

2. **Manual File Upload Tests:**
   - Test profile photo upload
   - Test manual deposit upload
   - Verify CDN URLs work

3. **Performance Testing:**
   - Test with large datasets
   - Test concurrent requests
   - Monitor response times

4. **Security Review:**
   - Verify authentication works
   - Test access control
   - Check input validation

5. **Documentation:**
   - Update API documentation
   - Add examples
   - Document edge cases

6. **Production Deployment:**
   - Set environment variables
   - Configure CDN
   - Set up monitoring
   - Deploy!

---

## ✅ Checklist

- [ ] Server running (`npm run dev`)
- [ ] Database seeded
- [ ] .env configured (Bunny CDN + Fast2SMS)
- [ ] Ran automated tests (`./scripts/test-e2e-all-new-apis.sh`)
- [ ] All tests passed
- [ ] Manual profile photo test done
- [ ] Manual deposit test done
- [ ] Verified CDN URLs accessible
- [ ] Reviewed error handling
- [ ] Checked console for errors
- [ ] Ready for production!

---

**Happy Testing! 🎉**

If you encounter any issues, check:
1. E2E_TEST_PLAN.md - Detailed test plan
2. IMPLEMENTATION_SUMMARY.md - What was implemented
3. README.md - Complete API documentation
4. BUNNY_CDN_SETUP.md - CDN configuration

For support, review the failed test output - it provides detailed error messages and suggestions.
