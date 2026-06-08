#!/bin/bash

# Test Image Upload & Get via Bunny CDN

API_URL="http://localhost:3000/api/v1"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
  echo ""
  echo -e "${BLUE}=========================================="
  echo "$1"
  echo "==========================================${NC}"
}

print_result() {
  if [ "$1" == "PASS" ]; then
    echo -e "${GREEN}✓ PASS${NC}: $2"
  else
    echo -e "${RED}✗ FAIL${NC}: $2"
    if [ ! -z "$3" ]; then
      echo -e "${YELLOW}  Error: $3${NC}"
    fi
  fi
}

check_response() {
  if echo "$1" | jq . >/dev/null 2>&1; then
    echo "$1"
  else
    echo '{"error": "Invalid JSON response"}'
  fi
}

print_header "IMAGE UPLOAD & GET TEST - Bunny CDN"

TIMESTAMP=$(date +%s)

# ===================================
# Step 1: Create Test User & Login
# ===================================
print_header "Step 1: Create Test User"

REFERRER_ID="2"  # Root user ID
TEST_EMAIL="imgtest_${TIMESTAMP}@test.com"
TEST_MOBILE="98769${TIMESTAMP: -5}"

echo "Creating test user: $TEST_EMAIL"
REG=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Image Test User\",
    \"email\": \"$TEST_EMAIL\",
    \"mobile\": \"$TEST_MOBILE\",
    \"password\": \"Test@12345\",
    \"referrer_user_id\": \"$REFERRER_ID\"
  }")

REG=$(check_response "$REG")
USER_ID=$(echo "$REG" | jq -r '.id // empty')

if [ -z "$USER_ID" ] || [ "$USER_ID" == "null" ]; then
  echo "❌ Failed to create user!"
  exit 1
fi

print_result "PASS" "User created (ID: $USER_ID)"

# Login
LOGIN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$TEST_EMAIL\", \"password\": \"Test@12345\"}")

TOKEN=$(echo "$LOGIN" | jq -r '.token // empty')

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo "❌ Failed to login!"
  exit 1
fi

print_result "PASS" "User logged in"

# ===================================
# Step 2: Create Test Image File
# ===================================
print_header "Step 2: Create Test Image"

TEST_IMAGE="/tmp/test_image_${TIMESTAMP}.png"

# Create a minimal PNG using base64 (1x1 blue pixel)
# This is a valid 1x1 PNG image
echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" | base64 -d > "$TEST_IMAGE" 2>/dev/null

# If base64 -d doesn't work, try base64 -D (macOS) or decode
if [ ! -f "$TEST_IMAGE" ] || [ ! -s "$TEST_IMAGE" ]; then
  # Try macOS base64
  echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" | base64 -D > "$TEST_IMAGE" 2>/dev/null
fi

# If still not working, create using printf (raw PNG bytes)
if [ ! -f "$TEST_IMAGE" ] || [ ! -s "$TEST_IMAGE" ]; then
  printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\nIDATx\x9cc\xf8\x00\x00\x00\x01\x00\x01\x00\x00\x00\x00IEND\xaeB`\x82' > "$TEST_IMAGE"
fi

if [ -f "$TEST_IMAGE" ] && [ -s "$TEST_IMAGE" ]; then
  print_result "PASS" "Test image created"
else
  print_result "FAIL" "Failed to create test image"
  exit 1
fi

if [ ! -f "$TEST_IMAGE" ]; then
  echo "❌ Failed to create test image!"
  exit 1
fi

IMAGE_SIZE=$(stat -f%z "$TEST_IMAGE" 2>/dev/null || stat -c%s "$TEST_IMAGE" 2>/dev/null)
echo "  📸 Image size: $IMAGE_SIZE bytes"

# ===================================
# Step 3: Upload Image via API
# ===================================
print_header "Step 3: Upload Image via API"

echo "Uploading image to Bunny CDN..."
UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/user/profile/photo" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$TEST_IMAGE" \
  -F "filename=test_profile_${TIMESTAMP}.png")

UPLOAD_RESPONSE=$(check_response "$UPLOAD_RESPONSE")
PHOTO_URL=$(echo "$UPLOAD_RESPONSE" | jq -r '.profile_photo_url // empty')

if [ ! -z "$PHOTO_URL" ] && [ "$PHOTO_URL" != "null" ]; then
  print_result "PASS" "Image uploaded successfully"
  echo "  📸 Photo URL: $PHOTO_URL"
  echo ""
  echo "Upload Response:"
  echo "$UPLOAD_RESPONSE" | jq '.'
else
  ERROR_MSG=$(echo "$UPLOAD_RESPONSE" | jq -r '.message // .error // empty')
  print_result "FAIL" "Image upload failed" "$ERROR_MSG"
  echo ""
  echo "Response:"
  echo "$UPLOAD_RESPONSE" | jq '.'
  exit 1
fi

# ===================================
# Step 4: Verify Image URL is Accessible
# ===================================
print_header "Step 4: Verify Image is Accessible"

if [ ! -z "$PHOTO_URL" ]; then
  echo "Checking if image URL is accessible..."
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PHOTO_URL")
  
  if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "301" ] || [ "$HTTP_CODE" == "302" ]; then
    print_result "PASS" "Image URL is accessible (HTTP $HTTP_CODE)"
    
    # Try to download and verify
    DOWNLOADED="/tmp/downloaded_${TIMESTAMP}.png"
    curl -s "$PHOTO_URL" -o "$DOWNLOADED" 2>/dev/null
    
    if [ -f "$DOWNLOADED" ]; then
      DOWNLOADED_SIZE=$(stat -f%z "$DOWNLOADED" 2>/dev/null || stat -c%s "$DOWNLOADED" 2>/dev/null)
      echo "  📥 Downloaded size: $DOWNLOADED_SIZE bytes"
      
      if [ "$DOWNLOADED_SIZE" -gt 0 ]; then
        print_result "PASS" "Image downloaded successfully"
        rm -f "$DOWNLOADED"
      else
        print_result "FAIL" "Downloaded image is empty"
      fi
    fi
  else
    print_result "FAIL" "Image URL not accessible (HTTP $HTTP_CODE)"
    echo "  ⚠️  URL might need authentication or CDN not configured"
  fi
fi

# ===================================
# Step 5: Get User Profile (Verify Photo URL Saved)
# ===================================
print_header "Step 5: Get User Profile to Verify Photo URL"

PROFILE=$(curl -s -X GET "$API_URL/user/details/$USER_ID" \
  -H "Authorization: Bearer $TOKEN")

PROFILE=$(check_response "$PROFILE")
SAVED_PHOTO_URL=$(echo "$PROFILE" | jq -r '.profile_photo_url // empty')

if [ ! -z "$SAVED_PHOTO_URL" ] && [ "$SAVED_PHOTO_URL" != "null" ]; then
  if [ "$SAVED_PHOTO_URL" == "$PHOTO_URL" ]; then
    print_result "PASS" "Photo URL saved correctly in profile"
    echo "  📸 Saved URL: $SAVED_PHOTO_URL"
  else
    print_result "FAIL" "Photo URL mismatch"
    echo "  Expected: $PHOTO_URL"
    echo "  Got: $SAVED_PHOTO_URL"
  fi
else
  print_result "FAIL" "Photo URL not found in profile"
fi

# ===================================
# Step 6: Upload Second Image (Test Replace)
# ===================================
print_header "Step 6: Upload Second Image (Test Replace)"

# Create second image (same method as first)
TEST_IMAGE2="/tmp/test_image2_${TIMESTAMP}.png"
echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" | base64 -d > "$TEST_IMAGE2" 2>/dev/null

if [ ! -f "$TEST_IMAGE2" ] || [ ! -s "$TEST_IMAGE2" ]; then
  echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" | base64 -D > "$TEST_IMAGE2" 2>/dev/null
fi

if [ ! -f "$TEST_IMAGE2" ] || [ ! -s "$TEST_IMAGE2" ]; then
  printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\nIDATx\x9cc\xf8\x00\x00\x00\x01\x00\x01\x00\x00\x00\x00IEND\xaeB`\x82' > "$TEST_IMAGE2"
fi

echo "Uploading second image (should replace first)..."
UPLOAD_RESPONSE2=$(curl -s -X POST "$API_URL/user/profile/photo" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$TEST_IMAGE2" \
  -F "filename=test_profile2_${TIMESTAMP}.png")

UPLOAD_RESPONSE2=$(check_response "$UPLOAD_RESPONSE2")
PHOTO_URL2=$(echo "$UPLOAD_RESPONSE2" | jq -r '.profile_photo_url // empty')

if [ ! -z "$PHOTO_URL2" ] && [ "$PHOTO_URL2" != "null" ]; then
  if [ "$PHOTO_URL2" != "$PHOTO_URL" ]; then
    print_result "PASS" "Second image uploaded (new URL generated)"
    echo "  📸 New Photo URL: $PHOTO_URL2"
  else
    print_result "FAIL" "Second image has same URL (might not have replaced)"
  fi
else
  ERROR_MSG=$(echo "$UPLOAD_RESPONSE2" | jq -r '.message // .error // empty')
  print_result "FAIL" "Second image upload failed" "$ERROR_MSG"
fi

# ===================================
# Cleanup
# ===================================
print_header "Cleanup"

rm -f "$TEST_IMAGE" "$TEST_IMAGE2" 2>/dev/null
print_result "PASS" "Test files cleaned up"

# ===================================
# SUMMARY
# ===================================
print_header "TEST SUMMARY"

echo ""
echo "✅ Image Upload Test Results:"
echo "  📤 Upload: $(if [ ! -z "$PHOTO_URL" ]; then echo "✅ Success"; else echo "❌ Failed"; fi)"
echo "  📥 Download: $(if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "301" ] || [ "$HTTP_CODE" == "302" ]; then echo "✅ Accessible"; else echo "❌ Not Accessible"; fi)"
echo "  💾 Save: $(if [ "$SAVED_PHOTO_URL" == "$PHOTO_URL" ]; then echo "✅ Saved"; else echo "❌ Not Saved"; fi)"
echo "  🔄 Replace: $(if [ ! -z "$PHOTO_URL2" ] && [ "$PHOTO_URL2" != "$PHOTO_URL" ]; then echo "✅ Replaced"; else echo "⚠️  Check"; fi)"
echo ""
echo "📸 Photo URLs:"
echo "  First:  $PHOTO_URL"
echo "  Second: $PHOTO_URL2"
echo ""

if [ ! -z "$PHOTO_URL" ] && [ "$SAVED_PHOTO_URL" == "$PHOTO_URL" ]; then
  echo -e "${GREEN}✅ IMAGE UPLOAD & GET WORKING!${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠️  SOME ISSUES DETECTED${NC}"
  exit 1
fi

