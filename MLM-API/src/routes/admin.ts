import { FastifyInstance } from 'fastify';
import { boss } from '../config/pgboss';
import { adminAuth } from '../middleware/adminAuth';

export async function adminRoutes(app: FastifyInstance) {
  app.post('/release-pending', { preHandler: adminAuth }, async (_req, reply) => {
    await boss.publish('eligibility-check', {});
    return reply.send({ ok: true, message: 'Eligibility/pending release job queued' });
  });
}


