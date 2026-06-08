import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function seedFromSQL(filePath: string, description: string) {
  console.log(`\n📦 ${description}...`);
  try {
    const sql = readFileSync(filePath, 'utf-8');
    // Split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.toLowerCase().startsWith('select'));
    
    for (const statement of statements) {
      if (statement.length > 10) { // Skip very short statements
        try {
          await prisma.$executeRawUnsafe(statement);
        } catch (e: any) {
          // Ignore errors like "already exists" or "relation does not exist" for TRUNCATE
          if (!e.message?.includes('does not exist') && !e.message?.includes('already exists')) {
            console.warn(`  ⚠️  Warning: ${e.message?.substring(0, 100)}`);
          }
        }
      }
    }
    console.log(`  ✅ ${description} completed`);
  } catch (error: any) {
    console.error(`  ❌ Error seeding ${description}:`, error.message);
  }
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌱 Seeding Local Database');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const seedDir = join(__dirname, '../../azure-kube/seed');

  // Seed in order
  await seedFromSQL(join(seedDir, 'packages-seed.sql'), 'Packages');
  await seedFromSQL(join(seedDir, 'level-seed.sql'), 'Levels');
  await seedFromSQL(join(seedDir, 'fee-rule-seed.sql'), 'Fee Rules');
  await seedFromSQL(join(seedDir, 'user-seed.sql'), 'Users');
  await seedFromSQL(join(seedDir, 'course-seed.sql'), 'Courses');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ All seeding completed!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

