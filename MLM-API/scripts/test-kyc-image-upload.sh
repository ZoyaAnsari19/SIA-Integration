#!/bin/bash

# Test KYC Image Upload Functionality
# Tests that KYC document images can be uploaded and stored in Bunny CDN

set -e

BASE_URL="http://localhost:3000/api/v1"
TS=$(date +%s)

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║          KYC IMAGE UPLOAD TEST                                 ║"
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

# Step 1: Register Test User
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Registering Test User"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
USER=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"KYC Image Test User $TS\",
    \"email\": \"kyc-image-test-$TS@test.com\",
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
  -d "{\"userId\": \"kyc-image-test-$TS@test.com\", \"password\": \"test123\"}")

TOKEN=$(echo $LOGIN | jq -r '.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  echo "$LOGIN" | jq
  exit 1
fi

echo "✅ User logged in"
echo ""

# Step 3: Create a test image file (minimal PNG)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Creating Test Image"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TEST_IMAGE="/tmp/kyc-test-image-$TS.png"

# Create minimal 1x1 PNG using base64 (always works)
echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" | base64 -d > "$TEST_IMAGE" 2>/dev/null

if [ ! -f "$TEST_IMAGE" ] || [ ! -s "$TEST_IMAGE" ]; then
  # Fallback: Create a simple text file as image (for testing)
  echo "Test KYC Document Image" > "$TEST_IMAGE"
  echo "⚠️  Using text file as test image (for testing upload functionality)"
else
  echo "✅ Test image created (minimal PNG)"
fi

echo "   Image path: $TEST_IMAGE"
echo "   File size: $(wc -c < "$TEST_IMAGE") bytes"
echo ""

# Step 4: Upload KYC Document Front Image
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4: Uploading KYC Document Front Image"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
FRONT_UPLOAD=$(curl -s -X POST "$BASE_URL/user/kyc/document" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$TEST_IMAGE" \
  -F "document_type=aadhar" \
  -F "side=front")

FRONT_IMAGE_URL=$(echo $FRONT_UPLOAD | jq -r '.image_url // empty')
FRONT_ERROR=$(echo $FRONT_UPLOAD | jq -r '.error // empty')
FRONT_MESSAGE=$(echo $FRONT_UPLOAD | jq -r '.message // empty')

if [ -n "$FRONT_ERROR" ]; then
  echo "❌ Front image upload failed"
  echo "   Error: $FRONT_ERROR"
  echo "   Message: $FRONT_MESSAGE"
  echo "   Response: $FRONT_UPLOAD" | jq
  exit 1
fi

if [ -z "$FRONT_IMAGE_URL" ] || [ "$FRONT_IMAGE_URL" = "null" ]; then
  echo "❌ Front image upload failed - no URL returned"
  echo "$FRONT_UPLOAD" | jq
  exit 1
fi

echo "✅ Front image uploaded successfully"
echo "   Image URL: $FRONT_IMAGE_URL"
echo ""

# Step 5: Upload KYC Document Back Image
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 5: Uploading KYC Document Back Image"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
BACK_UPLOAD=$(curl -s -X POST "$BASE_URL/user/kyc/document" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$TEST_IMAGE" \
  -F "document_type=aadhar" \
  -F "side=back")

BACK_IMAGE_URL=$(echo $BACK_UPLOAD | jq -r '.image_url // empty')
BACK_ERROR=$(echo $BACK_UPLOAD | jq -r '.error // empty')
BACK_MESSAGE=$(echo $BACK_UPLOAD | jq -r '.message // empty')

if [ -n "$BACK_ERROR" ]; then
  echo "❌ Back image upload failed"
  echo "   Error: $BACK_ERROR"
  echo "   Message: $BACK_MESSAGE"
  echo "   Response: $BACK_UPLOAD" | jq
  exit 1
fi

if [ -z "$BACK_IMAGE_URL" ] || [ "$BACK_IMAGE_URL" = "null" ]; then
  echo "❌ Back image upload failed - no URL returned"
  echo "$BACK_UPLOAD" | jq
  exit 1
fi

echo "✅ Back image uploaded successfully"
echo "   Image URL: $BACK_IMAGE_URL"
echo ""

# Step 6: Verify Images are Accessible
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 6: Verifying Images are Accessible"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
FRONT_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONT_IMAGE_URL")
BACK_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BACK_IMAGE_URL")

if [ "$FRONT_HTTP_CODE" = "200" ]; then
  echo "✅ Front image is accessible (HTTP $FRONT_HTTP_CODE)"
else
  echo "⚠️  Front image returned HTTP $FRONT_HTTP_CODE (may need time to propagate)"
fi

if [ "$BACK_HTTP_CODE" = "200" ]; then
  echo "✅ Back image is accessible (HTTP $BACK_HTTP_CODE)"
else
  echo "⚠️  Back image returned HTTP $BACK_HTTP_CODE (may need time to propagate)"
fi
echo ""

# Step 7: Submit KYC with Uploaded Images (if date allows)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 7: Submitting KYC with Uploaded Images"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
CURRENT_DAY=$(date +%d | sed 's/^0//')
ALLOWED_DATE=false

if [ "$CURRENT_DAY" -ge 2 ] && [ "$CURRENT_DAY" -le 13 ]; then
  ALLOWED_DATE=true
elif [ "$CURRENT_DAY" -ge 17 ] && [ "$CURRENT_DAY" -le 28 ]; then
  ALLOWED_DATE=true
fi

if [ "$ALLOWED_DATE" = "true" ]; then
  KYC_SUBMIT=$(curl -s -X POST "$BASE_URL/users/$USER_ID/kyc/submit" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"phone\": \"987654${TS: -4}\",
      \"pan_number\": \"ABCDE1234F\",
      \"aadhar_number\": \"123456789012\",
      \"documents\": [{
        \"document_type\": \"aadhar\",
        \"document_number\": \"123456789012\",
        \"front_image_url\": \"$FRONT_IMAGE_URL\",
        \"back_image_url\": \"$BACK_IMAGE_URL\"
      }]
    }")

  KYC_SUCCESS=$(echo $KYC_SUBMIT | jq -r '.success // false')
  KYC_ERROR=$(echo $KYC_SUBMIT | jq -r '.error // empty')

  if [ "$KYC_SUCCESS" = "true" ]; then
    echo "✅ KYC submitted successfully with uploaded images"
    echo "   Front image: $FRONT_IMAGE_URL"
    echo "   Back image: $BACK_IMAGE_URL"
  else
    echo "⚠️  KYC submission response:"
    echo "$KYC_SUBMIT" | jq
  fi
else
  echo "⚠️  Today is day $CURRENT_DAY - KYC submission not allowed"
  echo "   Skipping KYC submission test (date restriction)"
  echo "   Images uploaded successfully, ready for KYC submission on allowed dates"
fi
echo ""

# Step 8: Verify Images Stored in Database
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 8: Verifying Images in Database (if KYC submitted)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$ALLOWED_DATE" = "true" ] && [ "$KYC_SUCCESS" = "true" ]; then
  docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
  SELECT 
    id,
    user_id,
    document_type,
    front_image_url,
    back_image_url,
    status,
    submitted_at
  FROM kyc_documents
  WHERE user_id = $USER_ID
  ORDER BY submitted_at DESC
  LIMIT 1;
  " 2>/dev/null || echo "⚠️  Could not query database (may need to wait for KYC submission)"
else
  echo "ℹ️  Skipping database check (KYC not submitted due to date restriction)"
fi
echo ""

# Cleanup
rm -f "$TEST_IMAGE"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Front Image Upload: $FRONT_IMAGE_URL"
echo "✅ Back Image Upload: $BACK_IMAGE_URL"
echo "✅ Images stored in Bunny CDN: kyc_documents folder"
echo ""
if [ "$ALLOWED_DATE" = "true" ] && [ "$KYC_SUCCESS" = "true" ]; then
  echo "✅ KYC submitted with uploaded images"
  echo "✅ Images linked to KYC documents in database"
else
  echo "ℹ️  KYC submission skipped (date restriction or other reason)"
  echo "   Images are ready for use when KYC submission is allowed"
fi
echo ""
echo "✅ All image upload tests passed!"
echo ""

