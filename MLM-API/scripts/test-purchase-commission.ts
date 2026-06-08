#!/usr/bin/env tsx
/**
 * Test purchase commission processing for a specific purchase ID
 */

import { CommissionService } from '../src/modules/commissions/commission.service.js';

const purchaseId = BigInt(process.argv[2] || '304'); // Default to ID 304 (Main's purchase)

async function testPurchaseCommission() {
  console.log(`🧪 Testing purchase commission for Purchase ID: ${purchaseId}`);
  
  try {
    const result = await CommissionService.handlePurchase(purchaseId);
    console.log('✅ Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

testPurchaseCommission()
  .then(() => {
    console.log('✅ Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });

