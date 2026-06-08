import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import jwt, { Secret } from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { requireUser } from '../middleware/jwt.js';
import { FeeService } from '../modules/fees/feeService.js';
import { Fast2SMSService } from '../modules/sms/fast2smsService.js';
import { EmailService } from '../modules/email/emailService.js';

// Password change email OTP (key: userId string)
const passwordChangeOtpStore = new Map<string, { otp: string; expiresAt: number }>();
const PASSWORD_CHANGE_OTP_TTL_MS = 10 * 60 * 1000;

// In-memory OTP store for name change (for development - use Redis in production)
// Key format: `${userId}:${mobile}` to ensure consistency across pods
const nameChangeOtpStore = new Map<string, { otp: string; expiresAt: number; mobile: string }>();
// Name change verification store - stores verification token after OTP verification
const nameChangeVerificationStore = new Map<string, { verified: boolean; expiresAt: number }>();

// In-memory OTP store for forgot transaction PIN (for development - use Redis in production)
const forgotTransactionPinOtpStore = new Map<string, { otp: string; expiresAt: number }>();
// Forgot transaction PIN reset token store - stores reset token after OTP verification
const forgotTransactionPinStore = new Map<string, { resetToken: string; expiresAt: number }>();

export async function profileRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/profile:
   *   get:
   *     tags:
   *       - Profile
   *     summary: Get user profile details
   *     description: |
   *       Retrieve complete profile information for the authenticated user including
   *       personal details, KYC status, referrer information, and statistics.
   *     operationId: getProfile
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: Profile retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                   example: "10"
   *                 name:
   *                   type: string
   *                   nullable: true
   *                   example: "John Doe"
   *                 email:
   *                   type: string
   *                   nullable: true
   *                   example: "john@example.com"
   *                 kyc_status:
   *                   type: string
   *                   enum: [pending, submitted, approved, rejected]
   *                   example: "approved"
   *                 kyc_verified_at:
   *                   type: string
   *                   format: date-time
   *                   nullable: true
   *                   example: "2025-11-08T10:00:00.000Z"
   *                 referrer_user_id:
   *                   type: string
   *                   nullable: true
   *                   example: "9"
   *                 referrer_name:
   *                   type: string
   *                   nullable: true
   *                   example: "Sponsor Name"
   *                 created_at:
   *                   type: string
   *                   format: date-time
   *                   example: "2025-11-08T11:43:03.027Z"
   *                 stats:
   *                   type: object
   *                   properties:
   *                     direct_referrals:
   *                       type: number
   *                       example: 5
   *                     total_team_size:
   *                       type: number
   *                       example: 25
   *                     total_purchases:
   *                       type: number
   *                       example: 3
   *                     wallet_balance:
   *                       type: number
   *                       example: 5000.00
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.get('/', {
    preHandler: requireUser,
  }, async (req, reply) => {
    try {
      const id = BigInt((req as any).user.user_id);
      
      const user = await prisma.users.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          display_title: true,
          display_title_icon_url: true,
          email: true,
          phone: true,
          kyc_status: true,
          kyc_verified_at: true,
          referrer_user_id: true,
          created_at: true,
        },
      });

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Get referrer name and display_id if exists
      let referrerName = null;
      let referrerDisplayId = null;
      if (user.referrer_user_id) {
        const referrer = await prisma.users.findUnique({
          where: { id: user.referrer_user_id },
          select: { name: true, display_id: true },
        });
        referrerName = referrer?.name ?? null;
        referrerDisplayId = referrer?.display_id ?? null;
      }

      // Get stats and profile
      const [directReferrals, totalTeamSize, totalPurchases, wallet, userProfile, kycFeeRule] = await Promise.all([
        prisma.user_tree_paths.count({ where: { ancestor_id: id, depth: 1 } }),
        prisma.user_tree_paths.count({ where: { ancestor_id: id, depth: { gt: 0, lte: 9 } } }),
        prisma.purchases.count({ where: { user_id: id } }),
        prisma.user_balances.findUnique({ where: { user_id: id }, select: { balance: true } }),
        prisma.user_profiles.findUnique({ where: { user_id: id } }),
        FeeService.getFeeRule('KYC_SUBMISSION'),
      ]);

      // Get KYC documents to find rejection reason if any
      const kycDocuments = await prisma.kyc_documents.findMany({
        where: { user_id: id },
        select: {
          id: true,
          document_type: true,
          status: true,
          rejection_reason: true,
        },
        orderBy: { submitted_at: 'desc' },
        take: 1, // Get latest document
      });

      // Find rejection reason from latest rejected document
      const latestRejectedDoc = kycDocuments.find(doc => doc.status === 'rejected' && doc.rejection_reason);
      const rejectionReason = latestRejectedDoc?.rejection_reason || null;

      // Prioritize phone from user_profiles (KYC data) over users table
      const displayPhone = userProfile?.phone || user.phone;

      return reply.send({
        id: user.id.toString(),
        name: user.name,
        display_title: user.display_title ?? null,
        display_title_icon_url: user.display_title_icon_url ?? null,
        email: user.email,
        phone: displayPhone,
        kyc_status: user.kyc_status,
        kyc_verified_at: user.kyc_verified_at,
        kyc_rejection_reason: rejectionReason,
        kyc_fee_amount: kycFeeRule ? Number(kycFeeRule.amount) : 0,
        referrer_user_id: user.referrer_user_id ? user.referrer_user_id.toString() : null,
        referrer_name: referrerName,
        referrer_display_id: referrerDisplayId,
        created_at: user.created_at,
        profile: userProfile ? {
          phone: userProfile.phone,
          profile_photo_url: userProfile.profile_photo_url,
          date_of_birth: userProfile.date_of_birth ? userProfile.date_of_birth.toISOString().split('T')[0] : null,
          address: userProfile.address,
          city: userProfile.city,
          state: userProfile.state,
          pincode: userProfile.pincode,
          bank_account_no: userProfile.bank_account_no,
          bank_ifsc: userProfile.bank_ifsc,
          bank_name: userProfile.bank_name,
          bank_branch: userProfile.bank_branch,
          bank_ac_holder: userProfile.bank_ac_holder,
          bank_upi: userProfile.bank_upi,
          pan_number: userProfile.pan_number,
          aadhar_number: userProfile.aadhar_number,
          nominee_name: userProfile.nominee_name,
          nominee_contact: userProfile.nominee_contact,
          nominee_relation: userProfile.nominee_relation,
        } : null,
        stats: {
          direct_referrals: directReferrals,
          total_team_size: totalTeamSize,
          total_purchases: totalPurchases,
          wallet_balance: wallet ? Number(wallet.balance) : 0,
        },
      });
    } catch (error) {
      console.error('Error getting user details:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/profile:
   *   put:
   *     tags:
   *       - Profile
   *     summary: Update user profile
   *     description: |
   *       Update profile information for the authenticated user.
   *       Users can only update their own profile (name and email).
   *       Note: Referrer cannot be changed after registration.
   *     operationId: updateProfile
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *                 minLength: 1
   *                 example: "John Doe"
   *               email:
   *                 type: string
   *                 format: email
   *                 example: "john@example.com"
   *     responses:
   *       '200':
   *         description: Profile updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                   example: "10"
   *                 name:
   *                   type: string
   *                   example: "John Doe"
   *                 email:
   *                   type: string
   *                   example: "john@example.com"
   *                 message:
   *                   type: string
   *                   example: "Profile updated successfully"
   *       '400':
   *         description: Validation error or email already exists
   *       '404':
   *         description: User not found
   *       '401':
   *         description: Unauthorized
   */
  app.put('/', {
    preHandler: requireUser,
    schema: {
      description: 'Update user profile (name, email)',
      tags: ['Profile'],
      summary: 'Update Profile',
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          email: { type: 'string', format: 'email' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            details: { type: 'array' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const id = BigInt((req as any).user.user_id);

      const body = z.object({
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        name_change_verification_token: z.string().optional(), // Required if name is being changed
        // Address fields
        address: z.string().optional(),
        city: z.string().optional(),
        district: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        pincode: z.string().optional(),
        // Bank fields
        accountHolderName: z.string().optional(),
        accountNumber: z.string().optional(),
        bankName: z.string().optional(),
        branch: z.string().optional(),
        ifscCode: z.string().optional(),
        bank_ifsc: z.string().optional(),
        upiId: z.string().optional(),
        nomineeName: z.string().optional(),
        nomineeContact: z.string().optional(),
        nomineeRelation: z.string().optional(),
      }).parse(req.body);

      // Check if name is being changed and verify OTP
      if (body.name) {
        const [user, userProfile] = await Promise.all([
          prisma.users.findUnique({
            where: { id },
            select: { name: true, phone: true },
          }),
          prisma.user_profiles.findUnique({
            where: { user_id: id },
            select: { phone: true },
          })
        ]);

        // Prioritize phone from user_profiles (KYC data) over users table
        const registeredPhone = userProfile?.phone || user?.phone;

        // Only process if name is actually changing
        if (user?.name !== body.name) {
          // Require OTP verification token for name change
          if (!body.name_change_verification_token) {
            return reply.code(400).send({
              error: 'otp_verification_required',
              message: 'OTP verification is required for name change. Please verify OTP first.'
            });
          }

          // Verify the OTP verification token
          let nameChangeVerified = false;
          try {
            const jwtSecret = process.env.JWT_SECRET as Secret || 'dev-secret';
            const decoded = jwt.verify(body.name_change_verification_token, jwtSecret) as { 
              userId?: string; 
              mobile?: string; 
              verified?: boolean; 
              purpose?: string;
            };
            
            // Compare with registeredPhone (prioritizes user_profiles.phone)
            if (decoded.userId === id.toString() && 
                decoded.mobile === registeredPhone && 
                decoded.verified === true && 
                decoded.purpose === 'name_change') {
              nameChangeVerified = true;
            }
          } catch (err) {
            // Token invalid or expired
            return reply.code(400).send({
              error: 'invalid_verification_token',
              message: 'Name change verification token is invalid or expired. Please verify OTP again.'
            });
          }

          // Also check in-memory store as fallback (use registeredPhone)
          if (!nameChangeVerified && registeredPhone) {
            const verification = nameChangeVerificationStore.get(registeredPhone);
            if (verification && verification.verified && Date.now() <= verification.expiresAt) {
              nameChangeVerified = true;
              // Remove from store after use
              nameChangeVerificationStore.delete(registeredPhone);
            }
          }

          if (!nameChangeVerified) {
            return reply.code(400).send({
              error: 'otp_not_verified',
              message: 'OTP verification failed. Please verify OTP again.'
            });
          }

          // Name change fee will be deducted even if wallet goes negative
          // User will recover from commissions after package activation
          const ALLOW_NEGATIVE_FOR_NAME_CHANGE = true;
          
          // Check fee rule exists and get amount
          const feeCheck = await FeeService.checkFeeApplicable(id, 'NAME_CHANGE', ALLOW_NEGATIVE_FOR_NAME_CHANGE);
          if (!feeCheck.applicable && feeCheck.amount === 0) {
            // Only fail if fee rule doesn't exist
            const error: any = new Error(feeCheck.message || 'Name change fee rule not configured');
            error.code = 'FEE_RULE_NOT_FOUND';
            throw error;
          }

          // Deduct fee - allow negative balance for name change
          // User will recover from commissions after purchasing package
          if (feeCheck.amount > 0) {
            try {
              await FeeService.deductFee(id, 'NAME_CHANGE', null, 'profile_update', ALLOW_NEGATIVE_FOR_NAME_CHANGE);
            } catch (error: any) {
              // Only re-throw if it's not an insufficient balance error
              // (we're allowing negative balance for name change)
              if (error.code !== 'INSUFFICIENT_BALANCE') {
                throw error;
              }
            }
          }
        }
      }

      // Check if any other account details are being changed and deduct fee (ACCOUNT_CHANGE fee)
      // Note: Name changes are handled separately above with NAME_CHANGE fee
      const hasOtherChanges = body.email !== undefined || body.phone !== undefined ||
        body.address !== undefined || body.city !== undefined || body.state !== undefined ||
        body.pincode !== undefined || body.zipCode !== undefined || body.accountNumber !== undefined ||
        body.bankName !== undefined || body.ifscCode !== undefined || body.bank_ifsc !== undefined;

      if (hasOtherChanges) {
        // Check fee applicability for account details change
        const feeCheck = await FeeService.checkFeeApplicable(id, 'ACCOUNT_CHANGE');
        if (!feeCheck.applicable && feeCheck.amount > 0) {
          return reply.code(400).send({
            error: 'INSUFFICIENT_BALANCE',
            message: feeCheck.message || 'Insufficient balance for account details change',
            required_amount: feeCheck.amount,
            available_balance: Number(
              (await prisma.user_balances.findUnique({ where: { user_id: id } }))?.balance || 0
            ),
          });
        }

        // Deduct fee for account details change (if fee > 0)
        if (feeCheck.amount > 0) {
          try {
            await FeeService.deductFee(id, 'ACCOUNT_CHANGE', null, 'account_details_change');
          } catch (error: any) {
            if (error.code === 'INSUFFICIENT_BALANCE') {
              return reply.code(400).send({
                error: 'INSUFFICIENT_BALANCE',
                message: error.message || 'Insufficient balance for account details change',
                required_amount: error.required,
                available_balance: error.available,
              });
            }
            throw error;
          }
        }
      }

      // Users cannot set an email already used by another account (admin override only)
      if (body.email) {
        const existingUser = await prisma.users.findFirst({
          where: {
            email: body.email,
            NOT: { id },
          },
        });
        if (existingUser) {
          return reply.code(400).send({ error: 'Email already exists' });
        }
      }

      // Update users table (display_title is admin-only - not accepted here; user can only view it)
      const userUpdateData: any = {};
      if (body.name !== undefined) userUpdateData.name = body.name;
      if (body.email !== undefined) userUpdateData.email = body.email;
      if (body.phone !== undefined) userUpdateData.phone = body.phone;

      const updated = await prisma.users.update({
        where: { id },
        data: userUpdateData,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      });

      // Update or create user_profiles
      const profileUpdateData: any = {
        updated_at: new Date(),
      };
      
      if (body.address !== undefined) profileUpdateData.address = body.address;
      if (body.city !== undefined) profileUpdateData.city = body.city;
      if (body.state !== undefined) profileUpdateData.state = body.state;
      if (body.pincode !== undefined) profileUpdateData.pincode = body.pincode;
      if (body.zipCode !== undefined) profileUpdateData.pincode = body.zipCode; // zipCode maps to pincode
      if (body.phone !== undefined) profileUpdateData.phone = body.phone;
      
      // Bank fields
      if (body.accountHolderName !== undefined) profileUpdateData.bank_ac_holder = body.accountHolderName;
      if (body.bankName !== undefined) profileUpdateData.bank_name = body.bankName;
      if (body.accountNumber !== undefined) profileUpdateData.bank_account_no = body.accountNumber;
      if (body.branch !== undefined) profileUpdateData.bank_branch = body.branch;
      if (body.ifscCode !== undefined) profileUpdateData.bank_ifsc = body.ifscCode;
      if (body.bank_ifsc !== undefined) profileUpdateData.bank_ifsc = body.bank_ifsc;
      if (body.upiId !== undefined) profileUpdateData.bank_upi = body.upiId;
      // Nominee fields
      if (body.nomineeName !== undefined) profileUpdateData.nominee_name = body.nomineeName;
      if (body.nomineeContact !== undefined) profileUpdateData.nominee_contact = body.nomineeContact;
      if (body.nomineeRelation !== undefined) profileUpdateData.nominee_relation = body.nomineeRelation;

      // Upsert user_profiles (create if doesn't exist, update if exists)
      // NOTE: Some environments may be missing the DB unique constraint on user_profiles.user_id,
      // which breaks Prisma upsert (ON CONFLICT). So do a safe find + update/create.
      const existingProfileRow = await prisma.user_profiles.findFirst({
        where: { user_id: id },
        select: { id: true },
      });
      if (existingProfileRow?.id) {
        await prisma.user_profiles.update({
          where: { id: existingProfileRow.id },
          data: profileUpdateData,
        });
      } else {
        await prisma.user_profiles.create({
          data: { user_id: id, ...profileUpdateData },
        });
      }

      return reply.send({
        id: updated.id.toString(),
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        message: 'Profile updated successfully',
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      if (error.code === 'P2025') {
        return reply.code(404).send({ error: 'User not found' });
      }
      console.error('Error updating user:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/profile/name-change/send-otp:
   *   post:
   *     tags:
   *       - Profile
   *     summary: Send OTP for name change
   *     description: |
   *       Send OTP to user's mobile number for name change verification.
   *       OTP is valid for 10 minutes.
   *     operationId: sendNameChangeOtp
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - mobile
   *             properties:
   *               mobile:
   *                 type: string
   *                 pattern: '^[0-9]{10}$'
   *                 description: 10-digit mobile number
   *                 example: "9876543210"
   *     responses:
   *       '200':
   *         description: OTP sent successfully
   *       '400':
   *         description: Invalid mobile number
   *       '401':
   *         description: Unauthorized
   */
  app.post('/name-change/send-otp', {
    preHandler: requireUser,
    schema: {
      description: 'Send OTP for name change verification',
      tags: ['Profile'],
      summary: 'Send Name Change OTP',
      operationId: 'sendNameChangeOtp',
      body: {
        type: 'object',
        required: ['mobile'],
        properties: {
          mobile: {
            type: 'string',
            pattern: '^[0-9]{10}$',
            description: '10-digit mobile number'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req as any).user.user_id);
      const body = z.object({
        mobile: z.string().regex(/^[0-9]{10}$/, 'Mobile must be 10 digits')
      }).parse(req.body);

      // Verify the mobile number belongs to the authenticated user
      // Check both users.phone and user_profiles.phone (prioritize user_profiles.phone)
      const [user, userProfile] = await Promise.all([
        prisma.users.findUnique({
          where: { id: userId },
          select: { phone: true }
        }),
        prisma.user_profiles.findUnique({
          where: { user_id: userId },
          select: { phone: true }
        })
      ]);

      // Prioritize phone from user_profiles (KYC data) over users table
      const registeredPhone = userProfile?.phone || user?.phone;

      if (!user || registeredPhone !== body.mobile) {
        return reply.code(403).send({
          error: 'unauthorized',
          message: 'Mobile number does not match your account'
        });
      }

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      // Store OTP with userId+mobile key for consistency across pods
      // NOTE: In-memory storage has limitations with multiple pods - consider using Redis in production
      const otpKey = `${userId.toString()}:${body.mobile}`;
      nameChangeOtpStore.set(otpKey, { otp, expiresAt, mobile: body.mobile });
      
      // Also store with mobile-only key for backward compatibility (cleanup after 10 min)
      nameChangeOtpStore.set(body.mobile, { otp, expiresAt, mobile: body.mobile });

      // Send OTP via Fast2SMS (non-blocking - don't wait for SMS to complete)
      console.log(`[Name Change OTP Send] ✅ OTP stored - userId: ${userId}, mobile: ${body.mobile}, key: ${otpKey}, OTP: ${otp}, expiresAt: ${new Date(expiresAt).toISOString()}`);
      
      // Return response immediately, send SMS in background
      reply.send({
        success: true,
        message: 'OTP sent successfully to your mobile number'
      });

      // Send SMS asynchronously (don't await - fire and forget)
      if (Fast2SMSService.isConfigured()) {
        Fast2SMSService.sendNameChangeOTP(body.mobile, otp)
          .then((smsResult) => {
            if (smsResult.success) {
              console.log(`[Name Change OTP] ✅ Fast2SMS sent successfully to ${body.mobile}, Request ID: ${smsResult.requestId}`);
            } else {
              console.error(`[Name Change OTP] ❌ Failed to send OTP via Fast2SMS: ${smsResult.error}`);
            }
          })
          .catch((error: any) => {
            console.error(`[Name Change OTP] ❌ Error sending OTP via Fast2SMS:`, error?.message || error);
          });
      } else {
        console.log(`[Name Change OTP] ⚠️ OTP for ${body.mobile}: ${otp} (Fast2SMS not configured)`);
      }
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      console.error('Error sending name change OTP:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/profile/name-change/verify-otp:
   *   post:
   *     tags:
   *       - Profile
   *     summary: Verify OTP for name change
   *     description: |
   *       Verify OTP sent to mobile number. Returns verification token if successful.
   *     operationId: verifyNameChangeOtp
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - mobile
   *               - otp
   *             properties:
   *               mobile:
   *                 type: string
   *                 pattern: '^[0-9]{10}$'
   *                 description: 10-digit mobile number
   *                 example: "9876543210"
   *               otp:
   *                 type: string
   *                 pattern: '^[0-9]{6}$'
   *                 description: 6-digit OTP
   *                 example: "123456"
   *     responses:
   *       '200':
   *         description: OTP verified successfully
   *       '400':
   *         description: Invalid OTP or expired
   *       '401':
   *         description: Unauthorized
   */
  app.post('/name-change/verify-otp', {
    preHandler: requireUser,
    schema: {
      description: 'Verify OTP for name change',
      tags: ['Profile'],
      summary: 'Verify Name Change OTP',
      operationId: 'verifyNameChangeOtp',
      body: {
        type: 'object',
        required: ['mobile', 'otp'],
        properties: {
          mobile: {
            type: 'string',
            pattern: '^[0-9]{10}$',
            description: '10-digit mobile number'
          },
          otp: {
            type: 'string',
            pattern: '^[0-9]{6}$',
            description: '6-digit OTP'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            verificationToken: { type: 'string' }
          }
        }
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req as any).user.user_id);
      const body = z.object({
        mobile: z.string().regex(/^[0-9]{10}$/, 'Mobile must be 10 digits'),
        otp: z.string().regex(/^[0-9]{6}$/, 'OTP must be 6 digits')
      }).parse(req.body);

      // Verify the mobile number belongs to the authenticated user
      // Check both users.phone and user_profiles.phone (prioritize user_profiles.phone)
      const [user, userProfile] = await Promise.all([
        prisma.users.findUnique({
          where: { id: userId },
          select: { phone: true }
        }),
        prisma.user_profiles.findUnique({
          where: { user_id: userId },
          select: { phone: true }
        })
      ]);

      // Prioritize phone from user_profiles (KYC data) over users table
      const registeredPhone = userProfile?.phone || user?.phone;

      if (!user || registeredPhone !== body.mobile) {
        return reply.code(403).send({
          error: 'unauthorized',
          message: 'Mobile number does not match your account'
        });
      }

      // Try to get OTP using userId+mobile key first (for consistency across pods)
      const otpKey = `${userId.toString()}:${body.mobile}`;
      let stored = nameChangeOtpStore.get(otpKey);
      
      console.log(`[Name Change OTP Verify] Looking for OTP - userId: ${userId}, mobile: ${body.mobile}, key: ${otpKey}, found: ${!!stored}`);
      
      // Fallback to mobile-only key for backward compatibility
      if (!stored) {
        stored = nameChangeOtpStore.get(body.mobile);
        console.log(`[Name Change OTP Verify] Fallback check - mobile key: ${body.mobile}, found: ${!!stored}`);
      }

      if (!stored) {
        console.error(`[Name Change OTP Verify] ❌ OTP not found - userId: ${userId}, mobile: ${body.mobile}, key: ${otpKey}`);
        console.error(`[Name Change OTP Verify] Available keys in store: ${Array.from(nameChangeOtpStore.keys()).join(', ')}`);
        return reply.code(400).send({ error: 'otp_not_found', message: 'OTP not found. Please request a new OTP.' });
      }
      
      console.log(`[Name Change OTP Verify] ✅ OTP found - stored OTP: ${stored.otp}, provided OTP: ${body.otp}, match: ${stored.otp === body.otp}`);

      if (Date.now() > stored.expiresAt) {
        // Clean up both keys
        nameChangeOtpStore.delete(otpKey);
        nameChangeOtpStore.delete(body.mobile);
        return reply.code(400).send({ error: 'otp_expired' });
      }

      if (stored.otp !== body.otp) {
        return reply.code(400).send({ error: 'invalid_otp' });
      }

      // OTP verified - remove from store and mark as verified (clean up both keys)
      nameChangeOtpStore.delete(otpKey);
      nameChangeOtpStore.delete(body.mobile);

      // Generate a temporary token to confirm name change verification
      const jwtSecret = process.env.JWT_SECRET as Secret || 'dev-secret';
      const verificationToken = jwt.sign(
        { userId: userId.toString(), mobile: body.mobile, verified: true, purpose: 'name_change' },
        jwtSecret,
        { expiresIn: '30m' } // 30 minutes validity
      );

      nameChangeVerificationStore.set(body.mobile, {
        verified: true,
        expiresAt: Date.now() + 30 * 60 * 1000 // 30 minutes validity
      });

      return reply.send({
        success: true,
        message: 'OTP verified successfully',
        verificationToken
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      console.error('Error verifying name change OTP:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * POST /api/v1/profile/password/send-otp
   * Send email OTP to change login password (authenticated user)
   */
  app.post('/password/send-otp', {
    preHandler: requireUser,
    schema: {
      description: 'Send email OTP for login password change',
      tags: ['Profile'],
      summary: 'Send Password Change OTP',
      operationId: 'sendPasswordChangeOtp',
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req as any).user.user_id);
      const userIdKey = userId.toString();

      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      if (!user?.email) {
        return reply.code(400).send({
          success: false,
          error: 'email_not_found',
          message: 'No email on your account. Please contact support.',
        });
      }

      if (!EmailService.isConfigured()) {
        return reply.code(503).send({
          success: false,
          message: 'Email OTP service is not configured. Please contact support.',
        });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + PASSWORD_CHANGE_OTP_TTL_MS;
      passwordChangeOtpStore.set(userIdKey, { otp, expiresAt });

      const sendResult = await EmailService.sendPasswordChangeOTP(user.email, otp);
      if (!sendResult.success) {
        passwordChangeOtpStore.delete(userIdKey);
        return reply.code(500).send({
          success: false,
          message: sendResult.error || 'Failed to send OTP email. Please try again.',
        });
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Password Change] Dev OTP for user ${userIdKey}: ${otp}`);
      }

      return reply.send({
        success: true,
        message: 'OTP sent to your registered email address',
        email_masked: EmailService.maskEmail(user.email),
      });
    } catch (error: any) {
      return reply.code(500).send({ error: 'internal_server_error', message: error.message });
    }
  });

  /**
   * @openapi
   * /api/v1/profile/password:
   *   put:
   *     tags:
   *       - Profile
   *     summary: Change login password
   *     description: |
   *       Update the user's login password. Requires current password and email OTP.
   *     operationId: changePassword
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - current_password
   *               - new_password
   *             properties:
   *               current_password:
   *                 type: string
   *                 minLength: 1
   *                 example: "oldPassword123"
   *               new_password:
   *                 type: string
   *                 minLength: 6
   *                 example: "newPassword123"
   *     responses:
   *       '200':
   *         description: Password changed successfully
   *       '400':
   *         description: Invalid current password or validation error
   *       '401':
   *         description: Unauthorized
   */
  app.put('/password', {
    preHandler: requireUser,
    schema: {
      description: 'Change login password',
      tags: ['Profile'],
      summary: 'Change Password',
      operationId: 'changePassword',
      body: {
        type: 'object',
        required: ['current_password', 'new_password', 'otp'],
        properties: {
          current_password: { type: 'string', minLength: 1 },
          new_password: { type: 'string', minLength: 6 },
          otp: { type: 'string', pattern: '^[0-9]{6}$' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req as any).user.user_id);
      const userIdKey = userId.toString();
      const body = z.object({
        current_password: z.string().min(1),
        new_password: z.string().min(6, 'Password must be at least 6 characters'),
        otp: z.string().regex(/^[0-9]{6}$/, 'OTP must be 6 digits'),
      }).parse(req.body);

      const storedOtp = passwordChangeOtpStore.get(userIdKey);
      if (!storedOtp) {
        return reply.code(400).send({ error: 'otp_not_found', message: 'OTP not found. Please request a new OTP.' });
      }
      if (Date.now() > storedOtp.expiresAt) {
        passwordChangeOtpStore.delete(userIdKey);
        return reply.code(400).send({ error: 'otp_expired', message: 'OTP expired. Please request a new one.' });
      }
      if (storedOtp.otp !== body.otp) {
        return reply.code(400).send({ error: 'invalid_otp', message: 'Invalid OTP. Please try again.' });
      }

      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { password_hash: true },
      });

      if (!user) {
        return reply.code(404).send({ error: 'user_not_found' });
      }

      if (user.password_hash) {
        const isValid = body.current_password === user.password_hash;
        if (!isValid) {
          return reply.code(400).send({ error: 'invalid_password', message: 'Current password is incorrect' });
        }
      }

      passwordChangeOtpStore.delete(userIdKey);

      await prisma.users.update({
        where: { id: userId },
        data: {
          password_hash: body.new_password, // Store plain text (no bcrypt)
          password_plain: body.new_password, // Store plain text for admin view
        },
      });

      return reply.send({ message: 'Password changed successfully' });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'validation_error', message: error.errors[0].message });
      }
      return reply.code(500).send({ error: 'internal_server_error', message: error.message });
    }
  });

  /**
   * @openapi
   * /api/v1/profile/transaction-pin:
   *   put:
   *     tags:
   *       - Profile
   *     summary: Change transaction PIN
   *     description: |
   *       Update the user's transaction PIN. Requires current PIN for verification.
   *       PIN must be 4-6 digits.
   *     operationId: changeTransactionPin
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - current_pin
   *               - new_pin
   *             properties:
   *               current_pin:
   *                 type: string
   *                 pattern: '^[0-9]{4,6}$'
   *                 example: "1234"
   *               new_pin:
   *                 type: string
   *                 pattern: '^[0-9]{4,6}$'
   *                 example: "5678"
   *     responses:
   *       '200':
   *         description: Transaction PIN changed successfully
   *       '400':
   *         description: Invalid current PIN or validation error
   *       '401':
   *         description: Unauthorized
   */
  app.put('/transaction-pin', {
    preHandler: requireUser,
    schema: {
      description: 'Change transaction PIN',
      tags: ['Profile'],
      summary: 'Change Transaction PIN',
      operationId: 'changeTransactionPin',
      body: {
        type: 'object',
        required: ['current_pin', 'new_pin'],
        properties: {
          current_pin: { type: 'string', pattern: '^[0-9]{4,6}$' },
          new_pin: { type: 'string', pattern: '^[0-9]{4,6}$' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req as any).user.user_id);
      const body = z.object({
        current_pin: z.string().regex(/^[0-9]{4,6}$/, 'PIN must be 4-6 digits'),
        new_pin: z.string().regex(/^[0-9]{4,6}$/, 'PIN must be 4-6 digits'),
      }).parse(req.body);

      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { transaction_pin: true },
      });

      if (!user) {
        return reply.code(404).send({ error: 'user_not_found' });
      }

      // Verify current PIN
      if (user.transaction_pin && user.transaction_pin !== body.current_pin) {
        return reply.code(400).send({ error: 'invalid_pin', message: 'Current PIN is incorrect' });
      }

      // Update PIN
      await prisma.users.update({
        where: { id: userId },
        data: {
          transaction_pin: body.new_pin,
        },
      });

      return reply.send({ message: 'Transaction PIN changed successfully' });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'validation_error', message: error.errors[0].message });
      }
      return reply.code(500).send({ error: 'internal_server_error', message: error.message });
    }
  });

  /**
   * @openapi
   * /api/v1/profile/transaction-pin/set:
   *   post:
   *     tags:
   *       - Profile
   *     summary: Set transaction PIN (first time)
   *     description: |
   *       Set transaction PIN for the first time. Only works if PIN is not already set.
   *       PIN must be 4-6 digits.
   *     operationId: setTransactionPin
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - pin
   *               - confirm_pin
   *             properties:
   *               pin:
   *                 type: string
   *                 pattern: '^[0-9]{4,6}$'
   *                 example: "1234"
   *               confirm_pin:
   *                 type: string
   *                 pattern: '^[0-9]{4,6}$'
   *                 example: "1234"
   *     responses:
   *       '200':
   *         description: Transaction PIN set successfully
   *       '400':
   *         description: PIN already set, validation error, or PINs don't match
   *       '401':
   *         description: Unauthorized
   */
  app.post('/transaction-pin/set', {
    preHandler: requireUser,
    schema: {
      description: 'Set transaction PIN (first time)',
      tags: ['Profile'],
      summary: 'Set Transaction PIN',
      operationId: 'setTransactionPin',
      body: {
        type: 'object',
        required: ['pin', 'confirm_pin'],
        properties: {
          pin: { type: 'string', pattern: '^[0-9]{4,6}$' },
          confirm_pin: { type: 'string', pattern: '^[0-9]{4,6}$' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req as any).user.user_id);
      console.log('Setting transaction PIN for user:', userId.toString());
      
      const body = z.object({
        pin: z.string().regex(/^[0-9]{4,6}$/, 'PIN must be 4-6 digits'),
        confirm_pin: z.string().regex(/^[0-9]{4,6}$/, 'Confirm PIN must be 4-6 digits'),
      }).parse(req.body);

      console.log('PIN data received:', { pin: body.pin, confirm_pin: body.confirm_pin });

      // Check if PINs match
      if (body.pin !== body.confirm_pin) {
        return reply.code(400).send({ error: 'pin_mismatch', message: 'PIN and confirm PIN do not match' });
      }

      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { id: true, transaction_pin: true, display_id: true },
      });

      if (!user) {
        console.error('User not found:', userId.toString());
        return reply.code(404).send({ error: 'user_not_found' });
      }

      console.log('Current user transaction_pin:', user.transaction_pin);

      // Check if PIN is already set
      if (user.transaction_pin) {
        console.log('PIN already set for user:', userId.toString());
        return reply.code(400).send({ error: 'pin_already_set', message: 'Transaction PIN is already set. Use PUT /transaction-pin to change it.' });
      }

      // Set PIN
      const pinValue = body.pin.trim();
      console.log('Updating transaction_pin to:', pinValue);
      
      const updated = await prisma.users.update({
        where: { id: userId },
        data: {
          transaction_pin: pinValue,
        },
        select: { id: true, transaction_pin: true, display_id: true },
      });

      console.log('Updated user:', { id: updated.id.toString(), display_id: updated.display_id, transaction_pin: updated.transaction_pin });

      // Verify PIN was set
      if (!updated.transaction_pin) {
        console.error('Failed to set PIN - updated user has no transaction_pin');
        return reply.code(500).send({ error: 'internal_server_error', message: 'Failed to set transaction PIN' });
      }

      console.log('Transaction PIN set successfully for user:', userId.toString());
      return reply.send({ message: 'Transaction PIN set successfully' });
    } catch (error: any) {
      console.error('Error setting transaction PIN:', error);
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'validation_error', message: error.errors[0].message });
      }
      return reply.code(500).send({ error: 'internal_server_error', message: error.message });
    }
  });

  /**
   * @openapi
   * /api/v1/profile/forgot-transaction-pin/send-otp:
   *   post:
   *     tags:
   *       - Profile
   *     summary: Send OTP for transaction PIN reset
   *     description: |
   *       Send OTP to user's mobile number for transaction PIN reset.
   *       User must be logged in and mobile must match registered mobile.
   *     operationId: forgotTransactionPinSendOtp
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - mobile
   *             properties:
   *               mobile:
   *                 type: string
   *                 pattern: '^[0-9]{10}$'
   *                 example: "9876543210"
   *     responses:
   *       '200':
   *         description: OTP sent successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 fee_amount:
   *                   type: number
   *                   description: Fee amount that will be charged after OTP verification
   *       '400':
   *         description: Validation error, mobile mismatch, or PIN not set
   *       '401':
   *         description: Unauthorized
   */
  app.post('/forgot-transaction-pin/send-otp', {
    preHandler: requireUser,
    schema: {
      description: 'Send OTP for transaction PIN reset',
      tags: ['Profile'],
      summary: 'Send OTP for Transaction PIN Reset',
      operationId: 'forgotTransactionPinSendOtp',
      body: {
        type: 'object',
        required: ['mobile'],
        properties: {
          mobile: { type: 'string', pattern: '^[0-9]{10}$' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            fee_amount: { type: 'number' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req as any).user.user_id);
      const body = z.object({
        mobile: z.string().regex(/^[0-9]{10}$/, 'Mobile must be 10 digits'),
      }).parse(req.body);

      // Verify user exists and get their registered mobile
      // Check both users.phone and user_profiles.phone (prioritize user_profiles.phone)
      const [user, userProfile] = await Promise.all([
        prisma.users.findUnique({
          where: { id: userId },
          select: { id: true, phone: true, transaction_pin: true },
        }),
        prisma.user_profiles.findUnique({
          where: { user_id: userId },
          select: { phone: true },
        }),
      ]);

      if (!user) {
        return reply.code(404).send({ error: 'user_not_found', message: 'User not found' });
      }

      // Prioritize phone from user_profiles (KYC data) over users table
      const registeredPhone = userProfile?.phone || user.phone;

      // Normalize phone numbers for comparison (remove leading 0, keep only digits)
      const normalizePhone = (phone: string | null | undefined): string => {
        if (!phone) return '';
        // Remove all non-digit characters and leading zeros
        return phone.replace(/\D/g, '').replace(/^0+/, '');
      };

      const normalizedRegistered = normalizePhone(registeredPhone);
      const normalizedInput = normalizePhone(body.mobile);

      // Check if mobile matches user's registered mobile (after normalization)
      if (!registeredPhone || normalizedRegistered !== normalizedInput) {
        return reply.code(400).send({
          error: 'mobile_mismatch',
          message: 'Mobile number does not match your registered number',
        });
      }

      // Check if transaction PIN is set
      if (!user.transaction_pin || user.transaction_pin.trim().length === 0) {
        return reply.code(400).send({
          error: 'pin_not_set',
          message: 'Transaction PIN is not set. Please set it first.',
        });
      }

      // Get fee rule amount to show in response
      let feeAmount = 0;
      try {
        const feeRule = await FeeService.getFeeRule('TRANSACTION_PIN_FORGOT');
        if (feeRule) {
          feeAmount = Number(feeRule.amount);
        }
      } catch (error) {
        console.warn('[Forgot Transaction PIN] Fee rule not found, proceeding without fee info');
      }

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      // Store OTP
      forgotTransactionPinOtpStore.set(body.mobile, { otp, expiresAt });

      // Send OTP via Fast2SMS (Transaction PIN specific template when configured)
      console.log(`[Forgot Transaction PIN] Generated OTP: ${otp} for mobile: ${body.mobile}`);
      if (Fast2SMSService.isConfigured()) {
        try {
          const smsResult = await Fast2SMSService.sendTransactionPinOTP(body.mobile, otp);
          if (smsResult.success) {
            console.log(
              `[Forgot Transaction PIN] ✅ Fast2SMS sent successfully to ${body.mobile}, Request ID: ${smsResult.requestId}`
            );
          } else {
            console.error(
              `[Forgot Transaction PIN] ❌ Failed to send OTP via Fast2SMS: ${smsResult.error}`
            );
          }
        } catch (error: any) {
          console.error(
            `[Forgot Transaction PIN] ❌ Error sending OTP via Fast2SMS:`,
            error?.message || error
          );
        }
      } else {
        console.log(
          `[Forgot Transaction PIN] ⚠️ OTP for ${body.mobile}: ${otp} (Fast2SMS not configured)`
        );
      }

      return reply.send({
        success: true,
        message: 'OTP sent successfully to your mobile number',
        fee_amount: feeAmount,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'validation_error', message: error.errors[0].message });
      }
      return reply.code(500).send({ error: 'internal_server_error', message: error.message });
    }
  });

  /**
   * @openapi
   * /api/v1/profile/forgot-transaction-pin/verify-otp:
   *   post:
   *     tags:
   *       - Profile
   *     summary: Verify OTP for transaction PIN reset
   *     description: |
   *       Verify OTP and deduct fee. Returns reset token if successful.
   *       Fee will be deducted even if wallet balance is insufficient (negative balance allowed).
   *     operationId: forgotTransactionPinVerifyOtp
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - mobile
   *               - otp
   *             properties:
   *               mobile:
   *                 type: string
   *                 pattern: '^[0-9]{10}$'
   *                 example: "9876543210"
   *               otp:
   *                 type: string
   *                 pattern: '^[0-9]{6}$'
   *                 example: "123456"
   *     responses:
   *       '200':
   *         description: OTP verified successfully and fee deducted
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 resetToken:
   *                   type: string
   *       '400':
   *         description: Invalid OTP, expired OTP, or validation error
   *       '401':
   *         description: Unauthorized
   */
  app.post('/forgot-transaction-pin/verify-otp', {
    preHandler: requireUser,
    schema: {
      description: 'Verify OTP for transaction PIN reset',
      tags: ['Profile'],
      summary: 'Verify OTP for Transaction PIN Reset',
      operationId: 'forgotTransactionPinVerifyOtp',
      body: {
        type: 'object',
        required: ['mobile', 'otp'],
        properties: {
          mobile: { type: 'string', pattern: '^[0-9]{10}$' },
          otp: { type: 'string', pattern: '^[0-9]{6}$' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            resetToken: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req as any).user.user_id);
      const body = z.object({
        mobile: z.string().regex(/^[0-9]{10}$/, 'Mobile must be 10 digits'),
        otp: z.string().regex(/^[0-9]{6}$/, 'OTP must be 6 digits'),
      }).parse(req.body);

      // Verify mobile belongs to user
      // Check both users.phone and user_profiles.phone (prioritize user_profiles.phone)
      const [user, userProfile] = await Promise.all([
        prisma.users.findUnique({
          where: { id: userId },
          select: { id: true, phone: true },
        }),
        prisma.user_profiles.findUnique({
          where: { user_id: userId },
          select: { phone: true },
        }),
      ]);

      // Prioritize phone from user_profiles (KYC data) over users table
      const registeredPhone = userProfile?.phone || user?.phone;

      // Normalize phone numbers for comparison (remove leading 0, keep only digits)
      const normalizePhone = (phone: string | null | undefined): string => {
        if (!phone) return '';
        // Remove all non-digit characters and leading zeros
        return phone.replace(/\D/g, '').replace(/^0+/, '');
      };

      const normalizedRegistered = normalizePhone(registeredPhone);
      const normalizedInput = normalizePhone(body.mobile);

      if (!user || !registeredPhone || normalizedRegistered !== normalizedInput) {
        return reply.code(400).send({ error: 'mobile_mismatch', message: 'Mobile number does not match your registered number' });
      }

      const stored = forgotTransactionPinOtpStore.get(body.mobile);

      if (!stored) {
        return reply.code(400).send({ error: 'otp_not_found', message: 'OTP not found. Please request a new OTP.' });
      }

      if (Date.now() > stored.expiresAt) {
        forgotTransactionPinOtpStore.delete(body.mobile);
        return reply.code(400).send({ error: 'otp_expired', message: 'OTP has expired. Please request a new OTP.' });
      }

      if (stored.otp !== body.otp) {
        return reply.code(400).send({ error: 'invalid_otp', message: 'Invalid OTP. Please try again.' });
      }

      // OTP verified - deduct fee (allow negative balance)
      const ALLOW_NEGATIVE_FOR_TRANSACTION_PIN_FORGOT = true;

      // Check fee rule exists and get amount
      const feeCheck = await FeeService.checkFeeApplicable(
        userId,
        'TRANSACTION_PIN_FORGOT',
        ALLOW_NEGATIVE_FOR_TRANSACTION_PIN_FORGOT
      );

      if (feeCheck.applicable && feeCheck.amount > 0) {
        // Deduct fee - allow negative balance for transaction PIN forgot
        // User will recover from commissions after purchasing package or earning commissions
        try {
          await FeeService.deductFee(
            userId,
            'TRANSACTION_PIN_FORGOT',
            null,
            'transaction_pin_reset',
            ALLOW_NEGATIVE_FOR_TRANSACTION_PIN_FORGOT
          );
          console.log(`[Forgot Transaction PIN] Fee deducted: ₹${feeCheck.amount} for user ${userId}`);
        } catch (error: any) {
          // Only re-throw if it's not an insufficient balance error
          // (we're allowing negative balance for transaction PIN forgot)
          if (error.code !== 'INSUFFICIENT_BALANCE') {
            throw error;
          }
          // If it's INSUFFICIENT_BALANCE error, we still proceed (negative allowed)
          console.log(`[Forgot Transaction PIN] Fee deducted with negative balance: ₹${feeCheck.amount} for user ${userId}`);
        }
      } else if (!feeCheck.applicable && feeCheck.amount === 0) {
        // Fee rule not found - log warning but proceed
        console.warn('[Forgot Transaction PIN] Fee rule not found, proceeding without fee');
      }

      // Generate reset token
      const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const resetTokenExpiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

      // Remove OTP from store
      forgotTransactionPinOtpStore.delete(body.mobile);

      // Store reset token
      forgotTransactionPinStore.set(body.mobile, { resetToken, expiresAt: resetTokenExpiresAt });

      return reply.send({
        success: true,
        message: 'OTP verified successfully. Fee has been deducted.',
        resetToken,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'validation_error', message: error.errors[0].message });
      }
      return reply.code(500).send({ error: 'internal_server_error', message: error.message });
    }
  });

  /**
   * @openapi
   * /api/v1/profile/forgot-transaction-pin/reset:
   *   post:
   *     tags:
   *       - Profile
   *     summary: Reset transaction PIN
   *     description: |
   *       Reset transaction PIN using verified reset token.
   *       PIN must be 4-6 digits.
   *     operationId: forgotTransactionPinReset
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - mobile
   *               - resetToken
   *               - newPin
   *               - confirmPin
   *             properties:
   *               mobile:
   *                 type: string
   *                 pattern: '^[0-9]{10}$'
   *                 example: "9876543210"
   *               resetToken:
   *                 type: string
   *                 example: "abc123xyz"
   *               newPin:
   *                 type: string
   *                 pattern: '^[0-9]{4,6}$'
   *                 example: "1234"
   *               confirmPin:
   *                 type: string
   *                 pattern: '^[0-9]{4,6}$'
   *                 example: "1234"
   *     responses:
   *       '200':
   *         description: Transaction PIN reset successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *       '400':
   *         description: Invalid token, expired token, PIN mismatch, or validation error
   *       '401':
   *         description: Unauthorized
   */
  app.post('/forgot-transaction-pin/reset', {
    preHandler: requireUser,
    schema: {
      description: 'Reset transaction PIN',
      tags: ['Profile'],
      summary: 'Reset Transaction PIN',
      operationId: 'forgotTransactionPinReset',
      body: {
        type: 'object',
        required: ['mobile', 'resetToken', 'newPin', 'confirmPin'],
        properties: {
          mobile: { type: 'string', pattern: '^[0-9]{10}$' },
          resetToken: { type: 'string' },
          newPin: { type: 'string', pattern: '^[0-9]{4,6}$' },
          confirmPin: { type: 'string', pattern: '^[0-9]{4,6}$' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req as any).user.user_id);
      const body = z.object({
        mobile: z.string().regex(/^[0-9]{10}$/, 'Mobile must be 10 digits'),
        resetToken: z.string().min(1, 'Reset token is required'),
        newPin: z.string().regex(/^[0-9]{4,6}$/, 'PIN must be 4-6 digits'),
        confirmPin: z.string().regex(/^[0-9]{4,6}$/, 'Confirm PIN must be 4-6 digits'),
      }).parse(req.body);

      // Verify PINs match
      if (body.newPin !== body.confirmPin) {
        return reply.code(400).send({ error: 'pin_mismatch', message: 'PIN and confirm PIN do not match' });
      }

      // Verify reset token
      const stored = forgotTransactionPinStore.get(body.mobile);

      if (!stored) {
        return reply.code(400).send({ error: 'reset_token_not_found', message: 'Reset token not found. Please verify OTP again.' });
      }

      if (Date.now() > stored.expiresAt) {
        forgotTransactionPinStore.delete(body.mobile);
        return reply.code(400).send({ error: 'reset_token_expired', message: 'Reset token has expired. Please verify OTP again.' });
      }

      if (stored.resetToken !== body.resetToken) {
        return reply.code(400).send({ error: 'invalid_reset_token', message: 'Invalid reset token.' });
      }

      // Verify mobile belongs to user
      // Check both users.phone and user_profiles.phone (prioritize user_profiles.phone)
      const [user, userProfile] = await Promise.all([
        prisma.users.findUnique({
          where: { id: userId },
          select: { id: true, phone: true },
        }),
        prisma.user_profiles.findUnique({
          where: { user_id: userId },
          select: { phone: true },
        }),
      ]);

      // Prioritize phone from user_profiles (KYC data) over users table
      const registeredPhone = userProfile?.phone || user?.phone;

      // Normalize phone numbers for comparison (remove leading 0, keep only digits)
      const normalizePhone = (phone: string | null | undefined): string => {
        if (!phone) return '';
        // Remove all non-digit characters and leading zeros
        return phone.replace(/\D/g, '').replace(/^0+/, '');
      };

      const normalizedRegistered = normalizePhone(registeredPhone);
      const normalizedInput = normalizePhone(body.mobile);

      if (!user || !registeredPhone || normalizedRegistered !== normalizedInput) {
        forgotTransactionPinStore.delete(body.mobile);
        return reply.code(400).send({ error: 'mobile_mismatch', message: 'Mobile number does not match your registered number' });
      }

      // Update transaction PIN
      await prisma.users.update({
        where: { id: userId },
        data: {
          transaction_pin: body.newPin.trim(),
        },
      });

      // Remove reset token
      forgotTransactionPinStore.delete(body.mobile);

      console.log(`[Forgot Transaction PIN] PIN reset successfully for user ID: ${userId}`);

      return reply.send({
        success: true,
        message: 'Transaction PIN reset successfully',
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'validation_error', message: error.errors[0].message });
      }
      return reply.code(500).send({ error: 'internal_server_error', message: error.message });
    }
  });

  // GET /api/v1/profile/check-account-number - Check if account number already exists
  app.get(
    '/check-account-number',
    {
      preHandler: [requireUser],
      schema: {
        description: 'Check if bank account number is already used by another user',
        tags: ['Profile'],
        querystring: {
          type: 'object',
          required: ['account_number'],
          properties: {
            account_number: { type: 'string' },
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
        const userId = BigInt((request as any).user.user_id);
        const query = request.query as any;
        const accountNumber = query.account_number;

        if (!accountNumber || accountNumber.trim() === '') {
          return reply.code(400).send({ 
            exists: false,
            message: 'Account number is required' 
          });
        }

        // Check if account number exists for another user (exclude current user)
        const existingProfile = await prisma.user_profiles.findFirst({
          where: { 
            bank_account_no: accountNumber.trim(),
            NOT: { user_id: userId },
          },
          select: { user_id: true },
        });

        const exists = !!existingProfile;

        return reply.send({
          exists,
          message: exists 
            ? 'This account number is already registered with another user. Please use a different account number.' 
            : 'Account number is available',
        });
      } catch (error: any) {
        console.error('Check account number error:', error);
        return reply.code(500).send({
          exists: false,
          message: 'Failed to check account number',
        });
      }
    }
  );
}
