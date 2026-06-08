# Swagger UI Access Guide

## Swagger UI URL

Swagger UI available hai at:
```
http://localhost:3000/docs
```

## Steps to Access Swagger

### 1. Server Start Karo

```bash
npm run dev
```

### 2. Browser Mein Open Karo

```
http://localhost:3000/docs
```

### 3. Swagger Features

- ✅ **All API Endpoints** - Sabhi endpoints dikhenge
- ✅ **Try It Out** - Direct browser se API test kar sakte ho
- ✅ **Request/Response Examples** - Examples dikhenge
- ✅ **Authentication** - JWT token add kar sakte ho
- ✅ **Schema Definitions** - Request/Response schemas

## Alternative URLs

### Local Development:
- Swagger UI: `http://localhost:3000/docs`
- Health Check: `http://localhost:3000/health`
- API Base: `http://localhost:3000/api/v1`

### Docker (if running):
- Swagger UI: `http://localhost:3003/docs`
- Health Check: `http://localhost:3003/health`

## Using Swagger UI

1. **Browse Endpoints**: Left sidebar mein sabhi endpoints dikhenge
2. **Try It Out**: Endpoint click karo, "Try it out" button click karo
3. **Add Parameters**: Query params, path params, body add karo
4. **Add Authentication**: 
   - Top right mein "Authorize" button click karo
   - JWT token add karo: `Bearer <your-token>`
5. **Execute**: "Execute" button click karo
6. **See Response**: Response dikhega with status code, headers, body

## Authentication in Swagger

### User Token:
1. `/api/v1/auth/login` se login karo
2. Response mein `token` copy karo
3. Swagger UI mein "Authorize" button click karo
4. `Bearer <token>` format mein add karo

### Admin Token:
1. Environment variable `ADMIN_TOKEN` use karo
2. Swagger UI mein "Authorize" button click karo
3. Admin auth scheme mein token add karo

## Quick Test

```bash
# 1. Server start
npm run dev

# 2. Browser open karo
open http://localhost:3000/docs

# Ya manually browser mein type karo
# http://localhost:3000/docs
```

## Troubleshooting

**Problem:** Swagger page nahi khul raha
- ✅ Check karo server running hai: `curl http://localhost:3000/health`
- ✅ Check karo port 3000 free hai: `lsof -i :3000`
- ✅ Server restart karo: `npm run dev`

**Problem:** Endpoints nahi dikh rahe
- ✅ Check karo routes properly registered hain
- ✅ Browser console check karo for errors
- ✅ Network tab mein check karo API calls

**Problem:** Authentication nahi ho raha
- ✅ Token format check karo: `Bearer <token>`
- ✅ Token expire to nahi hua
- ✅ Login endpoint se naya token generate karo

