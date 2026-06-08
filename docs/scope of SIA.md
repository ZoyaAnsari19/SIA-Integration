## Scope of Secure Infinite Association (SIA)

Secure Infinite Association (SIA) is a **complete multi‑level marketing (MLM) and course platform**.  
It combines:

- **Core MLM commission engine** (atomic, paise-level accuracy)
- **User MLM dashboard** (wallet, income, team, withdrawals)
- **Admin dashboard** (top‑ups, renewals, course master)
- **Online course platform** (backend + frontend, payments, streaming)
- **Public/marketing site** for the SIA brand

This document explains **what the system actually does**, **who uses what**, and **how commissions and flows work end‑to‑end** across:

- `MLM-user-ui`
- `MLM-course-ui`
- `MLM-Admin-ui`
- `MLM-API`
- `Secure-Infinite-Association-`

---

### 1. High‑Level Vision

- **Business model**: SIA sells packages/courses through an MLM structure.  
- **Participants**:
  - **End users / associates**: Buy packages, build a team, earn commissions.
  - **Admins / back office**: Manage activations, renewals, courses, approvals.
  - **Learners**: Consume digital courses via the course platform.
- **Core promise**:
  - Transparent, auditable **wallet and commission system**.
  - **Progressive global helping**, spot bonuses, and recurring monthly income.
  - Seamless **course purchase → commission credit → reporting** loop.

In short: **User joins → buys package/course → system credits different commission types → user tracks and withdraws income → admin monitors and controls everything.**

---

### 2. System Modules (What Each App Does)

#### 2.1 `MLM-API` – Core MLM Engine & Wallet Backend

**Purpose**: The **brain of the MLM system**. It calculates all commissions and maintains the financial ledger.

- **Stack**: Fastify (Node.js), TypeScript, PostgreSQL, Prisma, PgBoss (job queue), Docker.
- **Key responsibilities**:
  - Manage **users, packages, purchases, referral tree** (up to 9 levels).
  - Maintain **wallets, balances, ledger, wallet transactions**.
  - Implement **4 commission types**:
    - `SELF`
    - `GLOBAL_HELPING`
    - `SPOT`
    - `MONTHLY`
  - Run **daily commission jobs** (via PgBoss / cron-like scheduler).
  - Provide **REST APIs** for `MLM-user-ui` and `MLM-Admin-ui`.
  - Support **time‑travel testing** for 90‑day simulations with full accuracy.

Think of `MLM-API` as: **“single source of truth” for money, commissions, and tree structure.**

---

#### 2.2 `MLM-user-ui` – User / Associate Dashboard

**Purpose**: What an **associate actually sees and uses every day**.

- **Stack**: Next.js (App Router), TypeScript, Tailwind CSS, Redux Toolkit, dark/light theming.
- **Main user journeys**:
  - **Onboarding & auth**:
    - Register, login, password flows, OTP logic (mapped in `api.md`).
  - **Dashboard**:
    - Overview cards, income charts, business stats.
  - **Wallet & payments**:
    - View main wallet balance.
    - Add balance (manual / gateway flows).
    - See payment history and bank details.
  - **Income history**:
    - Per‑type pages: self, direct, spot, team, global helping.
    - Filters, pagination, ready to plug into backend listing APIs.
  - **Team & network**:
    - Team list with metrics.
    - Tree hierarchy view for downline.
  - **Leaderboard & rank journey**:
    - Ranking pages and a rank‑journey visualisation.
  - **Withdrawals & transfers**:
    - Place withdrawal requests (normal + spot if configured).
    - P2P transfers, self‑transfer, transfer history.
  - **Profile & support**:
    - Profile and bank KYC sections.
    - Notices, notifications and support pages.
  - **Courses entry points**:
    - `my-course` entry in dashboard to link with course platform.

This app is **contract‑driven**: all backend contracts are described in `api.md`, so the UI knows **exactly which endpoints and responses** it expects from `MLM-API`.

---

#### 2.3 `MLM-Admin-ui` – Admin / Back Office Dashboard

**Purpose**: Internal **control panel for operations team**.

- **Stack**: Next.js App Router, React 18, Tailwind CSS.
- **Core modules**:
  - **TopUp**:
    - `activation-request`: see and act on activation/top‑up requests.
    - `activation-history`: audit of completed activations.
    - `gateway-activation`: flows for payment‑gateway based activations.
  - **Renewal Request**:
    - `new-request`: handle renewal submissions.
    - `request-history`: see all processed renewals.
  - **Course Master**:
    - `course-module`: manage modules/chapters.
    - `course-vedios`: manage course videos metadata.
- **Reusable components**:
  - Cards, tables, filters, pagination, status badges, action buttons.

Admins use this UI to **approve, reject, and monitor**:

- Package activations and renewals.
- Course definitions and content metadata.
- High‑level system status (when wired to `MLM-API` and `MLM-course-API`).

---

#### 2.4 `MLM-course-API` – Course Platform Backend

**Purpose**: Dedicated backend for the **course marketplace**.

- **Stack**: Fastify, Prisma, PostgreSQL, JWT auth, Razorpay, Bunny Stream, Swagger.
- **Key capabilities**:
  - User registration, login, password reset.
  - Course, module, video management.
  - Cart and checkout, Razorpay/test‑mode payments.
  - Purchase history and access control for enrolled courses.
  - Ratings and reviews.

The course backend can **optionally trigger or integrate with `MLM-API`** so that a course/plan purchase results in MLM commissions.

---

#### 2.5 `MLM-course-ui` – Course Marketplace Frontend

**Purpose**: Public‑facing **course storefront** for learners and associates.

- **Stack**: Next.js App Router, React 18, global CSS, custom contexts, `react-hot-toast`.
- **Key UX flows**:
  - Browse all courses (`/courses`) with filters and search.
  - See course details (`/course/[slug]`): curriculum, ratings, price, includes.
  - Add to cart, manage cart (`/cart`).
  - Checkout (`/checkout`) using Razorpay or **test purchase** endpoint.
  - Manage enrolled courses (`/my-courses`).
  - Watch videos (`/course/[slug]/videos`) via Bunny Stream.
  - Login/register/forgot‑password, plus static policy pages (privacy, terms, refund, shipping).

Together, `MLM-course-API` + `MLM-course-ui` form a **standalone e‑learning platform** that also feeds the MLM commission engine.

---

#### 2.6 `Secure-Infinite-Association-` – Public Site (Next.js)

**Purpose**: A separate **Next.js app reserved for the SIA marketing/public site**.  
Right now its README is the default `create-next-app` template; it is intended as the **brand website / landing experience** that can link users to:

- Course platform (`MLM-course-ui`)
- User dashboard (`MLM-user-ui`)
- Other SIA information (team, company, mission, etc.)

---

### 2.7 Project Structure – Konse Folder Mein Kya Hai (Backend vs Frontend)

Repo ke andar **backend** aur **frontend** alag-alag folders me hai. Neeche short overview hai.

---

#### Backend (Server / API)

| Folder | Type | Kya hai |
|--------|------|---------|
| **`MLM-API/`** | Backend | Core MLM engine – commissions, wallet, tree, jobs. |

**`MLM-API/`** ke andar important folders:

```
MLM-API/
├── prisma/              # DB schema, migrations
├── scripts/             # Seed, time-travel tests, one-off scripts
└── src/
    ├── config/          # App config, env
    ├── constants/       # Fixed values
    ├── jobs/            # PgBoss daily commission job etc.
    ├── middleware/      # Auth, validation
    ├── modules/         # Feature-wise logic
    │   ├── commissions/ # SELF, GLOBAL, SPOT, MONTHLY logic
    │   ├── purchases/   # Purchase create, scheduling
    │   ├── fees/        # Operation fees
    │   ├── kyc/         # KYC flows
    │   ├── leaderboard/ # Rank, leaderboard
    │   ├── support/     # Tickets
    │   ├── sms/         # SMS
    │   ├── bunny-cdn/   # CDN
    │   └── bunny-stream/# Video streaming
    ├── routes/          # API route handlers (v1, admin, etc.)
    └── utils/           # Helpers, date, clock
```

**Note:** Course platform ka backend (`MLM-course-API`) agar repo me ho to alag folder hoga; abhi is repo me sirf `MLM-API` (MLM backend) hai.

---

#### Frontend (User / Admin / Course / Marketing)

| Folder | Type | Kya hai |
|--------|------|---------|
| **`MLM-user-ui/`** | Frontend | Associate dashboard – wallet, income, team, withdraw. |
| **`MLM-Admin-ui/`** | Frontend | Admin panel – top-up, renewal, course master, users. |
| **`MLM-course-ui/`** | Frontend | Course marketplace – courses, cart, checkout, my-courses, videos. |
| **`Secure-Infinite-Association-/`** | Frontend | SIA public/marketing website. |

---

**`MLM-user-ui/`** (User app andar `user/` me):

```
MLM-user-ui/
├── user/                    # Next.js app (actual user UI)
│   └── src/
│       ├── app/             # Pages (routes)
│       │   ├── login/, register/, password/, forgot-password/
│       │   ├── dashboard/
│       │   ├── add-balance/, pay-now/, wallet-history/
│       │   ├── income-history/
│       │   │   ├── self-income/, direct-income/, spot-income/
│       │   │   ├── team-income/, global-help-income/
│       │   ├── withdraw/
│       │   │   ├── list-withdraw-request/, spot-withdraw-request/
│       │   │   ├── payment-history/, overall-withdraw/
│       │   ├── transfer-money/
│       │   │   ├── p2p-transfer/, self-transfer/, fund-transfer-data/, history/
│       │   ├── team/, leaderboard/, path-rank/
│       │   ├── my-course/, profile/, notice/, notifications/, support/
│       │   └── new-join/, renew/
│       ├── components/      # UI components
│       │   ├── layout/      # AppLayout, sidebar, topbar
│       │   ├── ui/          # Buttons, cards, tables, etc.
│       │   ├── auth/, payment/, user/, support/
│       ├── contexts/        # Theme (dark/light)
│       ├── redux/           # Auth, store
│       └── utils/
├── html/                    # Static HTML reference
└── api.md                   # Backend API contract
```

---

**`MLM-Admin-ui/`** (Admin panel):

```
MLM-Admin-ui/
└── src/
    ├── app/                 # Pages (routes)
    │   ├── login/, logout/, dashboard/
    │   ├── top-up/
    │   │   ├── activation-request/, activation-history/, gateway-activation/
    │   ├── renewal-request/
    │   │   ├── new-request/, request-history/
    │   ├── course-master/
    │   │   ├── course-module/, course-vedios/
    │   ├── withdraw/
    │   │   ├── pending-withdraw/, withdraw-history/
    │   ├── user-management/
    │   │   ├── users-summary/, users-details/, users-address/
    │   │   ├── users-wallet/, users-kyc/
    │   ├── master/          # Levels, packages, fees, notice, company bank, etc.
    │   ├── income-history/ # Self, direct, spot, team, global-help, pyramid
    │   ├── support/        # Tickets, pre-questions
    │   ├── p2p-history/, gateway-purchases/, ledger-logs/
    │   ├── website-setting/, notification-module/, settings1/
    │   └── legacy/         # Spot history, activation history (legacy)
    ├── components/         # ui (Card, DataTable, FiltersBar, Pagination, etc.)
    ├── lib/api/            # API client
    └── hooks/
```

---

**`MLM-course-ui/`** (Course marketplace):

```
MLM-course-ui/
├── app/                     # Next.js App Router
│   ├── page.jsx             # Home
│   ├── courses/             # All courses listing
│   ├── course/[slug]/       # Course detail
│   ├── course/[slug]/videos/# Enrolled video player
│   ├── cart/, checkout/
│   ├── my-courses/          # Enrolled courses
│   ├── login/, register/, forgot-password/
│   ├── payment/             # success, failed, callback
│   ├── dashboard/, notifications/
│   └── about/, contact/, privacy/, terms/, refund/, shipping/, faq/
├── components/              # Navbar, Footer, CourseCard, VideoPlayer, etc.
├── contexts/                # AuthContext, CartContext
├── lib/                     # apiClient, api helpers
└── docs/
```

---

**`Secure-Infinite-Association-/`** (Marketing site):

```
Secure-Infinite-Association-/
└── src/
    ├── app/
    │   ├── components/      # Sections, layouts
    │   ├── layouts/
    │   ├── dashboard/       # (e.g. internal dashboard if any)
    │   ├── contexts/, hooks/, data/
    ├── components/
    └── lib/
```

---

#### One-line summary

- **Backend:** `MLM-API/` – MLM engine, APIs, jobs, Prisma, modules (commissions, purchases, fees, etc.).
- **Frontend:**  
  - `MLM-user-ui/user/` – User dashboard.  
  - `MLM-Admin-ui/` – Admin dashboard.  
  - `MLM-course-ui/` – Course storefront.  
  - `Secure-Infinite-Association-/` – SIA marketing site.

---

### 3. End‑to‑End User Journeys

This section describes **what actually happens** for each major flow.

#### 3.1 New User / Associate Onboarding

1. **User registration**  
   - User signs up via `MLM-user-ui` (or via course UI in some flows).  
   - Backend validates data, creates user record, sets up referral linkage (who sponsored this user).
2. **Login & KYC**  
   - User logs in and fills in profile, address, and bank details.
   - Admin may verify documents offline or via future KYC modules.
3. **Package / course purchase**  
   - User selects a package/course (through MLM UI or course UI).  
   - Payment is processed (gateway or manual top‑up).  
   - On **successful completion**, a `purchase` record is written in `MLM-API` and commissions are scheduled.

Result: User now **owns an active package** and becomes eligible for various commission streams according to their level and package rules.

---

#### 3.2 Commission Life‑Cycle (High Level)

1. **Purchase event** (day 0)
   - A purchase is created in `MLM-API`.
   - Commission scheduling logic computes **pre‑calculated daily amounts** for SELF and MONTHLY, and per‑ID rates for GLOBAL_HELPING.
   - Corresponding entries are stored in `scheduled_commissions` (with full metadata and idempotency keys).
2. **Daily job (00:05)**  
   - A worker reads `scheduled_commissions` for “today”.  
   - For each active schedule, it computes **today’s commission amount** and writes:
     - `ledger_entries` (full audit log).
     - `wallet_transactions` and updates `user_balances`.
3. **User experience**  
   - User sees updated **income history and wallet balance** in `MLM-user-ui`.  
   - They can filter by type (SELF, GLOBAL, SPOT, MONTHLY), date, etc.
4. **Withdraw / transfer**  
   - User initiates withdrawal or P2P/self‑transfer.  
   - Admin can review/approve if manual.  
   - Wallet and ledger stay consistent and traceable.

---

#### 3.3 Course Purchase & Consumption

1. User browses courses via `MLM-course-ui`.
2. Adds course to cart, goes through checkout (Razorpay/test mode).
3. `MLM-course-API`:
   - Records purchase.
   - Grants access to course content (modules, videos).
4. Optionally, course purchases can be **connected to MLM packages**, so that:
   - Course buy ⇒ `MLM-API` purchase ⇒ **commissions**.
5. User then watches videos via the secure Bunny Stream integration.

---

#### 3.4 Admin Operations

Admins use `MLM-Admin-ui` to:

- Review **activation requests** and top‑up operations.
- Track **activation/renewal history**.
- Manage **course master data** (modules, videos).
- Monitor that business flows are running smoothly (when wired to appropriate APIs).

The idea is: **business team does not need database access**; they work through the admin dashboard.

---

### 3.5 User kaise kaam karta hai – Ek Step-by-Step Scenario (Faizan)

Yeh section **ek concrete example** se samjhata hai: user kaise enter hota hai, direct referral kaise jodta hai, aur commissions kaise flow karte hain.

---

#### Step 1: Faizan kaise enter hota hai (Registration)

1. **Faizan** SIA join karna chahta hai.
2. Uske paas **Bilal** (jo pehle se member hai) ka **referral link** ya **referral code** hota hai.
3. Faizan **MLM-user-ui** pe jata hai → **Register** pe click karta hai.
4. Form bharta hai: name, mobile, email, password, aur **referral code** (Bilal ka) dalta hai.
5. Backend (`MLM-API`):
   - Naya user create karta hai (Faizan).
   - **Sponsor / upline** set karta hai: Bilal = Faizan ka direct referrer.
   - Tree me entry: `user_tree_paths` me Faizan ↔ Bilal (Level 1) link ho jata hai.
6. Ab **Faizan registered** hai, lekin abhi tak **package nahi liya** – isliye commission eligible nahi.

**Summary:** Register → Referral code se **direct sponsor (Bilal)** link ho gaya → Tree me Level 1 pe add.

---

#### Step 2: Faizan package kharida (Activation)

1. Faizan login karke **Add Balance / Activate Package** flow pe jata hai.
2. Package choose karta hai (e.g. **₹2,500** wala).
3. Payment karta hai:
   - **Gateway** se (Razorpay etc.), ya
   - **Manual**: bank details dekh kar transfer, phir "Payment done" submit → Admin approve karega.
4. Jab payment **success / approved** hoti hai:
   - `MLM-API` me **purchase** record create hota hai (Faizan, ₹2,500, completed).
   - **Commission scheduling** trigger hota hai:
     - **SELF**: Faizan ko 90 din tak roz thodi amount (e.g. ₹62.50/month ÷ days) – `scheduled_commissions` me entries.
     - **GLOBAL_HELPING**: Faizan ko global user count pe based daily – schedule me add.
     - **SPOT**: Faizan ka koi direct referral abhi purchase nahi kiya, isliye SPOT nahi.
     - **MONTHLY**: Same – koi referral purchase nahi, so no MONTHLY yet.
5. **Bilal** (Faizan ka sponsor) ke liye:
   - Faizan **direct referral** hai → **SPOT commission** Bilal ke wallet me **turant** credit (e.g. 5% of ₹2,500 = ₹125).
   - **MONTHLY commission** Bilal ke liye schedule ho jati hai: 90 din tak roz Faizan ke package pe based amount (e.g. ₹12.50/month ÷ days).

**Summary:** Faizan ne package liya → Faizan ko SELF + GLOBAL_HELPING schedule; Bilal ko SPOT (instant) + MONTHLY (daily for 90 days).

---

#### Step 3: Faizan kisi ko direct jodta hai (Referral – Ramesh)

1. Faizan apna **referral link / code** share karta hai (e.g. WhatsApp, message).
2. **Ramesh** us link se aata hai aur **Register** karta hai – referral code me **Faizan** likha hota hai.
3. Backend:
   - Ramesh user create hota hai.
   - **Sponsor = Faizan** set hota hai.
   - Tree me: Ramesh ↔ Faizan (Level 1), Ramesh ↔ Bilal (Level 2).
4. Abhi Ramesh **sirf registered** hai; purchase nahi kiya – Faizan ko koi commission nahi.

---

#### Step 4: Ramesh package leta hai – Faizan ko commission

1. Ramesh login karke **₹2,500** package le leta hai (payment success/approved).
2. `MLM-API`:
   - Ramesh ka **purchase** create.
   - Ramesh ke liye SELF + GLOBAL_HELPING schedule (jaise Faizan ke liye hua).
3. **Faizan** (Ramesh ka direct referrer) ke liye:
   - **SPOT**: Ek baar **instant** Faizan ke wallet me (e.g. 5% × ₹2,500 = **₹125**).
   - **MONTHLY**: Faizan ke liye 90 din tak **daily** amount schedule (e.g. ₹12.50/month ÷ days in month).
4. **Bilal** (Faizan ka sponsor, Ramesh ka Level 2) ko bhi system rules ke hisaab se **Level 2** commission ho sakta hai (agar product me defined ho).

**Summary:** Ramesh ne package liya → Faizan ko **SPOT (₹125 turant)** + **MONTHLY (90 din roz)**; Ramesh ko SELF + GLOBAL_HELPING.

---

#### Step 5: Roz commission kaise aata hai (Daily Job)

1. Har raat **00:05** pe `MLM-API` ka **daily commission job** chalta hai.
2. Yeh job **scheduled_commissions** me aaj ke date ke liye active rows leta hai.
3. Har schedule ke hisaab se:
   - **SELF**: Faizan / Ramesh jisko bhi schedule hai, unke wallet me aaj ki daily amount credit.
   - **GLOBAL_HELPING**: Aaj tak kitne users (completed purchase) hain, cap ke andar – us hisaab se amount credit.
   - **MONTHLY**: Faizan ko Ramesh ke package se daily share; Bilal ko Faizan ke package se daily share – sab credit.
4. Sab entries **ledger** + **wallet_transactions** me jati hain → balance update.

**Result:** Faizan har din login karke **Income History** me dekh sakta hai: aaj kitna SELF, kitna GLOBAL, kitna MONTHLY (Ramesh se), aur pehle din SPOT (Ramesh ke purchase pe) bhi dikhega.

---

#### Step 6: Faizan apna income dekhta hai aur withdraw karta hai

1. **Dashboard**: Total wallet balance, charts, summary.
2. **Income History**:
   - **Self Income** – apne package se daily SELF.
   - **Direct / Spot Income** – Ramesh (direct) ke purchase pe SPOT.
   - **Team Income** – agar level 2+ se bhi kuch aata ho.
   - **Global Help Income** – GLOBAL_HELPING daily.
3. **Withdraw**: Faizan **Withdraw Request** create karta hai (amount, bank details).
4. Admin **MLM-Admin-ui** se request approve karta hai → amount bank me bhej diya jata hai, wallet se deduct.

---

#### Flow diagram (Faizan scenario – short)

```
Bilal (pehle se member)
    │
    ├── Faizan register (Bilal ka referral code)
    │       │
    │       ├── Faizan package ₹2500 → Purchase
    │       │       → Faizan: SELF + GLOBAL_HELPING (scheduled, daily 90 days)
    │       │       → Bilal:  SPOT (instant ₹125) + MONTHLY (90 days daily)
    │       │
    │       └── Faizan Ramesh ko jodta hai (referral link)
    │               │
    │               └── Ramesh register → Ramesh package ₹2500
    │                       → Ramesh: SELF + GLOBAL_HELPING (scheduled)
    │                       → Faizan: SPOT (instant ₹125) + MONTHLY (90 days daily)
    │
    └── Har din 00:05: sab scheduled commissions run → sabke wallet me daily credit
```

---

**Takeaway:** User **register** (referral se) → **package** le → **direct** me koi jode → jab wo package le, **SPOT turant** + **MONTHLY roz**; khud ko **SELF + GLOBAL_HELPING** roz. Sab **MLM-user-ui** me income history aur wallet me dikhta hai; withdraw admin approve ke baad.

---

### 4. Commission Types – How They Work

The system defines four main commission categories. Exact percentages and caps are stored in the **`commission_rules` and `packages` configuration**, but the behavior is:

#### 4.1 SELF Commission

- **What**: Daily income based on the **user’s own package** price.
- **How it’s set up**:
  - At purchase time, `MLM-API`:
    - Calculates monthly SELF amount from package rules.
    - Uses **tomorrow’s month length** to compute a **precise daily rate in paise**.
    - Creates `scheduled_commissions` rows from start_date to end_date (e.g. 90 days).
- **How it’s paid**:
  - Every day, the daily worker picks active schedules and credits that day’s SELF amount into the wallet.
  - Integer math (paise) + last‑day adjustment ensures the **total equals the exact configured monthly amount over time**.

Effectively: **a stable, predictable daily income for the user’s own package.**

---

#### 4.2 GLOBAL_HELPING Commission

- **What**: A **daily income linked to total active users** in the system, capped per package.
- **Key idea**: “Global helping” means you benefit from **overall system growth**, not just your own team.
- **How it’s calculated** (per day):
  - Each schedule stores a **per‑ID daily rate** (in paise).
  - At 00:05, for each receiver:
    - Count all `completed` purchases with `purchased_at <= today`, excluding the receiver.
    - Apply a **cap** based on package (e.g. up to N global IDs).
    - Today’s amount = `perIdDailyRate × effectiveGlobalUserCount`.
- **Why “progressive”**:
  - As days go by and more users join, the **global user count increases**, so **daily global‑helping income automatically grows**, until the cap is reached.

GLOBAL_HELPING is what gives SIA its **“system growth sharing”** feel.

---

#### 4.3 SPOT Commission

- **What**: A **one‑time, instant bonus** when your direct referral buys a package/course.
- **When it fires**:
  - On each qualifying purchase by a **direct referral**, the system:
    - Calculates SPOT amount from rules (often a percentage of package price).
    - Credits it immediately as a **single ledger + wallet transaction**.
- **Usage**:
  - Encourages **direct selling / sponsoring**.
  - Appears in **spot income history** on the user dashboard.

---

#### 4.4 MONTHLY Commission

- **What**: Recurring income based on **referrals’ packages**, distributed **daily** over a monthly period.
- **Behavior**:
  - For each qualifying referral purchase, system schedules a MONTHLY commission:
    - Monthly amount per referral is derived from package rules.
    - Converted into a **daily rate** using the appropriate month’s day count.
  - Daily worker credits this amount for the defined period (e.g. 90 days).
- **Relationship to SELF**:
  - SELF = based on **your** purchase.  
  - MONTHLY = based on **your referrals’** purchases.

Together, SELF + MONTHLY + GLOBAL_HELPING + SPOT form a **balanced commission structure**: personal reward, team reward, global growth reward, and instant bonuses.

---

### 5. Data, Wallet & Audit Model

Key tables in `MLM-API` (simplified):

- **`users`** – User accounts.
- **`packages`** – Package/course definitions with commission settings.
- **`purchases`** – Completed purchases (source for commissions).
- **`user_tree_paths`** – Closure table storing full 9‑level referral tree.
- **`scheduled_commissions`** – Future daily commissions (SELF, MONTHLY, GLOBAL_HELPING).
- **`pending_commissions`** – Held commissions (e.g. waiting for conditions).
- **`ledger_entries`** – Immutable, human‑readable financial ledger.
- **`wallet_transactions`** – Applied transactions affecting balances.
- **`user_balances`** – Current wallet balances per user.
- **`commission_rules` / `fee_rules`** – Percentages and fees for different operations.

All money‑related flows **must go through ledger + wallet_transactions**, so the system is:

- **Auditable** (every amount has an entry).
- **Reproducible** (time‑travel tests can recompute expected totals).
- **Safe** (idempotency keys prevent double‑crediting per day).

---

### 6. Testing, Accuracy & Time‑Travel

To avoid “wait 90 days to be sure” problems, `MLM-API` includes **time‑travel testing**:

- A generic **Clock interface** allows the system to run as if “today” is any date.
- Helper scripts simulate **full 90‑day cycles** in seconds:
  - Create test users & purchases.
  - Jump day‑by‑day from `start_date` to `end_date`.
  - Run daily commission job for each simulated date.
  - Compare final wallet balance to **manually‑computed expected value**.
- Real production behavior uses **system time**, test behavior uses **fake time**, but code paths are the same.

Multiple scenario analyses (e.g. Jatin scenario, Siddhant scenario) show **near‑perfect matches** between manual calculations and system output, with any tiny differences only coming from **more precise, per‑day integer math** in the code.

Result: **Commission engine is mathematically sound and production‑ready.**

---

### 7. Putting It All Together (Scope Summary)

- SIA provides a **full ecosystem**:
  - Public/marketing presence (`Secure-Infinite-Association-`).
  - Course platform (`MLM-course-API` + `MLM-course-ui`).
  - Core MLM engine (`MLM-API`).
  - User/associate portal (`MLM-user-ui`).
  - Admin/back office dashboard (`MLM-Admin-ui`).
- The platform covers:
  - **Onboarding, purchases, commissions, wallets, withdrawals, transfers**.
  - **Course browsing, checkout, enrollment, video streaming, ratings**.
  - **Admin operations for activations, renewals, and course master data**.
- Commissions follow a **well‑defined, tested mathematical model**:
  - SELF, GLOBAL_HELPING, SPOT, MONTHLY.
  - Atomic paise precision, time‑travel simulation, and full audit trail.

From a business point of view, the **scope of SIA** is:  
**“Run an end‑to‑end digital MLM + course business with transparent income, powerful dashboards for users and admins, and a provably correct commission engine.”**

