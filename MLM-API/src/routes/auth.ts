import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import jwt, { Secret } from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { signToken, requireUser } from '../middleware/jwt';
import { FeeService } from '../modules/fees/feeService.js';
import { Fast2SMSService } from '../modules/sms/fast2smsService.js';
import { CommissionService } from '../modules/commissions/commission.service.js';
import { EmailService } from '../modules/email/emailService.js';

// In-memory OTP store (for development - use Redis in production)
const otpStore = new Map<string, { otp: string; expiresAt: number }>();
// Forgot password email OTP + reset token (key: normalized email)
const forgotPasswordOtpStore = new Map<string, { otp: string; expiresAt: number }>();
const forgotPasswordStore = new Map<string, { resetToken: string; expiresAt: number }>();
const FORGOT_PASSWORD_OTP_TTL_MS = 10 * 60 * 1000;
// Mobile verification store - legacy SMS OTP (forgot-password etc.)
const mobileVerificationStore = new Map<string, { verified: boolean; expiresAt: number }>();
// Email OTP for registration / add member
const emailOtpStore = new Map<string, { otp: string; expiresAt: number }>();
const emailVerificationStore = new Map<string, { verified: boolean; expiresAt: number }>();
const REGISTRATION_EMAIL_OTP_TTL_MS = 10 * 60 * 1000;

// Numbers allowed to have multiple accounts (testing/special use). Others: one number = one account.
const MULTI_ACCOUNT_ALLOWED_MOBILES = new Set(['8600000889', '8010308898', '7887868492']);

export async function authRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/auth/me
   * Get current authenticated user details
   */
  app.get('/me', {
    preHandler: requireUser,
    schema: {
      description: 'Get current authenticated user details',
      tags: ['Authentication'],
      summary: 'Get Current User',
      response: {
        200: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                display_id: { type: 'string', nullable: true },
                name: { type: 'string', nullable: true },
                display_title: { type: 'string', nullable: true },
                display_title_icon_url: { type: 'string', nullable: true },
                email: { type: 'string', nullable: true },
                phone: { type: 'string', nullable: true },
                role: { type: 'string' },
                kyc_status: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const userId = BigInt((request as any).user.user_id);
    
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        display_id: true,
        name: true,
        display_title: true,
        display_title_icon_url: true,
        email: true,
        phone: true,
        role: true,
        kyc_status: true
      }
    });
    
    if (!user) {
      return reply.code(404).send({ error: 'user_not_found' });
    }
    
    return reply.send({
      user: {
        id: user.id.toString(),
        display_id: user.display_id,
        name: user.name,
        display_title: user.display_title ?? null,
        display_title_icon_url: user.display_title_icon_url ?? null,
        email: user.email,
        phone: user.phone,
        role: user.role,
        kyc_status: user.kyc_status
      }
    });
  });
  /**
   * @openapi
   * /api/v1/auth/login:
   *   post:
   *     tags:
   *       - Authentication
   *     summary: User login
   *     description: |
   *       Authenticate a user by User ID (numeric ID), display_id, email, or mobile number (10 digits) and password.
   *       Returns JWT token for authenticated requests.
   *       
   *       **Supported login methods:**
   *       - User ID (numeric): e.g., "123"
   *       - Display ID: e.g., "SIA02047"
   *       - Email: e.g., "user@example.com"
   *       - Mobile Number: e.g., "9876543210" (10 digits)
   *     operationId: login
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - userId
   *               - password
   *             properties:
   *               userId:
   *                 type: string
   *                 description: User ID (numeric), display_id, email, or mobile number (10 digits)
   *                 example: "9876543210"
   *               password:
   *                 type: string
   *                 description: User password
   *                 example: "password123"
   *     responses:
   *       '200':
   *         description: Login successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 token:
   *                   type: string
   *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   *                 user:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       example: "10"
   *                     email:
   *                       type: string
   *                       nullable: true
   *                       example: "testuser@example.com"
   *                     name:
   *                       type: string
   *                       nullable: true
   *                       example: "John Doe"
   *       '401':
   *         description: Invalid credentials
   *       '404':
   *         description: User not found
   */
  app.post('/login', {
    schema: {
      description: 'User login - returns JWT token',
      tags: ['Authentication'],
      summary: 'Login',
      operationId: 'login',
      consumes: ['application/json'],
      body: {
        type: 'object',
        required: ['userId', 'password'],
        properties: {
          userId: { 
            type: 'string',
            description: 'User ID (numeric), display_id, email, or mobile number (10 digits)'
          },
          password: { 
            type: 'string',
            description: 'User password'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            token: { 
              type: 'string',
              description: 'JWT token for authentication'
            },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                display_id: { type: 'string', nullable: true },
                email: { type: 'string', nullable: true },
                name: { type: 'string', nullable: true },
                has_transaction_password: { type: 'boolean' }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (req, reply) => {
    const body = z.object({ 
      userId: z.string().min(1),
      password: z.string().min(1)
    }).parse(req.body);
    
    // Try to find user by ID (if numeric), display_id, email, or mobile number
    let user;
    const userIdNum = parseInt(body.userId, 10);
    const loginSelect = { id: true, display_id: true, email: true, name: true, password_hash: true, transaction_pin: true, status: true };
    if (!isNaN(userIdNum)) {
      user = await prisma.users.findUnique({ where: { id: BigInt(userIdNum) }, select: loginSelect });
    }
    if (!user) {
      const displayIdUpper = String(body.userId).trim().toUpperCase();
      user = await prisma.users.findUnique({ where: { display_id: displayIdUpper }, select: loginSelect });
    }
    if (!user) {
      user = await prisma.users.findFirst({ where: { email: body.userId }, select: loginSelect });
    }
    if (!user) {
      user = await prisma.users.findFirst({
        where: { phone: body.userId },
        select: loginSelect,
        orderBy: { id: 'desc' }
      });
    }
    if (!user) {
      const profile = await prisma.user_profiles.findFirst({ where: { phone: body.userId }, select: { user_id: true } });
      if (profile) {
        user = await prisma.users.findUnique({ where: { id: profile.user_id }, select: loginSelect });
      }
    }
    
    if (!user) {
      return reply.code(404).send({ error: 'user_not_found' });
    }
    
    // Check if user is blocked/inactive
    if (user.status === 'inactive') {
      return reply.code(403).send({ error: 'account_blocked', message: 'Your account has been blocked. Please contact support.' });
    }
    
    // Validate password (plain text comparison - no bcrypt)
    if (!user.password_hash) {
      return reply.code(401).send({ error: 'password_not_set' });
    }
    
    // Plain text password comparison
    const isValidPassword = body.password === user.password_hash;
    if (!isValidPassword) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }
    
    const token = signToken({ user_id: user.id, email: user.email });
    
    // Check if transaction password is set (must be non-null and non-empty)
    const hasTransactionPassword = !!(user.transaction_pin && 
                                      typeof user.transaction_pin === 'string' && 
                                      user.transaction_pin.trim().length > 0);
    
    // Debug log
    console.log('Login - Transaction password check:', {
      userId: user.id.toString(),
      transaction_pin: user.transaction_pin,
      hasTransactionPassword
    });
    
    return reply.send({ 
      token, 
      user: { 
        id: user.id.toString(), 
        display_id: user.display_id,
        display_title: (user as any).display_title ?? null,
        display_title_icon_url: (user as any).display_title_icon_url ?? null,
        email: user.email,
        name: user.name,
        has_transaction_password: hasTransactionPassword
      }
    });
  });

  /**
   * @openapi
   * /api/v1/auth/sponsor/{sponsorId}:
   *   get:
   *     tags:
   *       - Authentication
   *     summary: Get sponsor name by sponsor ID
   *     description: |
   *       Retrieve sponsor name for a given sponsor ID. Used in registration form
   *       to auto-fill sponsor name when sponsor ID is entered.
   *     operationId: getSponsorName
   *     parameters:
   *       - in: path
   *         name: sponsorId
   *         required: true
   *         schema:
   *           type: string
   *         description: Sponsor user ID
   *     responses:
   *       '200':
   *         description: Sponsor found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                   example: "9"
   *                 name:
   *                   type: string
   *                   nullable: true
   *                   example: "Sponsor Name"
   *       '404':
   *         description: Sponsor not found
   */
  app.get('/sponsor/:sponsorId', {
    schema: {
      description: 'Get sponsor name by sponsor ID',
      tags: ['Authentication'],
      summary: 'Get Sponsor Name',
      operationId: 'getSponsorName',
      params: {
        type: 'object',
        properties: {
          sponsorId: { type: 'string' }
        },
        required: ['sponsorId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string', nullable: true }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (req, reply) => {
    const sponsorIdParam = (req.params as any).sponsorId;
    
    // Try to find by numeric ID first, then by display_id
    let sponsor;
    const numericId = parseInt(sponsorIdParam, 10);
    if (!isNaN(numericId)) {
      sponsor = await prisma.users.findUnique({
        where: { id: BigInt(numericId) },
        select: { id: true, name: true, display_id: true }
      });
    }
    
    // If not found by numeric ID, try by display_id (case-insensitive)
    if (!sponsor) {
      const displayIdUpper = sponsorIdParam.toUpperCase();
      sponsor = await prisma.users.findFirst({
        where: { display_id: displayIdUpper },
        select: { id: true, name: true, display_id: true }
      });
    }
    
    if (!sponsor) {
      return reply.code(404).send({ error: 'sponsor_not_found' });
    }
    
    return reply.send({
      id: sponsor.id.toString(),
      name: sponsor.name,
      display_id: sponsor.display_id
    });
  });

  /**
   * @openapi
   * /api/v1/auth/otp/send:
   *   post:
   *     tags:
   *       - Authentication
   *     summary: Send OTP to mobile number
   *     description: |
   *       Send OTP (One-Time Password) to the provided mobile number for verification.
   *       OTP is valid for 180 minutes (3 hours).
   *     operationId: sendOtp
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
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "OTP sent successfully"
   *       '400':
   *         description: Invalid mobile number
   */
  app.post('/otp/send', {
    schema: {
      description: 'Send OTP to mobile number',
      tags: ['Authentication'],
      summary: 'Send OTP',
      operationId: 'sendOtp',
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
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (req, reply) => {
    const body = z.object({
      mobile: z.string().regex(/^[0-9]{10}$/, 'Mobile must be 10 digits')
    }).parse(req.body);
    
    console.log(`[OTP Send] Request received for mobile: ${body.mobile}, IP: ${req.ip}, Origin: ${req.headers.origin || 'N/A'}`);
    
    // Find user by mobile number
    const user = await prisma.users.findFirst({
      where: { phone: body.mobile },
      select: { id: true },
    });
    
    // NEW: Prevent duplicate accounts on same mobile (except multi-account allowed numbers)
    // Requirement: "Same number par naya account/ID nahi banna chahiye"
    if (user && !MULTI_ACCOUNT_ALLOWED_MOBILES.has(body.mobile)) {
      return reply.code(400).send({
        error: 'mobile_already_exists',
        message: 'Is mobile number se pehle se account registered hai. Please isi account se login karein.',
      });
    }

    // If user exists (and is allowed), deduct fee for OTP send
    if (user) {
      try {
        const feeCheck = await FeeService.checkFeeApplicable(user.id as unknown as bigint, 'OTP_SEND');
        if (!feeCheck.applicable && feeCheck.amount > 0) {
          return reply.code(400).send({
            error: 'INSUFFICIENT_BALANCE',
            message: feeCheck.message || 'Insufficient balance for OTP send',
            required_amount: feeCheck.amount,
            available_balance: Number(
              (await prisma.user_balances.findUnique({ where: { user_id: user.id as unknown as bigint } }))?.balance || 0
            ),
          });
        }

        // Deduct fee for OTP send (if fee > 0)
        if (feeCheck.amount > 0) {
          await FeeService.deductFee(user.id as unknown as bigint, 'OTP_SEND', null, 'otp_send');
        }
      } catch (error: any) {
        if (error.code === 'INSUFFICIENT_BALANCE') {
          return reply.code(400).send({
            error: 'INSUFFICIENT_BALANCE',
            message: error.message || 'Insufficient balance for OTP send',
            required_amount: error.required,
            available_balance: error.available,
          });
        }
        throw error;
      }
    }
    // Note: If user not found, we still allow OTP send (for registration flow)
    
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 180 * 60 * 1000; // 180 minutes
    
    // Store OTP (in production, use Redis)
    otpStore.set(body.mobile, { otp, expiresAt });
    
    // Send OTP via Fast2SMS
    console.log(`[OTP Send] Generated OTP: ${otp} for mobile: ${body.mobile}`);
    if (Fast2SMSService.isConfigured()) {
      console.log(`[OTP Send] Fast2SMS configured, attempting to send SMS...`);
      try {
        const smsResult = await Fast2SMSService.sendOTP(body.mobile, otp);
        if (smsResult.success) {
          console.log(`[OTP Send] ✅ Fast2SMS sent successfully to ${body.mobile}, Request ID: ${smsResult.requestId}`);
        } else {
          console.error(`[OTP Send] ❌ Failed to send OTP via Fast2SMS: ${smsResult.error}`);
          // Still return success to user, but log the error
          // In production, you might want to handle this differently
        }
      } catch (error: any) {
        console.error(`[OTP Send] ❌ Error sending OTP via Fast2SMS:`, error?.message || error);
        // Continue even if SMS fails (for development/fallback)
      }
    } else {
      // Fallback: log OTP to console if Fast2SMS not configured
      console.log(`[OTP Send] ⚠️ OTP for ${body.mobile}: ${otp} (Fast2SMS not configured)`);
    }
    
    return reply.send({
      success: true,
      message: 'OTP sent successfully'
    });
  });

  /**
   * @openapi
   * /api/v1/auth/otp/verify:
   *   post:
   *     tags:
   *       - Authentication
   *     summary: Verify OTP
   *     description: |
   *       Verify OTP sent to mobile number. Returns verification token if successful.
   *     operationId: verifyOtp
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
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "OTP verified successfully"
   *                 verified:
   *                   type: boolean
   *                   example: true
   *       '400':
   *         description: Invalid OTP or expired
   */
  app.post('/otp/verify', {
    schema: {
      description: 'Verify OTP',
      tags: ['Authentication'],
      summary: 'Verify OTP',
      operationId: 'verifyOtp',
      body: {
        type: 'object',
        required: ['mobile', 'otp'],
        properties: {
          mobile: {
            type: 'string',
            pattern: '^[0-9]{10}$'
          },
          otp: {
            type: 'string',
            pattern: '^[0-9]{6}$'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            verified: { type: 'boolean' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (req, reply) => {
    const body = z.object({
      mobile: z.string().regex(/^[0-9]{10}$/),
      otp: z.string().regex(/^[0-9]{6}$/)
    }).parse(req.body);
    
    const stored = otpStore.get(body.mobile);
    
    if (!stored) {
      return reply.code(400).send({ error: 'otp_not_found' });
    }
    
    if (Date.now() > stored.expiresAt) {
      otpStore.delete(body.mobile);
      return reply.code(400).send({ error: 'otp_expired' });
    }
    
    if (stored.otp !== body.otp) {
      return reply.code(400).send({ error: 'invalid_otp' });
    }
    
    // OTP verified - remove from store and mark mobile as verified
    otpStore.delete(body.mobile);
    
    // Generate a temporary token to confirm mobile verification for registration
    const jwtSecret = process.env.JWT_SECRET as Secret || 'dev-secret';
    const verificationToken = jwt.sign(
      { mobile: body.mobile, verified: true },
      jwtSecret,
      { expiresIn: '180m' }
    );
    
    mobileVerificationStore.set(body.mobile, {
      verified: true,
      expiresAt: Date.now() + 180 * 60 * 1000 // 180 minutes validity
    });
    
    return reply.send({
      success: true,
      message: 'OTP verified successfully',
      verified: true,
      verificationToken // Return token for registration
    });
  });

  // POST /api/v1/auth/email-otp/send — Registration / add-member email OTP
  app.post('/email-otp/send', {
    schema: {
      description: 'Send registration OTP to email (replaces SMS for register/add member)',
      tags: ['Authentication'],
      summary: 'Send Email OTP',
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
        },
      },
    },
  }, async (req, reply) => {
    const body = z.object({
      email: z.string().email(),
    }).parse(req.body);

    const normalizedEmail = body.email.trim().toLowerCase();

    if (!EmailService.isConfigured()) {
      return reply.code(503).send({
        success: false,
        message: 'Email OTP service is not configured. Please contact support.',
      });
    }

    const existingEmail = await prisma.users.findFirst({
      where: { email: { equals: body.email.trim(), mode: 'insensitive' } },
    });
    if (existingEmail) {
      return reply.code(400).send({
        success: false,
        error: 'email_already_exists',
        message: 'This email is already registered. Please login or use a different email.',
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + REGISTRATION_EMAIL_OTP_TTL_MS;
    emailOtpStore.set(normalizedEmail, { otp, expiresAt });

    const sendResult = await EmailService.sendRegistrationOTP(body.email.trim(), otp);
    if (!sendResult.success) {
      emailOtpStore.delete(normalizedEmail);
      return reply.code(500).send({
        success: false,
        message: sendResult.error || 'Failed to send OTP email. Please try again.',
      });
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Registration Email OTP] Dev OTP for ${normalizedEmail}: ${otp}`);
    }

    return reply.send({
      success: true,
      message: 'OTP sent to your email address',
      email_masked: EmailService.maskEmail(body.email.trim()),
      ...(process.env.NODE_ENV !== 'production' ? { dev_otp: otp } : {}),
    });
  });

  // POST /api/v1/auth/email-otp/verify
  app.post('/email-otp/verify', {
    schema: {
      description: 'Verify registration email OTP',
      tags: ['Authentication'],
      summary: 'Verify Email OTP',
      body: {
        type: 'object',
        required: ['email', 'otp'],
        properties: {
          email: { type: 'string', format: 'email' },
          otp: { type: 'string', pattern: '^[0-9]{6}$' },
        },
      },
    },
  }, async (req, reply) => {
    const body = z.object({
      email: z.string().email(),
      otp: z.string().regex(/^[0-9]{6}$/),
    }).parse(req.body);

    const normalizedEmail = body.email.trim().toLowerCase();
    const stored = emailOtpStore.get(normalizedEmail);

    if (!stored) {
      return reply.code(400).send({ error: 'otp_not_found', message: 'OTP not found. Please request a new OTP.' });
    }
    if (Date.now() > stored.expiresAt) {
      emailOtpStore.delete(normalizedEmail);
      return reply.code(400).send({ error: 'otp_expired', message: 'OTP expired. Please request a new one.' });
    }
    if (stored.otp !== body.otp) {
      return reply.code(400).send({ error: 'invalid_otp', message: 'Invalid OTP. Please try again.' });
    }

    emailOtpStore.delete(normalizedEmail);

    const jwtSecret = process.env.JWT_SECRET as Secret || 'dev-secret';
    const verificationToken = jwt.sign(
      { email: body.email.trim(), verified: true },
      jwtSecret,
      { expiresIn: '30m' },
    );

    emailVerificationStore.set(normalizedEmail, {
      verified: true,
      expiresAt: Date.now() + 30 * 60 * 1000,
    });

    return reply.send({
      success: true,
      message: 'Email verified successfully',
      verified: true,
      verificationToken,
    });
  });

  /**
   * @openapi
   * /api/v1/auth/register:
   *   post:
   *     tags:
   *       - Authentication
   *     summary: Register a new user
   *     description: |
   *       Create a new user account in the MLM system. Supports registration with
   *       name, email, mobile, password, and referrer (sponsor) ID.
   *       If a referrer_user_id is provided, the new user will be linked to the referrer.
   *     operationId: registerUser
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - email
   *               - mobile
   *               - password
   *               - referrer_user_id
   *             properties:
   *               name:
   *                 type: string
   *                 minLength: 1
   *                 example: "John Doe"
   *               email:
   *                 type: string
   *                 format: email
   *                 example: "john@example.com"
   *               mobile:
   *                 type: string
   *                 pattern: '^[0-9]{10}$'
   *                 description: 10-digit mobile number
   *                 example: "9876543210"
   *               password:
   *                 type: string
   *                 minLength: 6
   *                 description: User password (minimum 6 characters)
   *                 example: "password123"
   *               referrer_user_id:
   *                 type: string
   *                 description: Sponsor/Referrer user ID
   *                 example: "9"
   *     responses:
   *       '201':
   *         description: User registered successfully
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
   *                 referrer_user_id:
   *                   type: string
   *                   nullable: true
   *                   example: "9"
   *       '400':
   *         description: Validation error or invalid referrer_user_id
   */
  app.post('/register', {
    schema: {
      description: 'Register a new user',
      tags: ['Authentication'],
      summary: 'Register User',
      operationId: 'registerUser',
      body: {
        type: 'object',
        properties: {
          name: { 
            type: 'string',
            minLength: 1,
            description: 'User full name'
          },
          email: { 
            type: 'string',
            format: 'email',
            description: 'User email address'
          },
          mobile: {
            type: 'string',
            pattern: '^[0-9]{10}$',
            description: '10-digit mobile number'
          },
          password: {
            type: 'string',
            minLength: 6,
            description: 'User password (minimum 6 characters)'
          },
          referrer_user_id: { 
            type: 'string',
            description: 'Referrer/Sponsor user ID'
          }
        },
        required: ['name', 'email', 'mobile', 'password', 'referrer_user_id']
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'User ID' },
            display_id: { type: 'string', nullable: true, description: 'User display ID (e.g., SIA02000)' },
            name: { type: 'string', nullable: true },
            email: { type: 'string', nullable: true },
            phone: { type: 'string', nullable: true },
            role: { type: 'string', enum: ['STUDENT', 'ADMIN'], description: 'User role' },
            referrer_user_id: { type: 'string', nullable: true }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            details: { type: 'array' }
          }
        }
      }
    }
  }, async (req, reply) => {
    const body = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      mobile: z.string().regex(/^[0-9]{10}$/, 'Mobile must be 10 digits'),
      password: z.string().min(6, 'Password must be at least 6 characters'),
      referrer_user_id: z.union([z.string(), z.number(), z.bigint()]).optional().default('2'),
      email_verified_token: z.string().optional(),
      mobile_verified_token: z.string().optional(), // legacy SMS OTP
    }).parse(req.body);
    
    // Convert referrer_user_id to bigint - handle both numeric ID and display_id (SIA format)
    let referrerUserId: bigint;
    if (typeof body.referrer_user_id === 'string') {
      // Check if it's a display_id (starts with SIA) or numeric string
      if (body.referrer_user_id.toUpperCase().startsWith('SIA')) {
        // Look up user by display_id
        const referrerByDisplayId = await prisma.users.findUnique({
          where: { display_id: body.referrer_user_id.toUpperCase() }
        });
        if (!referrerByDisplayId) {
          return reply.code(400).send({ error: 'invalid_referrer_user_id', message: 'Referrer ID not found' });
        }
        referrerUserId = referrerByDisplayId.id;
      } else {
        // Try to convert numeric string to bigint
        try {
          referrerUserId = BigInt(body.referrer_user_id);
        } catch {
          return reply.code(400).send({ error: 'invalid_referrer_user_id', message: 'Invalid referrer ID format' });
        }
      }
    } else if (typeof body.referrer_user_id === 'number') {
      referrerUserId = BigInt(body.referrer_user_id);
    } else if (typeof body.referrer_user_id === 'bigint') {
      referrerUserId = body.referrer_user_id;
    } else {
      referrerUserId = BigInt(2); // Default to root user
    }
    
    // Validate referrer exists
    const referrer = await prisma.users.findUnique({
      where: { id: referrerUserId }
    });
    if (!referrer) {
      return reply.code(400).send({ error: 'invalid_referrer_user_id', message: 'Referrer not found' });
    }
    
    // CRITICAL: Check if referrer has at least one ACTIVE package
    // User can only add referrals if they have purchased and activated a course/package
    // EXCEPTION: Root/System users (ID <= 2), SIA00001, and SIA00021 are exempt from this rule
    // Other users must have active course to add downline
    // Active package = package has NOT reached 2x income (expiry is ONLY based on 2x, not active_until date)
    if (referrerUserId > 2 && referrer.display_id !== 'SIA00001' && referrer.display_id !== 'SIA00021') {
      const today = new Date();
      const hasActive = await CommissionService.hasActiveCourse(referrerUserId, today);
      
      if (!hasActive) {
        return reply.code(403).send({ 
          error: 'referrer_no_active_package',
          message: 'Referrer must have an active package before adding new referrals. Please purchase a course first.'
        });
      }
    }
    
    // Verify email was verified via OTP (registration / add member)
    const normalizedEmail = body.email.trim().toLowerCase();
    let emailVerified = false;

    if (body.email_verified_token) {
      try {
        const jwtSecret = process.env.JWT_SECRET as Secret || 'dev-secret';
        const decoded = jwt.verify(body.email_verified_token, jwtSecret) as { email?: string; verified?: boolean };
        if (
          decoded.verified === true &&
          decoded.email &&
          decoded.email.trim().toLowerCase() === normalizedEmail
        ) {
          emailVerified = true;
        }
      } catch {
        return reply.code(400).send({
          error: 'email_not_verified',
          message: 'Email verification token is invalid or expired. Please verify your email again.',
        });
      }
    } else {
      const emailVerification = emailVerificationStore.get(normalizedEmail);
      if (emailVerification?.verified && Date.now() <= emailVerification.expiresAt) {
        emailVerified = true;
        emailVerificationStore.delete(normalizedEmail);
      }
    }

    if (!emailVerified) {
      return reply.code(400).send({
        error: 'email_not_verified',
        message: 'Please verify your email with OTP first.',
      });
    }
    
    // Duplicate email blocked for self-registration (admin may assign duplicate via PUT /admin/users/:id)
    const existingEmail = await prisma.users.findFirst({
      where: { email: body.email },
    });
    if (existingEmail) {
      return reply.code(400).send({ error: 'email_already_exists' });
    }

    // Check if mobile already exists (EXCEPT for multi-account allowed numbers)
    // Requirement: Same mobile number se multiple accounts allow nahi honge,
    // sirf MULTI_ACCOUNT_ALLOWED_MOBILES ke liye duplicate allowed hai.
    if (!MULTI_ACCOUNT_ALLOWED_MOBILES.has(body.mobile)) {
      const existingMobile = await prisma.users.findFirst({
        where: { phone: body.mobile },
      });

      if (existingMobile) {
        return reply.code(400).send({
          error: 'mobile_already_exists',
          message: 'This mobile number is already registered with another account.',
        });
      }
    }
    
    // Store password in plain text (no bcrypt hashing)
    const passwordPlain = body.password;
    
    // New, race-condition-safe display_id generation with sequential numbering:
    // 1) Create user without display_id
    // 2) Find max display_id number and increment by 1 for sequential IDs
    // 3) Update same user with that display_id
    const DISPLAY_ID_BASE = 2000n;
    
    const user = await prisma.$transaction(async (tx) => {
      // Step 1: create user without display_id
      const created = await tx.users.create({
        data: {
          name: body.name,
          email: body.email,
          phone: body.mobile,
          password_hash: passwordPlain, // Store plain text (no bcrypt)
          password_plain: passwordPlain, // Store plain text for admin view
          referrer_user_id: referrerUserId,
          role: 'STUDENT'
        },
      });

      // Step 2: Get the maximum numeric part from existing display_ids starting with "SIA"
      // This ensures sequential IDs: SIA02000, SIA02001, SIA02002, etc.
      const maxDisplayIdResult = await tx.$queryRaw<Array<{ display_id: string | null }>>`
        SELECT display_id 
        FROM users 
        WHERE display_id LIKE 'SIA%' 
        ORDER BY display_id DESC 
        LIMIT 1
      `;

      let nextNumericPart: bigint;
      if (maxDisplayIdResult && maxDisplayIdResult.length > 0 && maxDisplayIdResult[0].display_id) {
        // Extract numeric part from existing display_id (e.g., "SIA03943" -> 3943)
        const numericStr = maxDisplayIdResult[0].display_id.replace('SIA', '');
        const maxNumeric = BigInt(numericStr);
        nextNumericPart = maxNumeric + 1n;
      } else {
        // If no existing SIA user, start from base
        nextNumericPart = DISPLAY_ID_BASE;
      }

      const displayId = `SIA${nextNumericPart.toString().padStart(5, '0')}`;

      const updated = await tx.users.update({
        where: { id: created.id },
        data: { display_id: displayId }
      });

      // closure table maintenance
      // 1) self path depth 0
      await tx.user_tree_paths.create({ 
        data: { ancestor_id: created.id, descendant_id: created.id, depth: 0 } 
      });

      // 2) inherit ancestors from referrer (if any) and add referrer as depth 1
      if (created.referrer_user_id) {
        // referrer as ancestor depth 1
        await tx.user_tree_paths.create({
          data: {
            ancestor_id: created.referrer_user_id,
            descendant_id: created.id,
            depth: 1,
          },
        });

        // all ancestors of referrer (except referrer itself) become ancestors of created with +1 depth
        const ancestors = await tx.user_tree_paths.findMany({
          where: { 
            descendant_id: created.referrer_user_id,
            NOT: { ancestor_id: created.referrer_user_id }  // exclude self-path of referrer
          },
        });
        for (const a of ancestors) {
          await tx.user_tree_paths.create({
            data: {
              ancestor_id: a.ancestor_id,
              descendant_id: created.id,
              depth: a.depth + 1,
            },
          });
        }
      }

      return updated;
    });
    
    // Send login credentials via SMS using DLT Template
    if (Fast2SMSService.isConfigured() && user.phone && user.display_id) {
      try {
        const loginCredentialsResult = await Fast2SMSService.sendLoginCredentials(
          user.phone,
          user.name || 'User',
          user.display_id,
          passwordPlain
        );
        if (loginCredentialsResult.success) {
          console.log(`[Registration] ✅ Login credentials sent successfully to ${user.phone}, Request ID: ${loginCredentialsResult.requestId}`);
        } else {
          console.error(`[Registration] ❌ Failed to send login credentials via Fast2SMS: ${loginCredentialsResult.error}`);
        }
      } catch (error: any) {
        console.error(`[Registration] ❌ Error sending login credentials via Fast2SMS:`, error?.message || error);
        // Continue even if SMS fails - registration is successful
      }
    }
    
    // Convert BigInt to string for response
    const payload = { 
      id: user.id.toString(),
      display_id: user.display_id,
      name: user.name, 
      email: user.email,
      phone: user.phone,
      role: user.role,
      referrer_user_id: user.referrer_user_id ? user.referrer_user_id.toString() : null 
    };
    
    return reply.code(201).send(payload);
  });

  /**
   * @openapi
   * /api/v1/auth/admin/login:
   *   post:
   *     tags:
   *       - Authentication
   *     summary: Admin login
   *     description: |
   *       Authenticate an admin user using email and password.
   *       Returns JWT token for admin session management.
   *       The returned token can be used in Authorization header for admin endpoints.
   *     operationId: adminLogin
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - password
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 description: Admin email address
   *                 example: "admin@example.com"
   *               password:
   *                 type: string
   *                 description: Admin password
   *                 example: "password123"
   *     responses:
   *       '200':
   *         description: Admin login successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 token:
   *                   type: string
   *                   description: JWT token for admin authentication
   *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   *                 admin:
   *                   type: object
   *                   properties:
   *                     role:
   *                       type: string
   *                       example: "admin"
   *                     authenticated:
   *                       type: boolean
   *                       example: true
   *       '401':
   *         description: Invalid credentials
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "invalid_credentials"
   *       '404':
   *         description: User not found
   */
  app.post('/admin/login', {
    schema: {
      description: 'Admin login - returns JWT token for authorization. Supports both email/password and admin_token methods.',
      tags: ['Authentication'],
      summary: 'Admin Login',
      operationId: 'adminLogin',
      consumes: ['application/json'],
      body: {
        type: 'object',
        oneOf: [
          {
            required: ['email', 'password'],
            properties: {
              email: {
                type: 'string',
                format: 'email',
                description: 'Admin email address'
              },
              password: {
                type: 'string',
                description: 'Admin password'
              }
            }
          },
          {
            required: ['admin_token'],
            properties: {
              admin_token: {
                type: 'string',
                description: 'Direct admin token (from ADMIN_TOKEN env var)'
              }
            }
          }
        ]
      },
      response: {
        200: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: 'JWT token for admin authentication'
            },
            admin: {
              type: 'object',
              properties: {
                role: { type: 'string' },
                authenticated: { type: 'boolean' }
              }
            }
        }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (req, reply) => {
    const body = z.object({
      email: z.string().email('Invalid email format'),
      password: z.string().min(1, 'Password is required')
    }).parse(req.body);
    
    // Prefer admin account when email is shared with a regular user
    const user = await prisma.users.findFirst({
      where: {
        email: body.email,
        role: { in: ['SUPER_ADMIN', 'SUB_ADMIN'] },
      },
      select: { id: true, email: true, password_hash: true, role: true, status: true }
    });

    if (!user) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }

    // Check if user is admin (SUPER_ADMIN or SUB_ADMIN)
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'SUB_ADMIN') {
      return reply.code(403).send({ error: 'forbidden', message: 'Admin access required' });
    }

    // Check if user is active
    if (user.status !== 'active') {
      return reply.code(403).send({ error: 'account_blocked', message: 'Your account has been blocked' });
    }

    // Validate password exists
    if (!user.password_hash) {
      return reply.code(401).send({ error: 'password_not_set' });
    }

    // Verify password (plain text comparison - matching existing system)
    const isValidPassword = body.password === user.password_hash;
    if (!isValidPassword) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }

    // Generate JWT token for admin session
    // Use ADMIN_JWT_SECRET if available, otherwise use JWT_SECRET
    const adminJwtSecret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'dev-secret';
    const adminJwtExpiresIn = process.env.ADMIN_JWT_EXPIRES_IN || '24h';

    // Sign token with admin secret (not regular JWT_SECRET)
    const token = jwt.sign(
      { 
        role: user.role,
        admin: true,
        authenticated: true,
        user_id: user.id.toString()
      },
      adminJwtSecret,
      { expiresIn: adminJwtExpiresIn }
    );

    return reply.send({
      token,
      admin: {
        role: user.role,
        authenticated: true
      }
    });
  });

  /**
   * @openapi
   * /api/v1/auth/forgot-password/send-otp:
   *   post:
   *     tags:
   *       - Authentication
   *     summary: Send OTP for password reset
   *     description: |
   *       Send OTP to user's mobile number for password reset.
   *       User must exist in the system.
   *     operationId: forgotPasswordSendOtp
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
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "OTP sent successfully"
   *       '404':
   *         description: User not found
   *       '400':
   *         description: Invalid mobile number
   */
  app.post('/forgot-password/send-otp', {
    schema: {
      description: 'Send email OTP for password reset',
      tags: ['Authentication'],
      summary: 'Send OTP for Password Reset',
      operationId: 'forgotPasswordSendOtp',
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            email_masked: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    const body = z.object({
      email: z.string().email(),
    }).parse(req.body);

    const email = body.email.trim();
    const normalizedEmail = email.toLowerCase();

    if (!EmailService.isConfigured()) {
      return reply.code(503).send({
        success: false,
        message: 'Email OTP service is not configured. Please contact support.',
      });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, email: true },
    });

    if (!user || !user.email) {
      return reply.code(404).send({
        error: 'user_not_found',
        message: 'No account found with this email address',
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + FORGOT_PASSWORD_OTP_TTL_MS;
    forgotPasswordOtpStore.set(normalizedEmail, { otp, expiresAt });

    const sendResult = await EmailService.sendForgotPasswordOTP(user.email, otp);
    if (!sendResult.success) {
      forgotPasswordOtpStore.delete(normalizedEmail);
      return reply.code(500).send({
        success: false,
        message: sendResult.error || 'Failed to send OTP email. Please try again.',
      });
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Forgot Password] Dev OTP for ${normalizedEmail}: ${otp}`);
    }

    return reply.send({
      success: true,
      message: 'OTP sent to your email address',
      email_masked: EmailService.maskEmail(user.email),
    });
  });

  /**
   * @openapi
   * /api/v1/auth/forgot-password/verify-otp:
   *   post:
   *     tags:
   *       - Authentication
   *     summary: Verify OTP for password reset
   *     description: |
   *       Verify OTP sent to mobile number. Returns reset token if successful.
   *     operationId: forgotPasswordVerifyOtp
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
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "OTP verified successfully"
   *                 resetToken:
   *                   type: string
   *                   description: Token to use for password reset
   *       '400':
   *         description: Invalid OTP or expired
   */
  app.post('/forgot-password/verify-otp', {
    schema: {
      description: 'Verify email OTP for password reset',
      tags: ['Authentication'],
      summary: 'Verify OTP for Password Reset',
      operationId: 'forgotPasswordVerifyOtp',
      body: {
        type: 'object',
        required: ['email', 'otp'],
        properties: {
          email: { type: 'string', format: 'email' },
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
          },
        },
      },
    },
  }, async (req, reply) => {
    const body = z.object({
      email: z.string().email(),
      otp: z.string().regex(/^[0-9]{6}$/),
    }).parse(req.body);

    const normalizedEmail = body.email.trim().toLowerCase();
    const stored = forgotPasswordOtpStore.get(normalizedEmail);

    if (!stored) {
      return reply.code(400).send({ error: 'otp_not_found' });
    }

    if (Date.now() > stored.expiresAt) {
      forgotPasswordOtpStore.delete(normalizedEmail);
      return reply.code(400).send({ error: 'otp_expired' });
    }

    if (stored.otp !== body.otp) {
      return reply.code(400).send({ error: 'invalid_otp' });
    }

    const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const resetTokenExpiresAt = Date.now() + 15 * 60 * 1000;

    forgotPasswordOtpStore.delete(normalizedEmail);
    forgotPasswordStore.set(normalizedEmail, { resetToken, expiresAt: resetTokenExpiresAt });

    return reply.send({
      success: true,
      message: 'OTP verified successfully',
      resetToken,
    });
  });

  /**
   * @openapi
   * /api/v1/auth/forgot-password/reset:
   *   post:
   *     tags:
   *       - Authentication
   *     summary: Reset password
   *     description: |
   *       Reset password using verified reset token.
   *     operationId: forgotPasswordReset
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - mobile
   *               - resetToken
   *               - newPassword
   *             properties:
   *               mobile:
   *                 type: string
   *                 pattern: '^[0-9]{10}$'
   *                 description: 10-digit mobile number
   *                 example: "9876543210"
   *               resetToken:
   *                 type: string
   *                 description: Reset token from verify-otp
   *               newPassword:
   *                 type: string
   *                 minLength: 6
   *                 description: New password (minimum 6 characters)
   *     responses:
   *       '200':
   *         description: Password reset successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Password reset successfully"
   *       '400':
   *         description: Invalid reset token or expired
   *       '404':
   *         description: User not found
   */
  app.post('/forgot-password/reset', {
    schema: {
      description: 'Reset password',
      tags: ['Authentication'],
      summary: 'Reset Password',
      operationId: 'forgotPasswordReset',
      body: {
        type: 'object',
        required: ['email', 'resetToken', 'newPassword'],
        properties: {
          email: { type: 'string', format: 'email' },
          resetToken: { type: 'string' },
          newPassword: { type: 'string', minLength: 6 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (req, reply) => {
    const body = z.object({
      email: z.string().email(),
      resetToken: z.string().min(1),
      newPassword: z.string().min(6, 'Password must be at least 6 characters'),
    }).parse(req.body);

    const email = body.email.trim();
    const normalizedEmail = email.toLowerCase();
    const stored = forgotPasswordStore.get(normalizedEmail);

    if (!stored) {
      return reply.code(400).send({ error: 'reset_token_not_found' });
    }

    if (Date.now() > stored.expiresAt) {
      forgotPasswordStore.delete(normalizedEmail);
      return reply.code(400).send({ error: 'reset_token_expired' });
    }

    if (stored.resetToken !== body.resetToken) {
      return reply.code(400).send({ error: 'invalid_reset_token' });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });

    if (!user) {
      forgotPasswordStore.delete(normalizedEmail);
      return reply.code(404).send({ error: 'user_not_found' });
    }

    await prisma.users.update({
      where: { id: user.id },
      data: {
        password_hash: body.newPassword,
        password_plain: body.newPassword,
      },
    });

    forgotPasswordStore.delete(normalizedEmail);
    
    console.log(`[Forgot Password] Password reset successfully for user ID: ${user.id}`);
    
    return reply.send({
      success: true,
      message: 'Password reset successfully'
    });
  });

  /**
   * GET /api/v1/auth/referrer/:displayId
   * Public endpoint to get referrer name by display_id (for registration form)
   */
  app.get('/referrer/:displayId', {
    schema: {
      description: 'Get referrer name by display_id (public endpoint for registration)',
      tags: ['Authentication'],
      summary: 'Get Referrer Name',
      params: {
        type: 'object',
        required: ['displayId'],
        properties: {
          displayId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            display_id: { type: 'string' },
            name: { type: ['string', 'null'] },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { displayId } = request.params as { displayId: string };
      
      const user = await prisma.users.findUnique({
        where: { display_id: displayId.toUpperCase() },
        select: {
          display_id: true,
          name: true,
        },
      });

      if (!user) {
        return reply.code(404).send({ error: 'Referrer not found' });
      }

      return reply.send({
        display_id: user.display_id,
        name: user.name,
      });
    } catch (error) {
      console.error('Error getting referrer name:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

