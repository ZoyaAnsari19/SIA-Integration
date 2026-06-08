import { boss } from '../config/pgboss.js';
import { prisma } from '../config/prisma';

export async function registerReconcileLedger() {
  await boss.work('reconcile-ledger', async () => {
    const ledger = await prisma.ledger_entries.aggregate({ _sum: { amount: true } });
    const wallet = await prisma.user_balances.aggregate({ _sum: { balance: true } });
    const ledgerTotal = Number(ledger._sum.amount ?? 0);
    const walletTotal = Number(wallet._sum.balance ?? 0);
    const diff = ledgerTotal - walletTotal;
    // eslint-disable-next-line no-console
    console.log('[reconcile-ledger]', { ledgerTotal, walletTotal, diff });
    return { ok: true, ledgerTotal, walletTotal, diff };
  });
}


