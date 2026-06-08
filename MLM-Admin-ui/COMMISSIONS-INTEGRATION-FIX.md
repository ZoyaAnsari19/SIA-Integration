# Commissions API Integration - 404 Error Fix

## Issue
Getting "Resource not found" (404) error when accessing `/api/v1/admin/commissions`

## Root Cause
The route is registered in the backend but API server might need restart, or there's a route registration order issue.

## Solution Steps

### 1. Restart API Server
```bash
cd MLM-API
# Stop current server (Ctrl+C)
# Then restart
npm run dev
# or
npm start
```

### 2. Verify Route in Swagger
1. Open: `http://localhost:3006/docs`
2. Search for: `GET /api/v1/admin/commissions`
3. Verify it exists in the API documentation

### 3. Test Endpoint Directly
```bash
# Get admin token first (from login)
TOKEN="your-admin-token-here"

# Test the endpoint
curl -X GET "http://localhost:3006/api/v1/admin/commissions?commission_type=SPOT&page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

### 4. Check Route Registration Order
The route is registered in `MLM-API/src/routes/index.ts` at line 79:
```typescript
await app.register(adminAllCommissionsRoutes, { prefix: '/api/v1/admin' });
```

This should be AFTER `adminCommissionsRoutes` (line 68) to avoid conflicts.

### 5. Verify Frontend URL
Frontend is calling:
```
http://localhost:3006/api/v1/admin/commissions?commission_type=SPOT&page=1&limit=10
```

Check console logs to verify the exact URL being called.

## Expected Response
```json
{
  "count": 10,
  "page": 1,
  "limit": 10,
  "total_pages": 1,
  "total": 10,
  "items": [
    {
      "id": "1",
      "user_id": "5",
      "user_name": "User Name",
      "commission_type": "SPOT",
      "income_amount": 125.00,
      "income_lvl": 1,
      "from_id": "4",
      "from_name": "Source User",
      "investment_amt": 2500.00,
      "investment_type": "activation",
      "spot_added": true,
      "activation_req_id": "123",
      "created_at": "2025-11-29T10:00:00Z"
    }
  ]
}
```

## Debugging Steps

1. **Check Console Logs:**
   - Open browser DevTools (F12)
   - Check Console tab for detailed logs
   - Look for: `🔍 Fetching commissions:` logs

2. **Check Network Tab:**
   - Open Network tab in DevTools
   - Find the `commissions` request
   - Check Request URL, Status Code, Response

3. **Verify API Server:**
   ```bash
   curl http://localhost:3006/health
   # Should return: {"status":"ok"}
   ```

4. **Check Swagger UI:**
   - Visit: `http://localhost:3006/docs`
   - Search for "commissions"
   - Verify endpoint exists

## If Still Not Working

1. Check if `adminAllCommissionsRoutes` is properly exported
2. Verify the route function is async and properly defined
3. Check for any route conflicts in `adminCommissionsRoutes`
4. Ensure API server logs show route registration



