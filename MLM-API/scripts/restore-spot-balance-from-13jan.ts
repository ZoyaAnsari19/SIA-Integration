/**
 * Restore Spot Wallet Balance from 13 Jan 2026 Backup
 * 
 * Logic:
 * 1. Read 13 Jan 2026 backup file
 * 2. Extract spot_balance for each user
 * 3. Update local DB user_balances.spot_balance to match 13 Jan values
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://mlm_user:mlm_password_2024@localhost:5436/mlm_commission?schema=public'
    }
  }
});

const BACKUP_FILE = path.join(process.cwd(), '../production-db-backup/prod-backup-to-local-20260113_160030.sql');

interface UserBalance {
  user_id: bigint;
  balance: number;
  spot_balance: number;
  other_balance: number;
}

async function extractBalancesFromBackup(): Promise<Map<bigint, UserBalance>> {
  console.log('📖 Reading 13 Jan 2026 backup file...');
  const fileContent = fs.readFileSync(BACKUP_FILE, 'utf-8');
  
  // Find the COPY public.user_balances section
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
  
  const balancesMap = new Map<bigint, UserBalance>();
  
  // Skip the COPY header line, process data lines
  for (const line of lines) {
    if (!line.trim() || line.startsWith('COPY') || line.startsWith('\\')) continue;
    
    // Format: user_id | balance | spot_balance | other_balance | updated_at
    const parts = line.split('\t');
    if (parts.length >= 4) {
      const user_id = BigInt(parts[0]);
      const balance = parseFloat(parts[1]) || 0;
      const spot_balance = parseFloat(parts[2]) || 0;
      const other_balance = parseFloat(parts[3]) || 0;
      
      balancesMap.set(user_id, {
        user_id,
        balance,
        spot_balance,
        other_balance
      });
    }
  }
  
  console.log(`✅ Extracted ${balancesMap.size} user balances from backup`);
  return balancesMap;
}

async function main() {
  console.log('='.repeat(80));
  console.log('🔧 Restore Spot Wallet Balance from 13 Jan 2026');
  console.log('='.repeat(80));
  console.log();

  try {
    // Extract balances from backup
    const balances13Jan = await extractBalancesFromBackup();
    
    console.log(`📊 Found ${balances13Jan.size} users in 13 Jan backup`);
    console.log();

    // Get current balances from local DB
    console.log('📊 Fetching current balances from local DB...');
    const currentBalances = await prisma.user_balances.findMany({
      select: {
        user_id: true,
        balance: true,
        spot_balance: true,
        other_balance: true
      }
    });
    
    console.log(`✅ Found ${currentBalances.length} users in local DB`);
    console.log();

    // Find users that need updating
    const updates: Array<{
      user_id: bigint;
      old_spot: number;
      new_spot: number;
      old_total: number;
      new_total: number;
    }> = [];

    for (const current of currentBalances) {
      const backup13Jan = balances13Jan.get(current.user_id);
      if (!backup13Jan) continue; // User not in backup, skip
      
      const currentSpot = Number(current.spot_balance);
      const backupSpot = backup13Jan.spot_balance;
      
      if (Math.abs(currentSpot - backupSpot) > 0.01) { // Only update if difference > 1 paisa
        const currentOther = Number(current.other_balance);
        const currentTotal = Number(current.balance);
        const newTotal = currentOther + backupSpot;
        
        updates.push({
          user_id: current.user_id,
          old_spot: currentSpot,
          new_spot: backupSpot,
          old_total: currentTotal,
          new_total: newTotal
        });
      }
    }

    console.log(`📊 Found ${updates.length} users that need updating`);
    console.log();

    if (updates.length === 0) {
      console.log('✅ All spot wallet balances already match 13 Jan 2026 values!');
      return;
    }

    // Show top 30 updates
    updates.sort((a, b) => Math.abs(b.new_spot - b.old_spot) - Math.abs(a.new_spot - a.old_spot));
    console.log('Top 30 Updates:');
    console.log('-'.repeat(100));
    console.log('User ID | Old Spot | New Spot (13 Jan) | Difference');
    console.log('-'.repeat(100));
    
    for (const update of updates.slice(0, 30)) {
      const diff = update.new_spot - update.old_spot;
      console.log(
        `${update.user_id.toString().padEnd(8)} | ` +
        `₹${update.old_spot.toFixed(2).padStart(10)} | ` +
        `₹${update.new_spot.toFixed(2).padStart(15)} | ` +
        `₹${diff.toFixed(2).padStart(10)}`
      );
    }

    console.log();
    const totalDiff = updates.reduce((sum, u) => sum + Math.abs(u.new_spot - u.old_spot), 0);
    console.log(`📊 Total absolute difference: ₹${totalDiff.toFixed(2)}`);
    console.log();

    // Ask for confirmation
    console.log('⚠️  About to restore spot_balance for all users to 13 Jan 2026 values...');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Update balances
    let updated = 0;
    
    for (const update of updates) {
      const backup13Jan = balances13Jan.get(update.user_id);
      if (!backup13Jan) continue;

      const currentOther = await prisma.user_balances.findUnique({
        where: { user_id: update.user_id },
        select: { other_balance: true }
      });

      const currentOtherBalance = Number(currentOther?.other_balance || 0);
      const newTotal = currentOtherBalance + backup13Jan.spot_balance;

      await prisma.user_balances.update({
        where: { user_id: update.user_id },
        data: {
          spot_balance: backup13Jan.spot_balance,
          balance: newTotal,
          updated_at: new Date()
        }
      });
      
      updated++;
      
      if (updated % 50 === 0) {
        console.log(`   Updated ${updated}/${updates.length}...`);
      }
    }

    console.log(`\n✅ Updated ${updated} users`);
    console.log();

    // Final summary
    console.log('📊 Final Summary:');
    console.log(`   Users in backup: ${balances13Jan.size}`);
    console.log(`   Users in local DB: ${currentBalances.length}`);
    console.log(`   Users updated: ${updated}`);
    console.log(`   Total absolute difference restored: ₹${totalDiff.toFixed(2)}`);
    console.log();

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
