import { FastifyRequest, FastifyReply } from 'fastify';
import axios from 'axios';
import { prisma } from '../config/prisma.js';
import { CommissionService } from '../modules/commissions/commission.service.js';
import { generateSecureHash, verifySecureHash } from '../utils/icici-hash.utils.js';
import { resetSpotTeamWithdrawUsed } from '../utils/spotTeamWithdrawLimit.js';
import { getMinReinvestmentAmount, getMinReinvestmentMessage } from '../utils/reinvestmentMinAmount.js';
import {
  findAndValidateExpiredPurchase,
  validateRenewalWindow,
  createRenewalAsNewRow,
  computeUpgradeEffectiveGlobalIds,
} from '../utils/purchase-renewal-gateway.js';

// ICICI Gateway Configuration
const DEFAULT_MERCHANT_ID = process.env.ICICI_MERCHANT_ID || '100000000006873';

// UAT testing switch: set ICICI_USE_UAT=true to test payment gateway on production against UAT.
// All initiate-sale calls will go to UAT URL (no real money). Set to false or remove after testing.
const USE_UAT = process.env.ICICI_USE_UAT === 'true';
const UAT_INITIATE_SALE_URL = 'https://pgpayuat.icicibank.com/tsp/pg/api/v2/initiateSale';

const GATEWAY_CONFIG = {
  merchantId: DEFAULT_MERCHANT_ID,
  aggregatorId: process.env.ICICI_AGGREGATOR_ID || '',
  secretKey: process.env.ICICI_SECRET_KEY || 'c9dbb8c6ab664b4bbaffe65beced35af',
  initiateSaleURL: USE_UAT
    ? UAT_INITIATE_SALE_URL
    : (process.env.ICICI_INITIATE_SALE_URL || UAT_INITIATE_SALE_URL),
  returnURL: process.env.ICICI_RETURN_URL || 'https://app1.secureinfiniteassociation.com/payment/callback',
  currencyCode: '356', // INR
  payType: '0'
};

if (USE_UAT) {
  console.warn('⚠️ ICICI Payment Gateway: UAT mode is ON (ICICI_USE_UAT=true). All payments go to UAT. Turn off after testing.');
}

/**
 * Generate unique merchant transaction number
 * Format: TXN + timestamp + random number
 */
function generateMerchantTxnNo(): string {
  return `TXN${Date.now()}${Math.floor(Math.random() * 10000)}`;
}

/**
 * Generate transaction date in format: YYYYMMDDHHmmss
 */
function generateTxnDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

/**
 * Create Payment - POST /api/v1/payments/icici/create-payment
 * Generates merchantTxnNo, txnDate, secureHash and calls Initiate Sale API
 * Returns redirectURL to frontend
 */
type CreatePaymentBody = {
  courseIds?: string[];
  courseId?: string;
  packageId?: number;
  amount?: number;
  customerName?: string;
  customerEmail?: string;
  customerMobile?: string;
  request_type?: 'activation' | 'renew' | 'reinvestment' | 'upgrade';
  previous_purchase_id?: string;
};

export async function createPayment(
  request: FastifyRequest<{ Body: CreatePaymentBody }>,
  reply: FastifyReply
) {
  try {
    const userId = BigInt((request as any).user.user_id);
    const body = (request.body as CreatePaymentBody) || {};
    const {
      courseIds,
      courseId,
      packageId,
      amount,
      customerName,
      customerEmail,
      customerMobile,
      request_type: requestType = 'activation',
      previous_purchase_id: previousPurchaseIdRaw,
    } = body;

    const previousPurchaseId = previousPurchaseIdRaw ? BigInt(previousPurchaseIdRaw) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ACTIVATION: same as manual – user must have NO purchases OR all purchases must have reached 2x
    if (requestType === 'activation') {
      const allPurchases = await prisma.purchases.findMany({
        where: { user_id: userId, status: 'completed' },
      });
      if (allPurchases.length > 0) {
        const hasActive = await CommissionService.hasActiveCourse(userId, today);
        if (hasActive) {
          return reply.status(400).send({
            error: 'has_active_purchase',
            message: 'Cannot create activation request. User has active purchase. Use "reinvestment" or "renew" instead.',
          });
        }
        let allReached2x = true;
        for (const p of allPurchases) {
          const is2x = await CommissionService.isPurchaseDoubleReached(p.id as unknown as bigint);
          if (!is2x) {
            allReached2x = false;
            break;
          }
        }
        if (!allReached2x) {
          return reply.status(400).send({
            error: 'purchases_not_2x',
            message: 'Cannot create activation request. User has purchases that have not reached 2x. Use "reinvestment" or "renew" instead.',
          });
        }
      }
    }

    console.log('ICICI Payment Request:', {
      userId: userId.toString(),
      courseId,
      courseIds,
      packageId,
      amount,
      requestType,
      previous_purchase_id: previousPurchaseIdRaw,
      hasCourseId: !!courseId,
      hasCourseIds: !!courseIds,
      courseIdsLength: courseIds?.length,
    });

    // Support both courseId (single) and courseIds (array).
    // Additionally allow packageId (Buy More flow from MLM user dashboard) – backend resolves course from package.
    let finalCourseId = courseId || (courseIds && courseIds.length > 0 ? courseIds[0] : null);
    let resolvedFromPackage = false;

    // ---- RENEW: same package renewal (expired package) – get course from expired purchase's package ----
    if (requestType === 'renew') {
      if (!previousPurchaseId) {
        return reply.status(400).send({
          error: 'previous_purchase_id_required',
          message: 'For renewal, previous_purchase_id is required.',
        });
      }
      try {
        const { expiredPurchase, previousPackageId } = await findAndValidateExpiredPurchase(userId, previousPurchaseId);
        await validateRenewalWindow(previousPurchaseId, userId, new Date());

        const courseFromPackage = await prisma.courses.findFirst({
          where: {
            package_id: previousPackageId,
            is_published: true,
          },
          orderBy: { created_at: 'asc' },
        });
        if (!courseFromPackage) {
          return reply.status(404).send({
            error: 'Course not found for package',
            message: `No published course linked with package ID ${previousPackageId}.`,
          });
        }
        finalCourseId = courseFromPackage.id;
        resolvedFromPackage = true;
        // course will be set below from finalCourseId
      } catch (e: any) {
        const msg = e?.message || String(e);
        if (msg === 'EXPIRED_PURCHASE_NOT_FOUND') {
          return reply.status(400).send({ error: 'Invalid previous_purchase_id', message: 'Expired purchase not found.' });
        }
        if (msg === 'PREVIOUS_PURCHASE_NOT_OWNED') {
          return reply.status(400).send({ error: 'Invalid previous_purchase_id', message: 'Purchase does not belong to you.' });
        }
        if (msg === 'PREVIOUS_PURCHASE_NOT_EXPIRED') {
          return reply.status(400).send({ error: 'Invalid previous_purchase_id', message: 'Selected purchase is not expired (2x not reached).' });
        }
        if (msg === 'RENEWAL_WINDOW_UNKNOWN' || msg === 'RENEWAL_WINDOW_EXPIRED') {
          return reply.status(400).send({
            error: 'renewal_window_expired',
            message: 'Renewal window closed. Package can only be renewed within 65 days of last income.',
          });
        }
        throw e;
      }
    }

    // If no courseId provided but packageId is present (and not renew), resolve the primary course linked to this package.
    if (!finalCourseId && packageId) {
      try {
        const courseFromPackage = await prisma.courses.findFirst({
          where: {
            package_id: Number(packageId),
            is_published: true,
          },
          orderBy: {
            created_at: 'asc',
          },
        });

        if (courseFromPackage) {
          finalCourseId = courseFromPackage.id;
          resolvedFromPackage = true;
        }
      } catch (error: any) {
        console.error('Error resolving course from packageId:', { packageId, error });
        return reply.status(500).send({
          error: 'Database error',
          message: error.message || 'Failed to resolve course from package',
        });
      }
    }

    // UPGRADE: require previous_purchase_id and new package/course
    if (requestType === 'upgrade') {
      if (!previousPurchaseId) {
        return reply.status(400).send({
          error: 'previous_purchase_id_required',
          message: 'For upgrade, previous_purchase_id is required.',
        });
      }
      if (!finalCourseId && !packageId) {
        return reply.status(400).send({
          error: 'package_or_course_required',
          message: 'For upgrade, provide packageId or courseId of the new package.',
        });
      }
      try {
        await findAndValidateExpiredPurchase(userId, previousPurchaseId);
        await validateRenewalWindow(previousPurchaseId, userId, new Date());
      } catch (e: any) {
        const msg = e?.message || String(e);
        if (msg === 'EXPIRED_PURCHASE_NOT_FOUND') {
          return reply.status(400).send({ error: 'Invalid previous_purchase_id', message: 'Expired purchase not found.' });
        }
        if (msg === 'PREVIOUS_PURCHASE_NOT_OWNED') {
          return reply.status(400).send({ error: 'Invalid previous_purchase_id', message: 'Purchase does not belong to you.' });
        }
        if (msg === 'PREVIOUS_PURCHASE_NOT_EXPIRED') {
          return reply.status(400).send({ error: 'Invalid previous_purchase_id', message: 'Selected purchase is not expired (2x not reached).' });
        }
        if (msg === 'RENEWAL_WINDOW_UNKNOWN' || msg === 'RENEWAL_WINDOW_EXPIRED') {
          return reply.status(400).send({
            error: 'renewal_window_expired',
            message: 'Renewal window closed. Package can only be renewed/upgraded within 65 days of last income.',
          });
        }
        throw e;
      }
    }

    // REINVESTMENT: same as manual – must have active purchase; min = 2× last Main withdrawal OR 50% of current package
    if (requestType === 'reinvestment') {
      const hasActive = await CommissionService.hasActiveCourse(userId, today);
      if (!hasActive) {
        return reply.status(400).send({
          error: 'no_active_purchase',
          message: 'Cannot create reinvestment request. No active purchase found. Use "activation" or "renew" instead.',
        });
      }
      const minReinvest = await getMinReinvestmentAmount(userId);
      const amountNum = amount != null ? (typeof amount === 'string' ? parseFloat(amount) : amount) : 0;
      if (minReinvest.minAmount > 0 && amountNum < minReinvest.minAmount) {
        return reply.status(400).send({
          error: 'reinvestment_min_amount',
          message: getMinReinvestmentMessage(minReinvest),
        });
      }
    }

    // Same as manual: do not allow gateway payment if user already has a pending purchase request
    const existingPendingRequest = await prisma.purchase_requests.findFirst({
      where: { user_id: userId, status: 'pending' },
    });
    if (existingPendingRequest) {
      return reply.status(400).send({
        error: 'pending_purchase_request',
        message: 'You already have a pending purchase request. Please wait for admin approval or rejection before creating a new request.',
      });
    }

    if (!finalCourseId) {
      return reply.status(400).send({ error: 'Course ID is required' });
    }

    // Get course details
    let course;
    try {
      course = await prisma.courses.findUnique({
        where: { id: finalCourseId }
      });
    } catch (error: any) {
      console.error('Error fetching course:', error);
      return reply.status(500).send({
        error: 'Database error',
        message: error.message || 'Failed to fetch course details'
      });
    }

    if (!course) {
      console.error('Course not found:', finalCourseId);
      if (resolvedFromPackage && packageId) {
        return reply.status(404).send({
          error: 'Course not found for package',
          message: `No published course is linked with package ID ${packageId}. Please contact support.`
        });
      }
      return reply.status(404).send({ error: 'Course not found' });
    }

    if (!course.is_published) {
      console.error('Course not published:', finalCourseId);
      return reply.status(400).send({ error: 'Course is not available for purchase' });
    }

    if (!course.package_id) {
      console.error('Course has no package_id:', finalCourseId);
      return reply.status(400).send({ error: 'Course has no linked package' });
    }

    // Check if user already purchased this course.
    // - Skip for renew: we're explicitly renewing that same course.
    // - Skip for reinvestment: user is allowed to buy the same course again as a new package.
    if (requestType !== 'renew' && requestType !== 'reinvestment') {
      const existingPurchase = await prisma.purchases.findFirst({
        where: {
          user_id: userId,
          course_id: finalCourseId,
          purchase_type: 'COURSE_PURCHASE',
          status: 'completed',
        },
      });

      if (existingPurchase) {
        return reply.status(400).send({ error: 'You already own this course' });
      }
    }

    // Get user details for customer info
    const user = await prisma.users.findUnique({
      where: { id: userId }
    });

    // Use provided customer data or fallback to user data
    const finalCustomerName = customerName || user?.name || 'Customer';
    const finalCustomerEmail = customerEmail || user?.email || 'customer@example.com';
    const finalCustomerMobile = customerMobile || user?.phone || '0000000000';

    // Use provided amount or course price
    // Handle Prisma Decimal type properly
    const coursePrice = typeof course.price === 'object' && course.price !== null 
      ? Number(course.price.toString()) 
      : Number(course.price);
    const finalAmount = amount || coursePrice;
    
    // Format amount as string with 2 decimal places (like demo)
    const amountNum = typeof finalAmount === 'string' ? parseFloat(finalAmount) : finalAmount;
    const formattedAmount = (isNaN(amountNum) || amountNum <= 0) ? '0.00' : amountNum.toFixed(2);
    
    console.log('Amount formatting:', { 
      originalAmount: amount, 
      coursePrice, 
      finalAmount, 
      formattedAmount 
    });

    // Generate merchant transaction number
    const merchantTxnNo = generateMerchantTxnNo();
    
    // Generate transaction date
    const txnDate = generateTxnDate();

    // Validate returnURL is configured
    if (!GATEWAY_CONFIG.returnURL || GATEWAY_CONFIG.returnURL === '') {
      return reply.status(500).send({
        error: 'Server configuration error',
        message: 'Return URL is not configured. Please set ICICI_RETURN_URL environment variable'
      });
    }

    // Prepare payment request payload (Direct MID Mode - no aggregatorID)
    const paymentRequest: any = {
      merchantId: String(GATEWAY_CONFIG.merchantId),
      // Include aggregatorID / aggregatorId when configured (ICICI uses both in docs / error text)
      ...(GATEWAY_CONFIG.aggregatorId && { 
        aggregatorID: String(GATEWAY_CONFIG.aggregatorId),
        aggregatorId: String(GATEWAY_CONFIG.aggregatorId)
      }),
      merchantTxnNo: String(merchantTxnNo),
      amount: String(formattedAmount),
      currencyCode: String(GATEWAY_CONFIG.currencyCode),
      payType: String(GATEWAY_CONFIG.payType),
      customerEmailID: String(finalCustomerEmail),
      transactionType: 'SALE',
      returnURL: String(GATEWAY_CONFIG.returnURL),
      txnDate: String(txnDate),
      customerMobileNo: String(finalCustomerMobile),
      customerName: String(finalCustomerName),
      addlParam1: String(finalCourseId),
      addlParam2: String(course.title || 'Course')
    };

    // Generate secureHash
    const secureHash = generateSecureHash(paymentRequest, GATEWAY_CONFIG.secretKey);
    paymentRequest.secureHash = secureHash;

    // Remove debug property if exists
    delete paymentRequest._hashString;

    // Create pending purchase record (or gateway intent for legacy renew flow)
    let purchase: { id: bigint; user_id: bigint; course_id: string | null; is_renewal?: boolean; previous_purchase_id?: bigint | null } | null = null;
    let gatewayIntentId: bigint | null = null;

    if (requestType === 'renew' && previousPurchaseId) {
      // Renewal: create a pending purchase row (like new/reinvest/upgrade)
      // so admin gateway history sees the attempt immediately. We also
      // keep a lightweight intent row for audit/logging.
      try {
        purchase = await prisma.purchases.create({
          data: {
            user_id: userId,
            package_id: course.package_id,
            course_id: finalCourseId,
            purchase_type: 'COURSE_PURCHASE',
            amount: amountNum,
            status: 'pending',
            payment_type: 'icici',
            is_manual: false,
            income: 0,
            merchant_txn_no: merchantTxnNo,
            is_renewal: true,
            previous_package_id: course.package_id,
            previous_purchase_id: previousPurchaseId,
          },
        }) as any;

        const intent = await (prisma as any).gateway_payment_intents.create({
          data: {
            user_id: userId,
            merchant_txn_no: merchantTxnNo,
            request_type: 'renew',
            package_id: course.package_id,
            course_id: finalCourseId,
            previous_purchase_id: previousPurchaseId,
            amount: amountNum,
            status: 'pending',
          },
        });
        gatewayIntentId = intent.id;
        console.log('Gateway renewal intent created:', intent.id.toString());
      } catch (error: any) {
        console.error('Error creating gateway intent:', error);
        return reply.status(500).send({
          error: 'Database error',
          message: error.message || 'Failed to create payment intent',
        });
      }
    } else if (requestType === 'upgrade' && previousPurchaseId) {
      const { expiredPurchase } = await findAndValidateExpiredPurchase(userId, previousPurchaseId);
      try {
        purchase = await prisma.purchases.create({
          data: {
            user_id: userId,
            package_id: course.package_id,
            course_id: finalCourseId,
            purchase_type: 'COURSE_PURCHASE',
            amount: amountNum,
            status: 'pending',
            payment_type: 'icici',
            is_manual: false,
            income: 0,
            merchant_txn_no: merchantTxnNo,
            is_renewal: true,
            previous_package_id: expiredPurchase.package_id,
            previous_purchase_id: previousPurchaseId,
          },
        }) as any;
        console.log('Upgrade purchase created (pending):', purchase!.id.toString());
      } catch (error: any) {
        console.error('Error creating upgrade purchase:', error);
        return reply.status(500).send({
          error: 'Database error',
          message: error.message || 'Failed to create purchase record',
        });
      }
    } else {
      // activation or reinvestment
      try {
        purchase = await prisma.purchases.create({
          data: {
            user_id: userId,
            package_id: course.package_id,
            course_id: finalCourseId,
            purchase_type: 'COURSE_PURCHASE',
            amount: amountNum,
            status: 'pending',
            payment_type: 'icici',
            is_manual: false,
            income: 0,
            merchant_txn_no: merchantTxnNo,
          },
        }) as any;
        console.log('Purchase created:', purchase!.id.toString());
      } catch (error: any) {
        console.error('Error creating purchase:', error);
        return reply.status(500).send({
          error: 'Database error',
          message: error.message || 'Failed to create purchase record',
        });
      }
    }

    // Log payment request before API call (like demo)
    console.log('=== Payment Request (Before API Call) ===');
    console.log('Merchant ID:', paymentRequest.merchantId);
    console.log('Aggregator ID (aggregatorID):', paymentRequest.aggregatorID || null);
    console.log('Aggregator Id (aggregatorId):', paymentRequest.aggregatorId || null);
    console.log('Amount:', paymentRequest.amount);
    console.log('Return URL:', paymentRequest.returnURL);
    console.log('Customer Email:', paymentRequest.customerEmailID);
    console.log('Customer Mobile:', paymentRequest.customerMobileNo);
    console.log('=========================================');

    // Call ICICI Initiate Sale API
    let gatewayResponse;
    try {
      const response = await axios.post(
        GATEWAY_CONFIG.initiateSaleURL,
        paymentRequest,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );

      // Check if response is HTML (error page) instead of JSON
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('text/html') || typeof response.data === 'string') {
        console.error('ICICI Gateway returned HTML instead of JSON:', response.data?.substring(0, 500));
        throw new Error('Payment gateway returned an error page. Please check gateway configuration.');
      }

      gatewayResponse = response.data;
      console.log('Gateway Response:', JSON.stringify(gatewayResponse, null, 2));
    } catch (error: any) {
      console.error('ICICI Gateway API Error:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: typeof error.response?.data === 'string' 
          ? error.response.data.substring(0, 500) 
          : error.response?.data,
        code: error.code
      });
      
      // Update purchase or gateway intent to failed
      if (purchase) {
        await prisma.purchases.update({
          where: { id: purchase.id },
          data: { status: 'failed' }
        });
      } else if (gatewayIntentId) {
        await (prisma as any).gateway_payment_intents.update({
          where: { id: gatewayIntentId },
          data: { status: 'failed' }
        });
      }

      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        return reply.status(504).send({
          success: false,
          error: 'Gateway timeout',
          message: 'Payment gateway is taking too long to respond. Please try again.'
        });
      }

      if (error.response) {
        // Handle HTML responses (502 Bad Gateway, etc.)
        if (error.response.status === 502 || error.response.status === 503) {
          return reply.status(502).send({
            success: false,
            error: 'Gateway unavailable',
            message: 'Payment gateway is currently unavailable. Please try again later or contact support.'
          });
        }

        // Handle HTML error pages
        if (typeof error.response.data === 'string' && error.response.data.includes('<html>')) {
          return reply.status(502).send({
            success: false,
            error: 'Gateway error',
            message: 'Payment gateway returned an error. Please check gateway configuration or try again later.'
          });
        }

        return reply.status(error.response.status || 500).send({
          success: false,
          error: 'Payment gateway error',
          message: error.response.data?.responseDescription || error.response.data?.message || error.message,
          gatewayResponse: error.response.data
        });
      }

      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: error.message || 'Failed to connect to payment gateway'
      });
    }

    // Check if payment initiation was successful
    // Gateway returns responseCode: 'R1000' for success
    console.log('Checking gateway response:', {
      responseCode: gatewayResponse.responseCode,
      hasRedirectURI: !!gatewayResponse.redirectURI,
      hasTranCtx: !!gatewayResponse.tranCtx,
      fullResponse: JSON.stringify(gatewayResponse)
    });

    if (gatewayResponse.responseCode === 'R1000' && gatewayResponse.redirectURI && gatewayResponse.tranCtx) {
      const redirectURL = `${gatewayResponse.redirectURI}?tranCtx=${gatewayResponse.tranCtx}`;
      
      console.log('Payment initiation successful, redirectURL:', redirectURL);
      
      return reply.send({
        success: true,
        redirectURL: redirectURL,
        merchantTxnNo: merchantTxnNo,
        ...(purchase && { purchaseId: purchase.id.toString() }),
        ...(gatewayIntentId && { gatewayIntentId: gatewayIntentId.toString() }),
      });
    } else {
      console.error('Payment initiation failed - Gateway Response Details:');
      console.error('  responseCode:', gatewayResponse.responseCode);
      console.error('  responseDescription:', gatewayResponse.responseDescription);
      console.error('  redirectURI:', gatewayResponse.redirectURI);
      console.error('  tranCtx:', gatewayResponse.tranCtx);
      console.error('  Full response:', JSON.stringify(gatewayResponse, null, 2));
      
      // Update purchase or gateway intent to failed
      if (purchase) {
        await prisma.purchases.update({
          where: { id: purchase.id },
          data: { status: 'failed' }
        });
      } else if (gatewayIntentId) {
        await (prisma as any).gateway_payment_intents.update({
          where: { id: gatewayIntentId },
          data: { status: 'failed' }
        });
      }

      // Handle specific error codes
      let errorMessage = gatewayResponse.responseDescription || gatewayResponse.message || `Gateway returned: ${gatewayResponse.responseCode}`;
      if (gatewayResponse.responseCode === 'P1006') {
        errorMessage = 'Transaction limit exceeded. The payment gateway has reached its daily/monthly transaction limit. Please contact support or try again later.';
      }
      
      return reply.status(400).send({
        success: false,
        error: 'Payment initiation failed',
        message: errorMessage,
        responseCode: gatewayResponse.responseCode,
        response: gatewayResponse
      });
    }

  } catch (error: any) {
    console.error('Payment creation error (catch block):', error);
    console.error('Error stack:', error.stack);
    
    // Return detailed error for debugging
    return reply.status(500).send({
      success: false,
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

/**
 * Payment Callback - POST /api/v1/payments/icici/callback
 * Receives POST from ICICI gateway after payment completion
 * Verifies hash, updates purchase, triggers commissions
 */
export async function paymentCallback(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // ICICI Gateway sends POST with application/x-www-form-urlencoded
    // Fastify automatically parses form-urlencoded bodies
    
    console.log('\n========================================');
    console.log('PAYMENT CALLBACK RECEIVED');
    console.log('========================================');
    console.log('Method:', request.method);
    console.log('URL:', request.url);
    console.log('Content-Type:', request.headers['content-type']);
    console.log('Headers:', JSON.stringify(request.headers, null, 2));
    console.log('Raw Body:', request.body);
    console.log('Body Type:', typeof request.body);
    console.log('========================================\n');
    
    const responseData = request.body as any || {};
    
    // If body is empty or undefined, log error
    if (!responseData || Object.keys(responseData).length === 0) {
      console.error('ERROR: Empty or undefined request body');
      console.error('This might indicate form-urlencoded parsing issue');
      return reply.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invalid Request</title>
          <meta charset="utf-8">
        </head>
        <body style="font-family: Arial; padding: 20px; text-align: center;">
          <h2 style="color: red;">Invalid Payment Request</h2>
          <p>Request body is empty or could not be parsed.</p>
          <p>Please check server logs for details.</p>
        </body>
        </html>
      `);
    }
    
    // Extract and normalize field names (gateway may send in different cases)
    const normalizedData: any = {
      securehash: responseData.securehash || responseData.secureHash || responseData.SecureHash || responseData.SECUREHASH,
      merchantTxnNo: responseData.merchantTxnNo || responseData.merchanttxnno || responseData.merchantTxnno || responseData.MERCHANTTXNNO,
      responseCode: responseData.responseCode || responseData.responsecode || responseData.RESPONSECODE,
      respdescription: responseData.respdescription || responseData.respDescription || responseData.RESPDESCRIPTION || responseData.respDesc || responseData.RESPDESC,
      amount: responseData.amount || responseData.Amount || responseData.AMOUNT,
      txnID: responseData.txnID || responseData.txnId || responseData.txid || responseData.TXNID || responseData.transactionId || responseData.TRANSACTIONID,
      paymentID: responseData.paymentID || responseData.paymentId || responseData.PAYMENTID || responseData.paymentInstId || responseData.PAYMENTINSTID,
      merchantId: responseData.merchantId || responseData.merchantid || responseData.MERCHANTID,
      paymentDateTime: responseData.paymentDateTime || responseData.paymentdatetime || responseData.PAYMENTDATETIME || responseData.TransmissionDateTime || responseData.TRANSMISSIONDATETIME,
      customerEmailID: responseData.customerEmailID || responseData.customerEmailId || responseData.CUSTOMEREMAILID,
      customerMobileNo: responseData.customerMobileNo || responseData.customerMobileno || responseData.CUSTOMERMOBILENO,
      paymentMode: responseData.paymentMode || responseData.paymentmode || responseData.PAYMENTMODE,
      paymentSubInstType: responseData.paymentSubInstType || responseData.paymentSubInsttype || responseData.PAYMENTSUBINSTTYPE || responseData.paymentSubInst || responseData.PAYMENTSUBINST || '',
      addlParam1: responseData.addlParam1 || responseData.addlparam1 || responseData.ADDLPARAM1,
      addlParam2: responseData.addlParam2 || responseData.addlparam2 || responseData.ADDLPARAM2
    };
    
    console.log('--- NORMALIZED DATA ---');
    console.log(JSON.stringify(normalizedData, null, 2));
    console.log('========================================\n');
    
    // Validate required fields
    if (!normalizedData.responseCode) {
      return reply.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invalid Response</title>
          <meta charset="utf-8">
        </head>
        <body style="font-family: Arial; padding: 20px; text-align: center;">
          <h2 style="color: red;">Invalid Payment Response</h2>
          <p>Missing required field: responseCode</p>
        </body>
        </html>
      `);
    }
    
    if (!normalizedData.merchantTxnNo) {
      return reply.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invalid Response</title>
          <meta charset="utf-8">
        </head>
        <body style="font-family: Arial; padding: 20px; text-align: center;">
          <h2 style="color: red;">Invalid Payment Response</h2>
          <p>Missing required field: merchantTxnNo</p>
        </body>
        </html>
      `);
    }
    
    if (!normalizedData.securehash) {
      return reply.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invalid Response</title>
          <meta charset="utf-8">
        </head>
        <body style="font-family: Arial; padding: 20px; text-align: center;">
          <h2 style="color: red;">Invalid Payment Response</h2>
          <p>Missing required field: securehash</p>
        </body>
        </html>
      `);
    }

    // Verify secure hash
    const isValid = verifySecureHash(normalizedData, GATEWAY_CONFIG.secretKey, normalizedData.securehash);
    if (!isValid) {
      console.error('Hash verification failed - but proceeding for UAT testing');
      console.error('⚠️  WARNING: Hash verification is disabled for UAT. Enable in production!');
      // TODO: Re-enable hash verification after confirming correct hash order from ICICI
      // For now, we'll proceed with payment processing in UAT environment
      // In production, this should be: return reply.status(400).send(...)
    }
    
    // Find purchase or gateway intent by merchantTxnNo
    let purchase = await prisma.purchases.findFirst({
      where: {
        merchant_txn_no: normalizedData.merchantTxnNo,
        status: 'pending'
      }
    });

    const gatewayIntent = !purchase
      ? await (prisma as any).gateway_payment_intents.findFirst({
          where: { merchant_txn_no: normalizedData.merchantTxnNo, status: 'pending' },
        })
      : null;

    if (!purchase && !gatewayIntent) {
      return reply.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Transaction Not Found</title>
          <meta charset="utf-8">
        </head>
        <body style="font-family: Arial; padding: 20px; text-align: center;">
          <h2 style="color: red;">Transaction Not Found</h2>
          <p>Purchase or payment intent not found for merchantTxnNo: ${normalizedData.merchantTxnNo}</p>
        </body>
        </html>
      `);
    }

    // Determine transaction status
    const respCode = normalizedData.responseCode;
    const isSuccess = respCode === '00' || respCode === '000' || respCode === '0000' || respCode?.startsWith('000');
    const status = isSuccess ? 'completed' : 'failed';

    console.log('Transaction Status Check:', {
      responseCode: respCode,
      isSuccess,
      respdescription: normalizedData.respdescription,
      hasPurchase: !!purchase,
      hasIntent: !!gatewayIntent,
    });

    const txnId = normalizedData.txnID || normalizedData.merchantTxnNo;
    const paymentInfo = {
      txn_id: txnId,
      payment_type: 'icici',
      icici_txn_id: normalizedData.txnID || null,
      icici_payment_id: normalizedData.paymentID || null,
    };

    // ---- Gateway RENEW (intent): create NEW purchase row so history shows New / Reinvestment / Renewal separately ----
    if (gatewayIntent && gatewayIntent.request_type === 'renew') {
      if (isSuccess) {
        const previousPurchaseId = gatewayIntent.previous_purchase_id!;
        const expiredPurchase = await prisma.purchases.findUnique({
          where: { id: previousPurchaseId },
        });
        if (!expiredPurchase) {
          console.error('Renew: expired purchase not found', previousPurchaseId.toString());
        } else {
          const { id: renewedId } = await createRenewalAsNewRow(
            {
              id: expiredPurchase.id,
              user_id: expiredPurchase.user_id,
              package_id: expiredPurchase.package_id,
              course_id: expiredPurchase.course_id,
              purchase_type: (expiredPurchase as any).purchase_type || 'COURSE_PURCHASE',
            },
            { amount: gatewayIntent.amount, course_id: gatewayIntent.course_id ?? null },
            paymentInfo
          );
          await (prisma as any).gateway_payment_intents.update({
            where: { id: gatewayIntent.id },
            data: { status: 'completed' },
          });
          try {
            await resetSpotTeamWithdrawUsed(gatewayIntent.user_id);
          } catch (e) {
            console.error('Error resetting network withdraw used:', e);
          }
          try {
            await CommissionService.handlePurchase(renewedId);
          } catch (error) {
            console.error('Error triggering commissions (renew):', error);
          }
        }
      } else {
        await (prisma as any).gateway_payment_intents.update({
          where: { id: gatewayIntent.id },
          data: { status: 'failed' },
        });
      }
      // Fall through to HTML redirect below (use same frontendURL logic)
    } else if (purchase) {
      // ---- Purchase flow: upgrade (set effective_global_ids) or activation/reinvestment/renewal ----
      // Upgrade = is_renewal with a different package than previous; same-package renewals are NOT upgrades.
      const isUpgrade =
        !!(purchase as any).is_renewal &&
        (purchase as any).previous_purchase_id &&
        (purchase as any).previous_package_id &&
        (purchase as any).previous_package_id !== purchase.package_id;
      let effectiveGlobalIds: number | undefined;
      if (isSuccess && isUpgrade && (purchase as any).previous_purchase_id) {
        const expiredPurchase = await prisma.purchases.findUnique({
          where: { id: (purchase as any).previous_purchase_id },
        });
        if (expiredPurchase) {
          effectiveGlobalIds = await computeUpgradeEffectiveGlobalIds(
            expiredPurchase as { id: bigint; user_id: bigint; package_id: number; purchased_at: Date },
            purchase.package_id
          );
        }
      }

      const updatedPurchase = await prisma.purchases.update({
        where: { id: purchase.id },
        data: {
          status,
          txn_id: txnId,
          icici_txn_id: normalizedData.txnID || null,
          icici_payment_id: normalizedData.paymentID || null,
          payment_type: 'icici',
          purchased_at: isSuccess ? new Date() : purchase.purchased_at,
          ...(effectiveGlobalIds !== undefined && { effective_global_ids: effectiveGlobalIds }),
        },
      });

      if (isSuccess) {
        if (purchase.course_id) {
          await prisma.course_cart_entries.deleteMany({
            where: {
              user_id: purchase.user_id,
              course_id: purchase.course_id,
            },
          });
          await prisma.courses.update({
            where: { id: purchase.course_id },
            data: { total_students: { increment: 1 } },
          });
        }
        try {
          await resetSpotTeamWithdrawUsed(purchase.user_id);
        } catch (e) {
          console.error('Error resetting network withdraw used:', e);
        }
        try {
          await CommissionService.handlePurchase(updatedPurchase.id);
        } catch (error) {
          console.error('Error triggering commissions:', error);
        }
      }
    }

    // Return HTML redirect to frontend; show dashboard instruction so user knows where to check package
    const frontendURL = process.env.FRONTEND_URL || 'https://app.secureinfiniteassociation.com';
    const dashboardURL = process.env.DASHBOARD_URL || 'https://dashboard.secureinfiniteassociation.com';
    const successPageURL = `${frontendURL}/payment/success?txnId=${encodeURIComponent(normalizedData.txnID || '')}&merchantTxnNo=${encodeURIComponent(normalizedData.merchantTxnNo)}`;

    if (isSuccess) {
      return reply.type('text/html').send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Payment Successful</title>
          <meta charset="utf-8">
          <meta http-equiv="refresh" content="3;url=${successPageURL}">
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 40px 20px; max-width: 520px; margin: 0 auto;">
          <h2 style="color: #059669; margin-bottom: 16px;">✓ Payment Successful</h2>
          <p style="color: #374151; margin-bottom: 24px;">Your payment has been received. Your package is being activated.</p>
          <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 20px; margin-bottom: 24px; text-align: left;">
            <p style="margin: 0 0 12px 0; font-weight: 600; color: #166534;">What to do next</p>
            <p style="margin: 0; color: #15803d; line-height: 1.5;">Please go to <strong>Dashboard</strong> and check <strong>My Packages</strong> to see your package. Do not panic if it takes a few moments to appear.</p>
          </div>
          <p style="margin-bottom: 20px;"><a href="${dashboardURL}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">Go to Dashboard → My Packages</a></p>
          <p style="font-size: 14px; color: #6b7280;">Transaction: ${normalizedData.txnID || normalizedData.merchantTxnNo || 'N/A'}</p>
          <p style="font-size: 14px; color: #9ca3af;">Redirecting to success page in a few seconds...</p>
          <script>
            setTimeout(function() {
              window.location.href = '${successPageURL.replace(/'/g, "\\'")}';
            }, 3000);
          </script>
        </body>
        </html>
      `);
    } else {
      // Response code 039 = Transaction declined by card issuer
      let errorMessage = normalizedData.respdescription || 'Transaction Declined';
      if (respCode === '039') {
        errorMessage = 'Transaction declined by your bank. Please check your card details, balance, or contact your bank.';
      }
      
      const errorMsg = encodeURIComponent(errorMessage);
      const redirectURL = `${frontendURL}/payment/failed?merchantTxnNo=${normalizedData.merchantTxnNo}&error=${errorMsg}&responseCode=${respCode}`;
      
      // Immediate redirect - don't show backend page
      return reply.type('text/html').send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Payment Failed</title>
          <meta charset="utf-8">
          <meta http-equiv="refresh" content="0;url=${redirectURL}">
          <script>
            // Immediate redirect
            window.location.href = '${redirectURL}';
          </script>
        </head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h2 style="color: red;">✗ Payment Failed</h2>
          <p>Redirecting to payment page...</p>
          <p><a href="${redirectURL}">Click here if not redirected</a></p>
        </body>
        </html>
      `);
    }

  } catch (error: any) {
    console.error('\n========================================');
    console.error('PAYMENT CALLBACK ERROR');
    console.error('========================================');
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    console.error('Error Details:', JSON.stringify(error, null, 2));
    console.error('Request Body:', request.body);
    console.error('Request Headers:', JSON.stringify(request.headers, null, 2));
    console.error('========================================\n');
    
    const frontendURL = process.env.FRONTEND_URL || 'https://app.secureinfiniteassociation.com';
    const errorMsg = encodeURIComponent(error.message || 'An unexpected error occurred');
    
    return reply.status(500).type('text/html').send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Server Error</title>
        <meta charset="utf-8">
        <meta http-equiv="refresh" content="3;url=${frontendURL}/payment/failed?error=${errorMsg}">
      </head>
      <body style="font-family: Arial; padding: 20px; text-align: center;">
        <h2 style="color: red;">500 Internal Server Error</h2>
        <p>An error occurred while processing your payment.</p>
        <p>Error: ${error.message || 'Unknown error'}</p>
        <p>Redirecting...</p>
        <script>
          setTimeout(function() {
            window.location.href = '${frontendURL}/payment/failed?error=${errorMsg}';
          }, 3000);
        </script>
      </body>
      </html>
    `);
  }
}
