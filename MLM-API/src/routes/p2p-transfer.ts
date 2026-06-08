import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../middleware/jwt.js';
import { prisma } from '../config/prisma.js';
import { EmailService } from '../modules/email/emailService.js';

const P2P_OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const p2pOtpStore = new Map<string, { otp: string; expiresAt: number; email: string }>();

export async function p2pTransferRoutes(app: FastifyInstance) {
  // POST /api/v1/transfer/p2p/send-otp - Send P2P transfer OTP to user's registered email
  app.post(
    '/p2p/send-otp',
    {
      preHandler: [requireUser],
      schema: {
        description: 'Send P2P transfer OTP to registered email (replaces SMS OTP)',
        tags: ['Transfer'],
      },
    },
    async (request, reply) => {
      try {
        const userId = BigInt((request as any).user.user_id);

        const user = await prisma.users.findUnique({
          where: { id: userId },
          select: { id: true, email: true, status: true },
        });

        if (!user) {
          return reply.code(404).send({ success: false, message: 'User not found' });
        }

        if (user.status !== 'active') {
          return reply.code(403).send({ success: false, message: 'Your account is not active' });
        }

        const email = (user.email || '').trim();
        if (!email) {
          return reply.code(400).send({
            success: false,
            message: 'No email on your profile. Please add an email before P2P transfer.',
          });
        }

        if (!EmailService.isConfigured()) {
          return reply.code(503).send({
            success: false,
            message: 'Email OTP service is not configured. Please contact support.',
          });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + P2P_OTP_TTL_MS;
        p2pOtpStore.set(userId.toString(), { otp, expiresAt, email });

        const sendResult = await EmailService.sendP2PTransferOTP(email, otp);
        if (!sendResult.success) {
          p2pOtpStore.delete(userId.toString());
          return reply.code(500).send({
            success: false,
            message: sendResult.error || 'Failed to send OTP email. Please try again.',
          });
        }

        if (process.env.NODE_ENV !== 'production') {
          console.log(`[P2P OTP] Dev OTP for user ${userId}: ${otp}`);
        }

        return reply.send({
          success: true,
          message: 'OTP sent to your registered email address',
          email_masked: EmailService.maskEmail(email),
        });
      } catch (error: any) {
        console.error('[P2P OTP] send-otp error:', error);
        return reply.code(500).send({ success: false, message: 'Failed to send OTP' });
      }
    }
  );

  // GET /api/v1/transfer/rules - Get transfer rules (tax percentage)
  app.get(
    '/rules',
    {
      preHandler: [requireUser],
      schema: {
        description: 'Get P2P transfer rules (tax percentage)',
        tags: ['Transfer'],
        response: {
          200: {
            type: 'object',
            properties: {
              transfer_amt_tax: { type: 'number', description: 'Transfer tax percentage (e.g., 2.5 = 2.5%)' },
              min_transfer_amt: { type: 'number', description: 'Minimum transfer amount' },
              max_transfer_amt: { type: 'number', nullable: true, description: 'Maximum transfer amount (null = no limit)' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        // Get transfer rules (active, latest)
        const transferRules = await prisma.withdrawal_transfer_rules.findFirst({
          where: { is_active: true },
          orderBy: { created_at: 'desc' },
        });

        if (!transferRules) {
          return reply.send({
            transfer_amt_tax: 0,
            min_transfer_amt: 10,
            max_transfer_amt: null,
          });
        }

        return reply.send({
          transfer_amt_tax: Number(transferRules.transfer_amt_tax),
          min_transfer_amt: Number(transferRules.min_transfer_amt),
          max_transfer_amt: transferRules.max_transfer_amt ? Number(transferRules.max_transfer_amt) : null,
        });
      } catch (error: any) {
        return reply.code(500).send({ error: 'internal_server_error', message: error.message });
      }
    }
  );

  // POST /api/v1/transfer/p2p - P2P wallet transfer
  app.post(
    '/p2p',
    {
      preHandler: [requireUser],
      schema: {
        description: 'Transfer wallet amount to another user (P2P)',
        tags: ['Transfer'],
        body: {
          type: 'object',
          required: ['receiver_id', 'amount', 'from_wallet', 'transaction_password', 'otp'],
          properties: {
            receiver_id: { type: 'string' },
            amount: { type: 'number', minimum: 0 },
            from_wallet: { type: 'string', enum: ['other'] }, // P2P transfers only allowed from Main wallet (other)
            remarks: { type: 'string' },
            transaction_password: { type: 'string' },
            otp: { type: 'string', pattern: '^[0-9]{6}$' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              sender_id: { type: 'string' },
              receiver_id: { type: 'string' },
              amount: { type: 'number' },
              tax_amount: { type: 'number' },
              net_amount: { type: 'number' },
              status: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
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
        const body = z.object({
          receiver_id: z.string().min(1),
          amount: z.number().positive(),
          from_wallet: z.literal('other'),
          remarks: z.string().optional(),
          transaction_password: z.string().min(1),
          otp: z.string().regex(/^[0-9]{6}$/, 'OTP must be 6 digits'),
        }).parse(request.body);

        const { receiver_id, amount, from_wallet, remarks, transaction_password, otp } = body;

        const storedOtp = p2pOtpStore.get(userId.toString());
        if (!storedOtp) {
          return reply.code(400).send({ message: 'OTP not found. Please request a new OTP.' });
        }
        if (Date.now() > storedOtp.expiresAt) {
          p2pOtpStore.delete(userId.toString());
          return reply.code(400).send({ message: 'OTP expired. Please request a new OTP.' });
        }
        if (storedOtp.otp !== otp) {
          return reply.code(400).send({ message: 'Invalid OTP. Please check and try again.' });
        }
        p2pOtpStore.delete(userId.toString());

        // Try to find receiver by numeric ID, display_id, or email
        let receiver = null;
        let receiverId: bigint | null = null;

        // Try as numeric ID first
        const receiverIdNum = parseInt(receiver_id, 10);
        if (!isNaN(receiverIdNum)) {
          receiverId = BigInt(receiverIdNum);
          receiver = await prisma.users.findUnique({
            where: { id: receiverId },
          });
        }

        // If not found, try as display_id
        if (!receiver) {
          receiver = await prisma.users.findUnique({
            where: { display_id: receiver_id },
          });
          if (receiver) {
            receiverId = receiver.id;
          }
        }

        // If still not found, try as email
        if (!receiver) {
          receiver = await prisma.users.findFirst({
            where: { email: receiver_id },
          });
          if (receiver) {
            receiverId = receiver.id;
          }
        }

        if (!receiver || !receiverId) {
          return reply.code(404).send({ message: 'Receiver not found' });
        }

        // Validation: Cannot transfer to self
        if (receiverId === userId) {
          return reply.code(400).send({ message: 'Cannot transfer to yourself' });
        }

        // Validation: P2P transfers are only allowed from Main wallet (other) to Main wallet
        if (from_wallet !== 'other') {
          return reply.code(400).send({ 
            message: 'P2P transfers are only allowed from Main wallet. SPOT wallet transfers are not permitted.' 
          });
        }

        // Check if both users exist and verify transaction password
        const [sender, receiverUser] = await Promise.all([
          prisma.users.findUnique({
            where: { id: userId },
            select: { id: true, transaction_pin: true, kyc_status: true },
          }),
          prisma.users.findUnique({
            where: { id: receiverId },
            select: { id: true, kyc_status: true },
          }),
        ]);

        // Check if transaction password is set
        if (!sender || !sender.transaction_pin) {
          return reply.code(400).send({
            message: 'Transaction password is required for transfers. Please set your transaction password first.',
          });
        }

        // Check if sender exists
        if (!sender) {
          return reply.code(404).send({ message: 'Sender not found' });
        }

        // Check if transaction password is set
        if (!sender.transaction_pin) {
          return reply.code(400).send({
            message: 'Transaction password is required for transfers. Please set your transaction password first.',
          });
        }

        // Verify transaction password (trim both to handle whitespace issues)
        const storedPin = (sender.transaction_pin || '').trim();
        const providedPin = (transaction_password || '').trim();
        
        if (storedPin !== providedPin) {
          return reply.code(400).send({
            message: 'Transaction password is incorrect',
          });
        }

        // Check if receiver exists
        if (!receiverUser) {
          return reply.code(404).send({ message: 'Receiver not found' });
        }

        // Validation: Both must be KYC approved (check users.kyc_status, not kyc_documents)
        if (sender.kyc_status !== 'approved') {
          return reply.code(400).send({
            message: 'Your KYC must be approved to transfer funds',
          });
        }

        if (receiverUser.kyc_status !== 'approved') {
          return reply.code(400).send({
            message: 'Receiver must have approved KYC to receive funds',
          });
        }

        // Validation: If sender has a pending withdrawal request, block P2P transfers
        const pendingWithdrawal = await prisma.withdraw_requests.findFirst({
          where: {
            user_id: userId,
            status: 'pending',
          },
          select: { id: true },
        });

        if (pendingWithdrawal) {
          return reply.code(400).send({
            message: 'P2P transfer is not allowed while you have a pending withdrawal request. Please wait for it to be processed.',
          });
        }

        // Get transfer rules (active, latest)
        const transferRules = await prisma.withdrawal_transfer_rules.findFirst({
          where: { is_active: true },
          orderBy: { updated_at: 'desc' },
        });

        if (!transferRules) {
          return reply.code(500).send({ message: 'Transfer rules not configured' });
        }

        // Validate amount against min/max transfer limits
        const minTransfer = Number(transferRules.min_transfer_amt);
        const maxTransfer =
          transferRules.max_transfer_amt === null
            ? null
            : Number(transferRules.max_transfer_amt);

        if (amount < minTransfer) {
          return reply.code(400).send({
            message: `Minimum transfer amount is ₹${minTransfer}`,
          });
        }

        if (maxTransfer !== null && amount > maxTransfer) {
          return reply.code(400).send({
            message: `Maximum transfer amount is ₹${maxTransfer}`,
          });
        }

        // Calculate tax - tax is deducted from sender, receiver gets full amount
        const taxPercent = Number(transferRules.transfer_amt_tax);
        const taxAmount = (amount * taxPercent) / 100;
        const totalDeducted = amount + taxAmount; // Total to deduct from sender (amount + tax)

        // Check sender balance in Main wallet (P2P transfers only from Main wallet)
        const senderBalance = await prisma.user_balances.findUnique({
          where: { user_id: userId },
          select: { other_balance: true },
        });

        const availableBalance = Number(senderBalance?.other_balance || 0);

        // Check if sender has enough balance for amount + tax
        if (totalDeducted > availableBalance) {
          return reply.code(400).send({
            message: `Insufficient Main wallet balance. Required: ₹${totalDeducted.toFixed(2)} (₹${amount.toFixed(2)} + ₹${taxAmount.toFixed(2)} tax). Available: ₹${availableBalance.toFixed(2)}`,
          });
        }

        // Perform transfer in a transaction
        const transfer = await prisma.$transaction(async (tx) => {
          // Deduct from sender's Main wallet: amount + tax (total deducted)
          await tx.$executeRawUnsafe(
            `UPDATE user_balances 
             SET balance = balance - $1, 
                 other_balance = other_balance - $1, 
                 updated_at = now() 
             WHERE user_id = $2`,
            totalDeducted,
            userId
          );

          // Credit to receiver's other_balance only (full amount, no tax deduction)
          await tx.user_balances.upsert({
            where: { user_id: receiverId },
            update: { updated_at: new Date() },
            create: {
              user_id: receiverId,
              balance: 0,
              spot_balance: 0,
              other_balance: 0,
            },
          });

          await tx.$executeRawUnsafe(
            `UPDATE user_balances 
             SET balance = balance + $1, 
                 other_balance = other_balance + $1, 
                 updated_at = now() 
             WHERE user_id = $2`,
            amount, // Full amount to receiver (no tax deduction)
            receiverId
          );

          // Create ledger entries for transfer tracking
          // Sender debit: transfer amount
          await tx.ledger_entries.create({
            data: {
              receiver_user_id: userId,
              source_user_id: userId,
              purchase_id: null,
              commission_type: 'FEE_DEDUCTION',
              amount: -amount,
              metadata: {
                transfer_type: 'p2p_transfer',
                to_user_id: receiverId.toString(),
                from_wallet: from_wallet,
                wallet_type: 'other_balance',
              } as any,
              idempotency_key: `p2p:${userId}:${receiverId}:${Date.now()}:amount`,
            },
          });

          // Sender debit: tax amount
          if (taxAmount > 0) {
            await tx.ledger_entries.create({
              data: {
                receiver_user_id: userId,
                source_user_id: userId,
                purchase_id: null,
                commission_type: 'FEE_DEDUCTION',
                amount: -taxAmount,
                metadata: {
                  transfer_type: 'p2p_transfer_tax',
                  to_user_id: receiverId.toString(),
                  from_wallet: from_wallet,
                  wallet_type: 'other_balance',
                  tax_percent: taxPercent,
                } as any,
                idempotency_key: `p2p:${userId}:${receiverId}:${Date.now()}:tax`,
              },
            });
          }

          // Receiver credit (full amount, no tax deduction)
          await tx.ledger_entries.create({
            data: {
              receiver_user_id: receiverId,
              source_user_id: userId,
              purchase_id: null,
              commission_type: 'FEE_DEDUCTION', // Using FEE_DEDUCTION type but positive amount
              amount: amount, // Full amount to receiver
              metadata: {
                transfer_type: 'p2p_transfer',
                from_user_id: userId.toString(),
                wallet_type: 'other_balance', // Always goes to other_balance
              } as any,
              idempotency_key: `p2p:${userId}:${receiverId}:${Date.now()}:to`,
            },
          });

          // Create wallet transfer record
          const walletTransfer = await tx.wallet_transfers.create({
            data: {
              from_user_id: userId,
              to_user_id: receiverId,
              amount, // Transfer amount (receiver gets this full amount)
              tax_amount: taxAmount, // Tax deducted from sender
              net_amount: amount, // Net amount to receiver (same as amount, no tax deduction)
              status: 'completed',
              remarks: remarks || null,
            },
          });

          return walletTransfer;
        });

        return reply.send({
          id: transfer.id.toString(),
          sender_id: transfer.from_user_id.toString(),
          receiver_id: transfer.to_user_id.toString(),
          amount: Number(transfer.amount),
          tax_amount: Number(transfer.tax_amount),
          net_amount: Number(transfer.net_amount),
          status: transfer.status,
          created_at: transfer.created_at.toISOString(),
        });
      } catch (error) {
        console.error('P2P transfer error:', error);
        return reply.code(500).send({
          message: 'Failed to process transfer',
        });
      }
    }
  );

  // GET /api/v1/transfer/history - Transfer history
  app.get(
    '/history',
    {
      preHandler: [requireUser],
      schema: {
        description: 'Get P2P transfer history',
        tags: ['Transfer'],
        querystring: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['sent', 'received', 'all'], default: 'all' },
            page: { type: 'number', minimum: 1, default: 1 },
            limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              count: { type: 'number' },
              page: { type: 'number' },
              total: { type: 'number' },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    type: { type: 'string' },
                    sender_id: { type: 'string' },
                    sender_name: { type: 'string' },
                    sender_display_id: { type: ['string', 'null'] },
                    receiver_id: { type: 'string' },
                    receiver_name: { type: 'string' },
                    receiver_display_id: { type: ['string', 'null'] },
                    amount: { type: 'number' },
                    tax_amount: { type: 'number' },
                    net_amount: { type: 'number' },
                    remarks: { type: ['string', 'null'] },
                    created_at: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = BigInt((request as any).user.user_id);
        const { type = 'all', page = 1, limit = 20 } = request.query as {
          type?: 'sent' | 'received' | 'all';
          page?: number;
          limit?: number;
        };

        const skip = (page - 1) * limit;

        // Build where clause based on type
        const where: any = {};
        if (type === 'sent') {
          where.from_user_id = userId;
        } else if (type === 'received') {
          where.to_user_id = userId;
        } else {
          where.OR = [{ from_user_id: userId }, { to_user_id: userId }];
        }

        // Get total count
        const total = await prisma.wallet_transfers.count({ where });

        // Get transfers
        const transfers = await prisma.wallet_transfers.findMany({
          where,
          orderBy: { created_at: 'desc' },
          skip,
          take: limit,
        });

        // Get user details for all unique user IDs
        const userIds = new Set<bigint>();
        transfers.forEach((t) => {
          userIds.add(t.from_user_id);
          userIds.add(t.to_user_id);
        });

        const users = await prisma.users.findMany({
          where: { id: { in: Array.from(userIds) } },
          select: { id: true, name: true, display_id: true },
        });

        const userMap = new Map(users.map((u) => [u.id.toString(), { name: u.name, display_id: u.display_id }]));

        const items = transfers.map((transfer) => {
          const sender = userMap.get(transfer.from_user_id.toString());
          const receiver = userMap.get(transfer.to_user_id.toString());
          
          return {
            id: transfer.id.toString(),
            type: transfer.from_user_id === userId ? 'sent' : 'received',
            sender_id: transfer.from_user_id.toString(),
            sender_name: sender?.name || null,
            sender_display_id: sender?.display_id || null,
            receiver_id: transfer.to_user_id.toString(),
            receiver_name: receiver?.name || null,
            receiver_display_id: receiver?.display_id || null,
            amount: Number(transfer.amount),
            tax_amount: Number(transfer.tax_amount),
            net_amount: Number(transfer.net_amount),
            remarks: transfer.remarks,
            created_at: transfer.created_at.toISOString(),
          };
        });

        return reply.send({
          count: items.length,
          page,
          total,
          items,
        });
      } catch (error) {
        console.error('Transfer history error:', error);
        return reply.code(500).send({
          message: 'Failed to fetch transfer history',
        });
      }
    }
  );
}


