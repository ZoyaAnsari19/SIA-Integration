/**
 * Test Fast2SMS Wallet API
 * Run with: npx tsx scripts/test-fast2sms-wallet.ts
 */

const FAST2SMS_API_KEY = 'pqCvWrXHwkOFMl0Cm4GKvre7nDU8GESLNkwvsgZqkxGame2tWtmXQNkZb1To';
const API_BASE_URL = 'https://www.fast2sms.com/dev';

async function testFast2SMSWallet() {
  console.log('🧪 Testing Fast2SMS Wallet API...\n');
  console.log(`API Key: ${FAST2SMS_API_KEY.substring(0, 20)}...`);
  console.log(`Endpoint: ${API_BASE_URL}/wallet\n`);

  try {
    // Test 1: GET request with authorization header
    console.log('📡 Test 1: GET /wallet with authorization header');
    const response1 = await fetch(`${API_BASE_URL}/wallet`, {
      method: 'GET',
      headers: {
        'authorization': FAST2SMS_API_KEY,
      },
    });

    console.log(`Status: ${response1.status} ${response1.statusText}`);
    const text1 = await response1.text();
    console.log(`Response: ${text1}\n`);

    try {
      const json1 = JSON.parse(text1);
      console.log('Parsed JSON:', JSON.stringify(json1, null, 2));
    } catch (e) {
      console.log('Response is not valid JSON');
    }

    // Test 2: Try with different endpoint variations
    console.log('\n📡 Test 2: GET /wallet with Content-Type header');
    const response2 = await fetch(`${API_BASE_URL}/wallet`, {
      method: 'GET',
      headers: {
        'authorization': FAST2SMS_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    console.log(`Status: ${response2.status} ${response2.statusText}`);
    const text2 = await response2.text();
    console.log(`Response: ${text2}\n`);

    // Test 3: Try POST method (some APIs use POST)
    console.log('\n📡 Test 3: POST /wallet');
    const response3 = await fetch(`${API_BASE_URL}/wallet`, {
      method: 'POST',
      headers: {
        'authorization': FAST2SMS_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    console.log(`Status: ${response3.status} ${response3.statusText}`);
    const text3 = await response3.text();
    console.log(`Response: ${text3}\n`);

    // Test 4: Try with query parameter
    console.log('\n📡 Test 4: GET /wallet?authorization=...');
    const response4 = await fetch(`${API_BASE_URL}/wallet?authorization=${FAST2SMS_API_KEY}`, {
      method: 'GET',
    });

    console.log(`Status: ${response4.status} ${response4.statusText}`);
    const text4 = await response4.text();
    console.log(`Response: ${text4}\n`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testFast2SMSWallet();

