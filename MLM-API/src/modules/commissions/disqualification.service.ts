import { prisma } from '../../config/prisma.js';
import { CommissionService } from './commission.service.js';

export class DisqualificationService {
  /**
   * Check if a user is disqualified
   */
  static async isUserDisqualified(userId: bigint): Promise<boolean> {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { is_disqualified: true },
    });
    return user?.is_disqualified ?? false;
  }

  /**
   * Check if a user is in a disqualified user's new chain
   * (user was added by a disqualified user after their disqualification date)
   */
  static async isUserInDisqualifiedChain(userId: bigint, disqualifiedUserId: bigint): Promise<boolean> {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { referrer_user_id: true, created_at: true },
    });

    if (!user?.referrer_user_id) return false;

    // Check if user's referrer is the disqualified user
    if (user.referrer_user_id.toString() !== disqualifiedUserId.toString()) return false;

    // Get disqualified user's disqualification date
    const disqualifiedUser = await prisma.users.findUnique({
      where: { id: disqualifiedUserId },
      select: { disqualified_at: true },
    });

    if (!disqualifiedUser?.disqualified_at) return false;

    // Check if user was added after disqualification
    return user.created_at > disqualifiedUser.disqualified_at;
  }

  /**
   * Find users who have been inactive for more than 21 days and disqualify them
   */
  static async checkAndDisqualifyUsers(): Promise<{ disqualified: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twentyOneDaysAgo = new Date(today);
    twentyOneDaysAgo.setDate(twentyOneDaysAgo.getDate() - 21);

    console.log(`🔍 Checking for users inactive for more than 21 days (before ${twentyOneDaysAgo.toISOString().split('T')[0]})...`);

    // Find users with no active course and last purchase date > 21 days ago
    // User must have at least one purchase (completed) to be considered for disqualification
    // NOTE: active_until is NOT used - expiry is ONLY based on 2x income, not date
    const usersToDisqualify = await prisma.$queryRaw<Array<{ id: bigint }>>`
      SELECT DISTINCT u.id
      FROM users u
      WHERE EXISTS (
        -- User must have at least one completed purchase
        SELECT 1 FROM purchases p
        WHERE p.user_id = u.id AND p.status = 'completed'
      )
      AND NOT EXISTS (
        -- User has NO active course (no purchase that hasn't reached 2x)
        -- NOTE: active_until check removed - expiry is ONLY based on 2x income
        SELECT 1 FROM purchases p
        WHERE p.user_id = u.id
          AND p.status = 'completed'
          AND NOT EXISTS (
            -- Check if purchase reached 2x
            SELECT 1 FROM ledger_entries le
            WHERE le.purchase_id = p.id
              AND le.receiver_user_id = p.user_id
              AND le.commission_type IN ('SELF', 'GLOBAL_HELPING')
            GROUP BY le.purchase_id
            HAVING SUM(le.amount) >= p.amount * 2
          )
      )
      AND (
        -- Last purchase date (max purchased_at) is more than 21 days ago
        -- NOTE: Using purchased_at instead of active_until (active_until deprecated for logic)
        SELECT MAX(purchased_at) FROM purchases
        WHERE user_id = u.id AND status = 'completed'
      ) < ${twentyOneDaysAgo}
      AND (u.is_disqualified IS NULL OR u.is_disqualified = false)
    `;

    console.log(`📋 Found ${usersToDisqualify.length} users to disqualify`);

    let disqualifiedCount = 0;
    for (const user of usersToDisqualify) {
      try {
        await DisqualificationService.disqualifyUser(user.id as unknown as bigint);
        disqualifiedCount++;
      } catch (error) {
        console.error(`❌ Error disqualifying user ${user.id}:`, error);
      }
    }

    console.log(`✅ Disqualified ${disqualifiedCount} users`);
    return { disqualified: disqualifiedCount };
  }

  /**
   * Disqualify a single user
   */
  static async disqualifyUser(userId: bigint): Promise<void> {
    console.log(`🚫 Disqualifying user ${userId}...`);

    await prisma.$transaction(async (tx) => {
      // 1. Reset level eligibility (all levels to false)
      await tx.level_eligibility.upsert({
        where: { user_id: userId },
        update: {
          eligibility: {} as any, // Empty object = all levels false
          updated_at: new Date(),
        },
        create: {
          user_id: userId,
          eligibility: {} as any,
        },
      });

      // 2. Delete pending SPOT commissions where user is receiver
      const pendingDeleted = await tx.pending_commissions.deleteMany({
        where: { receiver_user_id: userId },
      });
      console.log(`   🗑️  Deleted ${pendingDeleted.count} pending commissions`);

      // NOTE: scheduled_commissions table has been removed (Dec 20, 2025)
      // All commissions (SELF, GLOBAL_HELPING, MONTHLY) are now processed dynamically

      // 4. Set disqualification flags
      await tx.users.update({
        where: { id: userId },
        data: {
          is_disqualified: true,
          disqualified_at: new Date(),
          updated_at: new Date(),
        },
      });

      console.log(`   ✅ User ${userId} disqualified successfully`);
    });
  }
}

