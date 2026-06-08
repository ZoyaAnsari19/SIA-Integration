import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../config/prisma.js';

/**
 * Middleware to check if admin user has a specific permission
 * Must be used after adminAuth middleware
 */
export function checkPermission(permissionKey: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const admin = (req as any).admin;
    
    if (!admin) {
      return reply.code(401).send({ error: 'unauthorized', message: 'Admin authentication required' });
    }

    // SUPER_ADMIN has all permissions
    if (admin.role === 'SUPER_ADMIN') {
      return; // Success - SUPER_ADMIN bypasses permission checks
    }

    // For SUB_ADMIN, check permission
    if (admin.role === 'SUB_ADMIN' && admin.user_id) {
      try {
        const userId = BigInt(admin.user_id);
        
        // Check if user has the required permission
        const hasPermission = await prisma.admin_user_permissions.findUnique({
          where: {
            admin_user_id_permission_key: {
              admin_user_id: userId,
              permission_key: permissionKey
            }
          }
        });

        if (!hasPermission) {
          return reply.code(403).send({ 
            error: 'forbidden', 
            message: `Permission required: ${permissionKey}` 
          });
        }

        return; // Success - permission found
      } catch (e) {
        console.error('Error checking permission:', e);
        return reply.code(500).send({ 
          error: 'internal_error', 
          message: 'Failed to check permission' 
        });
      }
    }

    // Not a valid admin role
    return reply.code(403).send({ 
      error: 'forbidden', 
      message: 'Permission check failed' 
    });
  };
}

/**
 * Middleware to check if admin has ANY of the given permissions.
 * Use when an endpoint should be allowed for multiple roles (e.g. package list for User Details filter).
 */
export function checkPermissionAny(permissionKeys: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const admin = (req as any).admin;

    if (!admin) {
      return reply.code(401).send({ error: 'unauthorized', message: 'Admin authentication required' });
    }

    if (admin.role === 'SUPER_ADMIN') {
      return;
    }

    if (admin.role === 'SUB_ADMIN' && admin.user_id) {
      try {
        const userId = BigInt(admin.user_id);
        const hasAny = await prisma.admin_user_permissions.findFirst({
          where: {
            admin_user_id: userId,
            permission_key: { in: permissionKeys }
          }
        });
        if (!hasAny) {
          return reply.code(403).send({
            error: 'forbidden',
            message: `One of these permissions required: ${permissionKeys.join(', ')}`
          });
        }
        return;
      } catch (e) {
        console.error('Error checking permission:', e);
        return reply.code(500).send({ error: 'internal_error', message: 'Failed to check permission' });
      }
    }

    return reply.code(403).send({ error: 'forbidden', message: 'Permission check failed' });
  };
}

/**
 * Helper for route handlers: returns true if the current admin has the given permission.
 * Use when permission check depends on request body (e.g. allow update but require extra permission for certain fields).
 */
export async function adminHasPermission(req: FastifyRequest, permissionKey: string): Promise<boolean> {
  const admin = (req as any).admin;
  if (!admin) return false;
  if (admin.role === 'SUPER_ADMIN') return true;
  if (admin.role !== 'SUB_ADMIN' || !admin.user_id) return false;
  const has = await prisma.admin_user_permissions.findUnique({
    where: {
      admin_user_id_permission_key: {
        admin_user_id: BigInt(admin.user_id),
        permission_key: permissionKey,
      },
    },
  });
  return !!has;
}

