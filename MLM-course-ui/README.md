# Secure Infinite Association - Course Frontend (Next.js)

Modern, fully responsive frontend for the **Secure Infinite Association** course platform.  
Built with **Next.js App Router**, integrated with the `MLM-course-API` backend (Fastify + Prisma).

---

## 🚀 Tech Stack

- **Framework**: Next.js 14.2.3 (App Router, React 18.2.0)
- **Language**: JavaScript (ESNext)
- **Styling**: Global CSS + CSS variables (no Tailwind)
- **State Management**:
  - Custom `AuthContext` (JWT-based auth with token persistence)
  - Custom `CartContext` (server-synced cart with real-time updates)
- **HTTP Client**: Custom `apiClient` wrapper over `fetch` with automatic token handling
- **Notifications**: `react-hot-toast` v2.6.0
- **Icons**: `react-icons` v5.5.0
- **Animations**: GSAP v3.13.0, OGL v1.0.11
- **Payments**: Razorpay-ready + **test mode** using `/api/payments/test-purchase`
- **Video Streaming**: Bunny Stream embed player via backend `/api/videos/{id}`

---

## 📁 Project Structure

```bash
MLM-course-ui/
├── app/                        # Next.js App Router pages
│   ├── page.jsx                # Home (Top Courses)
│   ├── layout.jsx              # Root layout with providers
│   ├── globals.css             # Global styles
│   ├── courses/
│   │   └── page.jsx            # All courses listing with filters
│   ├── course/
│   │   └── [slug]/
│   │       ├── page.jsx        # Course detail page
│   │       └── videos/
│   │           └── page.jsx    # Enrolled videos page
│   ├── cart/
│   │   └── page.jsx            # Shopping cart
│   ├── checkout/
│   │   └── page.jsx            # Checkout (Razorpay/test mode)
│   ├── my-courses/
│   │   └── page.jsx            # Enrolled courses dashboard
│   ├── login/
│   │   └── page.jsx            # Login page
│   ├── register/
│   │   └── page.jsx            # Registration page
│   ├── forgot-password/
│   │   └── page.jsx            # Password reset
│   ├── about/
│   │   └── page.jsx            # About page
│   ├── contact/
│   │   └── page.jsx            # Contact page
│   ├── privacy/
│   │   └── page.jsx            # Privacy policy
│   ├── terms/
│   │   └── page.jsx            # Terms of service
│   ├── refund/
│   │   └── page.jsx            # Refund policy
│   └── shipping/
│       └── page.jsx            # Shipping policy
├── components/                 # Reusable UI components
│   ├── Navbar.jsx              # Main navigation bar
│   ├── Footer.jsx              # Footer component
│   ├── CourseCard.jsx          # Course card display
│   ├── RazorpayButton.jsx      # Payment button component
│   ├── VideoPlayer.jsx         # Bunny Stream video player
│   ├── LoginForm.jsx           # Login form component
│   ├── EmptyCart.jsx           # Empty cart state
│   ├── Breadcrumbs.jsx         # Breadcrumb navigation
│   ├── LightRays.jsx           # Visual effects
│   ├── LogoLoop.jsx            # Logo animation
│   ├── ScrambledText.jsx       # Text animation
│   └── PayNowButton.jsx        # Payment button
├── contexts/                   # React Context providers
│   ├── AuthContext.jsx         # Auth state, login/register/logout, checkAuth
│   └── CartContext.jsx         # Cart state, add/remove/clear, calculateTotal
├── lib/                        # Utility libraries
│   ├── apiClient.js            # Low-level fetch wrapper (tokens, errors)
│   └── api.js                  # High-level API helpers (auth, courses, cart, payments, videos, ratings)
├── data/
│   └── courses.js              # Static course data (for home page)
├── docs/
│   └── domain-model.md        # Domain model documentation
├── html/                       # Static HTML templates (legacy)
├── next.config.mjs             # Next.js configuration
├── package.json
└── README.md
```

---

## ⚙️ Setup & Installation

### 1. Install dependencies

```bash
cd MLM-course-ui
npm install
```

### 2. Environment variables

Create `.env.local` in `MLM-course-ui/`:

```env
# Backend API URL (must match MLM-course-API port)
NEXT_PUBLIC_API_URL=http://localhost:4010
NEXT_PUBLIC_API_BASE_URL=http://localhost:4010/api
```

> **Important**: 
> - Make sure the backend (`MLM-course-API`) dev server is running on port **4010**
> - The `NEXT_PUBLIC_` prefix makes these variables available in the browser
> - Restart the Next.js dev server after changing environment variables

### 3. Run development server

```bash
npm run dev
```

Frontend will be available at `http://localhost:9000`.

**Available Scripts:**
- `npm run dev` - Start development server (port 9000)
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

> **Note**: To run on a specific port, use: `PORT=9000 npm run dev` or update your `package.json` scripts.

---

## 🔐 Authentication Flow

- **Register** (`/register`)
  - Fields: `firstName`, `lastName`, `email`, `password`, `phone (optional)`
  - Combines first + last → `name` and calls `POST /api/auth/register`
  - **On success**:
    - Shows toast: “Registration successful! Please log in to continue.”
    - Redirects to `/login` (no auto-login)

- **Login** (`/login`)
  - Calls `POST /api/auth/login`
  - Saves JWT using `apiClient.setToken`
  - `AuthContext` keeps `user` + `isAuthenticated`
  - Navbar + protected pages react to auth state

- **Session check**
  - On app load, `AuthContext.checkAuth()` calls `GET /api/auth/me` if token exists
  - Invalid/expired tokens are cleared and token removed from storage.

- **Logout**
  - Clears token, resets `user`, redirects to `/`
  - `CartContext` also clears cart when user logs out

---

## 🛒 Cart & Checkout

### Cart (`/cart`)

- Uses `CartContext` + backend `/api/cart`
- Features:
  - Add to cart from course detail page
  - Remove single course
  - Clear entire cart
  - Cart count badge in navbar
  - Total price calculated from backend prices (handles string/number)

### Checkout (`/checkout`)

- Shows order summary with cart items + total
- Integrates `RazorpayButton`:
  - **Test mode enabled** by default:
    - Calls `POST /api/payments/test-purchase`
    - 2-second simulated processing
    - On success:
      - Clears cart
      - Redirects to `/my-courses?payment=success`
  - Razorpay live integration is ready but disabled in test mode (can be enabled later).

---

## 📚 Courses & Enrollment

### Home (`/`)

- Shows featured “Top Courses” using static `data/courses.js`
- CTA buttons:
  - “Browse all courses” → `/courses`
  - “View basic course” → `/course/basic` (expects matching slug on backend)

### All Courses (`/courses`)

- Fetches from `GET /api/courses` with filters:
  - Category, level, language, search
- Displays premium course cards with:
  - Title, description
  - Rating + total ratings
  - Language, duration, level
  - Price

### Course Detail (`/course/[slug]`)

- Fetches:
  - `GET /api/courses/{slug}` (always sends token if available to determine `isEnrolled`)
  - `GET /api/courses/{slug}/modules` (if enrolled)
  - `GET /api/ratings/course/{courseId}` (ratings & reviews)
- Features:
  - Dark hero section (title, stats, language, level)
  - Buy box with price, discount, course includes
  - “Add to Cart”, “Buy Now” (checkout), or “Go to Course” (if enrolled)
  - Curriculum accordion (modules + lessons)
  - Full description
  - Student feedback summary (average rating + distribution)
  - Reviews list
  - Rating form (if enrolled)

### My Courses (`/my-courses`)

- Uses `GET /api/courses/my-courses/list`
- Shows:
  - Enrolled courses as premium cards
  - Stats: total courses, hours, lessons
  - “Continue Learning” button → `/course/[slug]/videos`

### Videos (`/course/[slug]/videos`)

- Protected: user must be logged in **and** enrolled
- Fetches:
  - `GET /api/courses/{slug}`
  - `GET /api/courses/{slug}/modules`
  - `GET /api/videos/{id}` (Bunny Stream embed URL via backend)
- Uses `VideoPlayer` to render Bunny Stream `iframe`
- Sidebar with modules & lessons; click to switch current video

---

## ⭐ Ratings & Reviews

- Rating form on course detail page (if enrolled)
- Uses:
  - `POST /api/ratings`
  - `GET /api/ratings/course/{courseId}`
- UI:
  - Star-based rating selector
  - Optional text review
  - Success/error states with toasts and inline messages

---

## 🌐 Navbar & Global Layout

- `Navbar.jsx`:
  - Displays **All Courses**, **My Courses**, **About**, **Contact**
  - Right side:
    - Cart icon + badge (if authenticated)
    - User first name (or email prefix) + Logout
    - Login / Sign up buttons when not authenticated
- `app/layout.jsx`:
  - Wraps app in `AuthProvider`, `CartProvider`
  - Injects `Navbar`, `Footer`, and global `react-hot-toast` `Toaster`

---

## 🧪 Development Tips

### Backend Connection
- Ensure backend (`MLM-course-API`) is running on `http://localhost:4010`
- Keep `NEXT_PUBLIC_API_BASE_URL` synced with backend port
- Check backend health: `curl http://localhost:4010/health`

### Video Streaming
- For Bunny Stream videos:
  - Backend must have proper Bunny env vars configured
  - Database must be seeded with video IDs from Bunny Stream
  - Videos are embedded via iframe from backend-generated URLs

### Payment Testing
- For purchases during testing:
  - Keep test mode enabled in `RazorpayButton.jsx`
  - Use `/api/payments/test-purchase` instead of Razorpay
  - Test mode simulates successful payment without actual Razorpay integration

### Authentication
- JWT tokens are stored in localStorage
- Tokens are automatically included in API requests via `apiClient`
- Session is checked on app load via `AuthContext.checkAuth()`
- Invalid/expired tokens are automatically cleared

### Cart Management
- Cart is synced with backend on every change
- Cart persists across page refreshes (stored in backend)
- Cart is cleared on logout

### Common Issues

**CORS Errors:**
- Ensure `FRONTEND_URL` in backend `.env` matches frontend URL (should be `http://localhost:9000` for this setup)
- Check that backend CORS is configured correctly
- Update backend `.env` file: `FRONTEND_URL=http://localhost:9000`

**API Connection Errors:**
- Verify backend is running: `curl http://localhost:4010/health`
- Check `NEXT_PUBLIC_API_BASE_URL` in `.env.local`
- Check browser console for detailed error messages

**Authentication Issues:**
- Clear localStorage and try logging in again
- Check backend JWT_SECRET is set correctly
- Verify token is being sent in Authorization header

**Build Errors:**
- Run `npm run build` to check for build-time errors
- Ensure all environment variables are set
- Check for missing dependencies: `npm install`

## 🎨 UI Features

- **Responsive Design**: Fully responsive across all device sizes
- **Dark Theme**: Modern dark theme with CSS variables
- **Animations**: Smooth animations using GSAP and custom CSS
- **Toast Notifications**: User-friendly notifications for all actions
- **Loading States**: Proper loading indicators for async operations
- **Error Handling**: Graceful error handling with user-friendly messages

## 📱 Pages Overview

- **Home (`/`)**: Featured courses, hero section, CTAs
- **Courses (`/courses`)**: Browse all courses with filters (category, level, language, search)
- **Course Detail (`/course/[slug]`)**: Full course information, curriculum, reviews, purchase options
- **Videos (`/course/[slug]/videos`)**: Video player with module navigation (requires enrollment)
- **Cart (`/cart`)**: Shopping cart with add/remove functionality
- **Checkout (`/checkout`)**: Payment processing (Razorpay/test mode)
- **My Courses (`/my-courses`)**: Dashboard of enrolled courses
- **Login/Register**: Authentication pages
- **Static Pages**: About, Contact, Privacy, Terms, Refund, Shipping policies

## 🔐 Security Considerations

- JWT tokens stored in localStorage (consider httpOnly cookies for production)
- All API requests include authentication tokens
- Sensitive operations require authentication
- CORS configured for specific frontend origin
- Input validation handled by backend (Zod schemas)

## 🚀 Production Deployment

1. Set `NODE_ENV=production` in build environment
2. Update `NEXT_PUBLIC_API_BASE_URL` to production API URL
3. Build the application: `npm run build`
4. Start production server: `npm start`
5. Use a process manager (PM2) for Node.js
6. Configure reverse proxy (Nginx) if needed
7. Enable HTTPS
8. Set up proper error monitoring and logging

---

## 📄 License

Internal project for **Secure Infinite Association (SIA)**.  
Not intended for public redistribution without permission.


