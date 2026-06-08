import { FastifyInstance } from 'fastify';
import { requireUser } from '../middleware/jwt.js';
import { prisma } from '../config/prisma.js';

export async function userDetailsRoutes(app: FastifyInstance) {
  // GET /api/v1/user/details/:receiverId - Get user details by ID
  app.get(
    '/details/:receiverId',
    {
      preHandler: [requireUser],
      schema: {
        description: 'Get user details by ID (any user)',
        tags: ['User'],
        params: {
          type: 'object',
          required: ['receiverId'],
          properties: {
            receiverId: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string' },
              phone: { type: ['string', 'null'] },
              profile_photo_url: { type: ['string', 'null'] },
              kyc_status: { type: ['string', 'null'] },
              status: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
              relationship: { type: 'string' },
              depth: { type: 'number' },
            },
          },
          400: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
          404: {
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
        const { receiverId } = request.params as { receiverId: string };

        // Try to find user by numeric ID, display_id, or email
        let targetUser = null;
        let targetUserId: bigint | null = null;

        // Try as numeric ID first
        const receiverIdNum = parseInt(receiverId, 10);
        if (!isNaN(receiverIdNum)) {
          targetUserId = BigInt(receiverIdNum);
          targetUser = await prisma.users.findUnique({
            where: { id: targetUserId },
          });
        }

        // If not found, try as display_id
        if (!targetUser) {
          targetUser = await prisma.users.findUnique({
            where: { display_id: receiverId },
          });
          if (targetUser) {
            targetUserId = targetUser.id;
          }
        }

        // If still not found, try as email
        if (!targetUser) {
          targetUser = await prisma.users.findFirst({
            where: { email: receiverId },
          });
          if (targetUser) {
            targetUserId = targetUser.id;
          }
        }

        if (!targetUser || !targetUserId) {
          return reply.code(404).send({ message: 'User not found' });
        }

        // Check if target user exists (get profile and KYC)
        const [userProfile, kycDoc] = await Promise.all([
          prisma.user_profiles.findUnique({
            where: { user_id: targetUserId },
            select: { phone: true, profile_photo_url: true },
          }),
          prisma.kyc_documents.findFirst({
            where: { user_id: targetUserId },
            select: { status: true },
          }),
        ]);

        // Check relationship for informational purposes (not for access control)
        let relationship = 'none';
        let depth = 0;

        // Check if target is self
        if (targetUserId === userId) {
          relationship = 'self';
          depth = 0;
        } else {
        // Check if target is upline
        const uplineCheck = await prisma.user_tree_paths.findFirst({
          where: {
            ancestor_id: targetUserId,
            descendant_id: userId,
          },
        });

        if (uplineCheck) {
          relationship = 'upline';
          depth = uplineCheck.depth;
        } else {
          // Check if target is downline
          const downlineCheck = await prisma.user_tree_paths.findFirst({
            where: {
              ancestor_id: userId,
              descendant_id: targetUserId,
            },
          });

          if (downlineCheck) {
            relationship = 'downline';
            depth = downlineCheck.depth;
          }
        }
        }

        // Allow access to any user (removed team restriction for P2P transfers)

        return reply.send({
          id: targetUser.id.toString(),
          name: targetUser.name,
          email: targetUser.email,
          phone: userProfile?.phone || null,
          profile_photo_url: userProfile?.profile_photo_url || null,
          kyc_status: kycDoc?.status || null,
          status: targetUser.status,
          created_at: targetUser.created_at.toISOString(),
          relationship,
          depth,
        });
      } catch (error) {
        console.error('User details error:', error);
        return reply.code(500).send({
          message: 'Failed to fetch user details',
        });
      }
    }
  );
}

