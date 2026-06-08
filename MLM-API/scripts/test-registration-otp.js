/**
 * Test Fast2SMS DLT Template - Registration OTP
 * Run with: node scripts/test-registration-otp.js
 * 
 * This script tests sending Registration OTP using Fast2SMS DLT generic template
 * Template ID: Generic OTP Template (for registration/forgot password)
 */

const FAST2SMS_API_KEY = 'pqCvWrXHwkOFMl0Cm4GKvre7nDU8GESLNkwvsgZqkxGame2tWtmXQNkZb1To';
const API_BASE_URL = 'https://www.fast2sms.com/dev';

// Fast2SMS Template IDs (from Dev API dashboard)
// TODO: Update this with your Generic OTP Template ID once created in Fast2SMS
const GENERIC_OTP_TEMPLATE_ID = process.env.FAST2SMS_GENERIC_OTP_TEMPLATE_ID || 'YOUR_GENERIC_OTP_TEMPLATE_ID_HERE';

const SENDER_ID = 'SIAPVT';
const TEST_MOBILE = '8600000889';

// Generate random 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function testRegistrationOTP() {
  console.log('🧪 Testing Fast2SMS - Registration OTP...\n');
  
  // Check if template ID is configured
  const useDLTTemplate = GENERIC_OTP_TEMPLATE_ID !== 'YOUR_GENERIC_OTP_TEMPLATE_ID_HERE' && GENERIC_OTP_TEMPLATE_ID && GENERIC_OTP_TEMPLATE_ID.trim() !== '';
  
  if (!useDLTTemplate) {
    console.log('⚠️  Generic OTP Template ID not configured, will use Quick SMS (custom message)');
    console.log('   To use DLT template:');
    console.log('   1. Create Generic OTP Template in Fast2SMS dashboard');
    console.log('   2. Get the Template ID from Fast2SMS Dev API dashboard');
    console.log('   3. Update this file or set environment variable\n');
  }
  
  const otp = generateOTP();
  console.log(`📱 Mobile Number: ${TEST_MOBILE}`);
  console.log(`🔢 Generated OTP: ${otp}`);
  if (useDLTTemplate) {
    console.log(`📋 Template ID: ${GENERIC_OTP_TEMPLATE_ID} (Generic OTP Template)`);
    console.log(`📤 Sender ID: ${SENDER_ID}`);
  } else {
    console.log(`📋 Method: Quick SMS (Custom Message)`);
  }
  console.log(`🎯 Purpose: Registration OTP\n`);

  try {
    let response;
    
    if (useDLTTemplate) {
      // Use DLT Template
      const url = new URL(`${API_BASE_URL}/bulkV2`);
      url.searchParams.append('authorization', FAST2SMS_API_KEY);
      url.searchParams.append('route', 'dlt'); // DLT route for approved templates
      url.searchParams.append('sender_id', SENDER_ID);
      url.searchParams.append('message', GENERIC_OTP_TEMPLATE_ID); // Fast2SMS Template ID
      url.searchParams.append('variables_values', otp); // OTP value for {#var#}
      url.searchParams.append('numbers', TEST_MOBILE);
      url.searchParams.append('flash', '0');

      console.log('📡 Sending Registration OTP via DLT Template...');
      console.log(`🌐 URL: ${url.toString().replace(FAST2SMS_API_KEY, '***')}`);
      console.log(`📤 Parameters:`);
      console.log(`   - route: dlt`);
      console.log(`   - sender_id: ${SENDER_ID}`);
      console.log(`   - message: ${GENERIC_OTP_TEMPLATE_ID} (Generic OTP Template ID)`);
      console.log(`   - variables_values: ${otp} (OTP)`);
      console.log(`   - numbers: ${TEST_MOBILE}`);
      console.log(`   - flash: 0\n`);

      // Make GET request
      response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'authorization': FAST2SMS_API_KEY,
        },
      });
    } else {
      // Use Quick SMS (Custom Message)
      const message = `Your OTP for Secure Infinite Association is ${otp}. Do not share this OTP with anyone. Valid for 10 minutes.`;
      
      console.log('📡 Sending Registration OTP via Quick SMS (Custom Message)...');
      console.log(`📤 Parameters:`);
      console.log(`   - route: q (transactional)`);
      console.log(`   - message: ${message}`);
      console.log(`   - numbers: ${TEST_MOBILE}\n`);

      // Make POST request
      response = await fetch(`${API_BASE_URL}/bulkV2`, {
        method: 'POST',
        headers: {
          'authorization': FAST2SMS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          language: 'english',
          route: 'q', // Route 'q' for transactional messages
          numbers: TEST_MOBILE,
        }),
      });
    }

    console.log(`📥 Response Status: ${response.status} ${response.statusText}`);
    
    const responseText = await response.text();
    console.log(`📥 Raw Response: ${responseText}\n`);

    // Parse JSON response
    let data;
    try {
      data = JSON.parse(responseText);
      console.log(`📊 Parsed Response:`, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error(`❌ Failed to parse response as JSON`);
      console.error(`Response: ${responseText}`);
      return;
    }

    // Check if successful
    if (data.return === true && data.request_id) {
      console.log(`\n✅ SUCCESS! Registration OTP sent`);
      console.log(`   Request ID: ${data.request_id}`);
      console.log(`   Mobile: ${TEST_MOBILE}`);
      console.log(`   OTP: ${otp}`);
      if (useDLTTemplate) {
        console.log(`   Method: DLT Template`);
        console.log(`   Template ID: ${GENERIC_OTP_TEMPLATE_ID}`);
        console.log(`   Template Type: Generic OTP (Registration/Forgot Password)`);
      } else {
        console.log(`   Method: Quick SMS (Custom Message)`);
      }
      console.log(`\n📱 Check your mobile ${TEST_MOBILE} for OTP message!`);
      if (useDLTTemplate) {
        console.log(`   Expected message format: "Your OTP for Secure Infinite Association is ${otp}..."`);
      } else {
        console.log(`   Message: "Your OTP for Secure Infinite Association is ${otp}. Do not share this OTP with anyone. Valid for 10 minutes."`);
      }
    } else {
      console.log(`\n❌ FAILED to send Registration OTP`);
      console.log(`   Return: ${data.return}`);
      console.log(`   Message: ${data.message?.join(', ') || 'Unknown error'}`);
      if (data.status_code) {
        console.log(`   Status Code: ${data.status_code}`);
      }
      
      // Common error messages
      if (data.message && Array.isArray(data.message)) {
        const errorMsg = data.message[0] || '';
        if (useDLTTemplate) {
          if (errorMsg.includes('Invalid Message ID') || errorMsg.includes('Template')) {
            console.log(`\n💡 Tip: Make sure Generic OTP Template ID is correct and approved in Fast2SMS`);
            console.log(`   Falling back to Quick SMS would be attempted in production`);
          }
          if (errorMsg.includes('Sender ID')) {
            console.log(`\n💡 Tip: Check if Sender ID "${SENDER_ID}" is approved for this template`);
          }
        }
      }
    }

  } catch (error) {
    console.error(`\n❌ Error:`, error.message);
    console.error(`   Stack:`, error.stack);
  }
}

// Run test
testRegistrationOTP().catch(console.error);

