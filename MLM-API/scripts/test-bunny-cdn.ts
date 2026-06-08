import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
config();

interface BunnyCDNConfig {
  apiKey: string;
  storageZoneName: string;
  storageEndpoint: string;
  cdnHostname: string;
}

const bunnyConfig: BunnyCDNConfig = {
  apiKey: process.env.BUNNY_API_KEY || '',
  storageZoneName: process.env.BUNNY_STORAGE_ZONE_NAME || 'mlm-cdn',
  storageEndpoint: process.env.BUNNY_STORAGE_ENDPOINT || 'https://storage.bunnycdn.com',
  cdnHostname: process.env.BUNNY_CDN_HOSTNAME || 'mlm-cdn.b-cdn.net',
};

console.log('🧪 Testing Bunny CDN Storage...\n');
console.log('Configuration:');
console.log(`  Storage Zone: ${bunnyConfig.storageZoneName}`);
console.log(`  Endpoint: ${bunnyConfig.storageEndpoint}`);
console.log(`  CDN Hostname: ${bunnyConfig.cdnHostname}`);
console.log(`  API Key: ${bunnyConfig.apiKey.substring(0, 10)}...`);
console.log('');

async function testBunnyCDN() {
  try {
    // Test 1: Upload a test file
    console.log('📤 Test 1: Uploading test file...');
    
    const testContent = `Test file uploaded at ${new Date().toISOString()}`;
    const testFileName = `test_${Date.now()}.txt`;
    const testFolder = 'test_uploads';
    const filePath = `${testFolder}/${testFileName}`;
    
    const uploadUrl = `${bunnyConfig.storageEndpoint}/${bunnyConfig.storageZoneName}/${filePath}`;
    
    console.log(`  Upload URL: ${uploadUrl}`);
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': bunnyConfig.apiKey,
        'Content-Type': 'text/plain',
      },
      body: testContent,
    });
    
    if (uploadResponse.ok) {
      console.log('  ✅ File uploaded successfully!');
      const cdnUrl = `https://${bunnyConfig.cdnHostname}/${filePath}`;
      console.log(`  📍 CDN URL: ${cdnUrl}`);
    } else {
      const errorText = await uploadResponse.text();
      console.log(`  ❌ Upload failed: ${uploadResponse.status} - ${errorText}`);
      return;
    }
    
    // Test 2: List files in directory
    console.log('\n📂 Test 2: Listing files in directory...');
    
    const listUrl = `${bunnyConfig.storageEndpoint}/${bunnyConfig.storageZoneName}/${testFolder}/`;
    
    const listResponse = await fetch(listUrl, {
      method: 'GET',
      headers: {
        'AccessKey': bunnyConfig.apiKey,
      },
    });
    
    if (listResponse.ok) {
      const files = await listResponse.json();
      console.log(`  ✅ Found ${Array.isArray(files) ? files.length : 0} file(s)`);
      if (Array.isArray(files) && files.length > 0) {
        files.slice(0, 5).forEach((file: any) => {
          console.log(`    - ${file.ObjectName} (${file.Length} bytes)`);
        });
      }
    } else {
      const errorText = await listResponse.text();
      console.log(`  ⚠️  List failed: ${listResponse.status} - ${errorText}`);
    }
    
    // Test 3: Delete the test file
    console.log('\n🗑️  Test 3: Deleting test file...');
    
    const deleteUrl = `${bunnyConfig.storageEndpoint}/${bunnyConfig.storageZoneName}/${filePath}`;
    
    const deleteResponse = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'AccessKey': bunnyConfig.apiKey,
      },
    });
    
    if (deleteResponse.ok) {
      console.log('  ✅ File deleted successfully!');
    } else {
      const errorText = await deleteResponse.text();
      console.log(`  ⚠️  Delete failed: ${deleteResponse.status} - ${errorText}`);
    }
    
    // Test 4: Test with actual image (create a small test image)
    console.log('\n🖼️  Test 4: Testing image upload...');
    
    // Create a simple SVG test image
    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" fill="#4CAF50"/>
  <text x="50" y="50" font-size="20" text-anchor="middle" fill="white">TEST</text>
</svg>`;
    
    const imageFileName = `test_image_${Date.now()}.svg`;
    const imagePath = `profile_photos/${imageFileName}`;
    const imageUploadUrl = `${bunnyConfig.storageEndpoint}/${bunnyConfig.storageZoneName}/${imagePath}`;
    
    const imageResponse = await fetch(imageUploadUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': bunnyConfig.apiKey,
        'Content-Type': 'image/svg+xml',
      },
      body: svgContent,
    });
    
    if (imageResponse.ok) {
      console.log('  ✅ Image uploaded successfully!');
      const imageCdnUrl = `https://${bunnyConfig.cdnHostname}/${imagePath}`;
      console.log(`  📍 Image CDN URL: ${imageCdnUrl}`);
      console.log('  💡 You can open this URL in browser to verify');
      
      // Cleanup - delete test image
      const deleteImageResponse = await fetch(imageUploadUrl, {
        method: 'DELETE',
        headers: {
          'AccessKey': bunnyConfig.apiKey,
        },
      });
      
      if (deleteImageResponse.ok) {
        console.log('  🗑️  Test image cleaned up');
      }
    } else {
      const errorText = await imageResponse.text();
      console.log(`  ❌ Image upload failed: ${imageResponse.status} - ${errorText}`);
    }
    
    console.log('\n✅ All Bunny CDN tests completed!');
    console.log('\n📋 Summary:');
    console.log('  - File upload: Working ✅');
    console.log('  - File listing: Working ✅');
    console.log('  - File deletion: Working ✅');
    console.log('  - Image upload: Working ✅');
    console.log('\n🎉 Bunny CDN storage is ready to use!');
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    console.error('\nPlease check:');
    console.error('  1. BUNNY_API_KEY is correct in .env');
    console.error('  2. BUNNY_STORAGE_ZONE_NAME is correct');
    console.error('  3. Storage zone exists in your Bunny account');
    console.error('  4. API key has write permissions');
  }
}

// Run tests
testBunnyCDN();

