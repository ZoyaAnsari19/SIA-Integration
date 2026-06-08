import { FastifyInstance } from 'fastify';
import { requireUser } from '../middleware/jwt.js';
import { prisma } from '../config/prisma.js';
import { bunnyCDNService } from '../modules/bunny-cdn/bunny-cdn.service.js';
import { CommissionService } from '../modules/commissions/commission.service.js';
import { getMinReinvestmentAmount, getMinReinvestmentMessage } from '../utils/reinvestmentMinAmount.js';

// Allowed image MIME types for payment proof
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE_MB = 10;

export async function manualDepositRoutes(app: FastifyInstance) {
  // POST /api/v1/deposit/payment-proof - Upload payment proof image (does NOT update profile photo)
  app.post(
    '/payment-proof',
    {
      preHandler: [requireUser],
      schema: {
        description: 'Upload payment proof image to Bunny CDN. This does NOT update profile photo.',
        tags: ['Deposit'],
        consumes: ['multipart/form-data'],
        response: {
          200: {
            type: 'object',
            properties: {
              payment_proof_url: { type: 'string', description: 'CDN URL of uploaded payment proof' },
              uploaded_at: { type: 'string', format: 'date-time' },
            },
          },
          400: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = BigInt((request as any).user.user_id);

        // Get uploaded file from multipart/form-data
        const data = await request.file();

        if (!data) {
          return reply.code(400).send({ message: 'No file uploaded' });
        }

        // Validate file type
        if (!bunnyCDNService.isValidFileType(data.mimetype, ALLOWED_IMAGE_TYPES)) {
          return reply.code(400).send({
            message: 'Invalid file type. Allowed: JPG, PNG, GIF, WebP',
          });
        }

        // Read file buffer
        const fileBuffer = await data.toBuffer();

        // Validate file size
        if (!bunnyCDNService.isValidFileSize(fileBuffer.length, MAX_FILE_SIZE_MB)) {
          return reply.code(400).send({
            message: `File too large. Maximum size: ${MAX_FILE_SIZE_MB}MB`,
          });
        }

        // Generate unique filename for payment proof
        const timestamp = Date.now();
        const extension = data.filename.split('.').pop() || 'jpg';
        const filename = `payment_proof_${userId}_${timestamp}.${extension}`;

        // Upload to Bunny CDN in payment_proofs folder (NOT profile_photos)
        const cdnUrl = await bunnyCDNService.uploadFile(
          fileBuffer,
          filename,
          'payment_proofs'
        );

        return reply.send({
          payment_proof_url: cdnUrl,
          uploaded_at: new Date().toISOString(),
        });
      } catch (error: any) {
        console.error('Payment proof upload error:', error);
        return reply.code(500).send({
          message: 'Failed to upload payment proof',
        });
      }
    }
  );

  // POST /api/v1/deposit/manual - Submit manual deposit request (JSON with pre-uploaded image URL)
  app.post(
    '/manual',
    {
      preHandler: [requireUser],
      schema: {
        description: 'Submit manual deposit payment details for admin approval (JSON body with pre-uploaded payment proof URL)',
        tags: ['Deposit'],
        body: {
          type: 'object',
          required: ['package_id', 'amount', 'request_type', 'utr_number', 'payment_proof_url'],
          properties: {
            package_id: { type: 'number' },
            previous_package_id: { type: 'number', description: 'For renewals: package_id of expired package being renewed/upgraded' },
            previous_purchase_id: { type: 'string', description: 'For renewals: purchase_id of the exact expired purchase being renewed/upgraded' },
            amount: { type: 'number' },
            request_type: { type: 'string', enum: ['activation', 'renew', 'reinvestment'] },
            utr_number: { type: 'string' },
            payment_proof_url: { type: 'string' },
            payment_type: { type: 'string' },
            remarks: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              user_id: { type: 'string' },
              package_id: { type: 'number' },
              request_type: { type: 'string' },
              amount: { type: 'number' },
              status: { type: 'string' },
              txn_id: { type: 'string' },
              payment_proof_url: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
              message: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = BigInt((request as any).user.user_id);

        // Parse JSON body
        const body = request.body as any;

        const packageId = parseInt(body.package_id);
        const previousPackageId = body.previous_package_id ? parseInt(body.previous_package_id) : null;
        const previousPurchaseId = body.previous_purchase_id ? BigInt(body.previous_purchase_id) : null;
        const amount = parseFloat(body.amount);
        const requestType = body.request_type as 'activation' | 'renew' | 'reinvestment';
        const utrNumber = body.utr_number;
        const paymentProofUrl = body.payment_proof_url;
        const paymentType = body.payment_type || 'bank_transfer';
        const remarks = body.remarks || null;

        // Validations
        if (!packageId || isNaN(packageId)) {
          return reply.code(400).send({ message: 'Valid package_id is required' });
        }

        if (!amount || isNaN(amount) || amount <= 0) {
          return reply.code(400).send({ message: 'Valid amount is required' });
        }

        if (!requestType || !['activation', 'renew', 'reinvestment'].includes(requestType)) {
          return reply.code(400).send({
            message: 'Valid request_type is required (activation, renew, reinvestment)',
          });
        }

        if (!utrNumber) {
          return reply.code(400).send({ message: 'UTR number is required' });
        }

        if (!paymentProofUrl) {
          return reply.code(400).send({ message: 'Payment proof URL is required' });
        }

        // Check if package exists
        const packageExists = await prisma.packages.findUnique({
          where: { id: packageId },
          select: { id: true, price: true, status: true },
        });

        if (!packageExists) {
          return reply.code(404).send({ message: 'Package not found' });
        }

        if (packageExists.status !== 'active') {
          return reply.code(400).send({ message: 'Package is not active' });
        }

        // Validate amount matches package price (allow some tolerance)
        const packagePrice = Number(packageExists.price);
        if (Math.abs(amount - packagePrice) > 1) {
          return reply.code(400).send({
            message: `Amount must match package price: ₹${packagePrice}`,
          });
        }

        // Validate request_type against user's purchase history
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (requestType === 'activation') {
          // Check: User has NO purchases OR all purchases expired AND 2x
          const allPurchases = await prisma.purchases.findMany({
            where: {
              user_id: userId,
              status: 'completed',
            },
          });

          if (allPurchases.length > 0) {
            // Check if any purchase is active (not expired, not 2x)
            const hasActive = await CommissionService.hasActiveCourse(userId, today);
            if (hasActive) {
              return reply.code(400).send({
                message: 'Cannot create activation request. User has active purchase. Use "reinvestment" or "renew" instead.',
              });
            }

            // Check if all purchases reached 2x
            let allReached2x = true;
            for (const purchase of allPurchases) {
              const is2xReached = await CommissionService.isPurchaseDoubleReached(purchase.id as unknown as bigint);
              if (!is2xReached) {
                allReached2x = false;
                break;
              }
            }

            if (!allReached2x) {
              return reply.code(400).send({
                message: 'Cannot create activation request. User has purchases that have not reached 2x. Use "reinvestment" or "renew" instead.',
              });
            }
          }
        }

        if (requestType === 'renew') {
          // Check: User has expired OR 2x reached purchase
          const { isRenewal } = await CommissionService.checkIfRenewal(userId);
          if (!isRenewal) {
            return reply.code(400).send({
              message: 'Cannot create renew request. No expired or 2x reached purchase found. Use "activation" or "reinvestment" instead.',
            });
          }

          // If previous_purchase_id is provided, validate it belongs to user and is expired (2x reached)
          if (previousPurchaseId !== null) {
            const prevPurchase = await prisma.purchases.findUnique({
              where: { id: previousPurchaseId },
              select: { id: true, user_id: true, amount: true, income: true, status: true },
            });

            if (!prevPurchase || prevPurchase.user_id.toString() !== userId.toString()) {
              return reply.code(400).send({
                message: 'Invalid previous_purchase_id. Purchase not found for this user.',
              });
            }

            const is2xReached = prevPurchase.status === 'completed' &&
              Number(prevPurchase.income || 0) >= Number(prevPurchase.amount) * 2;

            if (!is2xReached) {
              return reply.code(400).send({
                message: 'Invalid previous_purchase_id. Selected purchase is not expired (2x not reached).',
              });
            }
          }
        }

        if (requestType === 'reinvestment') {
          // Check: User has active purchase (not expired, not 2x)
          const hasActive = await CommissionService.hasActiveCourse(userId, today);
          if (!hasActive) {
            return reply.code(400).send({
              message: 'Cannot create reinvestment request. No active purchase found. Use "activation" or "renew" instead.',
            });
          }
          // Reinvestment min amount: 2× last Main withdrawal OR 50% of current package (if never withdrew from Main)
          const minReinvest = await getMinReinvestmentAmount(userId);
          if (minReinvest.minAmount > 0 && amount < minReinvest.minAmount) {
            return reply.code(400).send({
              message: getMinReinvestmentMessage(minReinvest),
            });
          }
        }

        // Check if user already has a pending purchase request
        const existingPendingRequest = await prisma.purchase_requests.findFirst({
          where: {
            user_id: userId,
            status: 'pending',
          },
        });

        if (existingPendingRequest) {
          return reply.code(400).send({
            message: 'You already have a pending purchase request. Please wait for admin approval or rejection before creating a new request.',
          });
        }

        // Create purchase request with pre-uploaded payment proof URL
        const purchaseRequest = await prisma.purchase_requests.create({
          data: {
            user_id: userId,
            package_id: packageId,
            previous_package_id: previousPackageId,
            previous_purchase_id: previousPurchaseId,
            request_type: requestType,
            amount: amount.toString(),
            status: 'pending',
            txn_id: utrNumber,
            payment_proof_url: paymentProofUrl, // Already uploaded via /deposit/payment-proof
            payment_type: paymentType,
            remarks,
          },
        });

        return reply.send({
          id: purchaseRequest.id.toString(),
          user_id: purchaseRequest.user_id.toString(),
          package_id: purchaseRequest.package_id,
          request_type: purchaseRequest.request_type,
          amount: Number(purchaseRequest.amount),
          status: purchaseRequest.status,
          txn_id: purchaseRequest.txn_id || '',
          payment_proof_url: purchaseRequest.payment_proof_url || '',
          created_at: purchaseRequest.created_at.toISOString(),
          message: 'Payment request submitted successfully. Admin will review and approve.',
        });
      } catch (error) {
        console.error('Manual deposit error:', error);
        return reply.code(500).send({
          message: 'Failed to submit payment request',
        });
      }
    }
  );

  // GET /api/v1/deposit/check-utr - Check if UTR number already exists
  app.get(
    '/check-utr',
    {
      preHandler: [requireUser],
      schema: {
        description: 'Check if UTR number is already used by any user',
        tags: ['Deposit'],
        querystring: {
          type: 'object',
          required: ['utr_number'],
          properties: {
            utr_number: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              exists: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const query = request.query as any;
        const utrNumber = query.utr_number;

        if (!utrNumber || utrNumber.trim() === '') {
          return reply.code(400).send({ 
            exists: false,
            message: 'UTR number is required' 
          });
        }

        // Check if UTR exists in purchase_requests or purchases tables
        const [requestExists, purchaseExists] = await Promise.all([
          prisma.purchase_requests.findFirst({
            where: { txn_id: utrNumber.trim() },
            select: { id: true, user_id: true },
          }),
          prisma.purchases.findFirst({
            where: { txn_id: utrNumber.trim() },
            select: { id: true, user_id: true },
          }),
        ]);

        const exists = !!(requestExists || purchaseExists);

        return reply.send({
          exists,
          message: exists 
            ? 'This UTR number has already been used. Please use a different UTR number.' 
            : 'UTR number is available',
        });
      } catch (error: any) {
        console.error('Check UTR error:', error);
        return reply.code(500).send({
          exists: false,
          message: 'Failed to check UTR number',
        });
      }
    }
  );
}

