## MLM-user-ui

Modern **MLM user dashboard UI** built with Next.js, dark/light mode support, and a full API contract for backend integration.

- **Tech stack**: Next.js (App Router), TypeScript, Tailwind CSS
- **Features**: MLM dashboard, wallet, income history, team tree, leaderboard, manual/gateway payments, dark/light theme
- **APIs**: Documented in detail in `api.md` (user, wallet, income, team, leaderboard, payments, withdraw, etc.)

---

### Project Structure

- `user/` – main Next.js app (MLM user UI)
  - `src/app/`
    - `dashboard/` – main dashboard (cards, charts, stats)
    - `add-balance/`, `pay-now/`, `bill-view/` – payment & billing flows
    - `income-history/` – `self-income/`, `direct-income/`, `spot-income/`, `team-income/`, `global-help-income/`
    - `withdraw/` – `list-withdraw-request/`, `spot-withdraw-request/`, `payment-history/`
    - `transfer-money/` – `p2p-transfer/`, `self-transfer/`, `fund-transfer-data/`
    - `team/`, `leaderboard/`, `path-rank/`, `my-course/`
    - `profile/`, `notice/`, `notifications/`, `support/`
    - `login/`, `register/`, `password/` – auth flows
  - `src/components/`
    - `layout/AppLayout.tsx` – main shell (sidebar + topbar)
    - `sidebar.tsx`, `topbar.tsx` – navigation + theme toggle
    - `ui/*` – reusable UI library (Button, Card, Tabs, Table, Toast, etc.)
    - `invoice/InvoiceTemplate.tsx` – invoice PDF/print layout
    - `rank/RankJourney.tsx` – rank journey visualisation
    - `payment/BankDetailsCard.tsx` – bank details for manual payments
  - `src/contexts/theme-context.tsx` – dark/light theme context
  - `src/redux/*` – auth slice + store setup
- `html/` – static HTML screens used as UI reference
- `api.md` – full API documentation (all endpoints the backend must implement)
- `report.md` – dark & light mode implementation report

---

### Setup & Local Development

1. **Install dependencies**

```bash
cd user
npm install
```

2. **Env config (example)**

Create `.env.local` inside `user/` (values example hai, apne backend ke hisaab se change karo):

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
```

3. **Run dev server**

```bash
cd user
npm run dev
```

Open `http://localhost:3000` in browser.

---

### Core Modules / Screens

- **Authentication**
  - Login, register, password change
  - OTP based flows (see `api.md` → Authentication & Registration APIs)
- **Dashboard**
  - Income/commission summary, charts, stats cards
  - Team business & commission trend (see Dashboard APIs in `api.md`)
- **Wallet & Payments**
  - Add balance (manual & gateway payment flows)
  - Wallet balance, payment history, withdraw requests, spot withdraw
  - Bank details card for manual deposits
- **Transfers**
  - P2P transfer, self-transfer, transfer history
  - Uses wallet APIs + transfer APIs from `api.md`
- **Income History**
  - Self income, direct income, spot income, team income, global help income
  - Filter/sort/pagination ready (see Income APIs in `api.md`)
- **Team & Network**
  - Team list with stats
  - Tree hierarchy view (`TreeHierarchy` component) for downline structure
- **Leaderboard & Rank**
  - Leaderboard pages with filters, pagination
  - Rank journey visualisation (`RankJourney`)
- **Profile & Settings**
  - User profile sections: personal, address, bank details
  - Profile photo upload
  - Notification center, support, notices

---

### Theming (Dark & Light Mode)

Dark/light mode pura implement aur document kiya gaya hai (`report.md`):

- `ThemeProvider` + `useTheme()` hook (`src/contexts/theme-context.tsx`)
- `globals.css` me 40+ CSS variables (light + dark palettes)
- Topbar par theme toggle (user dropdown / switch)
- Theme preference `localStorage` me store hota hai – reload ke baad bhi same theme
- `data-theme` attribute se SSR-safe theming (Next.js compatible)

Short me: **poori app theme-aware hai** (layout, UI components, pages sab).

---



### Scripts (from `user/package.json`)

Typical scripts (exact list `user/package.json` me check kar sakte ho):

- `npm run dev` – development server
- `npm run build` – production build
- `npm run start` – production server
- `npm run lint` – linting (Next/ESLint)

---

### Production Notes

- **Build**: `cd user && npm run build`
- **Env**: minimum `NEXT_PUBLIC_API_BASE_URL` + auth token storage strategy (cookies/localStorage) decide karo
- **Deployment**: Vercel / Node server / Docker – Next.js standard deployment flow follow karo

Agar tumhe **Docker setup**, **CI/CD**, ya **aur detailed contributor guide** chahiye ho, bata do, main uske sections bhi README me add kar dunga. 


