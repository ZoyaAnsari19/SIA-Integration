import { FastifyInstance } from 'fastify';
import { prisma } from '../config/prisma.js';
import { requireUser } from '../middleware/jwt.js';

/**
 * Public route for users to get active company bank account details
 */
export async function companyBankRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/company-bank/active
   * Get active company bank account for deposits
   */
  app.get('/company-bank/active', {
    preHandler: requireUser,
    schema: {
      description: 'Get active company bank account details for deposits',
      tags: ['Company Bank'],
      summary: 'Get Active Company Bank Account',
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            bank_name: { type: 'string' },
            bank_ac_holder: { type: 'string' },
            bank_ac_no: { type: 'string' },
            bank_ifsc: { type: 'string' },
            bank_branch: { type: ['string', 'null'] },
            bank_upi: { type: ['string', 'null'] },
            qr_image: { type: ['string', 'null'] },
          },
        },
        404: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      // Get the first active company bank account
      const bankAccount = await prisma.company_bank_accounts.findFirst({
        where: { is_active: true },
        orderBy: { created_at: 'desc' },
      });

      if (!bankAccount) {
        return reply.code(404).send({
          message: 'No active bank account found',
        });
      }

      return reply.send({
        id: bankAccount.id,
        bank_name: bankAccount.bank_name,
        bank_ac_holder: bankAccount.bank_ac_holder,
        bank_ac_no: bankAccount.bank_ac_no,
        bank_ifsc: bankAccount.bank_ifsc,
        bank_branch: bankAccount.bank_branch,
        bank_upi: bankAccount.bank_upi,
        qr_image: bankAccount.qr_image,
      });
    } catch (error: any) {
      console.error('Error fetching company bank account:', error);
      return reply.code(500).send({
        error: 'internal_server_error',
        message: error.message,
      });
    }
  });
}

