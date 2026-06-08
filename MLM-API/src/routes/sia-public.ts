import { FastifyInstance } from 'fastify';
import { prisma } from '../config/prisma.js';

/**
 * Public SIA ecosystem routes.
 * Used by other projects (e.g. Secure Pharma) to validate refer IDs —
 * only SIA users can be used as referrers in distributor/franchise applications.
 * No authentication required; safe to call from external backends/frontends.
 */
export async function siaPublicRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/sia/validate-refer/:displayId
   * Public: Check if the given display_id (Refer ID) belongs to an SIA user.
   * Returns display_id and name so the caller can show "Valid SIA referrer" and name.
   * Use this from Secure Pharma (or any SIA ecosystem app) to allow only SIA refer IDs in refer field.
   */
  app.get('/validate-refer/:displayId', {
    schema: {
      description:
        'Validate that a Refer ID belongs to an SIA user. Use from Secure Pharma / other SIA ecosystem apps to allow only SIA users as referrers. No auth required.',
      tags: ['SIA Public'],
      summary: 'Validate SIA Refer ID',
      params: {
        type: 'object',
        required: ['displayId'],
        properties: {
          displayId: {
            type: 'string',
            description: 'Refer ID / display ID (e.g. SIA0011)',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            is_sia_user: { type: 'boolean', const: true },
            display_id: { type: 'string', description: 'User display ID (Refer ID)' },
            name: { type: ['string', 'null'], description: 'User name for display' },
          },
        },
        404: {
          type: 'object',
          properties: {
            is_sia_user: { type: 'boolean', const: false },
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { displayId } = request.params as { displayId: string };
    const trimmed = (displayId || '').trim();
    if (!trimmed) {
      return reply.code(400).send({
        is_sia_user: false,
        error: 'displayId is required',
      });
    }

    const user = await prisma.users.findFirst({
      where: {
        display_id: { equals: trimmed, mode: 'insensitive' },
        status: 'active',
        is_disqualified: false,
      },
      select: {
        display_id: true,
        name: true,
      },
    });

    if (!user || !user.display_id) {
      return reply.code(404).send({
        is_sia_user: false,
        error: 'Refer ID not found or not a valid SIA user',
      });
    }

    return reply.send({
      is_sia_user: true,
      display_id: user.display_id,
      name: user.name,
    });
  });
}
