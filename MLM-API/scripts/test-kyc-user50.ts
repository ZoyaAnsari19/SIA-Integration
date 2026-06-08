import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);
const prisma = new PrismaClient();
const API_BASE = process.env.API_BASE_URL || 'http://localhost:3002';

async function main() {
  const userId = BigInt(50);
  
  console.log('=== Testing KYC Submission for User ID 50 ===\n');
  
  // Step 1: Get user details
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });
  
  if (!user) {
    console.error('User not found!');
    await prisma.$disconnect();
    return;
  }
  
  console.log(`User: ${user.name} (${user.email})\n`);
  
  // Step 2: Get balance BEFORE KYC
  const balanceBefore = await prisma.user_balances.findUnique({
    where: { user_id: userId },
  });
  
  console.log('Balance BEFORE KYC:');
  console.log(`  Total: ₹${Number(balanceBefore?.balance || 0).toLocaleString('en-IN')}`);
  console.log(`  Spot: ₹${Number(balanceBefore?.spot_balance || 0).toLocaleString('en-IN')}`);
  console.log(`  Other: ₹${Number(balanceBefore?.other_balance || 0).toLocaleString('en-IN')}\n`);
  
  // Step 3: Login to get JWT token
  console.log('Step 1: Logging in to get JWT token...');
  let token: string;
  try {
    const loginResponse = await axios.post(`${API_BASE}/api/v1/users/login`, {
      email: user.email,
    });
    token = loginResponse.data.token;
    console.log('✓ Login successful, token obtained\n');
  } catch (error: any) {
    console.error('✗ Login failed:', error.response?.data || error.message);
    await prisma.$disconnect();
    return;
  }
  
  // Step 4: Create dummy image file for KYC documents
  const dummyImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const dummyImageBuffer = Buffer.from(dummyImageBase64, 'base64');
  const tempImagePath = path.join(os.tmpdir(), `kyc-test-${Date.now()}.png`);
  fs.writeFileSync(tempImagePath, dummyImageBuffer);
  
  // Step 5: Upload Aadhar front image using curl
  console.log('Step 2: Uploading Aadhar front image...');
  let frontImageUrl: string;
  try {
    const curlCmd = `curl -s -X POST "${API_BASE}/api/v1/user/kyc/document" \\
      -H "Authorization: Bearer ${token}" \\
      -F "file=@${tempImagePath}" \\
      -F "document_type=aadhar" \\
      -F "side=front"`;
    
    const { stdout } = await execAsync(curlCmd);
    const uploadResponse = JSON.parse(stdout);
    frontImageUrl = uploadResponse.image_url;
    
    if (!frontImageUrl) {
      throw new Error('No image_url in response: ' + stdout);
    }
    console.log(`✓ Front image uploaded: ${frontImageUrl}\n`);
  } catch (error: any) {
    console.error('✗ Front image upload failed:', error.message);
    if (fs.existsSync(tempImagePath)) fs.unlinkSync(tempImagePath);
    await prisma.$disconnect();
    return;
  }
  
  // Step 6: Upload Aadhar back image using curl
  console.log('Step 3: Uploading Aadhar back image...');
  let backImageUrl: string;
  try {
    const curlCmd = `curl -s -X POST "${API_BASE}/api/v1/user/kyc/document" \\
      -H "Authorization: Bearer ${token}" \\
      -F "file=@${tempImagePath}" \\
      -F "document_type=aadhar" \\
      -F "side=back"`;
    
    const { stdout } = await execAsync(curlCmd);
    const uploadResponse = JSON.parse(stdout);
    backImageUrl = uploadResponse.image_url;
    
    if (!backImageUrl) {
      throw new Error('No image_url in response: ' + stdout);
    }
    console.log(`✓ Back image uploaded: ${backImageUrl}\n`);
  } catch (error: any) {
    console.error('✗ Back image upload failed:', error.message);
    if (fs.existsSync(tempImagePath)) fs.unlinkSync(tempImagePath);
    await prisma.$disconnect();
    return;
  }
  
  // Cleanup temp file
  if (fs.existsSync(tempImagePath)) fs.unlinkSync(tempImagePath);
  
  // Step 7: Submit KYC
  console.log('Step 4: Submitting KYC...');
  try {
    const kycSubmitResponse = await axios.post(
      `${API_BASE}/api/v1/users/${userId}/kyc/submit`,
      {
        phone: '9876543210',
        date_of_birth: '1990-01-15',
        address: '123 Test Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        pan_number: 'ABCDE1234F',
        aadhar_number: '123456789012',
        bank_account_no: '1234567890',
        bank_ifsc: 'SBIN0001234',
        bank_name: 'State Bank of India',
        documents: [
          {
            document_type: 'aadhar',
            document_number: '123456789012',
            front_image_url: frontImageUrl,
            back_image_url: backImageUrl,
          },
        ],
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('✓ KYC submitted successfully!');
    console.log(`  Response:`, JSON.stringify(kycSubmitResponse.data, null, 2));
  } catch (error: any) {
    console.error('✗ KYC submission failed:');
    console.error('  Status:', error.response?.status);
    console.error('  Error:', error.response?.data || error.message);
    if (error.response?.data?.details) {
      console.error('  Details:', JSON.stringify(error.response.data.details, null, 2));
    }
    await prisma.$disconnect();
    return;
  }
  
  // Step 8: Wait a bit for transaction to complete
  console.log('\nWaiting 2 seconds for transaction to complete...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Step 9: Get balance AFTER KYC
  const balanceAfter = await prisma.user_balances.findUnique({
    where: { user_id: userId },
  });
  
  console.log('\nBalance AFTER KYC:');
  console.log(`  Total: ₹${Number(balanceAfter?.balance || 0).toLocaleString('en-IN')}`);
  console.log(`  Spot: ₹${Number(balanceAfter?.spot_balance || 0).toLocaleString('en-IN')}`);
  console.log(`  Other: ₹${Number(balanceAfter?.other_balance || 0).toLocaleString('en-IN')}`);
  
  // Step 10: Calculate deduction
  const totalDeducted = Number(balanceBefore?.balance || 0) - Number(balanceAfter?.balance || 0);
  const spotDeducted = Number(balanceBefore?.spot_balance || 0) - Number(balanceAfter?.spot_balance || 0);
  const otherDeducted = Number(balanceBefore?.other_balance || 0) - Number(balanceAfter?.other_balance || 0);
  
  console.log('\n=== Deduction Summary ===');
  console.log(`Total Deducted: ₹${totalDeducted.toLocaleString('en-IN')}`);
  console.log(`Spot Deducted: ₹${spotDeducted.toLocaleString('en-IN')}`);
  console.log(`Other Deducted: ₹${otherDeducted.toLocaleString('en-IN')}`);
  
  // Step 11: Check ledger entry
  console.log('\n=== Recent Fee Deduction Ledger Entry ===');
  const feeLedger = await prisma.ledger_entries.findFirst({
    where: {
      receiver_user_id: userId,
      commission_type: 'FEE_DEDUCTION',
    },
    orderBy: { credited_at: 'desc' },
    select: {
      id: true,
      amount: true,
      metadata: true,
      credited_at: true,
    },
  });
  
  if (feeLedger) {
    console.log(`Ledger ID: ${feeLedger.id}`);
    console.log(`Amount: ₹${Number(feeLedger.amount).toLocaleString('en-IN')}`);
    console.log(`Wallet Type: ${(feeLedger.metadata as any)?.wallet_type || 'N/A'}`);
    console.log(`Spot Deducted: ₹${Number((feeLedger.metadata as any)?.spot_deducted || 0).toLocaleString('en-IN')}`);
    console.log(`Other Deducted: ₹${Number((feeLedger.metadata as any)?.other_deducted || 0).toLocaleString('en-IN')}`);
    console.log(`Rule Code: ${(feeLedger.metadata as any)?.rule_code || 'N/A'}`);
    console.log(`Date: ${feeLedger.credited_at}`);
  } else {
    console.log('No fee deduction ledger entry found!');
  }
  
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

