import { FastifyInstance } from 'fastify';
import { adminAuth } from '../middleware/adminAuth.js';
import { checkPermission } from '../middleware/checkPermission.js';
import { KYCService } from '../modules/kyc/kycService.js';
import { kycRejectSchema } from '../modules/kyc/kycValidation.js';
import { prisma } from '../config/prisma.js';
import { logAdminActivity, getRequestInfo } from '../utils/adminActivityLogger.js';

export async function adminKYCRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/admin/kyc/pending:
   *   get:
   *     tags:
   *       - Admin KYC
   *     summary: List all pending KYC submissions
   *     description: |
   *       Retrieve a list of all users whose KYC status is 'submitted' and awaiting admin review.
   *       This endpoint is only accessible to administrators and returns basic user information
   *       along with submission timestamps.
   *     operationId: getPendingKYCs
   *     security:
   *       - adminAuth: []
   *     responses:
   *       '200':
   *         description: List of pending KYC submissions
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 count:
   *                   type: number
   *                   description: Total number of pending KYCs
   *                   example: 2
   *                 items:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       user_id:
   *                         type: string
   *                         example: "7"
   *                       name:
   *                         type: string
   *                         nullable: true
   *                         example: "Test User"
   *                       email:
   *                         type: string
   *                         nullable: true
   *                         example: "test@example.com"
   *                       kyc_status:
   *                         type: string
   *                         example: "submitted"
   *                       submitted_at:
   *                         type: string
   *                         format: date-time
   *                         example: "2025-11-08T11:23:27.750Z"
   *       '401':
   *         description: Unauthorized - Invalid or missing admin token
   *       '500':
   *         description: Internal server error
   */
  app.get('/kyc/pending', {
    preHandler: [adminAuth, checkPermission('KYC_VIEW')],
    schema: {
      description: 'List all pending KYC submissions',
      tags: ['Admin KYC'],
      summary: 'Get Pending KYCs',
      response: {
        200: {
          type: 'object',
          properties: {
            count: { type: 'number' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  user_id: { type: 'string' },
                  display_id: { type: 'string', nullable: true },
                  name: { type: 'string', nullable: true },
                  email: { type: 'string', nullable: true },
                  kyc_status: { type: 'string' },
                  kyc_verified_at: { type: 'string', format: 'date-time', nullable: true },
                  created_at: { type: 'string', format: 'date-time' },
                  submitted_at: { type: 'string', format: 'date-time', nullable: true },
                  profile: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      phone: { type: 'string', nullable: true },
                      account_holder: { type: 'string', nullable: true },
                      date_of_birth: { type: 'string', format: 'date-time', nullable: true },
                      address: { type: 'string', nullable: true },
                      city: { type: 'string', nullable: true },
                      state: { type: 'string', nullable: true },
                      pincode: { type: 'string', nullable: true },
                      bank_account_no: { type: 'string', nullable: true },
                      bank_ifsc: { type: 'string', nullable: true },
                      bank_name: { type: 'string', nullable: true },
                      bank_branch: { type: 'string', nullable: true },
                      pan_number: { type: 'string', nullable: true },
                      aadhar_number: { type: 'string', nullable: true },
                    }
                  }
                }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      },
      security: [{ adminAuth: [] }]
    }
  }, async (_req, reply) => {
    try {
      const pendingKYCs = await KYCService.getPendingKYCs();
      return reply.send({
        count: pendingKYCs.length,
        items: pendingKYCs,
      });
    } catch (error) {
      console.error('Error getting pending KYCs:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/kyc/counts:
   *   get:
   *     tags:
   *       - Admin KYC
   *     summary: Get KYC status counts
   *     description: Returns counts of users by KYC status (pending/submitted, approved, rejected). Use for stable tab badges.
   *     operationId: getKYCCounts
   *     security:
   *       - adminAuth: []
   *     responses:
   *       '200':
   *         description: Counts by status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 pending: { type: 'number', description: 'Submitted, awaiting review' },
   *                 approved: { type: 'number' },
   *                 rejected: { type: 'number' }
   *       '401':
   *         description: Unauthorized
   *       '500':
   *         description: Internal server error
   */
  app.get('/kyc/counts', {
    preHandler: [adminAuth, checkPermission('KYC_VIEW')],
    schema: {
      description: 'Get KYC status counts for tab badges',
      tags: ['Admin KYC'],
      summary: 'Get KYC Counts',
      response: {
        200: {
          type: 'object',
          properties: {
            pending: { type: 'number' },
            approved: { type: 'number' },
            rejected: { type: 'number' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
      security: [{ adminAuth: [] }],
    },
  }, async (_req, reply) => {
    try {
      const [pending, approved, rejected] = await Promise.all([
        prisma.users.count({ where: { kyc_status: 'submitted' } }),
        prisma.users.count({ where: { kyc_status: 'approved' } }),
        prisma.users.count({ where: { kyc_status: 'rejected' } }),
      ]);
      return reply.send({ pending, approved, rejected });
    } catch (error) {
      console.error('Error getting KYC counts:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/kyc/{user_id}/approve:
   *   post:
   *     tags:
   *       - Admin KYC
   *     summary: Approve user KYC submission
   *     description: |
   *       Approve a user's KYC submission. This action will:
   *       - Set the user's KYC status to 'approved'
   *       - Set the kyc_verified_at timestamp
   *       - Update all submitted documents to 'approved' status
   *       - Make the user's profile visible via the profile endpoint
   *       
   *       **Note:** Only users with KYC status 'submitted' can be approved.
   *     operationId: approveKYC
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: user_id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID to approve
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties: {}
   *     responses:
   *       '200':
   *         description: KYC approved successfully
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
   *                   example: "KYC approved successfully"
   *                 user_id:
   *                   type: string
   *                   example: "7"
   *       '400':
   *         description: Invalid KYC status (not in 'submitted' state)
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "Invalid KYC status"
   *                 message:
   *                   type: string
   *                   example: "User KYC status is 'pending', expected 'submitted'"
   *       '401':
   *         description: Unauthorized - Invalid or missing admin token
   *       '404':
   *         description: User not found
   *       '500':
   *         description: Internal server error
   */
  app.post('/kyc/:user_id/approve', {
    preHandler: [adminAuth, checkPermission('KYC_APPROVE')],
    schema: {
      description: 'Approve user KYC submission',
      tags: ['Admin KYC'],
      summary: 'Approve KYC',
      params: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'User ID to approve' }
        },
        required: ['user_id']
      },
      body: {
        type: 'object',
        properties: {}
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            user_id: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      },
      security: [{ adminAuth: [] }]
    }
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).user_id);

      // Check if user exists
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { id: true, kyc_status: true },
      });

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      if (user.kyc_status !== 'submitted') {
        return reply.code(400).send({ 
          error: 'Invalid KYC status',
          message: `User KYC status is '${user.kyc_status}', expected 'submitted'`,
        });
      }

      await KYCService.approveKYC(userId);

      // Log admin activity
      const admin = (req as any).admin;
      if (admin?.user_id) {
        const { ipAddress, userAgent } = getRequestInfo(req);
        const user = await prisma.users.findUnique({
          where: { id: userId },
          select: { display_id: true, name: true, email: true },
        });
        
        logAdminActivity({
          adminUserId: BigInt(admin.user_id),
          actionType: 'KYC_APPROVE',
          targetUserId: userId,
          targetEntityType: 'kyc',
          targetEntityId: userId.toString(),
          actionDetails: {
            user_display_id: user?.display_id || null,
            user_name: user?.name || null,
            user_email: user?.email || null,
          },
          ipAddress,
          userAgent,
          status: 'success',
        });
      }

      return reply.send({
        success: true,
        message: 'KYC approved successfully',
        user_id: userId.toString(),
      });
    } catch (error) {
      console.error('Error approving KYC:', error);
      
      // Log failed activity
      const admin = (req as any).admin;
      if (admin?.user_id) {
        const { ipAddress, userAgent } = getRequestInfo(req);
        logAdminActivity({
          adminUserId: BigInt(admin.user_id),
          actionType: 'KYC_APPROVE',
          targetUserId: userId,
          targetEntityType: 'kyc',
          targetEntityId: userId.toString(),
          ipAddress,
          userAgent,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
      }
      
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/kyc/{user_id}/reject:
   *   post:
   *     tags:
   *       - Admin KYC
   *     summary: Reject user KYC submission
   *     description: |
   *       Reject a user's KYC submission with a reason. This action will:
   *       - Set the user's KYC status to 'rejected'
   *       - Set the kyc_verified_at timestamp
   *       - Update all submitted documents to 'rejected' status
   *       - Store the rejection reason for user reference
   *       
       *       **Note:** Users with KYC status 'pending' or 'submitted' can be rejected.
   *     operationId: rejectKYC
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: user_id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID to reject
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - reason
   *             properties:
   *               reason:
   *                 type: string
   *                 minLength: 1
   *                 description: Reason for rejection (required)
   *                 example: "Aadhar image is unclear. Please upload a clear image."
   *     responses:
   *       '200':
   *         description: KYC rejected successfully
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
   *                   example: "KYC rejected successfully"
   *                 user_id:
   *                   type: string
   *                   example: "7"
   *                 reason:
   *                   type: string
   *                   example: "Aadhar image is unclear. Please upload a clear image."
   *       '400':
   *         description: Invalid KYC status or validation error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "Validation error"
   *                 details:
   *                   type: array
   *       '401':
   *         description: Unauthorized - Invalid or missing admin token
   *       '404':
   *         description: User not found
   *       '500':
   *         description: Internal server error
   */
  app.post('/kyc/:user_id/reject', {
    preHandler: [adminAuth, checkPermission('KYC_APPROVE')],
    schema: {
      description: 'Reject user KYC submission with reason',
      tags: ['Admin KYC'],
      summary: 'Reject KYC',
      params: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'User ID to reject' }
        },
        required: ['user_id']
      },
      body: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Reason for rejection' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            user_id: { type: 'string' },
            reason: { type: 'string', nullable: true }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'array' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      },
      security: [{ adminAuth: [] }]
    }
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).user_id);
      const body = kycRejectSchema.parse(req.body);

      // Check if user exists
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { id: true, kyc_status: true },
      });

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      if (user.kyc_status !== 'submitted') {
        return reply.code(400).send({ 
          error: 'Invalid KYC status',
          message: `User KYC status is '${user.kyc_status}', expected 'submitted'`,
        });
      }

      await KYCService.rejectKYC(userId, body.reason);

      // Log admin activity
      const admin = (req as any).admin;
      if (admin?.user_id) {
        const { ipAddress, userAgent } = getRequestInfo(req);
        const user = await prisma.users.findUnique({
          where: { id: userId },
          select: { display_id: true, name: true, email: true },
        });
        
        logAdminActivity({
          adminUserId: BigInt(admin.user_id),
          actionType: 'KYC_REJECT',
          targetUserId: userId,
          targetEntityType: 'kyc',
          targetEntityId: userId.toString(),
          actionDetails: {
            user_display_id: user?.display_id || null,
            user_name: user?.name || null,
            user_email: user?.email || null,
            rejection_reason: body.reason,
          },
          ipAddress,
          userAgent,
          status: 'success',
        });
      }

      return reply.send({
        success: true,
        message: 'KYC rejected successfully',
        user_id: userId.toString(),
        reason: body.reason,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      console.error('Error rejecting KYC:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/kyc/{user_id}/documents:
   *   get:
   *     tags:
   *       - Admin KYC
   *     summary: View all uploaded documents for a user
   *     description: |
   *       Retrieve all KYC documents uploaded by a specific user. This endpoint provides administrators
   *       with complete access to view all document submissions including:
   *       - Document types and numbers
   *       - Image URLs (front and back)
   *       - Document status and verification details
   *       - Rejection reasons (if applicable)
   *       - Verification timestamps
   *     operationId: getUserDocuments
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: user_id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID to view documents for
   *     responses:
   *       '200':
   *         description: User documents retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user:
   *                   type: object
   *                   properties:
   *                     user_id:
   *                       type: string
   *                       example: "7"
   *                     name:
   *                       type: string
   *                       nullable: true
   *                       example: "Test User"
   *                     email:
   *                       type: string
   *                       nullable: true
   *                       example: "test@example.com"
   *                     kyc_status:
   *                       type: string
   *                       example: "submitted"
   *                 documents:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         example: "1"
   *                       document_type:
   *                         type: string
   *                         example: "aadhar"
   *                       document_number:
   *                         type: string
   *                         nullable: true
   *                         example: "123456789012"
   *                       front_image_url:
   *                         type: string
   *                         format: uri
   *                         nullable: true
   *                         example: "https://example.com/aadhar-front.jpg"
   *                       back_image_url:
   *                         type: string
   *                         format: uri
   *                         nullable: true
   *                         example: "https://example.com/aadhar-back.jpg"
   *                       status:
   *                         type: string
   *                         example: "submitted"
   *                       rejection_reason:
   *                         type: string
   *                         nullable: true
   *                         example: null
   *                       submitted_at:
   *                         type: string
   *                         format: date-time
   *                         example: "2025-11-08T11:23:33.394Z"
   *                       verified_at:
   *                         type: string
   *                         format: date-time
   *                         nullable: true
   *                         example: null
   *                       verified_by:
   *                         type: string
   *                         nullable: true
   *                         example: null
   *       '401':
   *         description: Unauthorized - Invalid or missing admin token
   *       '404':
   *         description: User not found
   *       '500':
   *         description: Internal server error
   */
  /**
   * @openapi
   * /api/v1/admin/kyc/{user_id}/update:
   *   put:
   *     tags:
   *       - Admin KYC
   *     summary: Update user KYC status
   *     description: |
   *       Update a user's KYC status directly. This endpoint allows admins to set any KYC status
   *       (pending, submitted, approved, rejected) and optionally provide a rejection reason.
   *     operationId: updateUserKYCStatus
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: user_id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - kyc_status
   *             properties:
   *               kyc_status:
   *                 type: string
   *                 enum: [pending, submitted, approved, rejected]
   *                 description: New KYC status
   *               rejection_reason:
   *                 type: string
   *                 description: Reason for rejection (optional, only for rejected status)
   *     responses:
   *       '200':
   *         description: KYC status updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user_id:
   *                   type: string
   *                   example: "7"
   *                 kyc_status:
   *                   type: string
   *                   example: "approved"
   *                 kyc_verified_at:
   *                   type: string
   *                   format: date-time
   *                   nullable: true
   *                 updated_at:
   *                   type: string
   *                   format: date-time
   *       '400':
   *         description: Invalid request data
   *       '401':
   *         description: Unauthorized
   *       '404':
   *         description: User not found
   *       '500':
   *         description: Internal server error
   */
  app.put('/kyc/:user_id/update', {
    preHandler: [adminAuth, checkPermission('KYC_APPROVE')],
    schema: {
      description: 'Update user KYC status',
      tags: ['Admin KYC'],
      summary: 'Update KYC Status',
      params: {
        type: 'object',
        required: ['user_id'],
        properties: {
          user_id: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['kyc_status'],
        properties: {
          kyc_status: { 
            type: 'string', 
            enum: ['pending', 'submitted', 'approved', 'rejected'] 
          },
          rejection_reason: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            kyc_status: { type: 'string' },
            kyc_verified_at: { type: 'string', format: 'date-time', nullable: true },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
      },
      security: [{ adminAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).user_id);
      const { kyc_status, rejection_reason } = req.body as any;

      // Check if user exists
      const existingUser = await prisma.users.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Build update data
      const updateData: any = {
        kyc_status,
        updated_at: new Date(),
      };

      // Set kyc_verified_at if approved
      if (kyc_status === 'approved') {
        updateData.kyc_verified_at = new Date();
      }

      // Update user
      const updatedUser = await prisma.users.update({
        where: { id: userId },
        data: updateData,
      });

      // If rejected, update kyc_documents with rejection_reason
      if (kyc_status === 'rejected' && rejection_reason) {
        await prisma.kyc_documents.updateMany({
          where: { user_id: userId },
          data: {
            rejection_reason,
            status: 'rejected',
            updated_at: new Date(),
          },
        });
      }

      // Log admin activity for KYC status changes
      const admin = (req as any).admin;
      if (admin?.user_id && (kyc_status === 'approved' || kyc_status === 'rejected')) {
        const { ipAddress, userAgent } = getRequestInfo(req);
        const user = await prisma.users.findUnique({
          where: { id: userId },
          select: { display_id: true, name: true, email: true },
        });
        
        logAdminActivity({
          adminUserId: BigInt(admin.user_id),
          actionType: kyc_status === 'approved' ? 'KYC_APPROVE' : 'KYC_REJECT',
          targetUserId: userId,
          targetEntityType: 'kyc',
          targetEntityId: userId.toString(),
          actionDetails: {
            user_display_id: user?.display_id || null,
            user_name: user?.name || null,
            user_email: user?.email || null,
            old_status: existingUser.kyc_status,
            new_status: kyc_status,
            rejection_reason: kyc_status === 'rejected' ? rejection_reason : null,
          },
          ipAddress,
          userAgent,
          status: 'success',
        });
      }

      return reply.send({
        user_id: updatedUser.id.toString(),
        kyc_status: updatedUser.kyc_status,
        kyc_verified_at: updatedUser.kyc_verified_at,
        updated_at: updatedUser.updated_at,
      });
    } catch (error) {
      console.error('Error updating KYC status:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  app.get('/kyc/:user_id/documents', {
    preHandler: [adminAuth, checkPermission('KYC_VIEW')],
    schema: {
      description: 'View all uploaded documents for a user',
      tags: ['Admin KYC'],
      summary: 'View User Documents',
      params: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'User ID' }
        },
        required: ['user_id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                user_id: { type: 'string' },
                name: { type: 'string', nullable: true },
                email: { type: 'string', nullable: true },
                kyc_status: { type: 'string' }
              }
            },
            documents: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  document_type: { type: 'string' },
                  document_number: { type: 'string', nullable: true },
                  front_image_url: { type: 'string', nullable: true },
                  back_image_url: { type: 'string', nullable: true },
                  status: { type: 'string' },
                  rejection_reason: { type: 'string', nullable: true },
                  submitted_at: { type: 'string', format: 'date-time' },
                  verified_at: { type: 'string', format: 'date-time', nullable: true },
                  verified_by: { type: 'string', nullable: true }
                }
              }
            }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      },
      security: [{ adminAuth: [] }]
    }
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).user_id);
      const documents = await KYCService.getUserDocuments(userId);
      return reply.send(documents);
    } catch (error: any) {
      if (error.message === 'User not found') {
        return reply.code(404).send({ error: 'User not found' });
      }
      console.error('Error getting user documents:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/profiles:
   *   get:
   *     tags:
   *       - Admin KYC
   *     summary: Get all user profiles
   *     description: |
   *       Retrieve a list of all users with their profile information. This endpoint is only accessible to administrators.
   *       
   *       **Profile Visibility:**
   *       - Only users with KYC status 'approved' will have full profile details visible
   *       - Users with other KYC statuses (pending, submitted, rejected) will have profile field as null
   *       - This allows admins to see all users and their KYC status at a glance
   *     operationId: getAllProfiles
   *     security:
   *       - adminAuth: []
   *     responses:
   *       '200':
   *         description: List of all user profiles retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 count:
   *                   type: number
   *                   description: Total number of users
   *                   example: 10
   *                 items:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       user_id:
   *                         type: string
   *                         example: "7"
   *                       name:
   *                         type: string
   *                         nullable: true
   *                         example: "Test User"
   *                       email:
   *                         type: string
   *                         nullable: true
   *                         example: "test@example.com"
   *                       kyc_status:
   *                         type: string
   *                         enum: [pending, submitted, approved, rejected]
   *                         example: "approved"
   *                       kyc_verified_at:
   *                         type: string
   *                         format: date-time
   *                         nullable: true
   *                         example: "2025-11-08T11:23:45.695Z"
   *                       created_at:
   *                         type: string
   *                         format: date-time
   *                         example: "2025-11-08T10:00:00.000Z"
   *                       profile:
   *                         type: object
   *                         nullable: true
   *                         description: Full profile details (only available if KYC is approved)
   *                         properties:
   *                           phone:
   *                             type: string
   *                             nullable: true
   *                             example: "9876543210"
   *                           date_of_birth:
   *                             type: string
   *                             format: date-time
   *                             nullable: true
   *                             example: "1990-01-15T00:00:00.000Z"
   *                           address:
   *                             type: string
   *                             nullable: true
   *                             example: "123 Test Street"
   *                           city:
   *                             type: string
   *                             nullable: true
   *                             example: "Mumbai"
   *                           state:
   *                             type: string
   *                             nullable: true
   *                             example: "Maharashtra"
   *                           pincode:
   *                             type: string
   *                             nullable: true
   *                             example: "400001"
   *                           bank_account_no:
   *                             type: string
   *                             nullable: true
   *                             example: "1234567890"
   *                           bank_ifsc:
   *                             type: string
   *                             nullable: true
   *                             example: "SBIN0001234"
   *                           bank_name:
   *                             type: string
   *                             nullable: true
   *                             example: "State Bank"
   *                           pan_number:
   *                             type: string
   *                             nullable: true
   *                             example: "ABCDE1234F"
   *                           aadhar_number:
   *                             type: string
   *                             nullable: true
   *                             example: "123456789012"
   *       '401':
   *         description: Unauthorized - Invalid or missing admin token
   *       '500':
   *         description: Internal server error
   */
  app.get('/profiles', {
    preHandler: [adminAuth, checkPermission('KYC_VIEW')],
    schema: {
      description: 'Get all user profiles with pagination and filters (Admin only)',
      tags: ['Admin KYC'],
      summary: 'Get All Profiles',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1, minimum: 1 },
          limit: { type: 'number', default: 20, minimum: 1, maximum: 100 },
          user_id: { type: 'string' },
          name: { type: 'string' },
          start_date: { type: 'string', format: 'date' },
          end_date: { type: 'string', format: 'date' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            count: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            total_pages: { type: 'number' },
            total: { type: 'number' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  user_id: { type: 'string' },
                  display_id: { type: 'string', nullable: true },
                  name: { type: 'string', nullable: true },
                  email: { type: 'string', nullable: true },
                  kyc_status: { type: 'string' },
                  kyc_verified_at: { type: 'string', format: 'date-time', nullable: true },
                  created_at: { type: 'string', format: 'date-time' },
                  submitted_at: { type: 'string', format: 'date-time', nullable: true },
                  profile: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      phone: { type: 'string', nullable: true },
                      account_holder: { type: 'string', nullable: true },
                      date_of_birth: { type: 'string', format: 'date-time', nullable: true },
                      address: { type: 'string', nullable: true },
                      city: { type: 'string', nullable: true },
                      state: { type: 'string', nullable: true },
                      pincode: { type: 'string', nullable: true },
                      bank_account_no: { type: 'string', nullable: true },
                      bank_ifsc: { type: 'string', nullable: true },
                      bank_name: { type: 'string', nullable: true },
                      bank_branch: { type: 'string', nullable: true },
                      pan_number: { type: 'string', nullable: true },
                      aadhar_number: { type: 'string', nullable: true },
                    }
                  }
                }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      },
      security: [{ adminAuth: [] }]
    }
  }, async (req, reply) => {
    try {
      const query = req.query as any;
      const page = Math.max(1, parseInt(query.page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
      
      // Handle user_id and name filters
      const userWhere: any = {};
      if (query.user_id) {
        const userIdStr = String(query.user_id).trim();
        // Check if it's a numeric ID or display_id
        if (isNaN(Number(userIdStr))) {
          // It's a display_id, find the user first
          const user = await prisma.users.findFirst({
            where: { display_id: userIdStr },
            select: { id: true },
          });
          if (user) {
            userWhere.id = user.id;
          } else {
            // No user found with this display_id, return empty result
            return reply.send({
              count: 0,
              page,
              limit,
              total_pages: 0,
              total: 0,
              items: [],
            });
          }
        } else {
          // It's a numeric ID
          userWhere.id = BigInt(userIdStr);
        }
      }
      if (query.name) {
        userWhere.name = { contains: query.name, mode: 'insensitive' };
      }
      
      // Add date range filter for user creation date
      if (query.start_date || query.end_date) {
        userWhere.created_at = {};
        if (query.start_date) {
          // Create date at start of day in UTC (00:00:00.000 UTC)
          const startDateStr = query.start_date.toString();
          const [year, month, day] = startDateStr.split('-').map(Number);
          const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
          userWhere.created_at.gte = startDate;
          console.log(`[Admin KYC] Date filter - start_date: ${startDateStr} -> ${startDate.toISOString()} (UTC)`);
        }
        if (query.end_date) {
          // Create date at end of day in UTC (23:59:59.999 UTC)
          const endDateStr = query.end_date.toString();
          const [year, month, day] = endDateStr.split('-').map(Number);
          const endDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
          userWhere.created_at.lte = endDate;
          console.log(`[Admin KYC] Date filter - end_date: ${endDateStr} -> ${endDate.toISOString()} (UTC)`);
        }
      }

      const where: any = {};
      if (Object.keys(userWhere).length > 0) {
        const matchingUsers = await prisma.users.findMany({
          where: userWhere,
          select: { id: true },
        });
        if (matchingUsers.length === 0) {
          // No users match, return empty result
          return reply.send({
            count: 0,
            page,
            limit,
            total_pages: 0,
            total: 0,
            items: [],
          });
        }
        where.id = { in: matchingUsers.map(u => u.id) };
      }

      const [users, total] = await Promise.all([
        prisma.users.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { created_at: 'desc' },
          select: {
            id: true,
            display_id: true,
            name: true,
            email: true,
            kyc_status: true,
            kyc_verified_at: true,
            created_at: true,
          },
        }),
        prisma.users.count({ where }),
      ]);

      // Get user IDs for fetching profiles
      const userIds = users.map(u => u.id);

      // Fetch user profiles separately
      const userProfiles = await prisma.user_profiles.findMany({
        where: { user_id: { in: userIds } },
      });

      // Create a map for quick lookup
      const profileMap = new Map(userProfiles.map(p => [p.user_id.toString(), p]));

      // Fetch all kyc_documents for all users in one query (optimize N+1 problem)
      const allKycDocs = await prisma.kyc_documents.findMany({
        where: { user_id: { in: userIds } },
        select: { user_id: true, submitted_at: true },
        orderBy: { submitted_at: 'asc' },
      });

      // Create a map: user_id -> earliest submitted_at
      const kycDocMap = new Map<string, Date | null>();
      for (const doc of allKycDocs) {
        const userIdStr = doc.user_id.toString();
        if (!kycDocMap.has(userIdStr) || (doc.submitted_at && (!kycDocMap.get(userIdStr) || doc.submitted_at < kycDocMap.get(userIdStr)!))) {
          kycDocMap.set(userIdStr, doc.submitted_at);
        }
      }

      // Map users to items
      const items = users.map((user) => {
        const userProfile = profileMap.get(user.id.toString());
        const submittedAt = kycDocMap.get(user.id.toString()) || null;

        return {
          user_id: user.id.toString(),
          display_id: user.display_id,
          name: user.name,
          email: user.email,
          kyc_status: user.kyc_status,
          kyc_verified_at: user.kyc_verified_at,
          created_at: user.created_at,
          submitted_at: submittedAt,
          profile: userProfile
            ? {
                phone: userProfile.phone,
                account_holder: userProfile.bank_ac_holder || user.name, // Use bank_ac_holder from KYC form, fallback to user name
                date_of_birth: userProfile.date_of_birth,
                address: userProfile.address,
                city: userProfile.city,
                state: userProfile.state,
                pincode: userProfile.pincode,
                bank_account_no: userProfile.bank_account_no,
                bank_ifsc: userProfile.bank_ifsc,
                bank_name: userProfile.bank_name,
                bank_branch: userProfile.bank_branch,
                pan_number: userProfile.pan_number,
                aadhar_number: userProfile.aadhar_number,
              }
            : null,
        };
      });

      return reply.send({
        count: items.length,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
        total,
        items,
      });
    } catch (error) {
      console.error('Error getting all profiles:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

