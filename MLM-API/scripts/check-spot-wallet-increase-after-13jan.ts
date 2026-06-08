/**
 * Check Spot Wallet Amount Increase After 13 Jan 2026
 * 
 * Logic:
 * 1. Get spot wallet balance from 13 Jan 2026 backup
 * 2. Get current spot wallet balance from local DB
 * 3. Compare and list users where current > 13 Jan balance
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://mlm_user:mlm_password_2024@localhost:5442/mlm_commission?schema=public'
    }
  }
});

const BACKUP_FILE = path.join(process.cwd(), '../production-db-backup/prod-backup-to-local-20260113_160030.sql');

interface UserBalance {
  user_id: bigint;
  spot_balance: number;
}

async function extractSpotBalancesFromBackup(): Promise<Map<bigint, number>> {
  console.log('📖 Reading 13 Jan 2026 backup file...');
  const fileContent = fs.readFileSync(BACKUP_FILE, 'utf-8');
  
  const copyStart = fileContent.indexOf('COPY public.user_balances');
  if (copyStart === -1) {
    throw new Error('Could not find user_balances section in backup file');
  }
  
  const copyEnd = fileContent.indexOf('\\.', copyStart);
  if (copyEnd === -1) {
    throw new Error('Could not find end of user_balances section');
  }
  
  const balancesSection = fileContent.substring(copyStart, copyEnd);
  const lines = balancesSection.split('\n');
  
  const balancesMap = new Map<bigint, number>();
  
  for (const line of lines) {
    if (!line.trim() || line.startsWith('COPY') || line.startsWith('\\')) continue;
    
    // Format: user_id | balance | spot_balance | other_balance | updated_at
    const parts = line.split('\t');
    if (parts.length >= 3) {
      const user_id = BigInt(parts[0]);
      const spot_balance = parseFloat(parts[2]) || 0;
      balancesMap.set(user_id, spot_balance);
    }
  }
  
  console.log(`✅ Extracted ${balancesMap.size} spot balances from backup`);
  return balancesMap;
}

async function main() {
  console.log('='.repeat(80));
  console.log('📊 Check Spot Wallet Amount Increase After 13 Jan 2026');
  console.log('='.repeat(80));
  console.log();

  try {
    // Extract 13 Jan balances from backup
    const balances13Jan = await extractSpotBalancesFromBackup();
    
    // Get current balances from local DB
    console.log('📊 Fetching current balances from local DB...');
    const currentBalances = await prisma.user_balances.findMany({
      select: {
        user_id: true,
        spot_balance: true
      }
    });
    
    console.log(`✅ Found ${currentBalances.length} users in local DB`);
    console.log();

    // Find users with increased spot wallet
    const increases: Array<{
      user_id: bigint;
      display_id: string;
      name: string;
      spot_13jan: number;
      spot_current: number;
      increase: number;
    }> = [];

    for (const current of currentBalances) {
      const spot13Jan = balances13Jan.get(current.user_id) || 0;
      const spotCurrent = Number(current.spot_balance);
      const increase = spotCurrent - spot13Jan;
      
      if (increase > 0.01) { // Only include if increase > 1 paisa
        // Get user details
        const user = await prisma.users.findUnique({
          where: { id: current.user_id },
          select: { display_id: true, name: true }
        });

        increases.push({
          user_id: current.user_id,
          display_id: user?.display_id || '',
          name: user?.name || '',
          spot_13jan: spot13Jan,
          spot_current: spotCurrent,
          increase: increase
        });
      }
    }

    console.log(`📊 Found ${increases.length} users with increased spot wallet`);
    console.log();

    if (increases.length === 0) {
      console.log('✅ No users with increased spot wallet found!');
      return;
    }

    // Sort by increase amount (descending)
    increases.sort((a, b) => b.increase - a.increase);

    // Display all increases
    console.log('='.repeat(120));
    console.log('📈 Users with Increased Spot Wallet After 13 Jan 2026');
    console.log('='.repeat(120));
    console.log();
    console.log('Display ID | Name | 13 Jan Spot | Current Spot | Increase');
    console.log('-'.repeat(120));
    
    for (const inc of increases) {
      console.log(
        `${(inc.display_id || inc.user_id.toString()).padEnd(10)} | ` +
        `${(inc.name || '').substring(0, 25).padEnd(25)} | ` +
        `₹${inc.spot_13jan.toFixed(2).padStart(12)} | ` +
        `₹${inc.spot_current.toFixed(2).padStart(13)} | ` +
        `₹${inc.increase.toFixed(2).padStart(10)}`
      );
    }

    console.log();
    console.log('='.repeat(120));
    console.log('📊 Summary:');
    console.log(`   Total users checked: ${currentBalances.length}`);
    console.log(`   Users with increase: ${increases.length}`);
    console.log(`   Total increase: ₹${increases.reduce((sum, i) => sum + i.increase, 0).toFixed(2)}`);
    console.log(`   Average increase: ₹${(increases.reduce((sum, i) => sum + i.increase, 0) / increases.length).toFixed(2)}`);
    console.log(`   Maximum increase: ₹${increases[0]?.increase.toFixed(2) || '0.00'} (User: ${increases[0]?.display_id || increases[0]?.user_id || 'N/A'})`);
    console.log();

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
