/**
 * Test Fast2SMS DLT Template OTP Sending
 * Run with: node scripts/test-fast2sms-dlt-otp.js
 * 
 * This script tests sending OTP using Fast2SMS DLT templates
 * Template IDs from Fast2SMS Dev API dashboard:
 * - OTP Template: 206001 (Name-Change-Request-OTP)
 * - Login Template: 206002 (Login credentials)
 */

const FAST2SMS_API_KEY = 'pqCvWrXHwkOFMl0Cm4GKvre7nDU8GESLNkwvsgZqkxGame2tWtmXQNkZb1To';
const API_BASE_URL = 'https://www.fast2sms.com/dev';

// Fast2SMS Template IDs (from Dev API dashboard)
const OTP_TEMPLATE_ID = '206001'; // Name-Change-Request-OTP
const LOGIN_TEMPLATE_ID = '206002'; // Login credentials

const SENDER_ID = 'SIAPVT';
const TEST_MOBILE = '8600000889';

// Generate random 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function testDLTOTP() {
  console.log('🧪 Testing Fast2SMS DLT Template OTP Sending...\n');
  
  const otp = generateOTP();
  console.log(`📱 Mobile Number: ${TEST_MOBILE}`);
  console.log(`🔢 Generated OTP: ${otp}`);
  console.log(`📋 Template ID: ${OTP_TEMPLATE_ID}`);
  console.log(`📤 Sender ID: ${SENDER_ID}\n`);

  try {
    // Build URL with query parameters
    const url = new URL(`${API_BASE_URL}/bulkV2`);
    url.searchParams.append('authorization', FAST2SMS_API_KEY);
    url.searchParams.append('route', 'dlt'); // DLT route for approved templates
    url.searchParams.append('sender_id', SENDER_ID);
    url.searchParams.append('message', OTP_TEMPLATE_ID); // Fast2SMS Template ID
    url.searchParams.append('variables_values', otp); // OTP value for {#var#}
    url.searchParams.append('numbers', TEST_MOBILE);
    url.searchParams.append('flash', '0');

    console.log('📡 Sending OTP via DLT Template...');
    console.log(`🌐 URL: ${url.toString().replace(FAST2SMS_API_KEY, '***')}`);
    console.log(`📤 Parameters:`);
    console.log(`   - route: dlt`);
    console.log(`   - sender_id: ${SENDER_ID}`);
    console.log(`   - message: ${OTP_TEMPLATE_ID} (Template ID)`);
    console.log(`   - variables_values: ${otp} (OTP)`);
    console.log(`   - numbers: ${TEST_MOBILE}`);
    console.log(`   - flash: 0\n`);

    // Make GET request
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'authorization': FAST2SMS_API_KEY,
      },
    });

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
      console.log(`\n✅ SUCCESS! OTP sent via DLT template`);
      console.log(`   Request ID: ${data.request_id}`);
      console.log(`   Mobile: ${TEST_MOBILE}`);
      console.log(`   OTP: ${otp}`);
      console.log(`   Template ID: ${OTP_TEMPLATE_ID}`);
      console.log(`\n📱 Check your mobile ${TEST_MOBILE} for OTP message!`);
    } else {
      console.log(`\n❌ FAILED to send OTP`);
      console.log(`   Return: ${data.return}`);
      console.log(`   Message: ${data.message?.join(', ') || 'Unknown error'}`);
      if (data.status_code) {
        console.log(`   Status Code: ${data.status_code}`);
      }
    }

  } catch (error) {
    console.error(`\n❌ Error:`, error.message);
    console.error(`   Stack:`, error.stack);
  }
}

async function testDTLLogin() {
  console.log('\n\n🧪 Testing Fast2SMS DLT Template Login Credentials...\n');
  
  // Sample login credentials
  const userName = 'John Doe';
  const loginId = 'SIA12345';
  const password = 'Pass@123';
  
  console.log(`📱 Mobile Number: ${TEST_MOBILE}`);
  console.log(`👤 User Name: ${userName}`);
  console.log(`🆔 Login ID: ${loginId}`);
  console.log(`🔑 Password: ${password}`);
  console.log(`📋 Template ID: ${LOGIN_TEMPLATE_ID}`);
  console.log(`📤 Sender ID: ${SENDER_ID}\n`);

  try {
    // Build URL with query parameters
    // Template has 3 variables: Name, Login ID, Password
    // Format: variables_values should be pipe-separated: "Name|LoginID|Password"
    const variables = `${userName}|${loginId}|${password}`;
    
    const url = new URL(`${API_BASE_URL}/bulkV2`);
    url.searchParams.append('authorization', FAST2SMS_API_KEY);
    url.searchParams.append('route', 'dlt'); // DLT route for approved templates
    url.searchParams.append('sender_id', SENDER_ID);
    url.searchParams.append('message', LOGIN_TEMPLATE_ID); // Fast2SMS Template ID
    url.searchParams.append('variables_values', variables); // Pipe-separated values
    url.searchParams.append('numbers', TEST_MOBILE);
    url.searchParams.append('flash', '0');

    console.log('📡 Sending Login Credentials via DLT Template...');
    console.log(`🌐 URL: ${url.toString().replace(FAST2SMS_API_KEY, '***')}`);
    console.log(`📤 Parameters:`);
    console.log(`   - route: dlt`);
    console.log(`   - sender_id: ${SENDER_ID}`);
    console.log(`   - message: ${LOGIN_TEMPLATE_ID} (Template ID)`);
    console.log(`   - variables_values: ${variables} (Name|LoginID|Password)`);
    console.log(`   - numbers: ${TEST_MOBILE}`);
    console.log(`   - flash: 0\n`);

    // Make GET request
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'authorization': FAST2SMS_API_KEY,
      },
    });

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
      console.log(`\n✅ SUCCESS! Login credentials sent via DLT template`);
      console.log(`   Request ID: ${data.request_id}`);
      console.log(`   Mobile: ${TEST_MOBILE}`);
      console.log(`   Template ID: ${LOGIN_TEMPLATE_ID}`);
      console.log(`\n📱 Check your mobile ${TEST_MOBILE} for login credentials message!`);
    } else {
      console.log(`\n❌ FAILED to send login credentials`);
      console.log(`   Return: ${data.return}`);
      console.log(`   Message: ${data.message?.join(', ') || 'Unknown error'}`);
      if (data.status_code) {
        console.log(`   Status Code: ${data.status_code}`);
      }
    }

  } catch (error) {
    console.error(`\n❌ Error:`, error.message);
    console.error(`   Stack:`, error.stack);
  }
}

// Run both tests
async function runAllTests() {
  await testDLTOTP();
  await testDTLLogin();
}

runAllTests().catch(console.error);

