import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { superAdminAuth } from '../middleware/superAdminAuth.js';

// Constants
const PIN_LENGTH = 4;
const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_DURATION_MINUTES = 15;

// Validation schemas
const setPinSchema = z.object({
  sub_admin_id: z.string().transform((val) => BigInt(val)),
  pin: z.string().length(PIN_LENGTH).regex(/^\d+$/, 'PIN must contain only digits'),
});

const verifyPinSchema = z.object({
  pin: z.string().length(PIN_LENGTH).regex(/^\d+$/, 'PIN must contain only digits'),
});

const resetPinSchema = z.object({
  sub_admin_id: z.string().transform((val) => BigInt(val)),
  new_pin: z.string().length(PIN_LENGTH).regex(/^\d+$/, 'PIN must contain only digits'),
});

export async function adminPinRoutes(app: FastifyInstance) {
  /**
   * Set PIN for a sub-admin (Super Admin only)
   */
  app.post('/pin/set', {
    preHandler: [adminAuth, superAdminAuth],
    schema: {
      description: 'Set action PIN for a sub-admin (Super Admin only)',
      tags: ['Admin PIN'],
      summary: 'Set Sub-Admin PIN',
      body: {
        type: 'object',
        required: ['sub_admin_id', 'pin'],
        properties: {
          sub_admin_id: { type: 'string', description: 'Sub-admin user ID' },
          pin: { type: 'string', minLength: PIN_LENGTH, maxLength: PIN_LENGTH, description: '4-digit PIN' },
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
      },
    },
  }, async (req, reply) => {
    try {
      const { sub_admin_id, pin } = setPinSchema.parse(req.body);
      const admin = (req as any).admin;

      // Verify sub-admin exists and is a SUB_ADMIN
      const subAdmin = await prisma.users.findUnique({
        where: { id: sub_admin_id },
        select: { id: true, role: true, name: true, email: true },
      });

      if (!subAdmin) {
        return reply.code(404).send({
          success: false,
          message: 'Sub-admin not found',
        });
      }

      if (subAdmin.role !== 'SUB_ADMIN') {
        return reply.code(400).send({
          success: false,
          message: 'User is not a sub-admin',
        });
      }

      // Store PIN as plain text (admin can view it)
      await prisma.users.update({
        where: { id: sub_admin_id },
        data: {
          action_pin: pin, // Plain text PIN
          action_pin_failed_attempts: 0,
          action_pin_locked_until: null,
          action_pin_set_at: new Date(),
          action_pin_set_by: BigInt(admin.user_id),
        },
      });

      console.log(`✅ [PIN] PIN set for sub-admin ${subAdmin.email} by super-admin ${admin.email}`);

      return reply.send({
        success: true,
        message: `PIN set successfully for ${subAdmin.name || subAdmin.email}`,
      });
    } catch (error: any) {
      console.error('Error setting PIN:', error);
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Invalid request data',
          errors: error.errors,
        });
      }

      return reply.code(500).send({
        success: false,
        message: 'Failed to set PIN',
      });
    }
  });

  /**
   * Reset PIN for a sub-admin (Super Admin only)
   */
  app.post('/pin/reset', {
    preHandler: [adminAuth, superAdminAuth],
    schema: {
      description: 'Reset action PIN for a sub-admin (Super Admin only)',
      tags: ['Admin PIN'],
      summary: 'Reset Sub-Admin PIN',
      body: {
        type: 'object',
        required: ['sub_admin_id', 'new_pin'],
        properties: {
          sub_admin_id: { type: 'string', description: 'Sub-admin user ID' },
          new_pin: { type: 'string', minLength: PIN_LENGTH, maxLength: PIN_LENGTH, description: 'New 4-digit PIN' },
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
      },
    },
  }, async (req, reply) => {
    try {
      const { sub_admin_id, new_pin } = resetPinSchema.parse(req.body);
      const admin = (req as any).admin;

      // Verify sub-admin exists
      const subAdmin = await prisma.users.findUnique({
        where: { id: sub_admin_id },
        select: { id: true, role: true, name: true, email: true },
      });

      if (!subAdmin) {
        return reply.code(404).send({
          success: false,
          message: 'Sub-admin not found',
        });
      }

      if (subAdmin.role !== 'SUB_ADMIN') {
        return reply.code(400).send({
          success: false,
          message: 'User is not a sub-admin',
        });
      }

      // Update sub-admin with new PIN (plain text) and reset lockout
      await prisma.users.update({
        where: { id: sub_admin_id },
        data: {
          action_pin: new_pin, // Plain text PIN
          action_pin_failed_attempts: 0,
          action_pin_locked_until: null,
          action_pin_set_at: new Date(),
          action_pin_set_by: BigInt(admin.user_id),
        },
      });

      console.log(`✅ [PIN] PIN reset for sub-admin ${subAdmin.email} by super-admin ${admin.email}`);

      return reply.send({
        success: true,
        message: `PIN reset successfully for ${subAdmin.name || subAdmin.email}`,
      });
    } catch (error: any) {
      console.error('Error resetting PIN:', error);
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Invalid request data',
          errors: error.errors,
        });
      }

      return reply.code(500).send({
        success: false,
        message: 'Failed to reset PIN',
      });
    }
  });

  /**
   * Verify PIN (Sub-admin verifies their own PIN before critical action)
   */
  app.post('/pin/verify', {
    preHandler: [adminAuth],
    schema: {
      description: 'Verify action PIN before performing critical action',
      tags: ['Admin PIN'],
      summary: 'Verify PIN',
      body: {
        type: 'object',
        required: ['pin'],
        properties: {
          pin: { type: 'string', minLength: PIN_LENGTH, maxLength: PIN_LENGTH, description: '4-digit PIN' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            verified: { type: 'boolean' },
            remaining_attempts: { type: 'number' },
            locked_until: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const { pin } = verifyPinSchema.parse(req.body);
      const admin = (req as any).admin;
      const adminUserId = BigInt(admin.user_id);

      // Get admin user with PIN info
      const adminUser = await prisma.users.findUnique({
        where: { id: adminUserId },
        select: {
          id: true,
          role: true,
          action_pin: true,
          action_pin_failed_attempts: true,
          action_pin_locked_until: true,
        },
      });

      if (!adminUser) {
        return reply.code(404).send({
          success: false,
          message: 'Admin user not found',
          verified: false,
        });
      }

      // Super admins don't need PIN verification
      if (adminUser.role === 'SUPER_ADMIN') {
        return reply.send({
          success: true,
          message: 'Super admin - PIN not required',
          verified: true,
        });
      }

      // Check if PIN is set
      if (!adminUser.action_pin) {
        return reply.code(400).send({
          success: false,
          message: 'Action PIN not set. Please contact super admin.',
          verified: false,
        });
      }

      // Check if account is locked
      if (adminUser.action_pin_locked_until && new Date() < new Date(adminUser.action_pin_locked_until)) {
        const lockedUntil = new Date(adminUser.action_pin_locked_until);
        const remainingMinutes = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
        
        return reply.code(423).send({
          success: false,
          message: `PIN locked due to too many failed attempts. Try again in ${remainingMinutes} minutes.`,
          verified: false,
          remaining_attempts: 0,
          locked_until: lockedUntil.toISOString(),
        });
      }

      // Verify PIN (plain text comparison)
      const isValidPin = pin === adminUser.action_pin;

      if (isValidPin) {
        // Reset failed attempts on successful verification
        await prisma.users.update({
          where: { id: adminUserId },
          data: {
            action_pin_failed_attempts: 0,
            action_pin_locked_until: null,
          },
        });

        return reply.send({
          success: true,
          message: 'PIN verified successfully',
          verified: true,
        });
      } else {
        // Increment failed attempts
        const newFailedAttempts = (adminUser.action_pin_failed_attempts || 0) + 1;
        const remainingAttempts = MAX_FAILED_ATTEMPTS - newFailedAttempts;

        let updateData: any = {
          action_pin_failed_attempts: newFailedAttempts,
        };

        // Lock account if max attempts reached
        if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
          const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
          updateData.action_pin_locked_until = lockUntil;

          await prisma.users.update({
            where: { id: adminUserId },
            data: updateData,
          });

          console.warn(`⚠️ [PIN] Sub-admin ${admin.email} locked out after ${MAX_FAILED_ATTEMPTS} failed PIN attempts`);

          return reply.code(423).send({
            success: false,
            message: `Too many failed attempts. PIN locked for ${LOCKOUT_DURATION_MINUTES} minutes.`,
            verified: false,
            remaining_attempts: 0,
            locked_until: lockUntil.toISOString(),
          });
        }

        await prisma.users.update({
          where: { id: adminUserId },
          data: updateData,
        });

        console.warn(`⚠️ [PIN] Failed PIN attempt for sub-admin ${admin.email}. Attempts: ${newFailedAttempts}/${MAX_FAILED_ATTEMPTS}`);

        return reply.code(401).send({
          success: false,
          message: `Invalid PIN. ${remainingAttempts} attempts remaining.`,
          verified: false,
          remaining_attempts: remainingAttempts,
        });
      }
    } catch (error: any) {
      console.error('Error verifying PIN:', error);
      
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Invalid PIN format',
          verified: false,
        });
      }

      return reply.code(500).send({
        success: false,
        message: 'Failed to verify PIN',
        verified: false,
      });
    }
  });

  /**
   * Check PIN status (Sub-admin checks if they have PIN set)
   */
  app.get('/pin/status', {
    preHandler: [adminAuth],
    schema: {
      description: 'Check if current admin has action PIN set',
      tags: ['Admin PIN'],
      summary: 'Check PIN Status',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            has_pin: { type: 'boolean' },
            requires_pin: { type: 'boolean' },
            is_locked: { type: 'boolean' },
            locked_until: { type: 'string', nullable: true },
            pin_set_at: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const admin = (req as any).admin;
      const adminUserId = BigInt(admin.user_id);

      const adminUser = await prisma.users.findUnique({
        where: { id: adminUserId },
        select: {
          role: true,
          action_pin: true,
          action_pin_locked_until: true,
          action_pin_set_at: true,
        },
      });

      if (!adminUser) {
        return reply.code(404).send({
          success: false,
          message: 'Admin user not found',
        });
      }

      console.log(`[PIN STATUS] Checking PIN status for user ${admin.user_id}, role: ${adminUser.role}`)

      // Super admins don't need PIN
      if (adminUser.role === 'SUPER_ADMIN') {
        console.log(`[PIN STATUS] User is SUPER_ADMIN - returning requires_pin: false`)
        return reply.send({
          success: true,
          has_pin: false,
          requires_pin: false,
          is_locked: false,
          locked_until: null,
          pin_set_at: null,
        });
      }

      const isLocked = adminUser.action_pin_locked_until 
        ? new Date() < new Date(adminUser.action_pin_locked_until)
        : false;

      const hasPin = !!adminUser.action_pin
      console.log(`[PIN STATUS] User is SUB_ADMIN - has_pin: ${hasPin}, is_locked: ${isLocked}, returning requires_pin: true`)

      return reply.send({
        success: true,
        has_pin: hasPin,
        requires_pin: true,
        is_locked: isLocked,
        locked_until: isLocked ? adminUser.action_pin_locked_until?.toISOString() : null,
        pin_set_at: adminUser.action_pin_set_at?.toISOString() || null,
      });
    } catch (error: any) {
      console.error('Error checking PIN status:', error);
      return reply.code(500).send({
        success: false,
        message: 'Failed to check PIN status',
      });
    }
  });

  /**
   * Get sub-admin PIN info (Super Admin only)
   */
  app.get('/pin/info/:sub_admin_id', {
    preHandler: [adminAuth, superAdminAuth],
    schema: {
      description: 'Get PIN info for a sub-admin (Super Admin only)',
      tags: ['Admin PIN'],
      summary: 'Get Sub-Admin PIN Info',
      params: {
        type: 'object',
        required: ['sub_admin_id'],
        properties: {
          sub_admin_id: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            sub_admin_id: { type: 'string' },
            sub_admin_name: { type: 'string', nullable: true },
            sub_admin_email: { type: 'string', nullable: true },
            has_pin: { type: 'boolean' },
            pin_value: { type: 'string', nullable: true }, // Show actual PIN to admin
            is_locked: { type: 'boolean' },
            locked_until: { type: 'string', nullable: true },
            failed_attempts: { type: 'number' },
            pin_set_at: { type: 'string', nullable: true },
            pin_set_by_name: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (req, reply) => {
    try {
      const { sub_admin_id } = req.params as { sub_admin_id: string };
      const subAdminId = BigInt(sub_admin_id);

      const subAdmin = await prisma.users.findUnique({
        where: { id: subAdminId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          action_pin: true,
          action_pin_failed_attempts: true,
          action_pin_locked_until: true,
          action_pin_set_at: true,
          action_pin_set_by: true,
        },
      });

      if (!subAdmin) {
        return reply.code(404).send({
          success: false,
          message: 'Sub-admin not found',
        });
      }

      if (subAdmin.role !== 'SUB_ADMIN') {
        return reply.code(400).send({
          success: false,
          message: 'User is not a sub-admin',
        });
      }

      // Get who set the PIN
      let pinSetByName = null;
      if (subAdmin.action_pin_set_by) {
        const setter = await prisma.users.findUnique({
          where: { id: subAdmin.action_pin_set_by },
          select: { name: true, email: true },
        });
        pinSetByName = setter?.name || setter?.email || null;
      }

      const isLocked = subAdmin.action_pin_locked_until 
        ? new Date() < new Date(subAdmin.action_pin_locked_until)
        : false;

      return reply.send({
        success: true,
        sub_admin_id: subAdmin.id.toString(),
        sub_admin_name: subAdmin.name,
        sub_admin_email: subAdmin.email,
        has_pin: !!subAdmin.action_pin,
        pin_value: subAdmin.action_pin || null, // Show actual PIN to admin
        is_locked: isLocked,
        locked_until: isLocked ? subAdmin.action_pin_locked_until?.toISOString() : null,
        failed_attempts: subAdmin.action_pin_failed_attempts || 0,
        pin_set_at: subAdmin.action_pin_set_at?.toISOString() || null,
        pin_set_by_name: pinSetByName,
      });
    } catch (error: any) {
      console.error('Error getting PIN info:', error);
      return reply.code(500).send({
        success: false,
        message: 'Failed to get PIN info',
      });
    }
  });

  /**
   * Unlock PIN (Super Admin only - removes lockout)
   */
  app.post('/pin/unlock', {
    preHandler: [adminAuth, superAdminAuth],
    schema: {
      description: 'Unlock PIN for a sub-admin (Super Admin only)',
      tags: ['Admin PIN'],
      summary: 'Unlock Sub-Admin PIN',
      body: {
        type: 'object',
        required: ['sub_admin_id'],
        properties: {
          sub_admin_id: { type: 'string', description: 'Sub-admin user ID' },
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
      },
    },
  }, async (req, reply) => {
    try {
      const { sub_admin_id } = req.body as { sub_admin_id: string };
      const subAdminId = BigInt(sub_admin_id);
      const admin = (req as any).admin;

      const subAdmin = await prisma.users.findUnique({
        where: { id: subAdminId },
        select: { id: true, role: true, name: true, email: true },
      });

      if (!subAdmin) {
        return reply.code(404).send({
          success: false,
          message: 'Sub-admin not found',
        });
      }

      if (subAdmin.role !== 'SUB_ADMIN') {
        return reply.code(400).send({
          success: false,
          message: 'User is not a sub-admin',
        });
      }

      await prisma.users.update({
        where: { id: subAdminId },
        data: {
          action_pin_failed_attempts: 0,
          action_pin_locked_until: null,
        },
      });

      console.log(`✅ [PIN] PIN unlocked for sub-admin ${subAdmin.email} by super-admin ${admin.email}`);

      return reply.send({
        success: true,
        message: `PIN unlocked for ${subAdmin.name || subAdmin.email}`,
      });
    } catch (error: any) {
      console.error('Error unlocking PIN:', error);
      return reply.code(500).send({
        success: false,
        message: 'Failed to unlock PIN',
      });
    }
  });
}
