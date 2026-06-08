import { FastifyInstance } from 'fastify';
import { prisma } from '../config/prisma.js';
import { adminAuth } from '../middleware/adminAuth.js';

export async function adminDashboardRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/admin/dashboard:
   *   get:
   *     tags:
   *       - Admin Dashboard
   *     summary: Get admin dashboard statistics
   *     description: |
     *       Retrieve comprehensive dashboard statistics including:
     *       - Total system wallet amount (sum of all user balances)
     *       - SMS wallet balance and remaining SMS count (from Fast2SMS)
     *       - Total number of users in the system
     *       - Pending activation requests count
   *     operationId: getAdminDashboard
   *     security:
   *       - adminAuth: []
   *     responses:
   *       '200':
   *         description: Dashboard statistics retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 total_system_amount:
   *                   type: number
   *                   description: Total wallet balance across all users
   *                   example: 1500000.00
   *                 sms_wallet_balance:
   *                   type: number
   *                   description: SMS wallet balance from Fast2SMS
   *                   example: 500.50
   *                 sms_left:
   *                   type: number
   *                   description: Remaining SMS count from Fast2SMS
   *                   example: 2500
   *                 total_users:
   *                   type: number
   *                   description: Total number of users in the system
   *                   example: 150
   *                 activation_pending_count:
   *                   type: number
   *                   description: Number of all pending purchase requests (activation + renew + reinvestment), matches Activation Requests page
   *                   example: 25
   *                 package_activated:
   *                   type: number
   *                   description: Number of activated packages (completed purchases)
   *                   example: 150
   *                 total_deposit_from_all_users:
   *                   type: number
   *                   description: Total deposit from all users (sum of all purchases - active + inactive)
   *                   example: 500000.00
   *                 monthly_business:
   *                   type: number
   *                   description: Total business for current month (sum of purchases created in current month)
   *                   example: 50000.00
   *                 total_self_income_given:
   *                   type: number
   *                   description: Total self income given to all users (from ledger_entries with SELF commission_type)
   *                   example: 100000.00
   *                 total_royalty_given:
   *                   type: number
   *                   description: Total royalty given to all users (from ledger_entries with MONTHLY commission_type)
   *                   example: 50000.00
   *                 total_spot:
   *                   type: number
   *                   description: Total spot given to all users (from ledger_entries with SPOT commission_type)
   *                   example: 25000.00
   *                 total_withdrawal:
   *                   type: number
   *                   description: Total withdrawal amount (sum of approved + processing withdrawals)
   *                   example: 50000.00
   *                 pending_withdrawal_amount:
   *                   type: number
   *                   description: Total pending withdrawal amount (sum of withdrawals with pending status)
   *                   example: 15000.00
   *                 total_main_wallet:
   *                   type: number
   *                   description: Total main wallet balance across all users (sum of other_balance)
   *                   example: 200000.00
   *                 total_spot_wallet:
   *                   type: number
   *                   description: Total spot wallet balance across all users (sum of spot_balance)
   *                   example: 50000.00
   *                 pending_kyc_count:
   *                   type: number
   *                   description: Count of users with pending or submitted KYC status
   *                   example: 25
   *                 kyc_approved_today:
   *                   type: number
   *                   description: Count of users whose KYC was approved today
   *                   example: 5
   *       '401':
   *         description: Unauthorized - Invalid or missing admin token
   *       '500':
   *         description: Internal server error
   */
  app.get('/dashboard', {
    preHandler: adminAuth,
    schema: {
      description: 'Get admin dashboard statistics',
      tags: ['Admin Dashboard'],
      summary: 'Get Admin Dashboard',
      querystring: {
        type: 'object',
        properties: {
          start_date: { type: 'string', format: 'date' },
          end_date: { type: 'string', format: 'date' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            total_system_amount: { type: 'number' },
            sms_wallet_balance: { type: 'number' },
            sms_left: { type: 'number' },
            total_users: { type: 'number' },
            activation_pending_count: { type: 'number' },
            package_activated: { type: 'number' },
            total_deposit_from_all_users: { type: 'number' },
            monthly_business: { type: 'number' },
            monthly_new_purchase_manual: { type: 'number' },
            monthly_upgrade: { type: 'number' },
            monthly_renewal: { type: 'number' },
            monthly_reinvestment: { type: 'number' },
            total_self_income_given: { type: 'number' },
            total_royalty_given: { type: 'number' },
            total_spot: { type: 'number' },
            total_withdrawal: { type: 'number' },
            pending_withdrawal_amount: { type: 'number' },
            total_main_wallet: { type: 'number' },
            total_spot_wallet: { type: 'number' },
            pending_kyc_count: { type: 'number' },
            kyc_approved_today: { type: 'number' },
            users_with_active_package: { type: 'number' },
            users_with_no_active_package: { type: 'number' },
          },
        },
      },
      security: [{ adminAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      // 1. Calculate total system wallet amount
      const totalWalletResult = await prisma.user_balances.aggregate({
        _sum: {
          balance: true,
        },
      });
      const totalSystemAmount = Number(totalWalletResult._sum.balance || 0);

      // 2. Fetch SMS data from Fast2SMS API
      let smsWalletBalance = 0;
      let smsLeft = 0;

      try {
        const { Fast2SMSService } = await import('../modules/sms/fast2smsService.js');
        if (Fast2SMSService.isConfigured()) {
          const walletData = await Fast2SMSService.getWalletBalance();
          if (walletData) {
            smsWalletBalance = walletData.wallet;
            smsLeft = walletData.sms;
            console.log(`[Dashboard] Fast2SMS wallet: ${smsWalletBalance}, SMS left: ${smsLeft}`);
          } else {
            console.warn('[Dashboard] Fast2SMS API returned null - check API key and account status');
          }
        } else {
          console.warn('[Dashboard] Fast2SMS API key not configured (FAST2SMS_API_KEY missing)');
        }
      } catch (smsError: any) {
        console.error('[Dashboard] Error fetching Fast2SMS data:', smsError?.message || smsError);
        // Continue with 0 values if SMS API fails
      }

      // 3. Count total users
      const totalUsers = await prisma.users.count();

      // 4. Count all pending purchase requests (activation + renew + reinvestment) – matches Activation Requests page list
      const activationPendingCount = await prisma.purchase_requests.count({
        where: {
          status: 'pending',
        },
      });

      // 5. Calculate Total Deposit (From All User) - sum of all purchases (active + inactive)
      const totalDepositResult = await prisma.purchases.aggregate({
        _sum: {
          amount: true,
        },
      });
      const totalDepositFromAllUsers = Number(totalDepositResult._sum.amount || 0);

      // 5b. Calculate Monthly Business - sum of purchases for current month OR custom date range
      const startDate = (req.query as any).start_date;
      const endDate = (req.query as any).end_date;
      
      let monthlyBusinessStart: Date;
      let monthlyBusinessEnd: Date;
      
      if (startDate && endDate) {
        // Custom date range provided
        monthlyBusinessStart = new Date(startDate);
        monthlyBusinessStart.setHours(0, 0, 0, 0);
        monthlyBusinessEnd = new Date(endDate);
        monthlyBusinessEnd.setHours(23, 59, 59, 999);
      } else {
        // Default to current month
        const now = new Date();
        monthlyBusinessStart = new Date(now.getFullYear(), now.getMonth(), 1);
        monthlyBusinessStart.setHours(0, 0, 0, 0);
        monthlyBusinessEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        monthlyBusinessEnd.setHours(23, 59, 59, 999);
      }

      const monthlyBusinessResult = await prisma.purchases.aggregate({
        where: {
          // Use purchased_at column for monthly business calculation
          purchased_at: {
            gte: monthlyBusinessStart,
            lte: monthlyBusinessEnd,
          },
          // Only count completed purchases
          status: 'completed',
        },
        _sum: {
          amount: true,
        },
      });
      const monthlyBusiness = Number(monthlyBusinessResult._sum.amount || 0);

      // 5c. Monthly New Purchase (Manual) - approved activation requests in period (by processed_at)
      const monthlyNewPurchaseResult = await prisma.purchase_requests.aggregate({
        where: {
          request_type: 'activation',
          status: 'approved',
          processed_at: {
            gte: monthlyBusinessStart,
            lte: monthlyBusinessEnd,
          },
        },
        _sum: { amount: true },
      });
      const monthly_new_purchase_manual = Number(monthlyNewPurchaseResult._sum.amount || 0);

      // 5d. Monthly Reinvestment - approved reinvestment requests in period (by processed_at)
      const monthlyReinvestmentResult = await prisma.purchase_requests.aggregate({
        where: {
          request_type: 'reinvestment',
          status: 'approved',
          processed_at: {
            gte: monthlyBusinessStart,
            lte: monthlyBusinessEnd,
          },
        },
        _sum: { amount: true },
      });
      const monthly_reinvestment = Number(monthlyReinvestmentResult._sum.amount || 0);

      // 5e. Monthly Renewal (same package) - purchases renewed in period, previous_package_id = package_id or null
      const monthlyRenewalRaw = await prisma.$queryRaw<[{ sum: string | null }]>`
        SELECT SUM(amount) as sum FROM purchases
        WHERE is_renewal = true AND status = 'completed'
          AND renewed_at >= ${monthlyBusinessStart} AND renewed_at <= ${monthlyBusinessEnd}
          AND (previous_package_id IS NULL OR previous_package_id = package_id)
      `;
      const monthly_renewal = Number(monthlyRenewalRaw[0]?.sum ?? 0);

      // 5f. Monthly Upgrade - purchases renewed in period with different package (previous_package_id != package_id)
      const monthlyUpgradeRaw = await prisma.$queryRaw<[{ sum: string | null }]>`
        SELECT SUM(amount) as sum FROM purchases
        WHERE is_renewal = true AND status = 'completed'
          AND renewed_at >= ${monthlyBusinessStart} AND renewed_at <= ${monthlyBusinessEnd}
          AND previous_package_id IS NOT NULL AND previous_package_id != package_id
      `;
      const monthly_upgrade = Number(monthlyUpgradeRaw[0]?.sum ?? 0);

      // 6. Calculate Total Self Income Given - sum of SELF commission_type from ledger_entries
      const totalSelfIncomeResult = await prisma.ledger_entries.aggregate({
        where: {
          commission_type: 'SELF',
        },
        _sum: {
          amount: true,
        },
      });
      const totalSelfIncomeGiven = Number(totalSelfIncomeResult._sum.amount || 0);

      // 7. Calculate Total Royalty Given - sum of MONTHLY commission_type from ledger_entries
      const totalRoyaltyResult = await prisma.ledger_entries.aggregate({
        where: {
          commission_type: 'MONTHLY',
        },
        _sum: {
          amount: true,
        },
      });
      const totalRoyaltyGiven = Number(totalRoyaltyResult._sum.amount || 0);

      // 8. Calculate Total Spot (Direct + Level based) - sum of SPOT commission_type from ledger_entries
      const totalSpotResult = await prisma.ledger_entries.aggregate({
        where: {
          commission_type: 'SPOT',
        },
        _sum: {
          amount: true,
        },
      });
      const totalSpot = Number(totalSpotResult._sum.amount || 0);

      // 9. Count package activated (completed purchases)
      const packageActivated = await prisma.purchases.count({
        where: {
          status: 'completed',
        },
      });

      // 9b. Users with active package vs no active package (2x logic: active = income < amount*2)
      type CountRow = { cnt: number };
      const activeUserCountResult = await prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(DISTINCT user_id)::int AS cnt FROM purchases
        WHERE status = 'completed' AND (COALESCE((income)::numeric, 0) < (amount)::numeric * 2)
      `;
      const users_with_active_package = Number(activeUserCountResult[0]?.cnt ?? 0);
      const users_with_no_active_package = Math.max(0, totalUsers - users_with_active_package);

      // 10. Calculate Total Withdrawal (sum of all approved + processing withdrawals)
      const totalWithdrawalResult = await prisma.withdraw_requests.aggregate({
        where: {
          status: {
            in: ['approved', 'processing'],
          },
        },
        _sum: {
          amount: true,
        },
      });
      const totalWithdrawal = Number(totalWithdrawalResult._sum.amount || 0);

      // 11. Calculate Pending Withdrawal Amount (sum of all pending withdrawals)
      const pendingWithdrawalResult = await prisma.withdraw_requests.aggregate({
        where: {
          status: 'pending',
        },
        _sum: {
          amount: true,
        },
      });
      const pendingWithdrawalAmount = Number(pendingWithdrawalResult._sum.amount || 0);

      // 12. Calculate Total Main Wallet Balance (sum of other_balance from all users)
      const totalMainWalletResult = await prisma.user_balances.aggregate({
        _sum: {
          other_balance: true,
        },
      });
      const totalMainWallet = Number(totalMainWalletResult._sum.other_balance || 0);

      // 13. Calculate Total Spot Wallet Balance (sum of spot_balance from all users)
      const totalSpotWalletResult = await prisma.user_balances.aggregate({
        _sum: {
          spot_balance: true,
        },
      });
      const totalSpotWallet = Number(totalSpotWalletResult._sum.spot_balance || 0);

      // 14. Count Pending KYC (users who submitted their KYC and are waiting for admin review)
      // Note: 'submitted' status means the user has filled out KYC and it's pending admin review
      // 'pending' status means user hasn't submitted KYC yet (not a request to review)
      const pendingKYCCount = await prisma.users.count({
        where: {
          kyc_status: 'submitted',
        },
      });

      // 15. Count KYC Approved Today (users verified today)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      
      const kycApprovedToday = await prisma.users.count({
        where: {
          kyc_status: 'approved',
          kyc_verified_at: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      });

      return reply.send({
        total_system_amount: totalSystemAmount,
        sms_wallet_balance: smsWalletBalance,
        sms_left: smsLeft,
        total_users: totalUsers,
        activation_pending_count: activationPendingCount,
        package_activated: packageActivated,
        users_with_active_package,
        users_with_no_active_package,
        total_deposit_from_all_users: totalDepositFromAllUsers,
        monthly_business: monthlyBusiness,
        monthly_new_purchase_manual: monthly_new_purchase_manual,
        monthly_upgrade: monthly_upgrade,
        monthly_renewal: monthly_renewal,
        monthly_reinvestment: monthly_reinvestment,
        total_self_income_given: totalSelfIncomeGiven,
        total_royalty_given: totalRoyaltyGiven,
        total_spot: totalSpot,
        total_withdrawal: totalWithdrawal,
        pending_withdrawal_amount: pendingWithdrawalAmount,
        total_main_wallet: totalMainWallet,
        total_spot_wallet: totalSpotWallet,
        pending_kyc_count: pendingKYCCount,
        kyc_approved_today: kycApprovedToday,
      });
    } catch (error) {
      console.error('Dashboard API error:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
