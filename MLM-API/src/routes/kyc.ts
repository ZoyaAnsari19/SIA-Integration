import { FastifyInstance } from 'fastify';
import { requireUser } from '../middleware/jwt.js';
import { KYCService } from '../modules/kyc/kycService.js';
import { kycSubmitSchema } from '../modules/kyc/kycValidation.js';

export async function kycRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/users/{id}/kyc/submit:
   *   post:
   *     tags:
   *       - KYC
   *     summary: Submit KYC documents and profile information
     *     description: |
     *       Submit KYC (Know Your Customer) documents and profile information for verification.
     *       This endpoint allows users to submit their personal details, bank information, and identity documents.
     *       After submission, the KYC status will be set to 'submitted' and will be reviewed by an admin.
     *       
     *       **Important:** KYC submission is only allowed on specific dates of each month:
     *       - Blocked dates: 1, 9, 10, 19, 20, 29, 30, 31
     *       - KYC is allowed on all other dates
     *       
     *       **Required Fields:**
     *       - At least one document must be provided in the documents array
     *       
     *       **Document Types:**
     *       - aadhar, pan, passport, driving_license, bank_statement, others
   *     operationId: submitKYC
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID (must match authenticated user)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               phone:
   *                 type: string
   *                 minLength: 10
   *                 maxLength: 15
   *                 description: Contact phone number
   *                 example: "9876543210"
   *               date_of_birth:
   *                 type: string
   *                 format: date
   *                 description: Date of birth in YYYY-MM-DD format
   *                 example: "1990-01-15"
   *               address:
   *                 type: string
   *                 description: Residential address
   *                 example: "123 Test Street"
   *               city:
   *                 type: string
   *                 description: City name
   *                 example: "Mumbai"
   *               state:
   *                 type: string
   *                 description: State name
   *                 example: "Maharashtra"
   *               pincode:
   *                 type: string
   *                 minLength: 6
   *                 maxLength: 6
   *                 description: PIN code
   *                 example: "400001"
   *               pan_number:
   *                 type: string
   *                 minLength: 10
   *                 maxLength: 10
   *                 description: PAN card number
   *                 example: "ABCDE1234F"
   *               aadhar_number:
   *                 type: string
   *                 minLength: 12
   *                 maxLength: 12
   *                 description: Aadhar card number (12 digits)
   *                 example: "123456789012"
   *               bank_account_no:
   *                 type: string
   *                 description: Bank account number
   *                 example: "1234567890"
   *               bank_ifsc:
   *                 type: string
   *                 description: Bank IFSC code
   *                 example: "SBIN0001234"
   *               bank_name:
   *                 type: string
   *                 description: Bank name
   *                 example: "State Bank of India"
   *               documents:
   *                 type: array
   *                 minItems: 1
   *                 description: Array of identity documents
   *                 items:
   *                   type: object
   *                   required:
   *                     - document_type
   *                   properties:
   *                     document_type:
   *                       type: string
   *                       enum: [aadhar, pan, passport, driving_license, bank_statement, others]
   *                       description: Type of document
   *                       example: "aadhar"
   *                     document_number:
   *                       type: string
   *                       description: Document number (optional)
   *                       example: "123456789012"
   *                     front_image_url:
   *                       type: string
   *                       format: uri
   *                       description: URL of front side image
   *                       example: "https://example.com/aadhar-front.jpg"
   *                     back_image_url:
   *                       type: string
   *                       format: uri
   *                       description: URL of back side image (if applicable)
   *                       example: "https://example.com/aadhar-back.jpg"
   *     responses:
   *       '201':
   *         description: KYC submitted successfully
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
   *                   example: "KYC submitted successfully"
   *                 user_id:
   *                   type: string
   *                   example: "7"
   *              '400':
     *         description: Validation error or KYC submission not allowed on this date
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 error:
     *                   type: string
     *                   example: "kyc_submission_not_allowed" or "Validation error"
     *                 message:
     *                   type: string
     *                   example: "KYC submission is not allowed on dates 1, 9, 10, 19, 20, 29, 30 and 31 of each month. Today is 1. Please try again on another date."
     *                 details:
     *                   type: array
   *       '403':
   *         description: Forbidden - User can only submit their own KYC
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "Forbidden: You can only submit your own KYC"
   *       '500':
   *         description: Internal server error
   */
  app.post('/:id/kyc/submit', {
    preHandler: requireUser,
    schema: {
      description: 'Submit KYC documents and profile information',
      tags: ['KYC'],
      summary: 'Submit KYC',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'User ID' }
        },
        required: ['id']
      },
      // Disable Fastify schema validation - use Zod instead for better error messages
      body: false,
      response: {
        201: {
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
            details: { type: 'array' }
          }
        },
        403: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      },
      security: [{ bearerAuth: [] }]
    }
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).id);
      const authenticatedUser = (req as any).user;

      // Verify user can only submit their own KYC
      if (authenticatedUser.user_id !== userId.toString()) {
        return reply.code(403).send({ error: 'Forbidden: You can only submit your own KYC' });
      }

      // Parse and validate request body with detailed error messages
      let body;
      try {
        body = kycSubmitSchema.parse(req.body);
      } catch (error: any) {
        console.error('KYC submission validation error:', JSON.stringify(error, null, 2));
        console.error('Request body:', JSON.stringify(req.body, null, 2));
        
        const errorDetails = error.errors?.map((e: any) => ({
          field: e.path.join('.'),
          message: e.message,
          code: e.code,
        })) || [{ message: error.message || 'Validation failed' }];
        
        return reply.code(400).send({
          error: 'validation_error',
          message: 'KYC submission validation failed',
          details: errorDetails,
        });
      }

      // Check if KYC submission is allowed on current date
      const dateCheck = KYCService.isKYCSubmissionAllowed();
      if (!dateCheck.allowed) {
        return reply.code(400).send({
          error: 'kyc_submission_not_allowed',
          message: dateCheck.message || 'KYC submission is not allowed on this date'
        });
      }

      // Prepare submit data (date conversion handled in service)
      const submitData = {
        ...body,
        date_of_birth: body.date_of_birth as Date | string | undefined,
      };

      await KYCService.submitKYC(userId, submitData);

      return reply.code(201).send({
        success: true,
        message: 'KYC submitted successfully',
        user_id: userId.toString(),
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Validation error', details: error.errors });
      }
      if (error.code === 'INSUFFICIENT_BALANCE') {
        return reply.code(400).send({
          error: 'INSUFFICIENT_BALANCE',
          message: error.message || 'Insufficient balance for KYC submission',
          required_amount: error.required,
          available_balance: error.available,
        });
      }
      if (error.code === 'KYC_SUBMISSION_NOT_ALLOWED') {
        return reply.code(400).send({
          error: 'kyc_submission_not_allowed',
          message: error.message || 'KYC submission is not allowed on this date',
        });
      }
      console.error('Error submitting KYC:', error);
      console.error('Error stack:', error.stack);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return reply.code(500).send({ 
        error: 'Internal server error',
        message: error.message || 'An error occurred while submitting KYC',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  /**
   * @openapi
   * /api/v1/users/{id}/kyc/status:
   *   get:
   *     tags:
   *       - KYC
   *     summary: Get KYC status and uploaded documents
   *     description: |
   *       Retrieve the current KYC status and list of uploaded documents for the authenticated user.
   *       This endpoint returns the user's KYC status (pending, submitted, approved, rejected) along with
   *       all submitted documents and their verification status.
   *     operationId: getKYCStatus
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID (must match authenticated user)
   *     responses:
   *       '200':
   *         description: KYC status retrieved successfully
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
   *                   enum: [pending, submitted, approved, rejected]
   *                   example: "submitted"
   *                 kyc_verified_at:
   *                   type: string
   *                   format: date-time
   *                   nullable: true
   *                   example: null
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
   *       '403':
   *         description: Forbidden - User can only view their own KYC status
   *       '404':
   *         description: User not found
   *       '500':
   *         description: Internal server error
   */
  app.get('/:id/kyc/status', {
    preHandler: requireUser,
    schema: {
      description: 'Get KYC status and uploaded documents',
      tags: ['KYC'],
      summary: 'Get KYC Status',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'User ID' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            kyc_status: {
              type: 'string',
              enum: ['pending', 'submitted', 'approved', 'rejected']
            },
            kyc_verified_at: { type: 'string', format: 'date-time', nullable: true },
            documents: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  document_type: { type: 'string' },
                  document_number: { type: 'string', nullable: true },
                  status: { type: 'string' },
                  rejection_reason: { type: 'string', nullable: true },
                  submitted_at: { type: 'string', format: 'date-time' },
                  verified_at: { type: 'string', format: 'date-time', nullable: true }
                }
              }
            }
          }
        },
        403: {
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
      },
      security: [{ bearerAuth: [] }]
    }
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).id);
      const authenticatedUser = (req as any).user;

      // Verify user can only view their own KYC status
      if (authenticatedUser.user_id !== userId.toString()) {
        return reply.code(403).send({ error: 'Forbidden: You can only view your own KYC status' });
      }

      const status = await KYCService.getKYCStatus(userId);
      return reply.send(status);
    } catch (error: any) {
      if (error.message === 'User not found') {
        return reply.code(404).send({ error: 'User not found' });
      }
      console.error('Error getting KYC status:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/users/{id}/profile:
   *   get:
   *     tags:
   *       - KYC
   *     summary: Get user profile
   *     description: |
   *       Retrieve the complete user profile including personal details, bank information, and document numbers.
   *       Profile data is available regardless of KYC status.
   *     operationId: getUserProfile
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID (must match authenticated user)
   *     responses:
   *       '200':
   *         description: Profile retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user_id:
   *                   type: string
   *                   example: "7"
   *                 name:
   *                   type: string
   *                   nullable: true
   *                   example: "Test User"
   *                 email:
   *                   type: string
   *                   nullable: true
   *                   example: "test@example.com"
   *                 kyc_status:
   *                   type: string
   *                   example: "approved"
   *                 kyc_verified_at:
   *                   type: string
   *                   format: date-time
   *                   nullable: true
   *                   example: "2025-11-08T11:23:45.695Z"
   *                 profile:
   *                   type: object
   *                   nullable: true
   *                   properties:
   *                     phone:
   *                       type: string
   *                       nullable: true
   *                       example: "9876543210"
   *                     date_of_birth:
   *                       type: string
   *                       format: date-time
   *                       nullable: true
   *                       example: "1990-01-15T00:00:00.000Z"
   *                     address:
   *                       type: string
   *                       nullable: true
   *                       example: "123 Test Street"
   *                     city:
   *                       type: string
   *                       nullable: true
   *                       example: "Mumbai"
   *                     state:
   *                       type: string
   *                       nullable: true
   *                       example: "Maharashtra"
   *                     pincode:
   *                       type: string
   *                       nullable: true
   *                       example: "400001"
   *                     bank_account_no:
   *                       type: string
   *                       nullable: true
   *                       example: "1234567890"
   *                     bank_ifsc:
   *                       type: string
   *                       nullable: true
   *                       example: "SBIN0001234"
   *                     bank_name:
   *                       type: string
   *                       nullable: true
   *                       example: "State Bank"
   *                     pan_number:
   *                       type: string
   *                       nullable: true
   *                       example: "ABCDE1234F"
   *                     aadhar_number:
   *                       type: string
   *                       nullable: true
   *                       example: "123456789012"
   *       '403':
   *         description: Forbidden - User can only view their own profile
   *       '404':
   *         description: Profile not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "User not found"
   *       '500':
   *         description: Internal server error
   */
  app.get('/:id/profile', {
    preHandler: requireUser,
    schema: {
      description: 'Get user profile (available regardless of KYC status)',
      tags: ['KYC'],
      summary: 'Get User Profile',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'User ID' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            name: { type: 'string', nullable: true },
            email: { type: 'string', nullable: true },
            kyc_status: { type: 'string' },
            kyc_verified_at: { type: 'string', format: 'date-time', nullable: true },
            profile: {
              type: 'object',
              nullable: true,
              properties: {
                phone: { type: 'string', nullable: true },
                date_of_birth: { type: 'string', format: 'date-time', nullable: true },
                address: { type: 'string', nullable: true },
                city: { type: 'string', nullable: true },
                state: { type: 'string', nullable: true },
                pincode: { type: 'string', nullable: true },
                bank_account_no: { type: 'string', nullable: true },
                bank_ifsc: { type: 'string', nullable: true },
                bank_name: { type: 'string', nullable: true },
                pan_number: { type: 'string', nullable: true },
                aadhar_number: { type: 'string', nullable: true }
              }
            }
          }
        },
        403: {
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
      },
      security: [{ bearerAuth: [] }]
    }
  }, async (req, reply) => {
    try {
      const userId = BigInt((req.params as any).id);
      const authenticatedUser = (req as any).user;

      // Verify user can only view their own profile
      if (authenticatedUser.user_id !== userId.toString()) {
        return reply.code(403).send({ error: 'Forbidden: You can only view your own profile' });
      }

      const profile = await KYCService.getUserProfile(userId);
      return reply.send(profile);
    } catch (error: any) {
      if (error.message === 'User not found') {
        return reply.code(404).send({ error: 'User not found' });
      }
      console.error('Error getting user profile:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

