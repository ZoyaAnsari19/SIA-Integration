 import { FastifyReply, FastifyRequest } from 'fastify';
import jwt, { Secret } from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'dev-secret';

/**
 * Middleware to ensure the request is from a SUPER_ADMIN user
 * Must be used after adminAuth middleware
 */
export async function superAdminAuth(req: FastifyRequest, reply: FastifyReply) {
  const admin = (req as any).admin;
  
  if (!admin) {
    return reply.code(401).send({ error: 'unauthorized', message: 'Admin authentication required' });
  }

  // Check if role is SUPER_ADMIN from JWT
  if (admin.role === 'SUPER_ADMIN') {
    return; // Success
  }

  // Fallback: Check database if user_id is available
  if (admin.user_id) {
    try {
      const userId = BigInt(admin.user_id);
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { role: true }
      });

      if (user && (user.role === 'SUPER_ADMIN' as any)) {
        return; // Success
      }
    } catch (e) {
      // Error checking database, continue to reject
    }
  }

  // Not a SUPER_ADMIN
  return reply.code(403).send({ 
    error: 'forbidden', 
    message: 'Super admin access required. Only SUPER_ADMIN can manage sub-admins.' 
  });
}

