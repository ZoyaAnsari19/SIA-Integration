# MLM Course UI - Setup Guide

## Quick Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
# Copy environment template
cp env.example .env.local

# Edit .env.local if needed (defaults should work for local development)
```

### 3. Start Backend (MLM-API)
```bash
cd ../MLM-API
docker-compose up -d
npm run dev  # Runs on port 3000
```

### 4. Start Frontend
```bash
cd ../MLM-course-ui
npm run dev  # Runs on port 3001
```

### 5. Access Application
Open browser: **http://localhost:3001**

---

## Testing

### Test Registration
1. Go to **http://localhost:3001/register**
2. Fill form:
   - **First Name:** Test
   - **Last Name:** User
   - **Email:** test@example.com
   - **Password:** password123
   - **Mobile:** 9876543210 (10 digits required)
   - **Referrer ID:** 2 (leave default)
3. Submit → Should show success with **SIA ID** (e.g., SIA02035)

### Test Login
1. Go to **http://localhost:3001/login**  
2. Login with registered email & password
3. Should redirect to homepage
4. Navbar should show user name

### Test Course Browsing
1. Go to **http://localhost:3001/courses**
2. View available courses
3. Click on a course to see details
4. Add to cart (requires login)

### Test Course Purchase
1. Login first
2. Add course to cart
3. Go to checkout
4. Complete payment (test mode or manual deposit)

---

## API Configuration

**Default API URL:** `http://localhost:3000/api/v1`

To change:
1. Edit `.env.local`
2. Update `NEXT_PUBLIC_API_BASE_URL`
3. Restart dev server: `npm run dev`

---

## Common Issues

### "Cannot connect to API"
**Solution:** Make sure MLM-API backend is running on port 3000
```bash
cd ../MLM-API
npm run dev
```

### "Invalid referrer_user_id"
**Solution:** 
- Use default '2' for testing
- Or ensure referrer user exists in database
- Run: `bash ../MLM-API/scripts/seed-db.sh` to create root user

### "Mobile validation failed"
**Solution:** 
- Must be exactly 10 digits
- No spaces, hyphens, or country code
- Example: `9876543210` ✅
- Wrong: `+91 9876543210` ❌

### CORS Errors
**Solution:**
- Ensure MLM-API allows `http://localhost:3001` in CORS origins
- Check MLM-API `src/app.ts` for CORS configuration

### Port 3001 Already in Use
**Solution:**
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Or use different port
PORT=3002 npm run dev
```

---

## Project Structure

```
MLM-course-ui/
├── app/                      # Next.js pages
│   ├── courses/             # Course listing
│   ├── course/[slug]/       # Course details
│   ├── my-courses/          # User's enrolled courses
│   ├── cart/                # Shopping cart
│   ├── checkout/            # Payment & checkout
│   ├── login/               # Login page
│   └── register/            # Registration page
├── components/              # Reusable components
│   ├── CourseCard.jsx       # Course card component
│   ├── VideoPlayer.jsx      # Video player (Bunny Stream)
│   ├── Navbar.jsx           # Navigation bar
│   └── LoginForm.jsx        # Login form
├── contexts/                # React contexts
│   ├── AuthContext.jsx      # Authentication state
│   └── CartContext.jsx      # Shopping cart state
├── lib/                     # Utilities
│   ├── api.js               # API endpoints
│   └── apiClient.js         # API client with JWT
├── env.example              # Environment template
├── .env.local               # Local environment (gitignored)
└── package.json             # Dependencies
```

---

## API Endpoints Used

### Public (No Auth Required)
- `GET /api/v1/courses` - List courses
- `GET /api/v1/courses/:slug` - Course details
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/register` - Register

### Protected (Auth Required)
- `GET /api/v1/auth/me` - Get current user
- `GET /api/v1/courses/:slug/modules` - Course modules (enrolled)
- `GET /api/v1/courses/my-courses/list` - My courses
- `GET /api/v1/videos/:id` - Video with signed URL
- `POST /api/v1/cart/items` - Add to cart
- `GET /api/v1/cart` - Get cart
- `POST /api/v1/payments/create-order` - Create payment
- `POST /api/v1/ratings` - Rate course

---

## Development Workflow

### Start Development
```bash
# Terminal 1: Backend
cd MLM-API
npm run dev

# Terminal 2: Frontend  
cd MLM-course-ui
npm run dev
```

### Make Changes
1. Edit frontend files
2. Next.js auto-reloads
3. Test in browser
4. Check console for errors

### Build for Production
```bash
npm run build
npm run start
```

---

## Environment Variables

### Development (.env.local)
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_your_key
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

### Production (.env.production)
```env
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com/api/v1
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_your_key
NEXT_PUBLIC_APP_URL=https://courses.yourdomain.com
```

---

## Next Steps

1. ✅ API integration updated
2. ✅ Registration form updated
3. ✅ Login flow updated
4. ✅ Environment configured
5. [ ] Test complete user journey
6. [ ] Update UI to show display_id
7. [ ] Add referral link sharing
8. [ ] Deploy to staging

---

**Last Updated:** November 30, 2025  
**MLM-API Version:** 2.0.0 (Course Integration)  
**Status:** Ready for Testing



