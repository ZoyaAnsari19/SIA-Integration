# Package Status Test Results

## Test Execution Summary

### ✅ **Test Scripts Created**
1. `scripts/test-package-status-simple.sh` - Simple test using existing users
2. `scripts/test-package-status-with-admin.sh` - Full test with admin API approvals
3. `scripts/test-package-status-loss.sh` - Comprehensive test with all scenarios

### ✅ **Admin API Integration**
- All purchase approvals done via Admin API (`POST /api/v1/admin/activation/requests/:id/approve`)
- No direct database manipulation for approvals
- Uses `ADMIN_TOKEN` as Bearer token for authentication

### ⚠️ **Current Issue**
- `global_ids_info` and `expiry_loss` are returning `null` in API responses
- Functions are being called but returning null
- Debug logs added to `PackageStatusService` to identify the issue

## Test Results

### Test 1: Active Package with Global IDs
**Status:** ⚠️ Partial
- Purchase created and approved via Admin API ✅
- Purchase is active ✅
- `global_ids_info` is null ❌

**Expected:**
```json
{
  "global_ids_info": {
    "package_cap": 55,
    "used_ids": 32,
    "remaining_ids": 23,
    "is_cap_reached": false,
    "new_ids_after_cap": null
  }
}
```

**Actual:**
```json
{
  "global_ids_info": null
}
```

### Test 2: Expired Package with Loss Calculation
**Status:** ⚠️ Partial
- Package expired (via DB update for testing) ✅
- Downline purchase created ✅
- `expiry_loss` is null ❌

**Expected:**
```json
{
  "expiry_loss": {
    "total_loss": 1250.50,
    "days_since_expiry": 1,
    "daily_breakdown": [...]
  }
}
```

**Actual:**
```json
{
  "expiry_loss": null
}
```

## Database Verification

### Purchase Details (ID: 34)
```sql
SELECT 
  p.id,
  p.user_id,
  p.package_id,
  p.effective_global_ids,
  p.active_until,
  p.status,
  pk.global_ids,
  (SELECT COUNT(*) FROM purchases WHERE status = 'completed' AND user_id != p.user_id AND purchased_at <= NOW()) as global_count
FROM purchases p
JOIN packages pk ON p.package_id = pk.id
WHERE p.id = 34;
```

**Result:**
- Purchase ID: 34
- User ID: 29
- Package ID: 1
- effective_global_ids: NULL (should use package.global_ids = 55)
- active_until: 2025-11-28 (expired)
- status: completed
- global_ids: 55
- global_count: 32

## Next Steps

1. **Check Server Logs** - Look for `[PackageStatusService]` debug output
2. **Verify Function Execution** - Check if functions are being called
3. **Check Date Comparison** - Verify date/timezone handling
4. **Restart Server** - May need restart to load new code changes

## Debug Information Added

### Console Logs in `PackageStatusService`
- `[PackageStatusService] Checking purchase:` - Shows purchase details and date comparison
- `[PackageStatusService] calculateGlobalIdsInfo result:` - Shows final result before return
- Error logging in route handlers for both functions

## Files Modified

1. ✅ `src/modules/purchases/package-status.service.ts` - Service functions created
2. ✅ `src/routes/my-course.ts` - Endpoints updated to call service functions
3. ✅ Test scripts created with admin API integration
4. ✅ Debug logging added

## Commands to Debug

```bash
# Check server logs for debug output
# Look for: [PackageStatusService]

# Test API directly
TOKEN=$(curl -s -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"userId":"a1@test.com","password":"Test@123"}' | jq -r '.token')

curl -X GET "http://localhost:3000/api/v1/my-course/1" \
  -H "Authorization: Bearer $TOKEN" | jq '{id, is_active, global_ids_info, expiry_loss}'

# Verify in DB
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  p.id,
  p.user_id,
  p.active_until,
  p.status,
  pk.global_ids,
  (SELECT COUNT(*) FROM purchases WHERE status = 'completed' AND user_id != p.user_id AND purchased_at <= NOW()) as global_count
FROM purchases p
JOIN packages pk ON p.package_id = pk.id
WHERE p.id = 1;
"
```

