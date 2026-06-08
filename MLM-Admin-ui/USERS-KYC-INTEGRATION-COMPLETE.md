# Users KYC API Integration - COMPLETE ✅

## Overview
The Users KYC page (`/user-management/users-kyc`) has been fully integrated with the backend API.

## Integration Details

### Backend API Endpoint
- **Endpoint:** `GET /api/v1/admin/profiles`
- **Status:** ✅ Already exists and fully functional
- **Authentication:** Required (Admin JWT token)

### Supported Filters
The API supports all required filters:
- ✅ `page` - Pagination page number
- ✅ `limit` - Items per page (default: 20, max: 100)
- ✅ `user_id` - Filter by User ID (exact match)

### API Response Structure
```typescript
{
  count: number;           // Items in current page
  page: number;            // Current page number
  limit: number;           // Items per page
  total_pages: number;     // Total number of pages
  total: number;           // Total number of profiles
  items: ProfileItem[];    // Array of profile objects
}
```

### Profile Item Structure
```typescript
{
  user_id: string;
  name: string | null;
  email: string | null;
  kyc_status: string;      // 'pending', 'submitted', 'approved', 'rejected'
  kyc_verified_at: string | null;
  created_at: string;
  submitted_at: string | null;
  profile: {
    phone: string | null;
    account_holder: string | null;
    date_of_birth: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    bank_account_no: string | null;
    bank_ifsc: string | null;
    bank_name: string | null;
    bank_branch: string | null;
    pan_number: string | null;
    aadhar_number: string | null;
  } | null;
}
```

## Frontend Implementation

### Page Location
- **File:** `MLM-Admin-ui/src/app/user-management/users-kyc/page.tsx`
- **Route:** `/user-management/users-kyc`

### Features Implemented

1. **API Client Function**
   - Added `getAllProfiles()` function in `kyc.ts`
   - Supports pagination and user_id filter
   - Proper error handling

2. **Data Table**
   - Displays all KYC profile information
   - Columns:
     - Action (Edit button)
     - Fullname
     - User ID
     - Bank Name
     - Branch
     - Account Holder
     - Account Number (masked - shows last 4 digits)
     - IFSC
     - Aadhaar Number (masked - shows last 4 digits)
     - PAN Number
     - Date (Submitted) with status indicator

3. **Data Masking**
   - Account numbers: `XXXXX5678` (shows last 4 digits)
   - Aadhaar numbers: `XXXX XXXX 1234` (formatted with spaces)

4. **Status Color Coding**
   - **Approved:** Green text
   - **Pending:** Yellow text
   - **Rejected:** Red text
   - **Default:** Regular text

5. **Filtering**
   - Filter by User ID input field
   - Search button to apply filter
   - Clear filters button

6. **Pagination**
   - Shows current page and total pages
   - Allows navigation between pages
   - Displays total results count
   - Page size selector (10, 25, 50)

7. **Loading States**
   - Loading spinner while fetching data
   - Error message display with retry option
   - Empty state when no results found

8. **Export & Print**
   - Export button (placeholder for future implementation)
   - Print button (opens browser print dialog)

## Usage

1. **Navigate to Users KYC Page**
   - Go to `/user-management/users-kyc` in the admin panel

2. **View All Profiles**
   - Page loads automatically with all KYC profiles
   - Profiles are displayed in a table format

3. **Filter by User ID**
   - Enter User ID in the filter field
   - Click "Search" button
   - Results are filtered to show only matching user

4. **Clear Filters**
   - Click "Clear filtering" button
   - Resets filter and shows all profiles

5. **Navigate Pages**
   - Use pagination controls at the bottom
   - Change page size if needed

## Data Mapping

### API to UI Mapping
- `name` → `fullname`
- `user_id` → `user_id`
- `profile.bank_name` → `bank_name`
- `profile.bank_branch` → `branch`
- `profile.account_holder` → `account_holder` (falls back to `name` if null)
- `profile.bank_account_no` → `account_no_masked` (masked)
- `profile.bank_ifsc` → `ifsc`
- `profile.aadhar_number` → `aadhaar_no_masked` (masked)
- `profile.pan_number` → `pan_no`
- `submitted_at` → `submitted_on` (formatted date)
- `kyc_status` → `status` (mapped to 'Pending', 'Rejected', 'Approved', or 'default')

## Testing Checklist

- [x] API client function created
- [x] Page fetches data from API on mount
- [x] Filter by User ID works
- [x] Pagination works correctly
- [x] Loading states display properly
- [x] Error handling works
- [x] Empty state displays when no results
- [x] Clear filters resets all fields
- [x] Table displays all columns correctly
- [x] Account numbers are masked
- [x] Aadhaar numbers are masked
- [x] Status color coding works
- [x] Date formatting works

## Notes

- The API returns profile data for ALL KYC statuses (not just approved)
- Profile field is `null` for users without profile data
- Account numbers and Aadhaar numbers are automatically masked for security
- Status is derived from `kyc_status` field
- `submitted_at` comes from the earliest `kyc_documents` submission

## Status: ✅ COMPLETE

The Users KYC integration is fully functional and ready for use!

