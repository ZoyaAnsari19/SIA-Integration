import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const userId = BigInt(14);

  console.log('\n=== User Balance ===\n');
  const balance = await prisma.user_balances.findUnique({
    where: { user_id: userId },
  });
  if (balance) {
    console.log(`User ID: ${balance.user_id}`);
    console.log(`Total Balance: ${balance.balance}`);
    console.log(`Spot Balance: ${balance.spot_balance}`);
    console.log(`Other Balance: ${balance.other_balance}`);
    console.log(`Updated At: ${balance.updated_at}`);
  } else {
    console.log('No balance record found');
  }

  console.log('\n=== Recent KYC Fee Deductions (Ledger Entries) ===\n');
  const ledgerEntries = await prisma.ledger_entries.findMany({
    where: {
      receiver_user_id: userId,
      commission_type: 'FEE_DEDUCTION',
    },
    orderBy: { credited_at: 'desc' },
    take: 5,
  });

  for (const entry of ledgerEntries) {
    const metadata = entry.metadata as any;
    console.log(`Ledger Entry ID: ${entry.id}`);
    console.log(`Amount: ${entry.amount}`);
    console.log(`Rule Code: ${metadata?.rule_code || 'N/A'}`);
    console.log(`Wallet Type: ${metadata?.wallet_type || 'N/A'}`);
    console.log(`Spot Deducted: ${metadata?.spot_deducted || 0}`);
    console.log(`Other Deducted: ${metadata?.other_deducted || 0}`);
    console.log(`Credited At: ${entry.credited_at}`);
    console.log('---');
  }

  console.log('\n=== Recent KYC Fee Transactions ===\n');
  const feeTransactions = await prisma.fee_transactions.findMany({
    where: {
      user_id: userId,
      rule_code: 'KYC_SUBMISSION',
    },
    orderBy: { created_at: 'desc' },
    take: 3,
  });

  for (const tx of feeTransactions) {
    console.log(`Fee Transaction ID: ${tx.id}`);
    console.log(`Amount: ${tx.amount}`);
    console.log(`Rule Code: ${tx.rule_code}`);
    console.log(`Created At: ${tx.created_at}`);
    console.log('---');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

