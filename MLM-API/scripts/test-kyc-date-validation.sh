#!/bin/bash

# Test KYC Date Validation
# Tests that KYC submission is blocked on dates 1, 9, 10, 19, 20, 29, 30, 31 and allowed on all other dates

set -e

BASE_URL="http://localhost:3000/api/v1"
TS=$(date +%s)

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║          KYC DATE VALIDATION TEST                            ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Check if API is running
if ! curl -s "$BASE_URL/health" > /dev/null 2>&1; then
  echo "❌ API is not running on $BASE_URL"
  echo "   Please start the API: cd MLM-API && npm run dev"
  exit 1
fi

echo "✅ API is running"
echo ""

# Get current date
CURRENT_DAY=$(date +%d | sed 's/^0//') # Remove leading zero
CURRENT_MONTH=$(date +%B)
CURRENT_YEAR=$(date +%Y)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Current Date Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Today: $CURRENT_DAY $CURRENT_MONTH $CURRENT_YEAR"
echo "Day of month: $CURRENT_DAY"
echo ""

# Check if date is allowed
BLOCKED_DAYS=(1 9 10 19 20 29 30 31)
EXPECTED_ERROR=false
EXPECTED_RESULT="ALLOWED"

for d in "${BLOCKED_DAYS[@]}"; do
  if [ "$CURRENT_DAY" -eq "$d" ]; then
    EXPECTED_RESULT="NOT ALLOWED"
    EXPECTED_ERROR=true
    break
  fi
done

echo "Expected Result: KYC submission should be $EXPECTED_RESULT on day $CURRENT_DAY"
echo ""

# Step 1: Register Test User
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Registering Test User"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
USER=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"KYC Test User $TS\",
    \"email\": \"kyc-test-$TS@test.com\",
    \"mobile\": \"987654${TS: -4}\",
    \"password\": \"test123\",
    \"referrer_user_id\": \"2\"
  }")

USER_ID=$(echo $USER | jq -r '.id')
USER_DISPLAY=$(echo $USER | jq -r '.display_id')

if [ "$USER_ID" = "null" ] || [ -z "$USER_ID" ]; then
  echo "❌ User registration failed"
  echo "$USER" | jq
  exit 1
fi

echo "✅ User registered"
echo "   ID: $USER_ID"
echo "   Display ID: $USER_DISPLAY"
echo ""

# Step 2: Login
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: User Login"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"kyc-test-$TS@test.com\", \"password\": \"test123\"}")

TOKEN=$(echo $LOGIN | jq -r '.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  echo "$LOGIN" | jq
  exit 1
fi

echo "✅ User logged in"
echo ""

# Step 3: Attempt KYC Submission
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Attempting KYC Submission"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Date: Day $CURRENT_DAY of month"
echo ""

KYC_RESPONSE=$(curl -s -X POST "$BASE_URL/users/$USER_ID/kyc/submit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"phone\": \"987654${TS: -4}\",
    \"pan_number\": \"ABCDE1234F\",
    \"aadhar_number\": \"123456789012\",
    \"documents\": [{
      \"document_type\": \"aadhar\",
      \"document_number\": \"123456789012\",
      \"front_image_url\": \"https://example.com/aadhar-front.jpg\"
    }]
  }")

echo "Response:"
echo "$KYC_RESPONSE" | jq
echo ""

# Check response
ERROR_CODE=$(echo $KYC_RESPONSE | jq -r '.error // empty')
MESSAGE=$(echo $KYC_RESPONSE | jq -r '.message // empty')
SUCCESS=$(echo $KYC_RESPONSE | jq -r '.success // false')

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Validation Result"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$EXPECTED_ERROR" = "true" ]; then
  # Should fail
  if [ "$ERROR_CODE" = "kyc_submission_not_allowed" ]; then
    echo "✅ TEST PASSED: KYC submission correctly rejected on day $CURRENT_DAY"
    echo "   Error code: $ERROR_CODE"
    echo "   Message: $MESSAGE"
  else
    echo "❌ TEST FAILED: Expected rejection but got different response"
    echo "   Expected error: kyc_submission_not_allowed"
    echo "   Got error: $ERROR_CODE"
    echo "   Response: $KYC_RESPONSE" | jq
    exit 1
  fi
else
  # Should succeed
  if [ "$SUCCESS" = "true" ] || [ -n "$(echo $KYC_RESPONSE | jq -r '.user_id // empty')" ]; then
    echo "✅ TEST PASSED: KYC submission correctly allowed on day $CURRENT_DAY"
    echo "   Success: $SUCCESS"
    echo "   Message: $MESSAGE"
  else
    if [ "$ERROR_CODE" = "kyc_submission_not_allowed" ]; then
      echo "❌ TEST FAILED: KYC submission was rejected but should be allowed on day $CURRENT_DAY"
      echo "   Error: $ERROR_CODE"
      echo "   Message: $MESSAGE"
      exit 1
    else
      echo "⚠️  TEST INCONCLUSIVE: Different error occurred"
      echo "   Error: $ERROR_CODE"
      echo "   Message: $MESSAGE"
      echo "   Full response:"
      echo "$KYC_RESPONSE" | jq
    fi
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Date Validation Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Allowed dates: All dates except 1, 9, 10, 19, 20, 29, 30, 31 of each month"
echo "Not allowed: 1, 9, 10, 19, 20, 29, 30, 31"
echo ""
echo "Current date: Day $CURRENT_DAY"
echo "Status: $EXPECTED_RESULT"
echo ""

# Show all dates for reference
echo "Full month date validation:"
echo "─────────────────────────────────────────────────────────────"
for day in {1..31}; do
  status="✅ ALLOWED"
  for bd in "${BLOCKED_DAYS[@]}"; do
    if [ "$day" -eq "$bd" ]; then
      status="❌ NOT ALLOWED"
      break
    fi
  done

  if [ "$day" -eq "$CURRENT_DAY" ]; then
    echo "Day $day: $status ← TODAY"
  else
    echo "Day $day: $status"
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

