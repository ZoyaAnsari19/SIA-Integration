# Changelog

All notable changes to the MLM Commission System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Fee/Deduction System**
  - Rule-based fee system for charging users for various actions
  - Automatic wallet deduction with insufficient balance checks
  - Complete fee transaction history tracking
  - Admin panel for managing fee rules (CRUD operations)
  - User endpoints for viewing fee history and active rules

- **Fee Rules Management**
  - `fee_rules` table: Store configurable fee rules (KYC, name change, report download, etc.)
  - `fee_transactions` table: Track all fee deductions with reference to actions
  - Admin endpoints for creating, updating, deleting fee rules
  - Default fee rules: KYC Submission (₹25), Name Change (₹2), Report Download (₹20)

- **Wallet Debit Functionality**
  - `deductFromWallet()` function for safe wallet deductions
  - Advisory locks for concurrency safety
  - Idempotency support to prevent duplicate charges
  - Insufficient balance error handling with detailed messages

- **Fee Service Module**
  - `FeeService.checkFeeApplicable()`: Check if user has sufficient balance
  - `FeeService.deductFee()`: Deduct fee from wallet with validation
  - `FeeService.getFeeHistory()`: Get user's fee transaction history
  - `FeeService.getActiveFeeRules()`: Get all active fee rules

- **Integration Points**
  - KYC submission: ₹25 fee deducted before submission
  - Name change: ₹2 fee deducted when name is changed
  - Report download: ₹20 fee deducted before report generation
  - All integrations include insufficient balance error handling

- **Admin Endpoints**
  - `GET /api/v1/admin/fees/rules` - List all fee rules
  - `POST /api/v1/admin/fees/rules` - Create fee rule
  - `GET /api/v1/admin/fees/rules/:id` - Get fee rule
  - `PUT /api/v1/admin/fees/rules/:id` - Update fee rule
  - `DELETE /api/v1/admin/fees/rules/:id` - Delete fee rule
  - `GET /api/v1/admin/fees/transactions` - List all fee transactions
  - `GET /api/v1/admin/fees/transactions/:userId` - Get user's fee transactions

- **User Endpoints**
  - `GET /api/v1/fees/history` - Get user's fee transaction history
  - `GET /api/v1/fees/rules` - Get active fee rules (for information)

- **Report Download Endpoint**
  - `POST /api/v1/reports/download` - Generate and download reports
  - Supports multiple report types: income, commission, wallet, team, payment_history
  - Fee deducted before report generation
  - Date range filtering support

### Changed
- **KYC Submission Flow**
  - Fee check and deduction added before KYC submission
  - Returns insufficient balance error if wallet balance < ₹25
  - Fee transaction recorded with reference to KYC action

- **Profile Update Flow**
  - Name change now charges ₹2 fee (only when name actually changes)
  - Email change remains free
  - Returns insufficient balance error with required/available amounts

- **Error Handling**
  - All fee-related endpoints return detailed insufficient balance errors
  - Error format: `{ error: 'INSUFFICIENT_BALANCE', message, required_amount, available_balance }`
  - UI can show warning and redirect to main screen

### Technical Details
- Fee rules stored in `fee_rules` table with `rule_code` as unique identifier
- Fee transactions stored in `fee_transactions` table with reference to actions
- Wallet debit uses advisory locks for thread-safe operations
- Idempotency keys prevent duplicate fee charges
- All fee deductions are atomic (transaction-based)

---

## Previous Changes

### Added
- **2x Investment Commission Cap System**
  - Implemented automatic commission stopping when SELF + GLOBAL_HELPING combined reaches 2x investment amount
  - Each purchase/course tracked separately for 2x calculation
  - Course deactivation when 2x investment reached
  - SPOT and MONTHLY commissions continue only if user has at least one active course

- **Purchase-wise Commission Tracking**
  - `isPurchaseDoubleReached()` function to check if purchase has earned 2x investment
  - Only SELF + GLOBAL_HELPING commissions count towards 2x calculation
  - SPOT and MONTHLY commissions excluded from 2x check

- **Active Course Validation**
  - `hasActiveCourse()` function to check if user has any active course
  - Active course = purchase.active_until >= today AND total_earned < 2x investment
  - SPOT/MONTHLY commissions only credited if receiver has active course

### Changed
- **Commission Stop Logic**
  - SELF + GLOBAL_HELPING: Stop when that specific purchase reaches 2x investment
  - SPOT commissions (direct + level): Only credit if receiver has active course
  - MONTHLY commissions (direct + level): Only schedule/credit if receiver has active course
  - Removed global IDs cap-based stopping (cap still applies for income calculation)

- **Global IDs Cap Behavior**
  - Global helping income still capped at course's `global_ids` count
  - Cap applies to income calculation, not commission stopping
  - Commission stops only when SELF + GLOBAL_HELPING = 2x investment

### Business Rules Implemented
1. **2x Investment Rule**
   - When SELF + GLOBAL_HELPING combined = 2x purchase amount → Course deactivated
   - SELF and GLOBAL_HELPING commissions stop for that course
   - Other courses continue earning independently

2. **Active Course Requirement**
   - SPOT/MONTHLY/Level commissions require receiver to have at least one active course
   - If all courses reach 2x → SPOT/MONTHLY commissions stop
   - User must purchase new course to continue earning SPOT/MONTHLY

3. **Global IDs Cap**
   - Global helping income limited to course's `global_ids` count
   - Example: 53 global IDs → income from max 53 users
   - Cap applies throughout course lifetime until 2x reached

### Technical Details
- Commission calculation uses only SELF + GLOBAL_HELPING for 2x check
- SPOT and MONTHLY commissions tracked separately (not included in 2x)
- Purchase-wise tracking ensures independent course management
- Daily commission worker checks 2x status before crediting
- Purchase handler checks active course status before crediting SPOT/MONTHLY

---

## Previous Changes

### Swagger Documentation Updates
- Complete OpenAPI documentation for all UI-aligned endpoints
- Added operationId, parameters, responses for all endpoints
- Updated Swagger tags in app.ts

### Endpoint Renaming (UI-Aligned)
- Created new route files: auth, dashboard, income-history, profile, my-course, team, payment-history, path-rank
- Moved endpoints from `/api/v1/users/:id/...` to semantic paths
- User ID now extracted from JWT token instead of URL parameter
- Old endpoints kept for backward compatibility

### Commission Processing
- Atomic precision using paise-based integer math
- Progressive global helping with dynamic user counting
- Pre-calculated daily amounts for month-aware scheduling
- Idempotent processing with safe job retries

