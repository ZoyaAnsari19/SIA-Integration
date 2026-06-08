import { FastifyInstance } from 'fastify';
import { requireUser } from '../middleware/jwt.js';
import { bunnyCDNService } from '../modules/bunny-cdn/bunny-cdn.service.js';

// Allowed image MIME types for KYC documents
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE_MB = 10;

export async function kycDocumentUploadRoutes(app: FastifyInstance) {
  /**
   * POST /api/v1/user/kyc/document
   * Upload KYC document image (front or back) to Bunny CDN
   * Returns CDN URL to be used in KYC submission
   */
  app.post(
    '/user/kyc/document',
    {
      preHandler: [requireUser],
      schema: {
        description: 'Upload KYC document image (front or back) to Bunny CDN. Returns CDN URL to be used in KYC submission.',
        tags: ['KYC'],
        consumes: ['multipart/form-data'],
        params: {
          type: 'object',
          properties: {
            document_type: { type: 'string' },
            side: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            document_type: { type: 'string' },
            side: { type: 'string' },
          },
        },
        body: false,
        response: {
          200: {
            type: 'object',
            properties: {
              image_url: { type: 'string', description: 'CDN URL of uploaded image' },
              document_type: { type: 'string' },
              side: { type: 'string' },
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

        // Get document_type and side from query params (simpler than parsing multipart fields)
        const query = request.query as any;
        const documentType = query.document_type;
        const side = query.side;

        if (!documentType || !['aadhar', 'pan', 'passport', 'driving_license', 'bank_statement', 'others'].includes(documentType)) {
          return reply.code(400).send({ message: 'Valid document_type query parameter is required (aadhar, pan, passport, driving_license, bank_statement, others)' });
        }

        if (!side || !['front', 'back'].includes(side)) {
          return reply.code(400).send({ message: 'Valid side query parameter is required (front or back)' });
        }

        // Get uploaded file - same simple approach as profile photo
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

        // Generate unique filename
        const timestamp = Date.now();
        const extension = data.filename.split('.').pop() || 'jpg';
        const filename = `kyc_${userId}_${documentType}_${side}_${timestamp}.${extension}`;

        // Upload to Bunny CDN in kyc_documents folder
        const cdnUrl = await bunnyCDNService.uploadFile(
          fileBuffer,
          filename,
          'kyc_documents'
        );

        return reply.send({
          image_url: cdnUrl,
          document_type: documentType,
          side: side,
          uploaded_at: new Date().toISOString(),
        });
      } catch (error: any) {
        console.error('KYC document upload error:', error);
        console.error('Error details:', {
          message: error?.message,
          stack: error?.stack,
          code: error?.code,
        });
        return reply.code(500).send({
          message: error?.message || 'Failed to upload KYC document',
          details: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
        });
      }
    }
  );
}

