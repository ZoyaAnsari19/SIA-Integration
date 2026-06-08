import 'dotenv/config';
import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  try {
    const seedDir = join(process.cwd(), '../azure-kube/seed');
    
    console.log('🌱 Seeding Database...\n');
    
    // 1. Packages
    console.log('1️⃣  Seeding Packages...');
    const packagesSql = readFileSync(join(seedDir, 'packages-seed.sql'), 'utf-8');
    await client.query(packagesSql);
    console.log('✅ Packages seeded\n');
    
    // 2. Levels
    console.log('2️⃣  Seeding Levels...');
    const levelsSql = readFileSync(join(seedDir, 'level-seed.sql'), 'utf-8');
    await client.query(levelsSql);
    console.log('✅ Levels seeded\n');
    
    // 3. Fee Rules
    console.log('3️⃣  Seeding Fee Rules...');
    const feeRulesSql = readFileSync(join(seedDir, 'fee-rule-seed.sql'), 'utf-8');
    await client.query(feeRulesSql);
    console.log('✅ Fee Rules seeded\n');
    
    // 4. Users
    console.log('4️⃣  Seeding Users (with KYC, Purchase, Ledger)...');
    const usersSql = readFileSync(join(seedDir, 'user-seed.sql'), 'utf-8');
    await client.query(usersSql);
    console.log('✅ Users seeded\n');
    
    // 5. Courses
    console.log('5️⃣  Seeding Courses...');
    const coursesSql = readFileSync(join(seedDir, 'course-seed.sql'), 'utf-8');
    await client.query(coursesSql);
    console.log('✅ Courses seeded\n');
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All seeding completed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

