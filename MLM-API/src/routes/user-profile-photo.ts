import { FastifyInstance } from 'fastify';
import { requireUser } from '../middleware/jwt.js';
import { prisma } from '../config/prisma.js';
import { bunnyCDNService } from '../modules/bunny-cdn/bunny-cdn.service.js';

// Allowed image MIME types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE_MB = 5;

export async function userProfilePhotoRoutes(app: FastifyInstance) {
  // POST /api/v1/user/profile/photo - Upload profile photo
  app.post(
    '/profile/photo',
    {
      preHandler: [requireUser],
      schema: {
        description: 'Upload profile photo to Bunny CDN',
        tags: ['User'],
        consumes: ['multipart/form-data'],
        response: {
          200: {
            type: 'object',
            properties: {
              profile_photo_url: { type: 'string' },
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

        // Generate unique filename
        const filename = bunnyCDNService.generateFilename(userId, data.filename);

        // Upload to Bunny CDN
        const cdnUrl = await bunnyCDNService.uploadFile(
          fileBuffer,
          filename,
          'profile_photos'
        );

        // Get existing profile
        const existingProfile = await prisma.user_profiles.findUnique({
          where: { user_id: userId },
          select: { profile_photo_url: true },
        });

        // Delete old photo if exists
        if (existingProfile?.profile_photo_url) {
          try {
            // Extract path from CDN URL
            const oldPath = existingProfile.profile_photo_url.split('/').slice(3).join('/');
            await bunnyCDNService.deleteFile(oldPath);
          } catch (error) {
            // Log but don't fail if old photo deletion fails
            console.error('Failed to delete old profile photo:', error);
          }
        }

        // Update user profile with new photo URL
        await prisma.user_profiles.upsert({
          where: { user_id: userId },
          update: {
            profile_photo_url: cdnUrl,
            updated_at: new Date(),
          },
          create: {
            user_id: userId,
            profile_photo_url: cdnUrl,
          },
        });

        return reply.send({
          profile_photo_url: cdnUrl,
          uploaded_at: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Profile photo upload error:', error);
        return reply.code(500).send({
          message: 'Failed to upload profile photo',
        });
      }
    }
  );
}

