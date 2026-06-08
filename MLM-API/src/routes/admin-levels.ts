import { FastifyInstance } from 'fastify';
import { prisma } from '../config/prisma.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { checkPermission } from '../middleware/checkPermission.js';

export async function adminLevelsRoutes(app: FastifyInstance) {
  /**
   * @openapi
   * /api/v1/admin/levels:
   *   get:
   *     tags:
   *       - Admin Levels
   *     summary: List all levels (Admin)
   *     description: |
   *       Retrieve all levels with their titles, descriptions, rewards, business requirements,
   *       and commission information. Admin can view and manage all level configurations.
   *     operationId: listAllLevelsAdmin
   *     security:
   *       - adminAuth: []
   *     responses:
   *       '200':
   *         description: Levels retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 count:
   *                   type: number
   *                   example: 10
   *                 items:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       level:
   *                         type: number
   *                         example: 2
   *                       title:
   *                         type: string
   *                         example: "Company City Manager"
   *                       description:
   *                         type: string
   *                         nullable: true
   *                       reward:
   *                         type: string
   *                         nullable: true
   *                       spot_commission_percent:
   *                         type: number
   *                         nullable: true
   *                       monthly_royalty_percent:
   *                         type: number
   *                         nullable: true
   *                       business_requirement:
   *                         type: object
   *                         nullable: true
   *                       icon_url:
   *                         type: string
   *                         nullable: true
   *                       color:
   *                         type: string
   *                         nullable: true
   *                       created_at:
   *                         type: string
   *                         format: date-time
   *                       updated_at:
   *                         type: string
   *                         format: date-time
   *       '401':
   *         description: Unauthorized
   *       '500':
   *         description: Internal server error
   */
  app.get('/levels', {
    preHandler: [adminAuth, checkPermission('LEVELS_VIEW')],
    schema: {
      description: 'List all levels (Admin)',
      tags: ['Admin Levels'],
      summary: 'List Levels',
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
                  level: { type: 'number' },
                  title: { type: 'string' },
                  description: { type: ['string', 'null'] },
                  reward: { type: ['string', 'null'] },
                  spot_commission_percent: { type: ['number', 'null'] },
                  monthly_royalty_percent: { type: ['number', 'null'] },
                  // Allow arbitrary keys inside business_requirement so that
                  // required_leg_count / total_business etc are not stripped.
                  business_requirement: {
                    type: ['object', 'null'],
                    additionalProperties: true,
                  },
                  icon_url: { type: ['string', 'null'] },
                  color: { type: ['string', 'null'] },
                  created_at: { type: 'string' },
                  updated_at: { type: 'string' },
                },
              },
            },
          },
        },
      },
      security: [{ adminAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const levels = await prisma.levels.findMany({ 
        include: {
          commission_rules: true,
        },
        orderBy: { level: 'asc' } 
      });
      
      return reply.send({
        count: levels.length,
        items: levels.map(l => {
          const businessReq = l.business_requirement as any;
          return {
            level: l.level,
            title: l.title,
            description: l.description,
            reward: l.reward,
            spot_commission_percent: l.spot_commission_percent ? Number(l.spot_commission_percent) : null,
            monthly_royalty_percent: l.monthly_royalty_percent ? Number(l.monthly_royalty_percent) : null,
            business_requirement: {
              required_leg_count: businessReq?.required_leg_count || null,
              required_leg_min_amount: businessReq?.required_leg_min_amount || null,
              total_business: businessReq?.total_business || null,
              description: businessReq ? `Har ${businessReq.required_leg_count || 0} direct member ke niche se ₹${(businessReq.required_leg_min_amount || 0).toLocaleString('en-IN')} ka business (total ₹${(businessReq.total_business || 0).toLocaleString('en-IN')})` : null,
            },
            commission_rules: l.commission_rules.map(cr => ({
              id: cr.id,
              type: cr.type,
              percent: cr.percent ? Number(cr.percent) : null,
              fixed_amount: cr.fixed_amount ? Number(cr.fixed_amount) : null,
              eligibility: cr.eligibility,
            })),
            icon_url: l.icon_url,
            color: l.color,
            created_at: l.created_at.toISOString(),
            updated_at: l.updated_at.toISOString(),
          };
        })
      });
    } catch (error) {
      console.error('Error fetching levels (admin):', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/levels/{level}:
   *   get:
   *     tags:
   *       - Admin Levels
   *     summary: Get level details with commission rules
   *     description: |
   *       Retrieve detailed information about a specific level including commission rules,
   *       business requirements, and all configuration details.
   *     operationId: getLevelDetails
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: level
   *         required: true
   *         schema:
   *           type: integer
   *         description: Level number
   *     responses:
   *       '200':
   *         description: Level details retrieved successfully
   *       '404':
   *         description: Level not found
   */
  app.get('/levels/:level', {
    preHandler: [adminAuth, checkPermission('LEVELS_VIEW')],
    schema: {
      description: 'Get level details with commission rules',
      tags: ['Admin Levels'],
      summary: 'Get Level Details',
      params: {
        type: 'object',
        properties: {
          level: { type: 'number' },
        },
        required: ['level'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            level: { type: 'number' },
            title: { type: 'string' },
            description: { type: ['string', 'null'] },
            reward: { type: ['string', 'null'] },
            spot_commission_percent: { type: ['number', 'null'] },
            monthly_royalty_percent: { type: ['number', 'null'] },
            // Same here: keep full JSON structure from DB
            business_requirement: {
              type: 'object',
              additionalProperties: true,
            },
            commission_rules: { type: 'array' },
            icon_url: { type: ['string', 'null'] },
            color: { type: ['string', 'null'] },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
          },
        },
      },
      security: [{ adminAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const level = parseInt((req.params as any).level);
      
      const levelData = await prisma.levels.findUnique({
        where: { level },
        include: {
          commission_rules: true,
        },
      });

      if (!levelData) {
        return reply.code(404).send({ error: 'Level not found' });
      }

      const businessReq = levelData.business_requirement as any;
      
      return reply.send({
        level: levelData.level,
        title: levelData.title,
        description: levelData.description,
        reward: levelData.reward,
        spot_commission_percent: levelData.spot_commission_percent ? Number(levelData.spot_commission_percent) : null,
        monthly_royalty_percent: levelData.monthly_royalty_percent ? Number(levelData.monthly_royalty_percent) : null,
        business_requirement: {
          required_leg_count: businessReq?.required_leg_count || null,
          required_leg_min_amount: businessReq?.required_leg_min_amount || null,
          total_business: businessReq?.total_business || null,
          description: businessReq ? `Har ${businessReq.required_leg_count || 0} direct member ke niche se ₹${(businessReq.required_leg_min_amount || 0).toLocaleString('en-IN')} ka business (total ₹${(businessReq.total_business || 0).toLocaleString('en-IN')})` : null,
        },
        commission_rules: levelData.commission_rules.map(cr => ({
          id: cr.id,
          type: cr.type,
          percent: cr.percent ? Number(cr.percent) : null,
          fixed_amount: cr.fixed_amount ? Number(cr.fixed_amount) : null,
          eligibility: cr.eligibility,
        })),
        icon_url: levelData.icon_url,
        color: levelData.color,
        created_at: levelData.created_at.toISOString(),
        updated_at: levelData.updated_at.toISOString(),
      });
    } catch (error) {
      console.error('Error fetching level details:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/v1/admin/levels/{level}:
   *   put:
   *     tags:
   *       - Admin Levels
   *     summary: Update level details (Admin)
   *     description: |
   *       Update level configuration including title, description, reward, monthly earning,
   *       business requirements, and commission information.
   *     operationId: updateLevelAdmin
   *     security:
   *       - adminAuth: []
   *     parameters:
   *       - in: path
   *         name: level
   *         required: true
   *         schema:
   *           type: integer
   *           minimum: 0
   *           maximum: 9
   *         description: Level number (0-9)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               title:
   *                 type: string
   *               description:
   *                 type: string
   *                 nullable: true
   *               reward:
   *                 type: string
   *                 nullable: true
   *               spot_commission_percent:
   *                 type: number
   *                 nullable: true
   *               monthly_royalty_percent:
   *                 type: number
   *                 nullable: true
   *               business_requirement:
   *                 type: object
   *                 nullable: true
   *               icon_url:
   *                 type: string
   *                 nullable: true
   *               color:
   *                 type: string
   *                 nullable: true
   *     responses:
   *       '200':
   *         description: Level updated successfully
   *       '404':
   *         description: Level not found
   *       '401':
   *         description: Unauthorized
   *       '500':
   *         description: Internal server error
   */
  app.put('/levels/:level', {
    preHandler: [adminAuth, checkPermission('LEVELS_MANAGE')],
    schema: {
      description: 'Update level details (Admin)',
      tags: ['Admin Levels'],
      summary: 'Update Level',
      params: {
        type: 'object',
        properties: {
          level: { type: 'number' },
        },
        required: ['level'],
      },
      body: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: ['string', 'null'] },
          reward: { type: ['string', 'null'] },
          spot_commission_percent: { type: ['number', 'null'] },
          monthly_royalty_percent: { type: ['number', 'null'] },
          business_requirement: { type: ['object', 'null'] },
          icon_url: { type: ['string', 'null'] },
          color: { type: ['string', 'null'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            level: { type: 'number' },
            title: { type: 'string' },
            description: { type: ['string', 'null'] },
            reward: { type: ['string', 'null'] },
            spot_commission_percent: { type: ['number', 'null'] },
            monthly_royalty_percent: { type: ['number', 'null'] },
            business_requirement: { type: ['object', 'null'] },
            icon_url: { type: ['string', 'null'] },
            color: { type: ['string', 'null'] },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
      security: [{ adminAuth: [] }],
    },
  }, async (req, reply) => {
    try {
      const level = parseInt((req.params as any).level);
      const body = req.body as any;
      
      // Check if level exists
      const existing = await prisma.levels.findUnique({ where: { level } });
      if (!existing) {
        return reply.code(404).send({ error: 'Level not found' });
      }
      
      const updateData: any = {
        updated_at: new Date(),
      };
      
      if (body.title !== undefined) updateData.title = body.title;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.reward !== undefined) updateData.reward = body.reward;
      if (body.spot_commission_percent !== undefined) updateData.spot_commission_percent = body.spot_commission_percent;
      if (body.monthly_royalty_percent !== undefined) updateData.monthly_royalty_percent = body.monthly_royalty_percent;
      if (body.business_requirement !== undefined) updateData.business_requirement = body.business_requirement;
      if (body.icon_url !== undefined) updateData.icon_url = body.icon_url;
      if (body.color !== undefined) updateData.color = body.color;

      const updated = await prisma.levels.update({
        where: { level },
        data: updateData,
        include: {
          commission_rules: true,
        },
      });

      const businessReq = updated.business_requirement as any;
      
      return reply.send({
        level: updated.level,
        title: updated.title,
        description: updated.description,
        reward: updated.reward,
        spot_commission_percent: updated.spot_commission_percent ? Number(updated.spot_commission_percent) : null,
        monthly_royalty_percent: updated.monthly_royalty_percent ? Number(updated.monthly_royalty_percent) : null,
        business_requirement: {
          required_leg_count: businessReq?.required_leg_count || null,
          required_leg_min_amount: businessReq?.required_leg_min_amount || null,
          total_business: businessReq?.total_business || null,
          description: businessReq ? `Har ${businessReq.required_leg_count || 0} direct member ke niche se ₹${(businessReq.required_leg_min_amount || 0).toLocaleString('en-IN')} ka business (total ₹${(businessReq.total_business || 0).toLocaleString('en-IN')})` : null,
        },
        commission_rules: updated.commission_rules.map(cr => ({
          id: cr.id,
          type: cr.type,
          percent: cr.percent ? Number(cr.percent) : null,
          fixed_amount: cr.fixed_amount ? Number(cr.fixed_amount) : null,
          eligibility: cr.eligibility,
        })),
        icon_url: updated.icon_url,
        color: updated.color,
        created_at: updated.created_at.toISOString(),
        updated_at: updated.updated_at.toISOString(),
      });
    } catch (error) {
      console.error('Error updating level (admin):', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

