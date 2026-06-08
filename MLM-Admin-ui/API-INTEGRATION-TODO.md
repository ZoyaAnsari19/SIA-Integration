# API Integration TODO List

## Authentication
- [x] POST /api/v1/auth/admin/login → Admin login page connected and token stored in sessionStorage
- [x] PUT /api/v1/profile/password → Settings page (`/settings1`) changing current admin/user login password using auth token (with inline error/success states)

## Dashboard
- [x] GET /api/v1/admin/dashboard → Dashboard page fetching and displaying statistics correctly

## Users Management ✅ **FULLY INTEGRATED & WORKING**
- [x] GET /api/v1/admin/users → Users summary/details/wallet/address pages fetching user list with filters and pagination
- [x] GET /api/v1/admin/users/:id → Users details page fetching single user by ID for edit modal
- [x] PUT /api/v1/admin/users/:id → Users details page updating user information
- [x] DELETE /api/v1/admin/users/:id → Users details page deleting/deactivating users
- [x] POST /api/v1/admin/users/:id/activate → Users details page activating users
- [x] POST /api/v1/admin/users/:id/deactivate → Users details page deactivating users
- [x] GET /api/v1/admin/profiles → Users address page fetching user profiles with address data
- [x] POST /api/v1/admin/commissions/manual-credit → Users wallet page manually crediting wallet
- [x] POST /api/v1/admin/commissions/manual-debit → Users wallet page manually debiting wallet
- [x] GET /api/v1/admin/kyc/:user_id/documents → Manual KYC page fetching user documents
- [x] POST /api/v1/admin/kyc/:user_id/approve → Manual KYC page approving KYC
- [x] POST /api/v1/admin/kyc/:user_id/reject → Manual KYC page rejecting KYC with reason

**Status**: All 6 User Management pages are fully integrated:
1. ✅ User Details - CRUD operations working
2. ✅ Users Summary - List with filters working
3. ✅ Users Wallet - Wallet operations working
4. ✅ Users KYC - KYC management working
5. ✅ Users Address - Address data fetching working
6. ✅ Manual KYC - Document approval/rejection working

## Commissions
- [x] GET /api/v1/admin/commissions → Spot commission page fetching SPOT commissions with filters
- [x] GET /api/v1/admin/users/:id/commissions → User-specific commissions function available in commissions API module
- [x] POST /api/v1/admin/commissions/manual-credit → Users wallet page manually crediting wallet
- [x] POST /api/v1/admin/commissions/manual-debit → Users wallet page manually debiting wallet

## Packages
- [x] GET /api/v1/admin/packages → Package setting page fetching packages list with search filter
- [x] GET /api/v1/admin/packages/:id → Package setting page fetching single package for edit
- [x] POST /api/v1/admin/packages → Package setting page creating new packages
- [x] PUT /api/v1/admin/packages/:id → Package setting page updating existing packages
- [x] DELETE /api/v1/admin/packages/:id → Package setting page deleting packages

## KYC Management
- [x] GET /api/v1/admin/profiles → Users KYC page fetching all user profiles with pagination
- [x] GET /api/v1/admin/kyc/:user_id/documents → Manual KYC page fetching user documents
- [x] POST /api/v1/admin/kyc/:user_id/approve → Users KYC page and Manual KYC page approving KYC
- [x] POST /api/v1/admin/kyc/:user_id/reject → Users KYC page and Manual KYC page rejecting KYC with reason
- [x] GET /api/v1/admin/kyc/pending → List all pending KYC submissions (API function added: getPendingKYCs)
- [x] PUT /api/v1/admin/kyc/:user_id/update → Update user KYC status directly (API function added: updateKYCStatus)

## Withdrawals ✅ **FULLY INTEGRATED & WORKING**
- [x] GET /api/v1/admin/withdraw/pending → Pending withdraw page fetching pending withdrawal requests
- [x] POST /api/v1/admin/withdraw/requests/:id/approve → Pending withdraw page approving withdrawal requests
- [x] POST /api/v1/admin/withdraw/requests/:id/reject → Pending withdraw page rejecting withdrawal requests with reason
- [x] GET /api/v1/admin/withdraw/requests → List all withdrawal requests with filters (API function added: getAllWithdrawals)
- [x] GET /api/v1/admin/withdraw/requests/:id → Get withdrawal request details (API function added: getWithdrawalDetails)
- [x] GET /api/v1/admin/withdraw/history → Withdraw History page fetching withdrawal history (approved/rejected) with filters and pagination
- [x] GET /api/v1/admin/wallet/transfers → P2P History page fetching all wallet transfers (user to user) with filters and pagination (✅ Verified in DB: 10 test records inserted)

**Status**: All Withdrawal pages are fully integrated:
1. ✅ Pending Withdraw - Approve/reject workflow working
2. ✅ Withdraw History - Historical withdrawals with filters working
3. ✅ P2P History - Wallet-to-wallet transfers with filters (sender/receiver ID), pagination, export, and print working

**Database Verification Date**: 2025-11-30
- `wallet_transfers` table: 10 test records verified ✅

## Income History ✅ **FULLY INTEGRATED & WORKING**
- [x] GET /api/v1/income-history/self-income → Self Income page fetching SELF commissions with pagination
- [x] GET /api/v1/income-history/direct-income → Direct Income page fetching direct referral commissions (SPOT from depth=1)
- [x] GET /api/v1/income-history/team-income → Team Income page fetching MONTHLY commissions with pagination
- [x] GET /api/v1/income-history/spot-income → Spot Commission page already integrated, Pyramid Income page using same endpoint

**Status**: All 4 Income History pages are fully integrated:
1. ✅ Self Income - SELF commissions working
2. ✅ Direct Income - Direct referral commissions working
3. ✅ Team Income - MONTHLY commissions working
4. ✅ Pyramid Income - Using SPOT income endpoint (pyramid income = SPOT commissions)

## Master Settings
- [x] GET /api/v1/admin/levels → Levels page fetching all levels configuration
- [x] PUT /api/v1/admin/levels/:level → Levels page updating level configuration
- [x] GET /api/v1/admin/levels/:level → Get level details with commission rules (API function added: getLevelDetails)
- [x] GET /api/v1/admin/fees/rules → Fee rules page fetching fee rules with pagination
- [x] GET /api/v1/admin/fees/rules/:id → Get fee rule by ID (function available)
- [x] POST /api/v1/admin/fees/rules → Create fee rule (integrated into fee-rules page with create modal)
- [x] PUT /api/v1/admin/fees/rules/:id → Fee rules page updating fee rule amount
- [x] DELETE /api/v1/admin/fees/rules/:id → Delete fee rule (integrated into fee-rules page with delete button)
- [x] GET /api/v1/admin/fees/transactions → List all fee transactions (API function added: getFeeTransactions)
- [x] GET /api/v1/admin/fees/transactions/:userId → Get user's fee transactions (API function added: getUserFeeTransactions)
- [x] GET /api/v1/admin/notices → Notice board page fetching notices with pagination
- [x] GET /api/v1/admin/notices/:id → Get notice by ID (function available)
- [x] POST /api/v1/admin/notices → Notice board page creating notices
- [x] PUT /api/v1/admin/notices/:id → Notice board page updating notices
- [x] DELETE /api/v1/admin/notices/:id → Notice board page deleting notices
- [x] GET /api/v1/admin/company-bank → Company bank page fetching company bank accounts
- [x] GET /api/v1/admin/company-bank/:id → Get company bank account by ID (function available)
- [x] POST /api/v1/admin/company-bank → Company bank page creating company bank accounts
- [x] PUT /api/v1/admin/company-bank/:id → Company bank page updating company bank accounts
- [x] DELETE /api/v1/admin/company-bank/:id → Company bank page deleting company bank accounts
- [x] GET /api/v1/admin/withdrawal-transfer-rules → Amount setup page fetching withdrawal and transfer rules
- [x] PUT /api/v1/admin/withdrawal-transfer-rules → Amount setup page updating withdrawal and transfer rules

## Website Settings ✅ **FULLY INTEGRATED & VERIFIED IN DATABASE**
- [x] GET /api/v1/admin/website/slider → Landing Slider page fetching sliders with pagination
- [x] POST /api/v1/admin/website/slider → Landing Slider page creating new sliders (✅ Verified in DB: Data properly inserted)
- [x] PUT /api/v1/admin/website/slider/:id → Landing Slider page updating sliders
- [x] DELETE /api/v1/admin/website/slider/:id → Landing Slider page deleting sliders
- [x] GET /api/v1/admin/website/notices → Website Notice page fetching notices with pagination
- [x] POST /api/v1/admin/website/notices → Website Notice page creating new notices (✅ Verified in DB: Data properly inserted)

**Status**: Website Settings fully integrated and database verified:
1. ✅ Landing Slider - Full CRUD operations working (GET, POST, PUT, DELETE)
   - Database verification: ✅ 1 record found with proper fields (title, image_url, link, display_order, is_active, timestamps)
2. ✅ Website Notice - GET and POST working (PUT/DELETE endpoints not available in backend)
   - Database verification: ✅ 1 record found with proper fields (title, content, is_active, timestamps)

**Note**: Website Notice PUT/DELETE endpoints are not implemented in the backend, so edit/delete functionality is disabled in the UI.

**Database Verification Date**: 2025-11-30
- `website_sliders` table: 1 record verified ✅
- `website_notices` table: 1 record verified ✅

## Ledger Logs ✅ **FULLY INTEGRATED & WORKING**
- [x] GET /api/v1/admin/audit-log → Ledger Logs page fetching ledger entries with pagination, user_id filter, and commission_type filter
- [x] GET /api/v1/admin/reports/commission-breakdown → Ledger Logs page fetching commission breakdown summary for KPI cards

**Status**: Ledger Logs page is fully integrated:
1. ✅ Ledger Entries - Full list with filters (user_id, commission_type), pagination, export, and print functionality
2. ✅ Commission Breakdown - Summary KPI cards showing totals by commission type (SELF, SPOT, MONTHLY, GLOBAL_HELPING)

**Features**:
- Pagination support (10, 25, 50 items per page)
- Filter by User ID
- Filter by Commission Type (SELF, SPOT, MONTHLY, GLOBAL_HELPING, FEE_DEDUCTION)
- Export to CSV functionality
- Print functionality
- Real-time commission breakdown summary cards
- Proper error handling and loading states

**API Functions**:
- `getLedgerEntries()` - Fetches paginated ledger entries with filters
- `getCommissionBreakdown()` - Fetches commission totals by type for summary cards

