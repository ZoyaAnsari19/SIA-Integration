import { FastifyInstance } from 'fastify';
import { usersRoutes } from '../routes/users.js';
import { packagesRoutes } from '../routes/packages.js';
import { purchasesRoutes } from '../routes/purchases.js';
import { reportsRoutes } from '../routes/reports.js';
import { adminRoutes } from '../routes/admin.js';
import { kycRoutes } from '../routes/kyc.js';
import { kycDocumentUploadRoutes } from '../routes/kyc-document-upload.js';
import { adminKYCRoutes } from '../routes/admin-kyc.js';
import { adminPackagesRoutes } from '../routes/admin-packages.js';
import { adminUsersRoutes } from '../routes/admin-users.js';
import { adminPurchasesRoutes } from '../routes/admin-purchases.js';
import { adminDashboardRoutes } from '../routes/admin-dashboard.js';
import { adminReportsRoutes } from '../routes/admin-reports.js';
import { adminLevelsRoutes } from '../routes/admin-levels.js';
import { adminCommissionsRoutes } from '../routes/admin-commissions.js';
import { adminScheduledCommissionsRoutes } from '../routes/admin-scheduled-commissions.js';
import { adminEligibilityRoutes } from '../routes/admin-eligibility.js';
import { adminSystemRoutes } from '../routes/admin-system.js';
import { leaderboardRoutes } from '../routes/leaderboard.js';
import { authRoutes } from '../routes/auth.js';
import { dashboardRoutes } from '../routes/dashboard.js';
import { incomeHistoryRoutes } from '../routes/income-history.js';
import { profileRoutes } from '../routes/profile.js';
import { myPackagesRoutes } from '../routes/my-packages.js';
import { coursesRoutes } from '../routes/courses.js';
import { courseCartRoutes } from '../routes/course-cart.js';
import { coursePaymentsRoutes } from '../routes/course-payments.js';
import { iciciPaymentRoutes } from '../routes/icici-payment.routes.js';
import { courseVideosRoutes } from '../routes/course-videos.js';
import { courseRatingsRoutes } from '../routes/course-ratings.js';
import { adminCoursesRoutes } from '../routes/admin-courses.js';
import { teamRoutes } from '../routes/team.js';
import { paymentHistoryRoutes } from '../routes/payment-history.js';
import { pathRankRoutes } from '../routes/path-rank.js';
import { feesRoutes } from '../routes/fees.js';
import { adminFeesRoutes } from '../routes/admin-fees.js';
import { adminWithdrawRoutes } from '../routes/admin-withdraw.js';
import { adminCompanyBankRoutes } from '../routes/admin-company-bank.js';
import { adminWithdrawalTransferRulesRoutes } from '../routes/admin-withdrawal-transfer-rules.js';
import { withdrawRoutes } from '../routes/withdraw.js';
import { walletTransferRoutes } from '../routes/wallet-transfer.js';
import { adminNoticesRoutes } from '../routes/admin-notices.js';
import { adminWebsiteRoutes } from '../routes/admin-website.js';
import { adminPurchaseRequestsRoutes } from '../routes/admin-purchase-requests.js';
import { adminAllCommissionsRoutes } from '../routes/admin-commissions-all.js';
import { adminSubAdminsRoutes } from '../routes/admin-sub-admins.js';
import { adminUserPackagesRoutes } from '../routes/admin-user-packages.js';
import { adminActivityLogsRoutes } from '../routes/admin-activity-logs.js';
import { adminFlushHistoryRoutes } from '../routes/admin-flush-history.js';
import { adminLegacyHistoryRoutes } from '../routes/admin-legacy-history.js';
import { adminPinRoutes } from '../routes/admin-pin.js';
import { userProfilePhotoRoutes } from '../routes/user-profile-photo.js';
import { p2pTransferRoutes } from '../routes/p2p-transfer.js';
import { userDetailsRoutes } from '../routes/user-details.js';
import { billsRoutes } from '../routes/bills.js';
import { manualDepositRoutes } from '../routes/manual-deposit.js';
import { companyBankRoutes } from '../routes/company-bank.js';
import { siaPublicRoutes } from '../routes/sia-public.js';
import { supportRoutes } from '../routes/support.js';
import { adminSupportRoutes } from '../routes/admin-support.js';

export async function registerRoutes(app: FastifyInstance) {
  // Public SIA ecosystem routes (no auth) — for Secure Pharma / other projects to validate refer IDs
  await app.register(siaPublicRoutes, { prefix: '/api/v1/sia' });

  // Register new UI-aligned routes first (before old routes to take precedence)
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(dashboardRoutes, { prefix: '/api/v1/dashboard' });
  await app.register(incomeHistoryRoutes, { prefix: '/api/v1/income-history' });
  await app.register(profileRoutes, { prefix: '/api/v1/profile' });
  await app.register(myPackagesRoutes, { prefix: '/api/v1/my-packages' });
  
  // Course routes (for MLM-course-ui)
  await app.register(coursesRoutes, { prefix: '/api/v1/courses' });
  await app.register(courseCartRoutes, { prefix: '/api/v1/cart' });
  await app.register(coursePaymentsRoutes, { prefix: '/api/v1/payments' });
  await app.register(iciciPaymentRoutes, { prefix: '/api/v1/payments/icici' });
  await app.register(courseVideosRoutes, { prefix: '/api/v1/videos' });
  await app.register(courseRatingsRoutes, { prefix: '/api/v1/ratings' });
  
  // Admin course management
  await app.register(adminCoursesRoutes, { prefix: '/api/v1/admin/courses' });
  await app.register(teamRoutes, { prefix: '/api/v1/team' });
  await app.register(paymentHistoryRoutes, { prefix: '/api/v1/payment-history' });
  await app.register(pathRankRoutes, { prefix: '/api/v1/path-rank' });
  await app.register(feesRoutes, { prefix: '/api/v1/fees' });
  await app.register(withdrawRoutes, { prefix: '/api/v1/withdraw' });
  await app.register(walletTransferRoutes, { prefix: '/api/v1/wallet' });
  
  // Register new user-side routes
  await app.register(userProfilePhotoRoutes, { prefix: '/api/v1/user' });
  await app.register(kycDocumentUploadRoutes, { prefix: '/api/v1' });
  await app.register(p2pTransferRoutes, { prefix: '/api/v1/transfer' });
  await app.register(userDetailsRoutes, { prefix: '/api/v1/user' });
  await app.register(billsRoutes, { prefix: '/api/v1' });
  await app.register(manualDepositRoutes, { prefix: '/api/v1/deposit' });
  await app.register(companyBankRoutes, { prefix: '/api/v1' });
  await app.register(supportRoutes, { prefix: '/api/v1/support' });
  
  // Register existing routes
  await app.register(kycRoutes, { prefix: '/api/v1/users' });
  await app.register(usersRoutes, { prefix: '/api/v1/users' });
  await app.register(packagesRoutes, { prefix: '/api/v1/packages' });
  await app.register(purchasesRoutes, { prefix: '/api/v1/purchases' });
  await app.register(reportsRoutes, { prefix: '/api/v1/reports' });
  await app.register(leaderboardRoutes, { prefix: '/api/v1/leaderboard' });
  await app.register(adminKYCRoutes, { prefix: '/api/v1/admin' });
  await app.register(adminPackagesRoutes, { prefix: '/api/v1/admin' });
  await app.register(adminUsersRoutes, { prefix: '/api/v1/admin' });
  await app.register(adminUserPackagesRoutes, { prefix: '/api/v1/admin' });
  await app.register(adminPurchasesRoutes, { prefix: '/api/v1/admin' });
  await app.register(adminDashboardRoutes, { prefix: '/api/v1/admin' });
  await app.register(adminReportsRoutes, { prefix: '/api/v1/admin' });
  await app.register(adminLevelsRoutes, { prefix: '/api/v1/admin' });
  await app.register(adminCommissionsRoutes, { prefix: '/api/v1/admin' });
  await app.register(adminScheduledCommissionsRoutes, { prefix: '/api/v1/admin' });
  await app.register(adminEligibilityRoutes, { prefix: '/api/v1/admin' });
  await app.register(adminSystemRoutes, { prefix: '/api/v1/admin' });
  await app.register(adminFeesRoutes, { prefix: '/api/v1/admin' });
  await app.register(adminWithdrawRoutes, { prefix: '/api/v1/admin' });
  await app.register(adminCompanyBankRoutes, { prefix: '/api/v1/admin' });
  await app.register(adminWithdrawalTransferRulesRoutes, { prefix: '/api/v1/admin' });
  await app.register(adminNoticesRoutes, { prefix: '/api/v1/admin' });
  await app.register(adminWebsiteRoutes, { prefix: '/api/v1/admin' });
  await app.register(adminPurchaseRequestsRoutes, { prefix: '/api/v1/admin' });
  await app.register(adminAllCommissionsRoutes, { prefix: '/api/v1/admin' });
  await app.register(adminSubAdminsRoutes, { prefix: '/api/v1/admin' });
  await app.register(adminActivityLogsRoutes, { prefix: '/api/v1/admin' });
  await app.register(adminFlushHistoryRoutes, { prefix: '/api/v1/admin' });
  await app.register(adminPinRoutes, { prefix: '/api/v1/admin' });
  await app.register(adminSupportRoutes, { prefix: '/api/v1/admin' });
  await app.register(adminLegacyHistoryRoutes, { prefix: '/api/v1/admin' });
  await app.register(adminRoutes, { prefix: '/api/v1/admin' });
}


